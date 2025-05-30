# ModuLink JavaScript Library - LLM Guide

## Quick Overview for LLMs

ModuLink is a JavaScript library that unifies HTTP endpoints, cron jobs, and CLI commands under a single function chain API.

## Core Pattern

1. **Create instance**: `const modulink = new Modulink(app)` (where `app` is Express)
2. **Add middleware**: `modulink.use(async ctx => { ... return ctx; })`
3. **Create chains**: Arrays of `async ctx => { ... return ctx; }` functions
4. **Register triggers**: 
   - HTTP: `modulink.when.http('/path', ['POST'], chainArray)`
   - Cron: `modulink.when.cron('0 * * * *', chainArray)`
   - CLI: `modulink.when.cli('command', chainArray)`

## Context Object (`ctx`)

The `ctx` object flows through all functions:
- HTTP: Contains `{req, res, next, app}` + request data
- Cron/CLI: Starts empty, gets populated by chain functions
- Add `ctx.result` for output, `ctx.error` for error handling

## Function Chain Example

```javascript
const validateStep = async ctx => {
  if (!ctx.req.body.value) {
    ctx.error = { message: 'Value required', status: 400 };
    return ctx;
  }
  ctx.validated = parseInt(ctx.req.body.value);
  return ctx;
};

const processStep = async ctx => {
  if (ctx.error) return ctx; // Skip on error
  ctx.result = { doubled: ctx.validated * 2 };
  return ctx;
};

// Use the chain
modulink.when.http('/api/double', ['POST'], [validateStep, processStep]);
```

## Important for Tests

Always call `modulink.cleanup()` in test cleanup to prevent Jest hanging:

```javascript
afterAll(() => modulink.cleanup());
```

## Key Points

- Functions are **pure**: take `ctx`, return modified `ctx`
- Middleware runs automatically on all chains created with instance
- Error handling: set `ctx.error` and subsequent steps can check/skip
- ES modules only (requires `"type": "module"` in package.json)
- Version 2.0.0+ has Jest hanging issues resolved via proper cron cleanup
