# ModuLink Hybrid Architecture Cookbook

## Overview

This cookbook demonstrates the **Hybrid Architecture** approach in ModuLink. The key principles are:

1. **Chains handle business logic** - Pure functions that are testable and composable
2. **ModuLink instances handle integration** - HTTP/cron/CLI/messaging triggers
3. **Multi-level middleware** - Apply at chain level OR instance level as needed
4. **Everything is modular** - Business logic and integration are completely separated
5. **Immediate registration** - `connect()` wires everything up instantly

## Hybrid Architecture Pattern

### ✅ Correct: With App Framework
```javascript
// 1. Create chains as pure functions (business logic)
import { chain } from 'modulink-js';
const userSignupChain = chain(validateInput, processUser, formatResponse);

// 2. Use ModuLink instance for integration with app framework
import { createModuLink } from 'modulink-js';
import express from 'express';

const app = express();
const modulink = createModuLink(app);

// 3. Multi-level middleware
userSignupChain.use(businessValidation);  // Chain-level (business logic)
modulink.use(globalLogging);              // Instance-level (infrastructure)

// 4. Connect with single parameter (app accessible via modulink.app)
modulink.connect((modulink) => {
  modulink.app.post('/api/signup', async (req, res) => {
    const ctx = modulink.createContext({ req, res, payload: req.body });
    const result = await userSignupChain(ctx);
    res.json(result);
  });
});

// Alternative: Connect with two parameters for explicit access
modulink.connect((app, modulink) => {
  app.post('/api/signup', async (req, res) => {
    const ctx = modulink.createContext({ req, res, payload: req.body });
    const result = await userSignupChain(ctx);
    res.json(result);
  });
});
```

### ✅ Correct: Standalone Mode
```javascript
// 1. Create chains as pure functions (business logic)
import { chain } from 'modulink-js';
const dataProcessingChain = chain(validateData, transformData, saveResults);

// 2. Use ModuLink instance without app framework
import { createModuLink } from 'modulink-js';

const modulink = createModuLink(); // No app parameter

// 3. Instance-level middleware still works
modulink.use(globalLogging);

// 4. Connect for standalone execution (e.g., CLI scripts, workers)
modulink.connect((modulink) => {
  // Process command line arguments
  const args = process.argv.slice(2);
  const ctx = modulink.createContext({ 
    type: 'cli',
    args,
    filename: args[0] 
  });
  
  dataProcessingChain(ctx).then(result => {
    console.log('Processing complete:', result);
  });
});

// Or with external context passing
modulink.connect((app, modulink) => {
  // app will be null in standalone mode
  console.log('Running in standalone mode, app:', app);
  
  const ctx = modulink.createContext({ type: 'standalone' });
  dataProcessingChain(ctx);
});
```

### Why This Works

- **Clear Separation**: Business logic (chains) vs Integration (ModuLink instances)
- **Flexible Usage**: Works with app frameworks OR standalone execution
- **Auto-Detection**: Function arity determines which connect pattern to use
- **Each Pattern Excels**: Let each pattern handle what it does best  
- **Natural Developer Flow**: Create chains → Wire with ModuLink → Everything works
- **No Registry Needed**: Function references are passed directly

## Architectural Decisions Implemented

### ✅ **Multi-Level Middleware System**
```javascript
// Instance-level middleware (infrastructure concerns)
const modulink = createModuLink(app);
modulink.use(globalLogging());      // All requests
modulink.use(securityHeaders());    // All requests  
modulink.use(rateLimiting());       // All requests

// Chain-level middleware (business logic concerns)
const userChain = chain(validate, process, respond)
  .use(timing('user-processing'))
  .use(businessValidation());

// Everything cascades - global middleware + chain middleware both apply
modulink.connect((app, modu) => {
  app.post('/api/users', async (req, res) => {
    const ctx = modu.createContext({ req, res });
    const result = await userChain(ctx); // Both levels of middleware run
    res.json(result);
  });
});
```

### ✅ **No Registry System**
```javascript
// ❌ Old approach - registry-based (not implemented)
// modulink.registerChain('user-signup', userSignupChain);
// modulink.http('/api/signup', 'user-signup');

// ✅ New approach - direct function references
modulink.connect((app, modu) => {
  app.post('/api/signup', async (req, res) => {
    const ctx = modu.createContext({ req, res });
    const result = await userSignupChain(ctx); // Direct function call
    res.json(result);
  });
});
```

