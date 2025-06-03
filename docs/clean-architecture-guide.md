# Clean Chain Architecture Guide

## Overview

ModuLink's Clean Chain Architecture represents a fundamental shift in how chain execution and observability are handled. This architecture separates concerns, eliminates metadata bloat, and provides conditional observability only when explicitly requested.

## Architecture Principles

### 1. Separation of Concerns

**Chain Execution**: Pure, lightweight execution flow
- Focuses solely on link execution logic
- No automatic metadata injection
- O(n) complexity for n links
- Minimal memory footprint

**Observability Middleware**: Dedicated observation layer
- Performance tracking only when needed
- Logging only when configured
- Timing only when requested
- Metadata only when explicitly enabled

### 2. Conditional Metadata

```javascript
// Simple chain - NO metadata bloat
const simpleChain = chain(link1, link2, link3);
const result = await simpleChain(ctx);
// result has NO _metadata, _observedBy, or _performance properties

// Observed chain - metadata ONLY when requested
const observedChain = chain(link1, link2, link3)
  .use(performanceTracker())
  .use(logging())
  .use(timing());
const result = await observedChain(ctx);
// result has metadata ONLY from explicitly added middleware
```

### 3. Advanced Middleware Positioning

```javascript
const chain = chain(link1, link2, link3)
  .use.onInput(preprocessor)    // Runs BEFORE each link
  .use.onOutput(postprocessor)  // Runs AFTER each link
  .use(finalProcessor);         // Legacy: runs after each link (same as onOutput)
```

## API Reference

### Core Chain Function

```javascript
import { chain } from 'modulink';

const myChain = chain(...links);
```

**Execution Flow:**
1. For each link:
   - Run input middleware
   - Execute link 
   - Run output middleware
   - Stop on error

### Middleware Positioning Methods

#### `.use(...middleware)` - Legacy/Default
```javascript
chain(link1, link2).use(middleware1, middleware2);
// Equivalent to .use.onOutput()
```

#### `.use.onInput(...middleware)` - Pre-link
```javascript
chain(link1, link2).use.onInput(validator, logger);
// Runs before each link execution
```

#### `.use.onOutput(...middleware)` - Post-link  
```javascript
chain(link1, link2).use.onOutput(metrics, audit);
// Runs after each link execution
```

### Dedicated Middleware

#### `performanceTracker(options)`
Adds performance metadata only when explicitly used.

```javascript
import { performanceTracker } from 'modulink';

const options = {
  trackTimings: true,      // Track link execution timings
  trackMemory: false,      // Track memory usage  
  trackMiddleware: false,  // Track middleware overhead
  generateChainId: true    // Generate unique chain execution ID
};

const trackedChain = chain(link1, link2)
  .use(performanceTracker(options));
```

**Metadata Added:**
```javascript
{
  _metadata: {
    chainId: "abc123def",
    startTime: 1640995200000,
    linkTimings: [
      { linkIndex: 0, duration: 5, timestamp: "2021-12-31T12:00:00Z" },
      { linkIndex: 1, duration: 3, timestamp: "2021-12-31T12:00:00Z" }
    ]
  },
  _performance: {
    memoryUsage: 1048576  // Only if trackMemory: true
  }
}
```

#### `logging(options)`
Provides clean, focused logging functionality.

```javascript
import { logging } from 'modulink';

const options = {
  level: 'info',              // Log level: debug, info, warn, error
  detectFunctionNames: true,  // Auto-detect function names
  logInput: false,           // Log input context
  logOutput: false,          // Log output context  
  logTiming: false           // Log execution timing
};

const loggedChain = chain(link1, link2)
  .use(logging(options));
```

**Metadata Added:**
```javascript
{
  _observedBy: {
    logging: {
      functionName: "processData",
      timestamp: "2021-12-31T12:00:00Z",
      level: "info"
    }
  }
}
```

#### `timing(label)`
Dedicated execution timing middleware.

```javascript
import { timing } from 'modulink';

const timedChain = chain(link1, link2)
  .use(timing('user-processing'));
```

**Metadata Added:**
```javascript
{
  timings: {
    "user-processing": {
      start: 1640995200000,
      current: 1640995205000,
      duration: 5000,
      timestamp: "2021-12-31T12:00:00Z"
    }
  }
}
```

