# ModuLink JavaScript Library

A minimal JavaScript library for building modular applications with unified triggers for HTTP, cron jobs, and CLI commands.

> **Version 2.1.0**: ES modules with modern function chain pattern. All tests passing (35/35). Jest hanging issues resolved.

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
import Modulink from './modulink/modulink.js';

const app = express();
app.use(express.json());

const modulink = new Modulink(app);

// Add global middleware
modulink.use(async (ctx) => {
  console.log(`${ctx.req.method} ${ctx.req.path}`);
  return ctx;
});

// Define function chain steps
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
  if (ctx.error) return ctx;
  
  ctx.result = {
    original: ctx.validatedValue,
    doubled: ctx.validatedValue * 2,
    timestamp: new Date()
  };
  return ctx;
};

// Register and use triggers
modulink.when.http('/api/process', ['POST'], [validateData, processData]);
modulink.when.cron('0 * * * *', [validateData, processData]);
modulink.when.cli('process-data', [validateData, processData]);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Core Concepts

- **Context Object (`ctx`)**: Data carrier passed through function chains
- **Function Chains**: Sequences of handler functions that process `ctx`
- **Triggers**: HTTP routes, cron jobs, or CLI commands that execute chains
- **Middleware**: Global functions applied to all chains via `modulink.use()`

### Context Structure

```javascript
// HTTP requests
const ctx = {
  req,          // Express request
  res,          // Express response  
  next,         // Express next function
  app,          // Express app
  result: {},   // Chain results
  error: null   // Error state
};
```

## API Reference

### Instance Methods

- `modulink.use(middleware)` - Add global middleware
- `modulink.when.http(path, methods, handler)` - HTTP trigger
- `modulink.when.cron(schedule, handler)` - Cron trigger  
- `modulink.when.message(topic, handler)` - Message trigger (pub/sub, queue, or event bus)
- `modulink.when.cli(command, handler)` - CLI trigger
- `modulink.cleanup()` - Clean up resources (important for tests)

### Message Trigger Example

```javascript
// Register a message trigger (default: logs a warning unless a custom provider is used)
modulink.when.message('my-topic', async (ctx) => {
  console.log('Received message on my-topic:', ctx);
});
```

### Static Methods

- `Modulink.chain(...steps)` - Create function chain without middleware

## Testing

```bash
npm test
```

For test environments, ensure proper cleanup:

```javascript
// In test files
afterAll(() => {
  if (modulink && typeof modulink.cleanup === 'function') {
    modulink.cleanup();
  }
});
```

## Modular Triggers (v2.1.0)

ModuLink now supports pluggable trigger providers, allowing you to use any scheduling, messaging, or CLI library while maintaining convenient defaults.

### Using Custom Trigger Providers

```javascript
import { Modulink } from './modulink/modulink.js';
import customCronLib from 'my-custom-cron';
import customMessageBroker from 'my-message-broker';

const customTriggers = {
  cron: {
    schedule: (expression, handler) => {
      return customCronLib.schedule(expression, handler);
    }
  },
  message: {
    consume: (topic, handler) => {
      customMessageBroker.subscribe(topic, handler);
    }
  },
  cli: {
    command: (name, handler) => {
      // Use your preferred CLI library
      myCliFramework.command(name, handler);
    }
  }
};

const modu = new Modulink(app, { triggers: customTriggers });

// Now uses your custom providers
modu.when.cron('0 0 * * *', handler);
modu.when.message('my-topic', handler);
modu.when.cli('my-command', handler);
```

### Partial Custom Providers

You can override just some providers while keeping defaults for others:

```javascript
const modu = new Modulink(app, {
  triggers: {
    cron: customCronProvider,  // Custom cron provider
    // message and cli will use defaults
  }
});
```

### Removing Default Dependencies

If you're using all custom providers, you can safely remove the default dependencies:

```bash
npm uninstall node-cron commander
```

## Examples

See the `/example` directory for complete working examples.

## Migration

For migration from v1.x, see [docs/migration.md](./docs/migration.md).

## License

Apache-2.0 @ Orchestrate LLC
