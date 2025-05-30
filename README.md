# ModuLink JavaScript Library

A minimal JS library for building modular applications with unified triggers for HTTP, cron jobs, and CLI commands.

> **🎉 Migration Complete**: ModuLink-JS has been successfully converted to ES modules with the modern Chain & Function pattern. All tests passing (35/35). Ready for production use in modern JavaScript environments.

> **Version 1.0.1**: Now includes automated version management and release workflows. See [CHANGELOG.md](./CHANGELOG.md) for full migration details.

## Core Concepts

*   **Modulink Instance (`modu`):** The central object created from `new Modulink(app)` (where `app` is an Express instance). It's used to register triggers, middleware, and create pipelines.
*   **Context Object (`ctx`):** A plain JavaScript object passed through middleware and handlers. It carries data between steps and can be modified by them. For HTTP triggers, `ctx` is initialized with `req.body` (and `req.query` for GET requests). For CLI triggers, it's initialized from a JSON string. In named pipeline execution, `ctx` typically contains `{ req, res, next, app }` properties for HTTP request handling.
*   **Handlers:** Functions that process the `ctx`. These can be simple `async ctx => { /* ... */ return newCtx; }` functions or more complex pipelines.
*   **Pipelines:** A sequence of handler functions. ModuLink provides `Modulink.pipeline(...steps)` (static method) and `modu.pipeline(...steps)` (instance method, which automatically includes middleware registered with `modu.use()`). A single `async ctx => {}` function is functionally equivalent to a single-step pipeline.
*   **Named Pipelines:** Pipelines registered with `modu.registerPipeline(name, steps)` and executed with `modu.execute(name, ctx)`. This is the recommended pattern for modular applications.
*   **Middleware:** Functions registered using `modu.use(mw)`. They are automatically included in pipelines created with `modu.pipeline()`. Middleware functions also receive and can modify the `ctx`.

## Context Object Structure

The context object (`ctx`) is the primary data carrier in ModuLink pipelines. Its structure varies based on usage:

### HTTP Request Context
```javascript
const ctx = {
  req,          // Express request object
  res,          // Express response object  
  next,         // Express next function
  app,          // Express app instance
  // Pipeline steps can add additional properties
  result: {},   // Common pattern for pipeline results
  error: null   // Set by error handling logic
};
```

### Error Handling in Context
```javascript
// Pipeline step setting an error
const validateStep = async ctx => {
  if (!ctx.req.body.email) {
    ctx.error = { 
      message: 'Email is required', 
      status: 400,
      step: 'validation' 
    };
    return ctx;
  }
  return ctx;
};

// Route handler checking for errors
app.post('/api/users', async (req, res, next) => {
  const { finalCtx, responseSent } = await modu.execute('createUser', { req, res, next, app });
  
  if (responseSent) return; // Pipeline handled the response
  
  if (finalCtx.error) {
    return res.status(finalCtx.error.status || 500).json({ 
      error: finalCtx.error.message 
    });
  }
  
  res.json(finalCtx.result);
});
```

## Installation

```bash
npm install express node-cron commander cors
```

### ES Modules Setup

ModuLink-JS uses ES modules. Ensure your `package.json` includes:

```json
{
  "type": "module"
}
```

## Quick Start

### Method 1: Modern Chain Pattern (Recommended)
This is the current pattern using ES modules and the new chain API.

