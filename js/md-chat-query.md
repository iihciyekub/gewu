# MD Chat Query Module (js/md-chat-query.js)

This module adds field query functionality to the Markdown Chat panel in the PaperStatsApp instance.
It is loaded after `js/app.js` and extends `PaperStatsApp.prototype` with field querying, value formatting, and result rendering.

## Load

`index.html` includes:

- `js/app.js`
- `js/json-query.js`
- `js/md-chat-query.js`
- `js/bib-download.js`
- `js/groupby-fields.js`

## Features

- **Field Query Management**: Add and remove fields from query
- **Smart Value Formatting**: Handles primitives, arrays, and object lists
- **Dot Notation Support**: Query nested fields with dot notation (e.g., `authors[]`, `publication.title`)
- **Object List Parsing**: Automatically extracts readable text from object arrays
- **Dynamic Result Display**: Real-time rendering in the chat panel

## Main APIs

### addMdChatQueryField(field)

Adds a field to the active query. If the field is new, it:

- Adds to `this.mdChatQueryFields` (Set)
- Calls `renderMdChatQueryChips()` to update the UI
- Calls `runMdChatFieldQuery()` to execute the query

**Parameters:**
- `field` (string): Field name or path to query

**Example:**
```js
window.paperStats.addMdChatQueryField('authors[]');
```

### removeMdChatQueryField(field)

Removes a field from the active query and re-executes.

**Parameters:**
- `field` (string): Field name/path to remove

**Example:**
```js
window.paperStats.removeMdChatQueryField('authors[]');
```

### renderMdChatQueryChips()

Renders the field chips/tags in the chat panel's field chip row.
Displays placeholder hint when no fields are added yet.

### resolveMdChatFieldValues(data, fieldPath)

Resolves field values from JSON data using dot notation.
Supports array traversal with `[]` suffix.

**Parameters:**
- `data` (object): The data object to query
- `fieldPath` (string): Dot-notation field path

**Returns:** Array of resolved values

**Examples:**
```js
// Get single field
const values = app.resolveMdChatFieldValues(jsonData, 'title');

// Get nested field
const values = app.resolveMdChatFieldValues(jsonData, 'publication.journal');

// Get array elements
const authors = app.resolveMdChatFieldValues(jsonData, 'authors[]');
```

### formatMdChatValue(value)

Formats a value for display in the chat panel.
Provides special handling for:

- **Primitives**: Direct string conversion
- **Simple Arrays**: Join with `; ` separator
- **Object Arrays**: 
  - Simple objects (≤3 fields): Extract readable text, join with `; `
  - Complex objects (>3 fields): Structured multi-line format
- **Dictionaries/Objects**: Key-value pairs on separate lines

**Parameters:**
- `value` (*): The value to format

**Returns:** Formatted string representation with structure

**Examples:**
```js
formatMdChatValue('Hello');                    
// → 'Hello'

formatMdChatValue(['A', 'B', 'C']);           
// → 'A; B; C'

// Simple object array
formatMdChatValue([{id: 'A1', name: 'Alice'}, 
                   {id: 'A2', name: 'Bob'}]); 
// → 'Alice; Bob'

// Complex object array
formatMdChatValue([
  {id: 'A1', name: 'Alice', email: 'a@ex.com', dept: 'Eng', active: true},
  {id: 'A2', name: 'Bob', email: 'b@ex.com', dept: 'Sales', active: true}
]);
// → 
// id: A1
// name: Alice
// email: a@ex.com
// dept: Eng
// active: true
// 
// id: A2
// name: Bob
// email: b@ex.com
// dept: Sales
// active: true

// Dictionary
formatMdChatValue({
  title: 'Paper Title',
  year: 2023,
  authors: ['Alice', 'Bob'],
  tags: ['AI', 'ML']
});
// →
// title: Paper Title
// year: 2023
// authors: [Alice, Bob]
// tags: [AI, ML]
```

### formatStructuredObject(obj)

Formats a complex object/dictionary as structured key-value pairs.
Each key-value pair appears on its own line, suitable for displaying dictionaries and complex objects.

**Parameters:**
- `obj` (object): The object to format

**Returns:** Structured text with line breaks

**Examples:**
```js
formatStructuredObject({
  title: 'AI in Healthcare',
  year: 2023,
  doi: '10.1234/ai.2023',
  authors: ['Alice', 'Bob']
});
// →
// title: AI in Healthcare
// year: 2023
// doi: 10.1234/ai.2023
// authors: [Alice, Bob]

formatStructuredObject({
  name: 'John',
  contact: {email: 'john@ex.com', phone: '123-456'},
  tags: [{id: 't1', label: 'AI'}, {id: 't2', label: 'ML'}]
});
// →
// name: John
// contact: {"email":"john@ex.com","phone":"123-456"}
// tags: [AI, ML]
```

### formatObjectListItem(obj)

Extracts readable text from a single object.
Uses a priority field list to find meaningful identifiers:

1. `id`
2. `name`
3. `title`
4. `label`
5. `value`
6. `text`
7. `display`

If no priority field is found, extracts all primitive values (max 3) joined by comma.

**Parameters:**
- `obj` (object): The object to format

**Returns:** Formatted string representation

**Examples:**
```js
formatObjectListItem({id: 'A1', name: 'Alice', email: 'alice@example.com'});
// → 'Alice' (name found first in priority)

formatObjectListItem({code: 'C01', dept: 'Engineering'});
// → 'C01, Engineering' (no priority fields, use all values)

formatObjectListItem({year: 2023});
// → '2023' (single value)
```