### ✅ **Immediate Connect Execution**
```javascript
// No separate "runConnects()" step needed - everything happens immediately

const modulink = createModuLink(app);

// This registers the route IMMEDIATELY
modulink.connect((app, modu) => {
  app.get('/immediate', (req, res) => {
    res.json({ message: 'Route registered instantly!' });
  });
});

// Server can start right away - all routes are already registered
app.listen(3000);
```

### ✅ **Function-First Architecture**
```javascript
// 1. Functions are first-class citizens
const processUser = (ctx) => ({ ...ctx, processed: true });
const validateInput = (ctx) => ({ ...ctx, validated: true });

// 2. Chains are composed functions
const userFlow = chain(validateInput, processUser);

// 3. ModuLink instances handle integration
const modulink = createModuLink(app);

// 4. Connect pattern wires them together
modulink.connect((app, modu) => {
  app.post('/users', async (req, res) => {
    const ctx = modu.createContext({ req, res });
    const result = await userFlow(ctx);
    res.json(result);
  });
});
```

## Usage Patterns

## Usage Patterns

### Pattern 1: Web Framework Integration
```javascript
import express from 'express';
import { createModuLink, chain } from 'modulink-js';

const app = express();
const modulink = createModuLink(app);

// Single parameter - app accessible via modulink.app
modulink.connect((modulink) => {
  modulink.app.get('/health', (req, res) => res.json({ status: 'ok' }));
});

// Two parameters - explicit app access (auto-detected by function arity)
modulink.connect((app, modulink) => {
  app.post('/api/process', async (req, res) => {
    const ctx = modulink.createContext({ req, res });
    // ... processing
  });
});
```

### Pattern 2: Standalone Scripts
```javascript
import { createModuLink, chain } from 'modulink-js';

const modulink = createModuLink(); // No app needed

const processFile = chain(readFile, validateData, processData, writeResults);

modulink.connect((modulink) => {
  const filename = process.argv[2];
  const ctx = modulink.createContext({ filename, type: 'file-processing' });
  
  processFile(ctx).then(result => {
    console.log(`Processed ${filename}:`, result);
    process.exit(0);
  });
});
```

### Pattern 3: Worker/Background Tasks
```javascript
import { createModuLink, chain } from 'modulink-js';

const modulink = createModuLink(); // Standalone mode

const jobProcessor = chain(fetchJob, validateJob, executeJob, reportResults);

modulink.connect((modulink) => {
  setInterval(async () => {
    const ctx = modulink.createContext({ 
      type: 'background-job',
      timestamp: Date.now()
    });
    
    await jobProcessor(ctx);
  }, 5000); // Process jobs every 5 seconds
});
```

### Pattern 4: Flexible Apps (Both Web and Standalone)
```javascript
import { createModuLink, chain } from 'modulink-js';
import express from 'express';

// Create with optional app - works in both modes
const app = process.env.WEB_MODE ? express() : null;
const modulink = createModuLink(app);

const dataProcessor = chain(validateInput, processData, formatOutput);

modulink.connect((app, modulink) => {
  if (app) {
    // Web mode - register HTTP endpoints
    app.post('/api/data', async (req, res) => {
      const ctx = modulink.createContext({ req, res, type: 'http' });
      const result = await dataProcessor(ctx);
      res.json(result);
    });
  } else {
    // Standalone mode - process command line arguments
    const ctx = modulink.createContext({ 
      type: 'cli',
      args: process.argv.slice(2)
    });
    
    dataProcessor(ctx).then(result => {
      console.log('Processing complete:', result);
    });
  }
});

// Start server only if app exists
if (app) {
  app.listen(3000, () => console.log('Server running on port 3000'));
}
```

### Pattern 5: Auto-Detection Based on Function Arity
```javascript
// ModuLink automatically detects which pattern to use based on function parameters

// This function takes 1 parameter - uses flexible connect with one parameter
modulink.connect((modulink) => {
  console.log('One parameter - app via modulink.app');
  modulink.app?.get('/single', (req, res) => res.json({ pattern: 'one-parameter' }));
});

// This function takes 2 parameters - uses flexible connect with two parameters  
modulink.connect((app, modulink) => {
  console.log('Two parameters - explicit app access');
  app?.get('/two', (req, res) => res.json({ pattern: 'two-parameter' }));
});
});

// You can mix and match in the same application!
```

## Middleware Usage Patterns

### ✅ Correct: General Middleware (Both APIs)
```javascript
// Simple function middleware
const withLogging = (ctx) => {
  console.log('Processing:', ctx.userId);
  return ctx; // Return transformed context
};

// Direct chain API
const loggedChain = chain(validateUser, processData)
  .use(withLogging);

// Application instance API
const loggedChain = app.createChain(validateUser, processData)
  .use(withLogging);

// Both support fluent chaining
chain(validateUser).use(withLogging);
app.createChain(validateUser).use(withLogging);
```