```javascript
// app.js
import express from 'express';
import Modulink from './modulink/modulink.js';

const app = express();
app.use(express.json());

const modu = new Modulink(app);

// Add global middleware
modu.use(async (ctx) => {
  console.log(`${ctx.req.method} ${ctx.req.path}`);
  return ctx;
});

// Define chain functions (links)
const validateData = async ctx => {
  const { value } = ctx.req.body;
  if (!value) {
    ctx.error = { message: 'Value is required', status: 400 };
    return ctx;
  }
  ctx.validatedValue = parseInt(value);
  return ctx;
};

const processData = async ctx => {
  if (ctx.error) return ctx; // Skip if validation failed
  
  ctx.result = {
    original: ctx.validatedValue,
    doubled: ctx.validatedValue * 2,
    timestamp: new Date()
  };
  return ctx;
};

// Register named pipeline
modu.registerPipeline('processValue', [validateData, processData]);

// Setup route that uses the named pipeline
app.post('/api/process', async (req, res, next) => {
  try {
    const { finalCtx, responseSent } = await modu.execute('processValue', { 
      req, res, next, app 
    });

    if (responseSent) return; // Pipeline handled the response

    if (finalCtx.error) {
      return res.status(finalCtx.error.status || 500).json({ 
        error: finalCtx.error.message 
      });
    }

    res.json(finalCtx.result);
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
  console.log('Try: curl -X POST -H "Content-Type: application/json" -d \'{"value": 42}\' http://localhost:3000/api/process');
});
```

### Method 2: Direct Trigger Registration (Legacy)

Let's assume you have your handler functions defined in a separate file, for example, `handlers.js`:

```javascript
// handlers.js
const initializeData = async ctx => {
  ctx.value = ctx.initialValue || 0;
  console.log('Step 1: Initialized data', ctx);
  return ctx;
};

const incrementValue = async ctx => {
  ctx.value += (ctx.incrementBy || 1);
  console.log('Step 2: Incremented value', ctx);
  return ctx;
};

const formatResponse = async ctx => {
  console.log('Step 3: Formatting response', ctx);
  return {
    currentValue: ctx.value,
    message: "Operation successful",
    details: ctx
  };
};

module.exports = {
  initializeData,
  incrementValue,
  formatResponse
};
```

Now, in your main application file (e.g., `app.js`):

```javascript
// app.js
const express = require('express');
const { Modulink } = require('modulink-js'); // Use './modulink/modulink' if example is inside the package
const { initializeData, incrementValue, formatResponse } = require('./handlers'); // Import handlers

const app = express();
app.use(express.json()); // Essential for parsing JSON in POST/PUT requests

const modu = new Modulink(app);

// Register a global middleware (e.g., logging)
modu.use(Modulink.logging()); // Built-in logging middleware
modu.use(async ctx => {
  console.log('Custom middleware processing context:', ctx);
  ctx.middlewareApplied = true;
  return ctx;
});

// Compose imported steps into a pipeline using the instance method (includes middleware)
const processingChain = modu.pipeline(
  initializeData,
  incrementValue,
  formatResponse
);

// Register an HTTP POST trigger
modu.when.http('/api/process', ['POST'], processingChain);
// Example usage: POST /api/process with JSON body {"initialValue": 10, "incrementBy": 5}

// Register a Cron job trigger (runs every minute)
modu.when.cron('* * * * *', async () => {
  console.log('Cron job triggered');
  const result = await processingChain({ initialValue: Date.now() % 100 });
  console.log('Cron job result:', result);
});

// Register a CLI command trigger
modu.when.cli('process-data', processingChain);
// Example usage from terminal:
// node app.js process-data -d '{"initialValue": 50, "incrementBy": 10}'

app.listen(3000, () => {
  console.log('Server running on port 3000');
  console.log('Try: curl -X POST -H "Content-Type: application/json" -d \'{"initialValue": 10, "incrementBy": 2}\' http://localhost:3000/api/process');
  console.log('Or CLI: node app.js process-data -d \'{"initialValue": 100}\'');
});
```

## API Highlights

### Initializing Modulink
```javascript
const express = require('express');
const { Modulink } = require('modulink-js');
const app = express();
const modu = new Modulink(app);
```

### Named Pipeline Management (Recommended)
The primary API for production applications:

*   **`modu.registerPipeline(name, steps)`:** Register a named pipeline.
    ```javascript
    const validateStep = async ctx => { /* validation */ return ctx; };
    const processStep = async ctx => { /* processing */ return ctx; };
    
    modu.registerPipeline('myFeature', [validateStep, processStep]);
    ```

