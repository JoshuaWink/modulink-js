# ModuLink Clean Chain Architecture Cookbook

## Overview

This cookbook demonstrates the correct usage patterns for ModuLink's clean chain architecture. The key principles are:

1. **Simple transformations** - Middleware just transforms context, no complex `next` parameters
2. **Reserved `ctx._meta`** - Exclusively for middleware context and state
3. **Chain-as-middleware** - Chains can be used as middleware via `.use(anotherChain)`
4. **Granular positioning** - Input/output middleware for precise control
5. **Dual API support** - Use `chain()` directly or `app.createChain()` - both work identically

## Basic Chain Creation

### ✅ Correct: Simple Chain Creation (Both APIs)
```javascript
// Option 1: Direct import (simpler, preferred)
import { chain } from 'modulink';
const processUser = chain(validateUser, processData, formatResponse);

// Option 2: Application instance method
import { createModulink } from 'modulink';
const app = createModulink();
const processUser = app.createChain(validateUser, processData, formatResponse);

// Both execute identically
const result = await processUser({ userId: '123' });
```

### ❌ Incorrect: Empty chains
```javascript
const emptyChain = chain(); // Throws error - chains need at least one link
const emptyChain = app.createChain(); // Also throws error
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
