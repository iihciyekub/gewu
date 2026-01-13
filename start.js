#!/usr/bin/env node
/**
 * EnlightenKey - Node.js launcher
 * Cross-platform replacement for start.sh
 */

const fs = require('fs');
const path = require('path');

function logHeader() {
  console.log('=========================================');
  console.log('        EnlightenKey - Starting...');
  console.log('=========================================');
  console.log('');
}

function ensureProjectRoot(rootDir) {
  const requiredFiles = ['index.html', 'server.js'];
  for (const file of requiredFiles) {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) {
      console.error('❌ Error: Please run this script from the project root directory');
      console.error(`   Missing: ${file}`);
      process.exit(1);
    }
  }
}

function main() {
  const rootDir = path.resolve(__dirname);
  process.chdir(rootDir);

  logHeader();
  ensureProjectRoot(rootDir);

  const port = process.env.PORT || '8000';

  console.log(`✅ Starting HTTP server with JSON save support on port ${port}...`);
  console.log('');
  console.log(`📂 Project directory: ${rootDir}`);
  console.log(`🌐 Access the application at: http://localhost:${port}`);
  console.log('💾 Default project layout: json/view1/, md/, pdf/');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('=========================================');
  console.log('');

  // `server.js` reads PORT from env and starts the server.
  // Requiring it keeps logs/errors in the same process and works cross-platform.
  require('./server.js');
}

main();