*   **`modu.execute(name, ctx)`:** Execute a named pipeline.
    ```javascript
    const { finalCtx, responseSent } = await modu.execute('myFeature', { req, res, next, app });
    ```

### Registering Triggers (`modu.when`)
The `modu.when` object provides methods to register different types of triggers. All trigger handlers receive a context object (`ctx`) and should return the (potentially modified) `ctx` or a final result.

*   **HTTP Triggers:**
    ```javascript
    modu.when.http('/path', ['GET', 'POST'], async ctx => { /* ... */ return { data: ctx }; });
    ```
*   **Cron Triggers:**
    ```javascript
    modu.when.cron('0 * * * *', async ctx => { /* Runs every hour */ console.log('Hourly job', ctx); return ctx; });
    ```
*   **CLI Triggers:**
    ```javascript
    modu.when.cli('mycommand', async ctx => { /* ... */ return ctx; });
    // Invoke: node app.js mycommand -d '{"some": "data"}'
    ```
*   **Message Triggers (Placeholder):**
    ```javascript
    modu.when.message('my.topic', async ctx => { /* ... */ return ctx; });
    // Note: This is currently a placeholder and not fully implemented.
    ```

## Real-World Usage Patterns

### Module Structure Pattern
This is the recommended pattern used throughout the AI Chat UI project:

```javascript
// src/mymodule/index.js - Module initialization
import { createFeaturePipeline, listFeaturesPipeline } from './pipelines/index.js';

/**
 * Initialize the module with ModuLink
 * @param {Object} app - Express application instance
 * @param {Object} modulink - ModuLink instance
 */
export function initializeMyModule(app, modulink) {
  // Register named pipelines
  modulink.registerPipeline('createFeature', createFeaturePipeline.steps);
  modulink.registerPipeline('listFeatures', listFeaturesPipeline.steps);

  // Setup HTTP routes that execute named pipelines
  app.post('/api/features', async (req, res, next) => {
    try {
      const { finalCtx, responseSent } = await modulink.execute('createFeature', { 
        req, res, next, app 
      });

      if (responseSent) {
        console.log('Response sent by pipeline');
        return;
      }

      // Handle response based on pipeline results
      if (finalCtx.error) {
        return res.status(finalCtx.error.status || 500).json({ 
          error: finalCtx.error.message 
        });
      }

      res.status(201).json(finalCtx.result);
    } catch (error) {
      console.error('Route error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  app.get('/api/features', async (req, res, next) => {
    try {
      const { finalCtx, responseSent } = await modulink.execute('listFeatures', { 
        req, res, next, app 
      });

      if (responseSent) return;

      if (finalCtx.error) {
        return res.status(finalCtx.error.status || 500).json({ 
          error: finalCtx.error.message 
        });
      }

      res.json(finalCtx.result);
    } catch (error) {
      console.error('Route error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });
}
```

```javascript
// src/mymodule/pipelines/createFeaturePipeline.js
const validateInput = async ctx => {
  const { name, description } = ctx.req.body;
  
  if (!name || !description) {
    ctx.error = { 
      message: 'Name and description are required',
      status: 400,
      step: 'validation'
    };
    return ctx;
  }
  
  ctx.validatedData = { name, description };
  return ctx;
};

const saveFeature = async ctx => {
  if (ctx.error) return ctx; // Skip if previous error
  
  try {
    // Simulate database save
    const feature = {
      id: Date.now(),
      ...ctx.validatedData,
      createdAt: new Date()
    };
    
    ctx.result = feature;
    return ctx;
  } catch (error) {
    ctx.error = { 
      message: 'Failed to save feature',
      status: 500,
      step: 'database',
      originalError: error
    };
    return ctx;
  }
};

const logResult = async ctx => {
  if (ctx.error) {
    console.log(`[Feature Creation] Error: ${ctx.error.message}`);
  } else {
    console.log(`[Feature Creation] Success: Created feature ${ctx.result.id}`);
  }
  return ctx;
};

export default {
  steps: [validateInput, saveFeature, logResult]
};
```