## Usage Patterns

### 1. Development vs Production

```javascript
// Development: Full observability
const devChain = chain(validate, process, respond)
  .use.onInput(logging({ logInput: true, level: 'debug' }))
  .use.onOutput(logging({ logOutput: true }))
  .use(performanceTracker({ trackMemory: true }))
  .use(timing('dev-processing'));

// Production: Clean execution
const prodChain = chain(validate, process, respond);
// Zero overhead, no metadata
```

### 2. Conditional Observability

```javascript
let apiChain = chain(auth, validate, process, respond);

// Add observability based on environment
if (process.env.NODE_ENV === 'development') {
  apiChain = apiChain
    .use(performanceTracker())
    .use(logging({ detectFunctionNames: true }));
}

// Always add error handling
apiChain = apiChain.use(errorHandler());
```

### 3. Granular Middleware Control

```javascript
const preciseChain = chain(validate, transform, save)
  .use.onInput(
    securityCheck,    // Before each link
    inputLogging      // Log inputs
  )
  .use.onOutput(
    metricsCollection, // After each link
    auditTrail        // Audit outputs
  )
  .use(
    errorHandler,     // Final error handling
    responseFormatter // Final response
  );
```

### 4. Performance-Critical Paths

```javascript
// Hot path: Zero overhead
const hotPathChain = chain(
  criticalValidation,
  highFrequencyProcessing,
  fastResponse
);

// Monitoring path: Full observability  
const monitoredChain = chain(
  criticalValidation,
  highFrequencyProcessing, 
  fastResponse
)
  .use(performanceTracker({ trackTimings: true }))
  .use(timing('critical-path'));
```

## Performance Characteristics

### Memory Usage

| Chain Type | Memory Overhead | Use Case |
|------------|----------------|----------|
| Simple chain | 0 bytes | Production hot paths |
| With logging | ~100 bytes | Development/debugging |
| With performance tracking | ~200 bytes | Monitoring/analytics |
| Full observability | ~500 bytes | Development/troubleshooting |

### Execution Speed

| Middleware | Overhead per Link | When to Use |
|------------|------------------|-------------|
| None | 0ms | Always (production) |
| Logging | ~0.1ms | Development/debugging |
| Performance tracking | ~0.2ms | Monitoring |
| Full stack | ~0.5ms | Development only |

## Migration Guide

### From Bloated Implementation

**Before (with metadata bloat):**
```javascript
// Old implementation automatically added metadata
const result = await chain(link1, link2)(ctx);
// result always had _metadata, _performance, etc.
```

**After (clean implementation):**
```javascript
// New implementation: clean by default
const result = await chain(link1, link2)(ctx);
// result has NO automatic metadata

// Metadata only when explicitly requested
const observedResult = await chain(link1, link2)
  .use(performanceTracker())
  .use(logging())(ctx);
// observedResult has metadata only from explicit middleware
```

### Backward Compatibility

The clean architecture maintains full backward compatibility:

```javascript
// Legacy .use() method still works
const legacyChain = chain(link1, link2)
  .use(middleware1)
  .use(middleware2);

// New positioning methods are additive
const modernChain = chain(link1, link2)
  .use.onInput(inputMiddleware)
  .use.onOutput(outputMiddleware)
  .use(legacyMiddleware); // Still works
```

## Best Practices

### 1. Choose the Right Pattern

```javascript
// ✅ DO: Use simple chains for production hot paths
const productionChain = chain(validate, process, respond);

// ✅ DO: Use observability for development/debugging
const devChain = chain(validate, process, respond)
  .use(logging({ level: 'debug' }))
  .use(performanceTracker());

// ❌ AVOID: Unnecessary observability in production
const bloatedProdChain = chain(validate, process, respond)
  .use(logging({ logInput: true, logOutput: true }))
  .use(performanceTracker({ trackMemory: true }));
```

### 2. Layer Middleware Strategically

