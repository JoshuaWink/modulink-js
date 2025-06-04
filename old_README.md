# ModuLink JavaScript Library

A minimal JavaScript library for building modular applications with unified processing for HTTP, cron jobs, CLI commands, and message processing.

> **Version 2.0.0**: Function-based composition with context-driven processing.

## Core Types System

ModuLink JavaScript uses 5 core types that work together:

- **Ctx** (Context): Stores information that gets passed from one component to another
- **Link** (Function): Single function that performs an action with/on context (single responsibility)
- **Chain** (Composition): Series of Links chained together that execute in sequence
- **Trigger** (Event Source): Starts the chain reaction (HTTP requests, cron schedules, CLI commands, etc.)
- **Middleware** (Observer): Goes between links for logging, listening, monitoring - NOT transforming

## Installation

```bash
npm install express node-cron commander cors
```

Ensure your `package.json` includes:
```json
{
  "type": "module"
}
```

## Quick Start

```javascript
import express from 'express';
import { 
  createModulink, 
  createHttpContext, 
  chain, 
  catchErrors 
} from 'modulink';

const app = express();
app.use(express.json());

const modulink = createModulink();

// Define link functions
const validateData = async (ctx) => {
  const { value } = ctx.body;
  if (!value) {
    ctx.error = { message: 'Value is required', status: 400 };
    return ctx;
  }
  ctx.validatedValue = parseInt(value);
  return ctx;
};

const processData = async (ctx) => {
  if (ctx.error) return ctx;
  
  ctx.result = {
    original: ctx.validatedValue,
    doubled: ctx.validatedValue * 2,
    timestamp: new Date().toISOString()
  };
  return ctx;
};

const sendResponse = async (ctx) => {
  if (ctx.error) {
    ctx.res.status(ctx.error.status || 500).json(ctx.error);
  } else {
    ctx.res.json(ctx.result);
  }
  return ctx;
};

// Create chain using chain()
const processChain = chain(
  validateData,
  processData,
  sendResponse
);

// Set up context middleware
app.use((req, res, next) => {
  req.ctx = createHttpContext(req, res);
  next();
});

// Register HTTP route
app.post('/api/process', async (req, res) => {
  const chain = processChain.use(errorHandler());
  await chain(req.ctx);
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## 🚀 Chain API

The `chain()` function provides enhanced middleware support for building powerful processing pipelines:

```javascript
import { chain } from 'modulink';

// Create chain with middleware support
const processChain = chain(validateData, processData, sendResponse)
  .use(logging({ level: 'info' }))
  .use(timing('request-processing'))
  .use(errorHandler());

// Middleware runs after each link (O(n*m) linear execution)
app.post('/api/process', async (req, res) => {
  await processChain(req.ctx);
});
```

### Chain API Features

- **Enhanced Middleware**: Built-in `.use()` method for observers
- **Linear Execution**: Middleware runs after each link, not just at the end
- **Better Debugging**: Easier to track execution flow
- **Future-Ready**: Supports upcoming `.use.onInput()` and `.use.onOutput()` features
- **Chainable**: Multiple `.use()` calls can be chained together

```javascript
// Multiple middleware approaches
const myChain = chain(link1, link2, link3)
  .use(logger)                    // Logs after each link
  .use(validator)                 // Validates after each link
  .use(errorHandler);             // Handles errors after each link

// Future enhancements (coming soon)
const advancedChain = chain(link1, link2)
  .use.onInput(preprocessor)      // Runs before each link
  .use.onOutput(postprocessor);   // Runs after each link (current default)
```

## Context Types

Different triggers create different context types:

```javascript
import { 
  createContext,
  createHttpContext,
  createCronContext,
  createCliContext,
  createMessageContext,
  createErrorContext
} from 'modulink';

// HTTP contexts (from Express req/res)
const httpCtx = createHttpContext(req, res);

// Cron job contexts
const cronCtx = createCronContext({
  schedule: '0 */6 * * *',
  data: { task: 'cleanup' }
});

// CLI contexts
const cliCtx = createCliContext({
  command: 'process',
  args: ['--file', 'data.txt'],
  flags: { verbose: true }
});

// Message contexts (for queues, events, etc.)
const messageCtx = createMessageContext({
  topic: 'user.created',
  payload: { userId: 123 }
});