### ✅ Correct: Input/Output Positioning (Both APIs)
```javascript
// Input middleware - runs before each link
const withInputValidation = (ctx) => {
  if (!ctx.userId) {
    return { ...ctx, error: new Error('User ID required') };
  }
  return ctx;
};

// Output middleware - runs after each link
const withOutputLogging = (ctx) => {
  console.log('Link completed:', ctx._linkInfo?.name);
  return ctx;
};

// Both APIs support the same positioning
const validatedChain = chain(validateUser, processData)
  .use.onInput(withInputValidation)
  .use.onOutput(withOutputLogging);

const validatedChain = app.createChain(validateUser, processData)
  .use.onInput(withInputValidation)
  .use.onOutput(withOutputLogging);
```

### ✅ Correct: Chain-as-Middleware (Both APIs)
```javascript
// Create reusable middleware chains with either API
const authChain = chain(validateToken, checkPermissions);
const auditChain = app.createChain(logActivity, recordMetrics);

// Use chains as middleware - APIs can be mixed
const secureProcessing = chain(processData, formatResponse)
  .use(authChain)      // Runs for metadata/validation
  .use(auditChain);    // Runs for logging/metrics

const secureProcessing = app.createChain(processData, formatResponse)
  .use(authChain)      // Same behavior
  .use(auditChain);    // Same behavior
```

// ❌ INCORRECT - DANGEROUS PATTERN
// Using .use() on authChain and auditChain is bad practice. Fine for debugging these chains
// but should NEVER be in production or even sustained in dev. This risks exponential complexity.
// 
// Under the hood we are O(n*m) where:
// - n = number of links in main chain
// - m = number of middleware
//
// But using .use() on a chain that is being used as middleware creates:
// O(n * m * k * j * ...) where each nested middleware chain adds another dimension
//
// Example: If authChain has 3 middleware and auditChain has 2 middleware:
// - Main chain: 2 links
// - Middleware: 2 chains (authChain, auditChain)  
// - AuthChain middleware: 3 functions
// - AuditChain middleware: 2 functions
// - Result: (2 * 3) + (2 * 2) = 6 + 4 = 10 operations per execution
// But if we start .use() on the middleware chains, say even just 2 checks per.
// - Result: (2 * 3 * 2) + (2 * 2 * 2) = 12 + 8 = 20 operations per execution
//
// This grows exponentially with each level of nesting and can cause:
// - Infinite recursion loops
// - Performance degradation
// - Memory leaks
// - Unpredictable execution order

## Context and Metadata

### ✅ Correct: Using ctx._meta for Middleware
```javascript
const timingMiddleware = (ctx) => {
  if (!ctx._meta.startTime) {
    // Input phase - start timing
    ctx._meta.startTime = Date.now();
  } else {
    // Output phase - calculate duration
    ctx._meta.duration = Date.now() - ctx._meta.startTime;
  }
  return ctx;
};
```

### ❌ Incorrect: Polluting main context
```javascript
const badMiddleware = (ctx) => {
  // Don't add middleware internals to main context
  ctx.middlewareState = { started: true };
  ctx._internal = { debug: true };
  return ctx;
};
```

### ✅ Correct: Error Handling
```javascript
const processUser = async (ctx) => {
  if (!ctx.userId) {
    return { ...ctx, error: new Error('User ID required') };
  }
  
  try {
    const user = await getUserById(ctx.userId);
    return { ...ctx, user };
  } catch (error) {
    return { ...ctx, error };
  }
};

// Chain automatically stops on error
const userChain = chain(processUser, formatUser);
```

## Real-World Examples

### Example 1: HTTP API Processing
```javascript
import { chain, logging, timing, errorHandler } from 'modulink';

// Validation middleware
const validateRequest = (ctx) => {
  const { method, path, body } = ctx.request;
  if (method !== 'POST') {
    return { ...ctx, error: new Error('Method not allowed') };
  }
  return { ...ctx, validated: true };
};

// Rate limiting middleware
const rateLimit = (ctx) => {
  const userId = ctx.request.headers['user-id'];
  if (isRateLimited(userId)) {
    return { ...ctx, error: new Error('Rate limit exceeded') };
  }
  return ctx;
};

// Business logic links
const parseRequest = (ctx) => ({
  ...ctx,
  data: JSON.parse(ctx.request.body)
});

const processBusinessLogic = async (ctx) => {
  const result = await businessService.process(ctx.data);
  return { ...ctx, result };
};

const formatResponse = (ctx) => ({
  ...ctx,
  response: {
    success: true,
    data: ctx.result,
    timestamp: new Date().toISOString()
  }
});

// Complete API chain
const apiChain = chain(parseRequest, processBusinessLogic, formatResponse)
  .use.onInput(validateRequest, rateLimit)           // Validate before each link
  .use(logging({ level: 'info' }))                   // Log everything
  .use(timing({ label: 'api-request', expose: true })) // Time execution
  .use.onOutput(errorHandler);                       // Handle errors after processing
```