### Application Bootstrap Pattern
```javascript
// src/core/index.js - Main application setup
import express from 'express';
import { createModulinkInstance } from './setup/modulink.js';
import { initializeMyModule } from '../mymodule/index.js';

const app = express();
app.use(express.json());

// Create ModuLink instance
const modulink = createModulinkInstance(app);

// Initialize modules
await initializeMyModule(app, modulink);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Named Pipeline Management
ModuLink supports registering and executing pipelines by name, which is the recommended pattern for modular applications.

*   **`modu.registerPipeline(name, steps)`:** Registers a pipeline with a unique name.
    ```javascript
    const validateInput = async ctx => { /* validation logic */ return ctx; };
    const processData = async ctx => { /* processing logic */ return ctx; };
    const formatResponse = async ctx => { /* formatting logic */ return ctx; };
    
    // Register named pipeline
    modu.registerPipeline('myFeature', [validateInput, processData, formatResponse]);
    ```

*   **`modu.execute(name, ctx)`:** Executes a registered pipeline by name.
    ```javascript
    // Execute the named pipeline
    const { finalCtx, responseSent } = await modu.execute('myFeature', { 
      req, res, next, app,
      customData: 'value' 
    });
    
    // Check if pipeline sent HTTP response
    if (responseSent) {
      console.log('Response handled by pipeline');
      return;
    }
    
    // Handle response manually if needed
    if (finalCtx.error) {
      return res.status(500).json({ error: finalCtx.error.message });
    }
    res.json(finalCtx.result);
    ```

### Working with Pipelines
Pipelines chain multiple processing steps.

*   **`modu.pipeline(...steps)`:** Creates a pipeline that includes middleware registered via `modu.use()`.
    ```javascript
    const step1 = async ctx => { ctx.a = 1; return ctx; };
    const step2 = async ctx => { ctx.b = 2; return ctx; };
    const instancePipeline = modu.pipeline(step1, step2);
    // const result = await instancePipeline({}); // result will include effects of modu.use() middleware
    ```
*   **`Modulink.pipeline(...steps)`:** Static method. Creates a pipeline *without* instance-specific middleware.
    ```javascript
    const staticPipeline = Modulink.pipeline(step1, step2);
    // const result = await staticPipeline({}); // result will NOT include effects of modu.use() middleware
    ```
*   **`Modulink.pipe(...steps)`:** An alias for `Modulink.pipeline()`.

### Using Middleware
Middleware functions are processed as part of pipelines created with `modu.pipeline()`.

*   **Registering Middleware:**
    ```javascript
    modu.use(async ctx => {
      ctx.timestamp = Date.now();
      console.log('Middleware: Context at', ctx.timestamp);
      return ctx;
    });
    ```
*   **Built-in Logging Middleware:**
    ```javascript
    modu.use(Modulink.logging()); // Logs the context object at each step it's part of.
    ```

### Utility Functions

*   **`Modulink.wrapWithCtx(fn)`:**
    Wraps a function `fn` so that its arguments are automatically extracted from properties of the `ctx` object.
    ```javascript
    const myFunc = (user, id) => { /* uses user and id */ return {userId: `${user}-${id}`}; };
    const wrappedFunc = Modulink.wrapWithCtx(myFunc);

    // If ctx = { user: "Alice", id: 123, otherData: "..." }
    // const { result, error } = wrappedFunc(ctx);
    // result would be { userId: "Alice-123" }
    // fn is called as myFunc("Alice", 123)
    ```

## Best Practices

### Error Handling Patterns
1. **Set errors in context**: Don't throw errors in pipeline steps; set `ctx.error` instead.
2. **Check for errors**: Each step should check `if (ctx.error) return ctx;` to skip processing.
3. **Handle in routes**: Check `finalCtx.error` and `responseSent` in Express routes.
4. **Use status codes**: Include HTTP status codes in error objects.

```javascript
// Good: Setting error in pipeline step
const validateStep = async ctx => {
  if (!ctx.req.body.email) {
    ctx.error = { message: 'Email required', status: 400, step: 'validation' };
    return ctx;
  }
  return ctx;
};