```javascript
// ✅ DO: Position middleware appropriately
const strategicChain = chain(validate, process, respond)
  .use.onInput(authentication)     // Security first
  .use.onOutput(metricsCollection) // Monitor outputs
  .use(errorHandler);              // Handle all errors

// ❌ AVOID: Wrong positioning
const poorChain = chain(validate, process, respond)
  .use(errorHandler)               // Too early
  .use.onInput(metricsCollection); // Wrong phase
```

### 3. Environment-Specific Configuration

```javascript
// ✅ DO: Environment-based observability
function createApiChain() {
  let chain = chain(auth, validate, process, respond);
  
  if (isDevelopment) {
    chain = chain.use(logging()).use(performanceTracker());
  }
  
  if (isProduction) {
    chain = chain.use(errorHandler());
  }
  
  return chain;
}
```

### 4. Performance Monitoring

```javascript
// ✅ DO: Monitor performance trade-offs
const benchmark = async () => {
  const simple = chain(link1, link2, link3);
  const observed = chain(link1, link2, link3).use(performanceTracker());
  
  const simpleTime = await measureExecution(simple);
  const observedTime = await measureExecution(observed);
  
  console.log(`Overhead: ${observedTime - simpleTime}ms`);
};
```

## Advanced Patterns

### 1. Conditional Middleware

```javascript
const conditionalChain = (enableDebug) => {
  let chain = chain(validate, process, respond);
  
  if (enableDebug) {
    chain = chain
      .use.onInput(logging({ logInput: true }))
      .use.onOutput(logging({ logOutput: true }));
  }
  
  return chain;
};
```

### 2. Middleware Composition

```javascript
const createObservabilityStack = (options) => ({
  onInput: [
    logging({ level: options.logLevel }),
    timing(`${options.label}-input`)
  ],
  onOutput: [
    performanceTracker(options.performance),
    timing(`${options.label}-output`)
  ]
});

const observedChain = chain(validate, process, respond)
  .use.onInput(...observabilityStack.onInput)
  .use.onOutput(...observabilityStack.onOutput);
```

### 3. Dynamic Middleware

```javascript
class ChainBuilder {
  constructor(...links) {
    this.chain = chain(...links);
  }
  
  withLogging(level = 'info') {
    this.chain = this.chain.use(logging({ level }));
    return this;
  }
  
  withPerformanceTracking(options = {}) {
    this.chain = this.chain.use(performanceTracker(options));
    return this;
  }
  
  build() {
    return this.chain;
  }
}

const dynamicChain = new ChainBuilder(validate, process, respond)
  .withLogging('debug')
  .withPerformanceTracking({ trackMemory: true })
  .build();
```

## Troubleshooting

### Common Issues

**1. Missing Middleware Metadata**
```javascript
// Problem: Expected metadata not present
const result = await chain(link1, link2)(ctx);
console.log(result._metadata); // undefined

// Solution: Add explicit middleware
const result = await chain(link1, link2)
  .use(performanceTracker())(ctx);
console.log(result._metadata); // present
```

**2. Performance Degradation**
```javascript
// Problem: Unexpected slowdown
const slowChain = chain(link1, link2)
  .use(logging({ logInput: true, logOutput: true }))
  .use(performanceTracker({ trackMemory: true }));

// Solution: Remove unnecessary observability
const fastChain = chain(link1, link2);
// or use conditional observability
const conditionalChain = chain(link1, link2)
  .use(process.env.DEBUG ? logging() : (ctx) => ctx);
```

**3. Middleware Execution Order**
```javascript
// Problem: Wrong execution order
const confusedChain = chain(link1, link2)
  .use(errorHandler)    // Runs after each link
  .use.onInput(validator); // Runs before each link

// Solution: Use appropriate positioning
const clearChain = chain(link1, link2)
  .use.onInput(validator)  // Before links
  .use.onOutput(metrics)   // After links  
  .use(errorHandler);      // Final handling
```

## Conclusion

The Clean Chain Architecture provides:

- **Zero-overhead execution** for production paths
- **Conditional observability** for development/debugging
- **Precise middleware control** for complex scenarios
- **Backward compatibility** with existing code
- **Clear performance trade-offs** for informed decisions

This architecture enables you to write high-performance, maintainable code that can be easily observed and debugged when needed, without sacrificing production performance.