### Example 2: Data Processing Pipeline
```javascript
// Reusable validation chain
const dataValidation = chain(
  checkSchema,
  sanitizeInput,
  validateBusiness
);

// Processing chain
const dataProcessing = chain(
  transformData,
  enrichData,
  persistData
);

// Audit chain
const auditTrail = chain(
  logOperation,
  recordMetrics,
  notifyMonitoring
);

// Complete pipeline using chains as middleware
const dataPipeline = chain(processRecord, generateReport)
  .use(dataValidation)    // Validate in _meta context
  .use(auditTrail)        // Audit in _meta context
  .use(dataProcessing);   // Additional processing in _meta
```

### Example 3: Microservice Coordination
```javascript
// Service-specific chains
const userService = chain(validateUser, enrichUserData);
const orderService = chain(validateOrder, calculateTotals);
const inventoryService = chain(checkStock, reserveItems);

// Coordination middleware
const coordinateServices = (ctx) => {
  ctx._meta.services = {
    user: !!ctx.user,
    order: !!ctx.order,
    inventory: !!ctx.inventory
  };
  return ctx;
};

// Main orchestration
const orderProcessing = chain(createOrder, processPayment, fulfillOrder)
  .use(userService)          // User validation in middleware
  .use(orderService)         // Order processing in middleware  
  .use(inventoryService)     // Inventory checks in middleware
  .use(coordinateServices);  // Coordination logic
```

## Utility Middleware

### Built-in Middleware Concepts
```javascript
import { chain } from 'modulink';

// Note: These are conceptual examples of middleware that could be built
// Some may be available as utility functions in the ModuLink ecosystem

const enhancedChain = chain(processData, formatOutput)
  .use(loggingMiddleware({ 
    level: 'debug',
    includeTiming: true,
    includeContext: false 
  }))
  .use(timingMiddleware({ 
    label: 'processing-time',
    expose: true 
  }))
  .use(errorHandlerMiddleware({ 
    includeStack: false,
    logErrors: true 
  }));
```

### Custom Middleware Patterns
```javascript
// Middleware factory pattern
const createCacheMiddleware = (ttl = 3600) => (ctx) => {
  const cacheKey = generateCacheKey(ctx);
  const cached = cache.get(cacheKey);
  
  if (cached) {
    ctx._meta.fromCache = true;
    return { ...ctx, ...cached };
  }
  
  return ctx;
};

// Conditional middleware
const devOnlyMiddleware = (ctx) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Debug info:', ctx);
  }
  return ctx;
};

// Async middleware
const asyncEnrichment = async (ctx) => {
  const enrichedData = await externalService.enrich(ctx.data);
  ctx._meta.enriched = true;
  return { ...ctx, enrichedData };
};
```

## Anti-Patterns to Avoid

### ❌ Don't: Modify context directly
```javascript
const badMiddleware = (ctx) => {
  ctx.newProp = 'value'; // Mutates original context
  return ctx;
};
```

### ❌ Don't: Use complex middleware signatures
```javascript
const complexMiddleware = (ctx, next, options, state) => {
  // Too complex - keep it simple
  return next(ctx);
};
```

### ❌ Don't: Mix concerns in single middleware
```javascript
const doEverythingMiddleware = (ctx) => {
  // Validation
  if (!ctx.valid) return { ...ctx, error: new Error('Invalid') };
  
  // Logging
  console.log('Processing...');
  
  // Business logic
  ctx.processed = processData(ctx.data);
  
  // Formatting
  ctx.response = formatResponse(ctx.processed);
  
  return ctx; // Too many responsibilities
};
```

### ✅ Do: Single responsibility middleware
```javascript
const validation = (ctx) => ctx.valid ? ctx : { ...ctx, error: new Error('Invalid') };
const logging = (ctx) => { console.log('Processing...'); return ctx; };
const processing = (ctx) => ({ ...ctx, processed: processData(ctx.data) });
const formatting = (ctx) => ({ ...ctx, response: formatResponse(ctx.processed) });

// Compose them cleanly
const processChain = chain(mainLogic)
  .use.onInput(validation, logging)
  .use.onOutput(formatting);
```

