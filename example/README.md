# ModuLink Examples

This directory contains different example approaches for using ModuLink.

## Files Overview

### `app.js` 
**Complete standalone example** - Shows the simplest way to create a ModuLink application from scratch. Includes Express setup, ModuLink configuration, and server start in one file.

**Usage:**
```bash
node example/app.js
# Visit http://localhost:3000/api/process
```

### `server.js`
**Pure Express factory** - Creates a basic Express app without ModuLink. Useful as a building block for other examples.

### `modulink_setup.js`
**Modular configuration** - Exports a `setupModulink(app)` function that can be applied to any Express app. Demonstrates separation of concerns.

**Usage:**
```javascript
import { setupModulink } from './example/modulink_setup.js';
import { createApp } from './example/server.js';

const app = createApp();
const modulink = setupModulink(app);
// Start server when ready
```

### `verbose_demo.js`
**Feature-complete demonstration** - Shows all ModuLink features including HTTP routes, cron jobs, CLI commands, and comprehensive logging. Can run as standalone server or be imported for testing.

**Usage:**
```bash
# Run as server
node example/verbose_demo.js

# Run CLI command
node example/verbose_demo.js process-cli --data '{"value": 50}'
```

## Choose Your Approach

- **Getting started**: Use `app.js`
- **Modular applications**: Use `modulink_setup.js` + `server.js`
- **Full feature exploration**: Use `verbose_demo.js`
- **Testing/examples**: All files export their instances for easy testing
