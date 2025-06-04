# ModuLink JavaScript Library

![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![ES Modules](https://img.shields.io/badge/ES%20Modules-✓-success.svg)

A modern JavaScript library for building modular applications with unified processing for HTTP, cron jobs, CLI commands, and message handling. Built on a clean function-based architecture with powerful middleware support.

## ✨ What Makes ModuLink Special

- 🔗 **Function-First Architecture**: Simple links and chains - no complex classes
- 🎯 **Single Responsibility**: Each component has one clear purpose
- 🧬 **Universal Patterns**: Same approach for HTTP, cron, CLI, and messages
- ⚡ **Modern JavaScript**: ES modules, async/await, and clean APIs
- 🛡️ **Built-in Error Handling**: Graceful error propagation and recovery
- 🔧 **Powerful Middleware**: Observable middleware system for logging, timing, and monitoring
- 📦 **Zero Configuration**: Works out of the box with sensible defaults

## 🏗️ Core Architecture

ModuLink is built on 5 simple types that work together:

| Type | Purpose | Example |
|------|---------|---------|
| **Ctx** | Stores data passed between components | `{ user: { id: 123 }, data: {...} }` |
| **Link** | Single function with one responsibility | `validateUser`, `saveData`, `sendEmail` |
| **Chain** | Series of links executed in sequence | `chain(validate, process, respond)` |
| **Trigger** | Event source that starts processing | HTTP request, cron schedule, CLI command |
| **Middleware** | Observer functions for monitoring | Logging, timing, error handling |

## 🚀 Quick Start

### Installation

```bash
npm install modulink-js
```

### Basic Usage

```javascript
import { chain, createModulink } from 'modulink-js';
import express from 'express';

// Define your business logic as simple functions (Links)
const validateInput = (ctx) => {
  if (!ctx.body?.email) {
    return { ...ctx, error: new Error('Email is required') };
  }
  return { ...ctx, validated: true };
};

const processUser = async (ctx) => {
  // Simulate async processing
  const user = await createUser(ctx.body);
  return { ...ctx, user };
};

const formatResponse = (ctx) => {
  if (ctx.error) {
    return { ...ctx, response: { error: ctx.error.message }, status: 400 };
  }
  return { ...ctx, response: { user: ctx.user }, status: 201 };
};

// Create processing chains
const userSignupChain = chain(validateInput, processUser, formatResponse);
const getUsersChain = chain(
  async (ctx) => {
    const users = await getAllUsers();
    return { ...ctx, response: { users } };
  }
);

// Create your application setup as a modular function (Link)
function createUserManagementApp() {
  const app = express();
  app.use(express.json());
  
  // Wrap Express with ModuLink - making the entire server modular
  const modulink = createModulink(app);
  
  // Register routes through ModuLink
  modulink.http('/api/signup', ['POST'], userSignupChain);
  modulink.http('/api/users', ['GET'], getUsersChain);
  
  return { app, modulink };
}

// Your entire application becomes swappable and modular
const { app } = createUserManagementApp();

app.listen(3000, () => console.log('Modular server running on port 3000'));
```

**🎯 Modular Everything Philosophy**: With ModuLink, you create your entire application as a function (`createUserManagementApp`). This means you can easily swap out different app configurations, test different setups, or compose multiple app modules together. ModuLink wraps Express with `createModulink(app)` and manages all routes via `modulink.http()`, making every part of your application - from individual functions to the entire server setup - completely modular and swappable.

```javascript
// Example: Composing multiple app modules
function createAuthModule() {
  const loginChain = chain(validateCredentials, generateToken, setAuthCookie);
  const logoutChain = chain(clearToken, clearCookie);
  
  return (modulink) => {
    modulink.http('/auth/login', ['POST'], loginChain);
    modulink.http('/auth/logout', ['POST'], logoutChain);
  };
}

function createAPIModule() {
  const apiChain = chain(authenticate, authorize, processAPI, formatJSON);
  
  return (modulink) => {
    modulink.http('/api/*', ['GET', 'POST', 'PUT', 'DELETE'], apiChain);
  };
}

// Compose different app configurations
function createProductionApp() {
  const app = express();
  app.use(express.json());
  const modulink = createModulink(app);
  
  // Apply modules
  createAuthModule()(modulink);
  createAPIModule()(modulink);
  createUserManagementApp()(modulink);
  
  return { app, modulink };
}

function createDevelopmentApp() {
  const app = express();
  app.use(express.json());
  app.use(cors()); // Dev-only middleware
  const modulink = createModulink(app);
  
  // Different module composition for development
  createUserManagementApp()(modulink);
  // Skip auth module in development
  
  return { app, modulink };
}

// Easily swap between configurations
const { app } = process.env.NODE_ENV === 'production' 
  ? createProductionApp() 
  : createDevelopmentApp();
```

## 🔗 Chain API

The heart of ModuLink is the `chain()` function, which provides powerful composition and middleware capabilities:

### Basic Chain Creation

```javascript
import { chain } from 'modulink-js';

// Simple chain
const simpleChain = chain(
  validateData,
  transformData,
  saveData
);

// Execute the chain
const result = await simpleChain({ data: 'input' });
```

### Enhanced Chain with Middleware

```javascript
import { chain, logging, timing, errorHandler } from 'modulink-js';

const enhancedChain = chain(
  fetchUserData,
  validatePermissions,
  updateDatabase,
  sendNotification
)
  .use(logging({ level: 'info' }))        // Log after each link
  .use(timing('user-update'))             // Time each operation
  .use(errorHandler());                   // Handle any errors

const result = await enhancedChain({ userId: '123' });
```

### Middleware Execution Model

ModuLink uses a linear middleware execution model (O(n×m)) where middleware runs after each link:

```
Link 1 → [Middleware 1, Middleware 2, Middleware 3]
Link 2 → [Middleware 1, Middleware 2, Middleware 3]  
Link 3 → [Middleware 1, Middleware 2, Middleware 3]
```

This provides better observability and debugging compared to traditional models.

## 🛠️ Built-in Utilities

<!-- IMPROVEMENT: Show how utilities themselves are modular functions that can be swapped -->
<!-- IMPROVEMENT: Demonstrate creating custom utility modules that can be composed with others -->
ModuLink comes with powerful utility functions for common patterns:

### Conditional Execution

<!-- IMPROVEMENT: Show how conditional logic itself becomes modular -->
<!-- IMPROVEMENT: Demonstrate creating swappable business rule modules -->
```javascript
import { when } from 'modulink-js';

const conditionalChain = chain(
  authenticateUser,
  when(
    (ctx) => ctx.user.role === 'admin',
    adminProcessing
  ),
  sendResponse
);
```

### Error Handling

<!-- IMPROVEMENT: Show how error handling strategies are modular and swappable -->
<!-- IMPROVEMENT: Demonstrate different error handling modules for different environments -->
```javascript
import { errorHandler } from 'modulink-js';

const safeChain = chain(
  riskyOperation,
  processResult
).use(errorHandler((error, ctx) => {
  console.log('Custom error handling:', error.message);
  return { ...ctx, handled: true };
}));
```

### Performance Monitoring

<!-- IMPROVEMENT: Show how monitoring itself is modular and swappable -->
<!-- IMPROVEMENT: Demonstrate different monitoring modules for different needs -->
```javascript
import { timing, logging } from 'modulink-js';

const monitoredChain = chain(
  expensiveOperation,
  anotherOperation
)
  .use(timing('operation-performance'))
  .use(logging({ 
    level: 'debug',
    includePerformance: true 
  }));
```

### Data Transformation

<!-- IMPROVEMENT: Show how data transformation utilities are modular building blocks -->
<!-- IMPROVEMENT: Demonstrate creating custom transformation modules for different data types -->
```javascript
import { transform, validate, retry } from 'modulink-js';

const robustChain = chain(
  validate((ctx) => ctx.data?.id ? true : 'ID is required'),
  transform((ctx) => ({ ...ctx, data: normalize(ctx.data) })),
  retry(unreliableAPI, 3, 1000)
);
```

## 🌐 Multiple Trigger Types

<!-- IMPROVEMENT: Emphasize how each trigger type creates modular entry points -->
<!-- IMPROVEMENT: Show how the same business logic chains work across all trigger types -->
<!-- IMPROVEMENT: Demonstrate creating trigger-agnostic application modules -->
ModuLink supports various trigger types with consistent patterns:

### HTTP Triggers

<!-- IMPROVEMENT: Show how HTTP setup becomes a modular function -->
<!-- IMPROVEMENT: Demonstrate swappable HTTP configurations (REST vs GraphQL vs tRPC) -->
```javascript
import express from 'express';
import { createModulink, chain } from 'modulink-js';

const app = express();
const modulink = createModulink(app);

const apiChain = chain(authenticate, authorize, processRequest, respond);

// Register HTTP routes
modulink.http('/api/users', ['GET', 'POST'], apiChain);
modulink.http('/api/users/:id', ['PUT', 'DELETE'], apiChain);
```

### Cron Jobs

<!-- IMPROVEMENT: Show how cron setup becomes a modular scheduling function -->
<!-- IMPROVEMENT: Demonstrate swappable scheduling strategies (cron vs event-driven) -->
```javascript
import { createModulink, chain } from 'modulink-js';

const modulink = createModulink();

const dailyCleanup = chain(
  fetchExpiredData,
  archiveData,
  sendReport
);

// Schedule daily at midnight
modulink.cron('0 0 * * *', dailyCleanup);
```

### CLI Commands

<!-- IMPROVEMENT: Show how CLI setup becomes a modular command system -->
<!-- IMPROVEMENT: Demonstrate swappable CLI interfaces (commander vs yargs vs custom) -->
```javascript
import { createModulink, chain } from 'modulink-js';

const modulink = createModulink();

const deployChain = chain(
  validateConfig,
  buildApplication,
  deployToServer,
  notifyTeam
);

// Register CLI command
modulink.cli('deploy', deployChain);

// Usage: node app.js deploy --data '{"env":"production"}'
```

### Message Processing

<!-- IMPROVEMENT: Show how message processing becomes a modular messaging module -->
<!-- IMPROVEMENT: Demonstrate swappable message broker integrations -->
```javascript
import { createModulink, chain } from 'modulink-js';

const modulink = createModulink();

const messageProcessor = chain(
  parseMessage,
  validateSchema,
  processBusinessLogic,
  publishResponse
);

// Register message handler (implementation varies by message broker)
modulink.message('user.created', messageProcessor);
```

## 📋 Context Types

<!-- IMPROVEMENT: Show how context types enable modular data flow patterns -->
<!-- IMPROVEMENT: Demonstrate creating custom context types for specific domains -->
Different triggers create different context types with relevant data:

### HTTP Context

<!-- IMPROVEMENT: Show how HTTP context creation becomes a modular factory function -->
<!-- IMPROVEMENT: Demonstrate swappable context enrichment for different HTTP patterns -->
```javascript
import { createHttpContext } from 'modulink-js';

const httpCtx = createHttpContext({
  request: req,
  method: 'POST',
  path: '/api/users',
  headers: req.headers,
  body: req.body,
  query: req.query
});
```

### Cron Context

<!-- IMPROVEMENT: Show how cron context becomes part of modular scheduling system -->
<!-- IMPROVEMENT: Demonstrate different context patterns for different scheduling strategies -->
```javascript
import { createCronContext } from 'modulink-js';

const cronCtx = createCronContext({
  expression: '0 0 * * *',
  scheduledTime: new Date(),
  jobName: 'daily-cleanup'
});
```

### CLI Context

<!-- IMPROVEMENT: Show how CLI context enables modular command-line interfaces -->
<!-- IMPROVEMENT: Demonstrate swappable CLI argument parsing strategies -->
```javascript
import { createCliContext } from 'modulink-js';

const cliCtx = createCliContext({
  command: 'deploy',
  args: process.argv.slice(2),
  options: { env: 'production' }
});
```

## 🔧 Advanced Features

<!-- IMPROVEMENT: Show how advanced features enable even more modular architectures -->
<!-- IMPROVEMENT: Demonstrate plugin-like systems where features are modular -->

### Named Chains and Links

<!-- IMPROVEMENT: Show how naming enables a modular registry system -->
<!-- IMPROVEMENT: Demonstrate swappable implementations via named registrations -->
```javascript
const modulink = createModulink();

// Register reusable components
modulink.registerLink('validateUser', validateUserFunction);
modulink.registerChain('userProcessing', userProcessingChain);

// Retrieve and use them
const validator = modulink.getLink('validateUser');
const processor = modulink.getChain('userProcessing');
```

### Middleware Scoping

<!-- IMPROVEMENT: Show how middleware scoping creates modular monitoring systems -->
<!-- IMPROVEMENT: Demonstrate swappable monitoring strategies per environment -->
```javascript
const modulink = createModulink();

// Global middleware (applies to all chains)
modulink.use(globalLogging);

// Link-specific middleware
modulink.useLink('validateUser', validationLogging);

// Chain-specific middleware
modulink.useChain('userProcessing', processingMetrics);
```

### Performance Tracking

<!-- IMPROVEMENT: Show how performance tracking becomes a swappable monitoring module -->
<!-- IMPROVEMENT: Demonstrate different performance strategies for different environments -->
```javascript
import { chain, performanceTracker } from 'modulink-js';

const trackedChain = chain(
  fetchData,
  processData,
  saveResults
).use(performanceTracker({
  exposeMetadata: true,
  generateChainId: true,
  trackTiming: true
}));

// Access performance data
const result = await trackedChain(ctx);
console.log(result._metadata.performance);
```

## 🧪 Testing

<!-- IMPROVEMENT: Show how modular design makes testing incredibly simple -->
<!-- IMPROVEMENT: Demonstrate testing entire application modules as functions -->
<!-- IMPROVEMENT: Show swappable test doubles and mock modules -->
ModuLink is designed to be easily testable:

```javascript
import { chain } from 'modulink-js';

// Test individual links
describe('validateUser', () => {
  test('should validate required fields', () => {
    const ctx = { body: { email: 'test@example.com' } };
    const result = validateUser(ctx);
    expect(result.validated).toBe(true);
  });
});

// Test chains
describe('userSignupChain', () => {
  test('should process valid signup', async () => {
    const ctx = { body: { email: 'user@example.com', password: 'secret' } };
    const result = await userSignupChain(ctx);
    expect(result.user).toBeDefined();
    expect(result.error).toBeUndefined();
  });
});

<!-- IMPROVEMENT: Add example of testing entire application modules -->
// Test entire application modules
describe('createUserManagementApp', () => {
  test('should create app with all routes configured', () => {
    const { app, modulink } = createUserManagementApp();
    expect(app).toBeDefined();
    expect(modulink).toBeDefined();
    // Test that routes are registered
  });
});
```

## 📚 API Reference

<!-- IMPROVEMENT: Emphasize how the API itself enables modular architecture patterns -->
<!-- IMPROVEMENT: Show how each API function contributes to the modular ecosystem -->

### Core Functions

<!-- IMPROVEMENT: Add examples showing how these functions enable modular composition -->
| Function | Description |
|----------|-------------|
| `createModulink(app?, options?)` | Create a ModuLink instance |
| `chain(...links)` | Create a chain from link functions |
| `createContext(data)` | Create basic context |
| `createHttpContext(data)` | Create HTTP-specific context |
| `createCronContext(data)` | Create cron-specific context |
| `createCliContext(data)` | Create CLI-specific context |

### Chain Methods

| Method | Description |
|--------|-------------|
| `.use(...middleware)` | Add middleware to chain |
| `.use.onInput(...middleware)` | Future: Pre-link middleware |
| `.use.onOutput(...middleware)` | Future: Post-link middleware |

### Utility Functions

<!-- IMPROVEMENT: Show how each utility enables modular patterns -->
<!-- IMPROVEMENT: Demonstrate creating custom utilities that follow the same modular approach -->
| Function | Description |
|----------|-------------|
| `when(condition, chain)` | Conditional execution |
| `errorHandler(customHandler?)` | Error handling middleware |
| `logging(options?)` | Logging middleware |
| `timing(label?, options?)` | Performance timing |
| `validate(validator, chain)` | Input validation |
| `retry(chain, attempts?, delay?)` | Retry failed operations |
| `transform(transformer)` | Data transformation |
| `parallel(...chains)` | Parallel execution |
| `cache(chain, keyFn, ttl?)` | Result caching |

## 🚀 Migration Guide

<!-- IMPROVEMENT: Show how migration itself demonstrates the modular evolution -->
<!-- IMPROVEMENT: Emphasize how the new version enhances modularity -->

### From v1.x to v2.0+

<!-- IMPROVEMENT: Highlight how the migration showcases improved modular patterns -->
```javascript
// OLD (v1.x - Class-based)
const modulink = new Modulink(app);
const chain = modulink.chain(fn1, fn2, fn3);
modulink.when.http('/api/endpoint', ['POST'], chain);

// NEW (v2.0+ - Function-based)
const modulink = createModulink(app);
const myChain = chain(fn1, fn2, fn3);
modulink.http('/api/endpoint', ['POST'], myChain);
```

### ES Modules Migration

Ensure your `package.json` includes:
```json
{
  "type": "module"
}
```

Update all imports:
```javascript
// Before (CommonJS)
const { Modulink } = require('modulink-js');

// After (ES Modules)
import { createModulink } from 'modulink-js';
```

## 🏭 Production Examples

<!-- IMPROVEMENT: Show how production examples demonstrate complete modular systems -->
<!-- IMPROVEMENT: Emphasize how each example is a swappable application module -->

### E-commerce Order Processing

<!-- IMPROVEMENT: Show this as a complete e-commerce module that can be plugged into any app -->
```javascript
import { chain, logging, timing, errorHandler, retry } from 'modulink-js';

const orderProcessingChain = chain(
  validateOrder,
  checkInventory,
  processPayment,
  updateInventory,
  createShipment,
  sendConfirmationEmail
)
  .use(logging({ level: 'info', includeUserId: true }))
  .use(timing('order-processing'))
  .use(errorHandler(handleOrderError));

// Robust payment processing with retries
const paymentChain = chain(
  validatePaymentInfo,
  retry(chargeCard, 3, 2000),
  recordTransaction
).use(timing('payment-processing'));
```

## 🏭 Production Examples

<!-- IMPROVEMENT: Show how production examples demonstrate complete modular systems -->
<!-- IMPROVEMENT: Emphasize how each example is a swappable application module -->

### E-commerce Order Processing

<!-- IMPROVEMENT: Show this as a complete e-commerce module that can be plugged into any app -->
```javascript
import { chain, logging, timing, errorHandler, retry } from 'modulink-js';

const orderProcessingChain = chain(
  validateOrder,
  checkInventory,
  processPayment,
  updateInventory,
  createShipment,
  sendConfirmationEmail
)
  .use(logging({ level: 'info', includeUserId: true }))
  .use(timing('order-processing'))
  .use(errorHandler(handleOrderError));

// Robust payment processing with retries
const paymentChain = chain(
  validatePaymentInfo,
  retry(chargeCard, 3, 2000),
  recordTransaction
).use(timing('payment-processing'));
```

### Microservice API Gateway

<!-- IMPROVEMENT: Show this as a modular gateway that can be composed with other services -->
<!-- IMPROVEMENT: Demonstrate how gateway logic itself is swappable and configurable -->
```javascript
import { chain, when, parallel } from 'modulink-js';

const gatewayChain = chain(
  authenticateRequest,
  authorizeEndpoint,
  when(
    (ctx) => ctx.route.startsWith('/api/v1'),
    legacyApiProcessor,
    modernApiProcessor
  ),
  formatResponse,
  logRequest
);

// Parallel service calls
const aggregationChain = chain(
  validateRequest,
  parallel(
    fetchUserProfile,
    fetchUserPreferences,
    fetchUserHistory
  ),
  combineResults,
  sendResponse
);
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](./LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/JoshuaWink/modulink-js)
- [NPM Package](https://www.npmjs.com/package/modulink-js)
- [Documentation](https://github.com/JoshuaWink/modulink-js/wiki)
- [Examples](./examples/)
- [Changelog](./CHANGELOG.md)

---

<!-- 
IMPROVEMENT SUMMARY: Areas identified for better modular design integration:

1. UTILITIES SECTION: Show utilities as modular functions that can be swapped and composed
2. CONDITIONAL EXECUTION: Demonstrate modular business rule systems
3. ERROR HANDLING: Show swappable error handling strategies per environment
4. PERFORMANCE MONITORING: Demonstrate modular monitoring systems
5. DATA TRANSFORMATION: Show transformation utilities as modular building blocks
6. TRIGGER TYPES: Emphasize how triggers create modular entry points with shared business logic
7. HTTP TRIGGERS: Show swappable HTTP configurations (REST vs GraphQL vs tRPC)
8. CRON TRIGGERS: Demonstrate modular scheduling strategies
9. CLI TRIGGERS: Show modular command-line interface systems
10. MESSAGE PROCESSING: Demonstrate swappable message broker integrations
11. CONTEXT TYPES: Show how contexts enable modular data flow patterns
12. ADVANCED FEATURES: Demonstrate plugin-like modular systems
13. NAMED REGISTRATIONS: Show modular registry systems with swappable implementations
14. MIDDLEWARE SCOPING: Demonstrate modular monitoring strategies
15. PERFORMANCE TRACKING: Show swappable performance monitoring modules
16. TESTING: Emphasize testing entire application modules as functions
17. API REFERENCE: Show how API functions enable modular composition
18. MIGRATION: Highlight how new version enhances modularity
19. PRODUCTION EXAMPLES: Emphasize complete modular systems that can be plugged together

NEXT STEPS: Implement these improvements by adding concrete examples showing:
- How to create and swap different module implementations
- Environment-specific module configurations
- Module composition patterns
- Plugin-like architecture examples
- Cross-trigger business logic reuse
-->

**ModuLink**: Simple functions, powerful composition. Build modular applications the clean way.