### runMdChatFieldQuery()

Main execution method. Queries all fields in `this.mdChatQueryFields` and renders results.

**Steps:**
1. Validates chat panel and body element exist
2. Checks if JSON data is loaded
3. For each field:
   - Resolves values using `resolveMdChatFieldValues()`
   - Formats values using `formatMdChatValue()`
   - Generates HTML block with title and value
4. Renders all blocks to the chat panel body
5. Updates metadata (file name, current view)

**Data Flow:**
```
runMdChatFieldQuery()
  └── resolveMdChatFieldValues()    [resolve from JSON]
      └── formatMdChatValue()       [format for display]
          └── formatObjectListItem() [extract from objects]
```

## Workflow

### User Enters Field in Chat Input

1. User types field name in chat textarea (e.g., `authors[]`)
2. Presses Enter key (without Shift)
3. `addFieldFromInput()` is triggered (defined in `initMarkdownChatPanel()`)
4. Calls `addMdChatQueryField(field)`

### Adding a Field

```
User Input
  ↓
addMdChatQueryField()
  ├─ Add to mdChatQueryFields Set
  ├─ renderMdChatQueryChips()  [update UI tags]
  └─ runMdChatFieldQuery()     [execute query and display]
```

### Query Execution

```
runMdChatFieldQuery()
  ├─ Check data loaded
  ├─ For each field:
  │  ├─ resolveMdChatFieldValues()   [get values from JSON]
  │  ├─ formatMdChatValue()          [format for display]
  │  └─ Generate HTML block
  ├─ Render to panel body
  └─ Update metadata (file, view)
```

## Supported Field Paths

### Simple Field
```js
addMdChatQueryField('title');
addMdChatQueryField('authors');
```

### Nested Field (Dot Notation)
```js
addMdChatQueryField('publication.journal');
addMdChatQueryField('metadata.year');
```

### Array Traversal
```js
addMdChatQueryField('authors[]');        // Get all authors
addMdChatQueryField('keywords[]');       // Get all keywords
addMdChatQueryField('references[].doi'); // Get DOI from each reference
```

## Value Formatting

### Primitive Values
- Strings, numbers, booleans → Direct string conversion

### Simple Arrays
```js
['Alice', 'Bob', 'Charlie'] → 'Alice; Bob; Charlie'
```

### Simple Object Arrays (≤3 fields)
Extracts name/identifier fields with inline format:
```js
[
  {id: 'A1', name: 'Alice'},
  {id: 'A2', name: 'Bob'}
]
↓
'Alice; Bob'
```

### Complex Object Arrays (>3 fields)
Structured multi-line format with key-value pairs:
```js
[
  {id: 'A1', name: 'Alice', email: 'a@ex.com', dept: 'Eng', active: true},
  {id: 'A2', name: 'Bob', email: 'b@ex.com', dept: 'Sales', active: true}
]
↓
id: A1
name: Alice
email: a@ex.com
dept: Eng
active: true

id: A2
name: Bob
email: b@ex.com
dept: Sales
active: true
```

### Dictionaries (Objects)
Structured key-value format with arrays shown compactly:
```js
{
  title: 'Paper Title',
  year: 2023,
  authors: ['Alice', 'Bob'],
  references: [{doi: '10.1/a'}, {doi: '10.2/b'}]
}
↓
title: Paper Title
year: 2023
authors: [Alice, Bob]
references: [10.1/a, 10.2/b]
```

### Fallback for Objects Without Priority Fields
```js
[
  {code: 'C01', department: 'Engineering'},
  {code: 'C02', department: 'Sales'}
]
↓
code: C01, Engineering
code: C02, Sales
```

## HTML Structure

### Query Block
```html
<div class="md-chat-query-block">
  <div class="md-chat-query-title">authors[]</div>
  <div class="md-chat-query-value">Alice; Bob; Charlie</div>
</div>
```

### Field Chips
```html
<div class="md-chat-field-chips">
  <button class="md-chat-chip">
    <span>authors[]</span>
    <i class="fas fa-times"></i>
  </button>
</div>
```

## State

### Instance Variables

- `this.mdChatQueryFields` (Set): Currently active query fields
- `this.mdChatHistory` (Array): Query field history
- `this.mdChatHistoryIndex` (number): Current history index
- `this._mdChatBody` (HTMLElement): Chat panel body cache
- `this.currentData` (object): Currently loaded JSON data

## Notes

- Object list parsing automatically detects arrays of objects vs. simple values
- Nested queries with `[]` are fully supported (e.g., `references[].authors[].name`)
- Empty results display "(not found)" placeholder
- Metadata shows current file name and view type
- All HTML output is escaped for security
- Values are joined with newlines when multiple results from same field
- Object arrays are joined with semicolons for compact display

## Integration

This module integrates with:

- **initMarkdownChatPanel()** in `app.js`: Sets up event listeners for field input
- **loadFile()** in `app.js`: Updates `this.currentData` for queries
- **renderGotoLinks()** in `app.js`: Converts query results to clickable links
- **escapeHtml()** in `app.js`: Security escaping for HTML output

## Related Files

- `js/app.js`: Main application logic
- `js/md-chat-query.js`: This module
- `js/json-query.js`: JSON query inline rendering
- `index.html`: Script loader
- `css/styles.css`: Chat panel styling