// Good: Checking for errors in subsequent steps
const processStep = async ctx => {
  if (ctx.error) return ctx; // Skip if previous error
  // ... processing logic
  return ctx;
};
```

### Pipeline Organization
1. **Keep steps small**: Each function should have a single responsibility.
2. **Use descriptive names**: Function names should clearly indicate their purpose.
3. **Structure by module**: Organize pipelines in separate files per feature.
4. **Export as objects**: Use `{ steps: [...] }` format for pipeline definitions.

### Context Management
1. **Preserve request objects**: Always pass `{ req, res, next, app }` to named pipelines.
2. **Use consistent property names**: Standardize on `ctx.result`, `ctx.error`, etc.
3. **Avoid mutation**: Return new context objects when possible, but mutation is acceptable for performance.

## Migration Guide

### From Direct Triggers to Named Pipelines

**Before (Legacy)**:
```javascript
const handler = modu.pipeline(step1, step2, step3);
modu.when.http('/api/data', ['POST'], handler);
```

**After (Recommended)**:
```javascript
modu.registerPipeline('processData', [step1, step2, step3]);

app.post('/api/data', async (req, res, next) => {
  const { finalCtx, responseSent } = await modu.execute('processData', { req, res, next, app });
  
  if (responseSent) return;
  
  if (finalCtx.error) {
    return res.status(finalCtx.error.status || 500).json({ error: finalCtx.error.message });
  }
  
  res.json(finalCtx.result);
});
```

**Benefits of Named Pipelines**:
- Better error handling and response management
- Easier testing and debugging
- More explicit route handling
- Consistent patterns across modules
- Better integration with Express middleware

## Version Management

ModuLink-JS includes automated version management and release workflows:

### Version Commands

```bash
# Show current version and increment options
npm run version

# Increment version
npm run version:patch  # 1.0.1 → 1.0.2
npm run version:minor  # 1.0.1 → 1.1.0  
npm run version:major  # 1.0.1 → 2.0.0
```

### Release Workflow

```bash
# Complete release with testing (recommended)
npm run release:patch  # Patch release
npm run release:minor  # Minor release
npm run release:major  # Major release
```

The release workflow:
1. ✅ Checks git working directory status
2. ✅ Runs complete test suite (35 tests)
3. ✅ Increments version and updates documentation
4. ✅ Commits changes and creates git tag
5. ✅ Provides instructions for pushing changes

### Semantic Versioning

- **PATCH** (1.0.0 → 1.0.1): Bug fixes and small improvements
- **MINOR** (1.0.0 → 1.1.0): New features that are backward compatible  
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes

## Development

### Running Tests

```bash
npm test  # Runs all 35 tests with ES modules support
```

### Project Structure

```
modulink_js/
├── modulink/
│   └── modulink.js          # Core library
├── __tests__/               # Test suites (35 tests)
├── example/                 # Usage examples
├── scripts/                 # Version management scripts
├── docs/                    # Documentation
│   └── migration.md         # Migration guide
├── CHANGELOG.md             # Version history
└── package.json             # ES modules configuration
```

### Contributing

1. Ensure all tests pass: `npm test`
2. Follow semantic versioning for changes
3. Update documentation for new features
4. Use the release workflow for version increments

## Migration from CommonJS

If upgrading from a CommonJS version, see [docs/migration.md](./docs/migration.md) for a complete guide covering:

- ES modules conversion steps
- Chain API migration from pipeline pattern
- Updated import/export syntax
- Jest configuration for ES modules
- All changes are backward compatible

## License

MIT License - see LICENSE file for details.
