# Vis-Network Mode Data Management Analysis

## Current Implementation

### Architecture Overview

The vis-network system uses **`VisModeStateStore`** class to manage three independent mode states:
- **Normal Mode** (`'normal'`)
- **Node Mode** (`'node'`)
- **Edge Mode** (`'edge'`)

### Key Components

#### 1. VisModeStateStore Class (Line 796-1027)

**Data Storage Structure:**
```javascript
this.state = {
    modes: {
        normal: { nodes: [], edges: [], ... },
        node: { nodes: [], edges: [], ... },
        edge: { nodes: [], edges: [], ... }
    },
    settings: null,
    meta: { nodeCount, edgeCount }
}
```

#### 2. Core Methods

**`capture(mode)` (Line 847-902)**
- Captures current graph state for specified mode
- Saves ALL properties:
  - **Nodes**: position (x, y), color, icon, font, labelStyle, fixed state
  - **Edges**: color, all edge properties
  - **Focus State**: customFocusAlpha, customFocusDepth, selectedNodeIds, lockedEdgeIds
- Deep clones data to avoid reference issues
- Persists to project storage

**`apply(mode)` (Line 904-1024)**
- Loads saved state from `this.state.modes[mode]`
- Validates data integrity (node/edge count, ID matching)
- Uses `dataset.nodes.update()` and `dataset.edges.update()` to restore
- Restores focus states and selections
- Includes safety checks to prevent duplicate data

**`setToolbarMode(mode)` (Line 2574-2623)**
- Core switching logic:
  ```javascript
  this.modeStateStore.capture(prevMode);  // Save current mode
  this.modeStateStore.apply(nextMode);    // Load target mode
  ```

### Data Independence

**Good:** Each mode has separate snapshot in `this.state.modes[mode]`

**Saved Properties Per Mode:**
1. Node positions (x, y)
2. Node colors, sizes, styles
3. Edge colors, widths, styles
4. Transparency/alpha values
5. Focus states
6. Selected node/edge IDs
7. Custom focus depth maps

### Potential Issues

#### Issue 1: Direct Data Modifications
Some operations directly call `dataset.nodes.update()` or `dataset.edges.update()` without going through capture/apply:
- Line 434: Label rendering
- Line 3165-3166: Apply normal mode styles
- Line 3249-3250: Apply normal mode styles
- Line 4626-4632: Update style
- Line 4968-4969: Reset base colors
- Line 5037-5038: Apply depth mode
- And many more...

**Impact:** Direct updates bypass the mode state store, potentially causing:
- Mode A changes affecting Mode B when switching back
- Lost state when not captured before modification

#### Issue 2: Shared State Objects
The code uses `getEdgeFocusState()` which returns a single state object:
```javascript
const state = manager.getEdgeFocusState();
state.baseNodeColors.clear();
state.baseEdgeColors.clear();
```

**Impact:** If state is shared across modes, modifications in one mode affect others.

#### Issue 3: Position Persistence
Node positions are captured, but physics simulation may continue running:
- Fixed positions: `fixed: node.fixed ?? null` (Line 869)
- No explicit physics stop when capturing

**Impact:** Positions may drift between mode switches if physics enabled.

#### Issue 4: Timing Issues
Mode store operations are async but some direct updates are sync:
```javascript
this._modeStoreReady.then(() => {
    applyForMode();  // Async
});

// But elsewhere:
dataset.nodes.update(updates);  // Sync, immediate
```

**Impact:** Race conditions between mode restoration and direct updates.

## Recommendations

### 1. Centralize All Data Updates
**Problem:** 50+ direct `dataset.nodes.update()` calls bypass mode store

**Solution:** Create wrapper methods:
```javascript
updateNodesWithCapture(updates) {
    const dataset = this.visNetwork?.body?.data;
    dataset.nodes.update(updates);
    if (this._toolbarMode) {
        this.modeStateStore.capture(this._toolbarMode);
    }
}
```

### 2. Separate State Objects Per Mode
**Problem:** `getEdgeFocusState()` returns shared state

**Solution:** Store state separately per mode:
```javascript
this.modeStates = {
    normal: { baseNodeColors: new Map(), ... },
    node: { baseNodeColors: new Map(), ... },
    edge: { baseNodeColors: new Map(), ... }
}
```

### 3. Freeze Physics on Mode Switch
**Problem:** Positions drift during mode switch

**Solution:**
```javascript
capture(mode) {
    // Disable physics
    this.manager.visNetwork.setOptions({
        physics: { enabled: false }
    });

    // Get final positions
    const positions = this.manager.visNetwork.getPositions();
    // ... save state
}
```

### 4. Auto-Capture Before Direct Updates
**Problem:** Many operations forget to capture before modifying

**Solution:** Add auto-capture wrapper:
```javascript
withCapture(fn) {
    const prevMode = this._toolbarMode || 'normal';
    const result = fn();
    this.modeStateStore.capture(prevMode);
    return result;
}
```

### 5. Validation System
**Problem:** No way to verify mode independence

**Solution:** Add test method:
```javascript
verifyModeIndependence() {
    const modes = ['normal', 'node', 'edge'];
    modes.forEach(mode => {
        const snapshot = this.state.modes[mode];
        console.log(`${mode}: ${snapshot.nodes.length} nodes, ${snapshot.edges.length} edges`);
        console.log(`  First node color:`, snapshot.nodes[0]?.color);
        console.log(`  First node pos:`, snapshot.nodes[0]?.x, snapshot.nodes[0]?.y);
    });
}
```

## Critical Action Items

1. **Audit all `dataset.nodes.update()` and `dataset.edges.update()` calls** (~50 locations)
2. **Add auto-capture after modifications** in critical paths
3. **Separate state objects** for baseNodeColors, baseEdgeColors per mode
4. **Add mode switch validation** to detect data leakage
5. **Document which operations should/should not trigger capture**

## Testing Checklist

To verify mode independence:
- [ ] Enter node mode, change node positions, switch to edge mode → positions should revert
- [ ] In node mode, fade nodes, switch to normal → opacity should restore
- [ ] In edge mode, change edge colors, switch to node mode → colors should revert
- [ ] Make changes in normal, switch to node, switch back → changes should persist
- [ ] Check that view position (pan/zoom) is also independent per mode
- [ ] Verify no data duplication after multiple mode switches

## Current Status

**Architecture:** ✅ Good foundation with VisModeStateStore

**Implementation:** ⚠️ Partial - many direct updates bypass the store

**Data Independence:** ⚠️ Mostly independent, but shared state objects and direct updates can cause leakage

**Recommendation:** Refactor to centralize all data updates through the mode store system.
