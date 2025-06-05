# ModuLink JavaScript Library

![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![ES Modules](https://img.shields.io/badge/ES%20Modules-✓-success.svg)

A modern JavaScript library for building modular applications with unified processing for HTTP, cron jobs, CLI commands, and message handling. Built on a hybrid architecture that combines clean function-based chains with flexible integration patterns.

## ✨ What Makes ModuLink Special

- 🔗 **Hybrid Architecture**: Clean function chains + flexible integration patterns  
- 🎯 **Auto-Detection**: Automatically detects single vs two-parameter connect patterns
- 🧬 **Universal Patterns**: Same approach for HTTP, cron, CLI, standalone scripts
- ⚡ **Modern JavaScript**: ES modules, async/await, and clean APIs
- 🛡️ **Built-in Error Handling**: Graceful error propagation and recovery
- 🔧 **Powerful Middleware**: Observable middleware system for logging, timing, and monitoring
- 📦 **Zero Configuration**: Works with or without web frameworks

## 🏗️ Core Architecture

ModuLink combines **Business Logic** (chains) with **Integration** (ModuLink instances):

### Business Logic Layer
| Type | Purpose | Example |
|------|---------|---------|
| **Ctx** | Context object passed between functions | `{ user: { id: 123 }, data: {...} }` |
| **Link** | Pure function with single responsibility | `validateUser`, `saveData`, `sendEmail` |
| **Chain** | Sequence of links with middleware support | `chain(validate, process, respond)` |

### Integration Layer  
| Type | Purpose | Example |
|------|---------|---------|
| **ModuLink** | Integration instance with middleware | `createModuLink(app)` |
| **Connect** | Flexible wiring with auto-detection | `modulink.connect(fn)` |
| **Triggers** | Event sources (HTTP, cron, CLI) | Routes, schedules, commands |

## 🚀 Quick Start

### Installation

```bash
npm install modulink-js
```

### Flexible Connect Patterns

ModuLink auto-detects your preferred pattern based on function arity:

```javascript
import { chain, createModuLink } from 'modulink-js';
import express from 'express';

const app = express();
const modulink = createModuLink(app);

// Two-parameter pattern: fn(app, modulink)
modulink.connect((app, modu) => {
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
});

// Single-parameter pattern: fn(modulink) 
modulink.connect((modu) => {
  modu.app.get('/status', (req, res) => {
    res.json({ status: 'running' });
  });
});

// Standalone mode (no app framework)
const standalone = createModuLink();
standalone.connect((modu) => {
  // Process files, run CLI scripts, etc.
});
```

### Business Logic with Chains

```javascript
// Define pure business logic functions
const validateInput = (ctx) => {
  if (!ctx.body?.email) {
    return { ...ctx, error: new Error('Email is required') };
  }
  return { ...ctx, validated: true };
};

const processUser = async (ctx) => {
  if (ctx.error) return ctx;
  const user = await createUser(ctx.body);
  return { ...ctx, user };
};

const formatResponse = (ctx) => {
  if (ctx.error) {
    return { ...ctx, response: { error: ctx.error.message }, status: 400 };
  }
  return { ...ctx, response: { user: ctx.user }, status: 201 };
};

// Create processing chain
const userSignupChain = chain(validateInput, processUser, formatResponse);

// Connect to routes with either pattern
modulink.connect((app, modu) => {
  app.post('/api/signup', async (req, res) => {
    const ctx = modu.createContext({
      body: req.body,
      method: 'POST',
      path: '/api/signup'
    });
    
    const result = await userSignupChain(ctx);
    res.status(result.status || 200).json(result.response);
  });
});
```

## 🔄 Five Usage Patterns

### 1. Web Framework Integration (Two-Parameter)
```javascript
// Traditional pattern with explicit app access
modulink.connect((app, modu) => {
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
});
```

### 2. Web Framework Integration (Single-Parameter)  
```javascript
// Modern pattern using modu.app
modulink.connect((modu) => {
  modu.app.get('/status', (req, res) => {
    res.json({ status: 'running' });
  });
});
```

### 3. Standalone Scripts
```javascript
// No app framework needed
const modulink = createModuLink();
modulink.connect((modu) => {
  const filename = process.argv[2];
  const ctx = modu.createContext({ filename, type: 'file-processing' });
  // Process files, CLI commands, etc.
});
```

### 4. Background Workers & Cron Jobs
```javascript
// Scheduled tasks and background processing
modulink.connect((modu) => {
  modu.cron('0 0 * * *', async () => {
    const ctx = modu.createContext({ type: 'daily-cleanup' });
    await cleanupChain(ctx);
  });
});
```

### 5. Flexible Apps (Auto-Detection)
```javascript
// Same code works with or without app
function setupModule(modulink) {
  // Works in both standalone and web modes
  if (modulink.app) {
    // Web-specific setup
    modulink.app.get('/api/status', handler);
  }
  // Always available: CLI, cron, etc.
  modulink.cli('status', statusChain);
}

modulink.connect(setupModule); // Auto-detects single parameter
```

## 🔧 Middleware System

Instance-level middleware runs before chains:

```javascript
// Add timing middleware
modulink.use(async (ctx, next) => {
  ctx.startTime = Date.now();
  await next();
  console.log(`Completed in ${Date.now() - ctx.startTime}ms`);
});

// Add logging middleware
modulink.use(async (ctx, next) => {
  console.log(`Processing: ${ctx.type || 'unknown'}`);
  await next();
});

// All chains now include this middleware automatically
```

## 🎯 Core Concepts

### Immediate Execution Pattern
```javascript
// Connect immediately executes the function
modulink.connect((modu) => {
  // This runs RIGHT NOW, not later
  console.log('Setting up routes...');
  
  modu.app.get('/ready', (req, res) => {
    res.json({ ready: true });
  });
});
```

### Context Creation
```javascript
// Create rich context objects
const ctx = modulink.createContext({
  userId: 123,
  requestId: 'req-456',
  type: 'user-update',
  startTime: Date.now()
});

// Context flows through entire chain
const result = await updateUserChain(ctx);
```

### Error Propagation
```javascript
// Errors flow naturally through chains
const safeChain = chain(
  (ctx) => ctx.error ? ctx : validateData(ctx),
  (ctx) => ctx.error ? ctx : processData(ctx),  
  (ctx) => ctx.error ? ctx : saveData(ctx)
);

// Or use built-in error handling
safeChain.use(errorHandler());
```

## 📚 Examples

Check out the comprehensive examples:

- `examples/index-flexible.js` - All connect patterns working together
- `examples/standalone-example.js` - File processing without web framework  
- `examples/connect-flexible.js` - Helper functions for both patterns
- `docs/clean-chain-cookbook.md` - Complete architectural guide

## 🧪 Testing

Test business logic and integration separately:

```javascript
// Test pure business logic
describe('validateInput', () => {
  test('should validate email', () => {
    const ctx = { body: { email: 'test@example.com' } };
    const result = validateInput(ctx);
    expect(result.validated).toBe(true);
  });
});

// Test integration patterns
describe('connect patterns', () => {
  test('should auto-detect single parameter', () => {
    const mockFn = jest.fn();
    modulink.connect(mockFn);
    expect(mockFn).toHaveBeenCalledWith(modulink);
  });
});
```

## 🔗 Key Benefits

1. **Function-First**: Pure functions for business logic, instances for integration
2. **Auto-Detection**: No need to remember which pattern to use  
3. **Universal**: Same patterns work everywhere (HTTP, CLI, cron, standalone)
4. **Flexible**: Works with or without web frameworks
5. **Testable**: Easy to test business logic and integration separately
6. **Observable**: Built-in middleware for monitoring and debugging

## 📄 License

Apache License 2.0 - see [LICENSE](./LICENSE) file for details.

---

**ModuLink**: Hybrid architecture for modern JavaScript applications. Clean function chains meet flexible integration patterns.