// Error contexts
const errorCtx = createErrorContext(error, originalCtx);
```

## Function Composition

Use `chain()` to create chains from individual link functions:

```javascript
import { chain, when, errorHandler } from 'modulink';

// Basic chain composition
const simpleChain = chain(
  validateInput,
  processData,
  saveToDatabase,
  sendResponse
);

// Conditional chain composition
const conditionalChain = chain(
  authenticate,
  when(
    (ctx) => ctx.user.role === 'admin',
    adminProcessing,
    userProcessing
  ),
  sendResponse
);

// Error handling with middleware
const safeChain = chain(
  riskyOperation,
  processResult
).use(errorHandler());
```

## Utility Functions

ModuLink provides utilities for common patterns:

```javascript
import { 
  when,
  catchErrors,
  timing,
  logging,
  validate,
  retry,
  transform,
  parallel,
  cache
} from 'modulink';

// Conditional execution
const conditionalChain = chain(
  when(
    (ctx) => ctx.user.isAdmin,
    adminOnlyLink,
    regularUserLink
  )
);

// Error handling
const safeChain = catchErrors(riskyChain);

// Performance timing
const timedChain = chain(
  timing('processing'),
  expensiveOperation
);

// Logging
const loggedChain = chain(
  logging(),
  businessLogic
);

// Validation
const validatedChain = chain(
  validate({
    required: ['email', 'password'],
    email: { format: 'email' }
  }),
  processUser
);

// Retry logic
const retriedChain = chain(
  retry({ attempts: 3, delay: 1000 }),
  unreliableOperation
);

// Data transformation
const transformedChain = chain(
  transform((ctx) => ({
    ...ctx,
    normalizedData: normalizeInput(ctx.input)
  })),
  processNormalizedData
);

// Parallel processing
const parallelChain = chain(
  parallel([
    processDataA,
    processDataB,
    processDataC
  ]),
  combineResults
);

// Caching
const cachedChain = chain(
  cache({ ttl: 300, key: (ctx) => ctx.userId }),
  expensiveUserOperation
);
```

## Migration from Legacy ModuLink

If migrating from the legacy class-based ModuLink (v1.x):

```javascript
// OLD (v1.x Legacy)
const modulink = new Modulink(app);
const chain = modulink.chain(fn1, fn2, fn3);
modulink.when.http('/api/endpoint', ['POST'], chain);

// NEW (v2.0+ Standard)
const modulink = createModulink();
const chainFn = chain(fn1, fn2, fn3);
app.post('/api/endpoint', async (req, res) => {
  const safeChain = catchErrors(chain);
  await safeChain(req.ctx);
});
```

## API Reference

### Core Functions

- `chain(...links)` - **🚀 Recommended**: Create chain with middleware support
- `createModulink()` - Create ModuLink instance
- `createContext(data)` - Create basic context
- `createHttpContext(req, res)` - Create HTTP context
- `createCronContext(data)` - Create cron context
- `createCliContext(data)` - Create CLI context

### Chain API Methods

- `chain(...links).use(...middleware)` - Add middleware to chain
- `chain(...links).use.onInput(...middleware)` - Future: Pre-link middleware
- `chain(...links).use.onOutput(...middleware)` - Future: Post-link middleware (current default)

### Utilities

- `when(condition, truthy, falsy)` - Conditional execution
- `catchErrors(chain)` - Error handling wrapper
- `timing(label)` - Performance measurement
- `logging(options)` - Request/response logging
- `validate(schema)` - Input validation
- `retry(options)` - Retry failed operations
- `transform(fn)` - Data transformation
- `parallel(chains)` - Parallel execution
- `cache(options)` - Result caching

## Testing

ModuLink's functional composition makes testing straightforward:

```javascript
import { chain } from 'modulink';

// Test individual links
test('validateData should set error for missing value', async () => {
  const ctx = { body: {} };
  const result = await validateData(ctx);
  expect(result.error).toBeDefined();
});

// Test chained functions
test('processChain should handle complete flow', async () => {
  const ctx = { body: { value: 42 } };
  const chainFn = chain(validateData, processData);
  const result = await chainFn(ctx);
  expect(result.result.doubled).toBe(84);
});
```

## Examples

See the `/examples` directory for complete working examples:

- `cli_example.js` - File processing with CLI commands
- `hybrid-pattern-example.js` - HTTP API with authentication and authorization

## Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