## Migration from Legacy Patterns

### Old Pattern (❌)
```javascript
const addStarted = (ctx) => {
  // Complex state management
  ctx.req.state = { started: Date.now() };
  ctx.next();
}
// Complex middleware with next() callbacks
app.use(addStarted);

app.use((req, res, next) => {
  try {
    processRequest(req);
    next();
  } catch (error) {
    next(error);
  }
});
```

### New Pattern (✅)
```javascript
// Simple transformation middleware
const addTiming = (ctx) => ({
  ...ctx,
  _meta: { ...ctx._meta, started: Date.now() }
});

const processRequest = (ctx) => {
  try {
    const result = businessLogic(ctx.request);
    return { ...ctx, result };
  } catch (error) {
    return { ...ctx, error };
  }
};

// main business chain
const apiHandler = chain(parseRequest, processRequest, formatResponse)
  .use(addTiming); // middleware added after each link runs
```

## Performance Considerations

### ✅ Efficient Middleware
```javascript
// Lightweight middleware
const quickCheck = (ctx) => ctx.valid ? ctx : { ...ctx, error: new Error('Invalid') };

// Conditional expensive operations
const expensiveMiddleware = (ctx) => {
  if (!ctx._meta.needsExpensive) return ctx;
  
  const result = expensiveOperation(ctx);
  return { ...ctx, ...result };
};
```

### ❌ Inefficient Middleware
```javascript
// Heavy operations in every middleware call
const heavyMiddleware = (ctx) => {
  const data = JSON.parse(JSON.stringify(ctx)); // Unnecessary deep clone
  const result = expensiveComputation(data);     // Always runs
  return { ...ctx, ...result };
};
```

---

## Summary

The clean chain architecture emphasizes:

1. **Simplicity**: Middleware are just context transformations
2. **Clarity**: Clear separation between main logic and middleware concerns
3. **Composability**: Chains can be middleware for other chains
4. **Performance**: Minimal overhead with maximum flexibility
5. **Maintainability**: Easy to understand, test, and debug

Keep middleware focused on single responsibilities, use `ctx._meta` for middleware state, and compose functionality through chain combination rather than complex middleware signatures.

## Important: Understanding Connect Parameter Relationships

### Flexible Connect - Two Parameters Relationship

**Key Insight**: In the flexible connect with two parameters `fn(app, modulink)`, both parameters relate to the **same ModuLink instance**:

```javascript
modulink.connect((app, modulink) => {
  // IMPORTANT: These are the same!
  console.log(app === modulink.app); // true
  
  // app parameter is just modulink.app extracted for convenience
  // modulink parameter is the full ModuLink instance
  
  // Both of these do the same thing:
  app.get('/route1', handler);
  modulink.app.get('/route2', handler);
  
  // Access other ModuLink features via modulink parameter:
  const ctx = modulink.createContext({ type: 'http' });
  modulink.use(middlewareFunction);
});
```

### Why Two Parameters?

Flexible connect with two parameters provides **convenience**, not different instances:

1. **Traditional Express Style**: `app.get()` feels familiar to Express developers
2. **Less Typing**: `app.get()` vs `modulink.app.get()`  
3. **Pattern Recognition**: Matches common Express middleware patterns

### Variable Naming Guidelines

To avoid confusion, use clear variable names:

```javascript
// ✅ GOOD: Clear that both relate to same instance
modulink.connect((app, modulink) => {
  // app = modulink.app (convenience access)
  app.get('/health', handler);
});

// ✅ GOOD: Alternative clear naming
modulink.connect((app, modu) => {
  // app = modu.app (convenience access)
  app.get('/health', handler);
});

// ❌ CONFUSING: Don't use similar names
modulink.connect((modulink1, modulink2) => {
  // Suggests two different instances (not true!)
});

// ❌ CONFUSING: Don't use generic names
modulink.connect((a, b) => {
  // Unclear what each parameter represents
});
```

### Standalone Mode with Flexible Connect

When no app is provided, the first parameter will be `null`:

```javascript
const standalone = createModuLink(); // No app

standalone.connect((app, modulink) => {
  console.log(app); // null - no app framework
  console.log(modulink.app); // null - same as app parameter
  
  // Use ModuLink features that don't require app:
  const ctx = modulink.createContext({ type: 'standalone' });
  processFileChain(ctx);
});
```
