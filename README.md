# ModuLink JavaScript Library

A minimal JS Modulink library for building modular applications with unified triggers for HTTP, cron jobs, and CLI commands.

## Core Concepts

*   **Modulink Instance (`modu`):** The central object created from `new Modulink(app)` (where `app` is an Express instance). It's used to register triggers, middleware, and create pipelines.
*   **Context Object (`ctx`):** A plain JavaScript object passed through middleware and handlers. It carries data between steps and can be modified by them. For HTTP triggers, `ctx` is initialized with `req.body` (and `req.query` for GET requests). For CLI triggers, it's initialized from a JSON string.
*   **Handlers:** Functions that process the `ctx`. These can be simple `async ctx => { /* ... */ return newCtx; }` functions or more complex pipelines.
*   **Pipelines:** A sequence of handler functions. ModuLink provides `Modulink.pipeline(...steps)` (static method) and `modu.pipeline(...steps)` (instance method, which automatically includes middleware registered with `modu.use()`). A single `async ctx => {}` function is functionally equivalent to a single-step pipeline.
*   **Middleware:** Functions registered using `modu.use(mw)`. They are automatically included in pipelines created with `modu.pipeline()`. Middleware functions also receive and can modify the `ctx`.

## Installation

```sh
npm install express node-cron commander
npm install modulink-js # or link this package if developing locally
```

## Quick Start

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
