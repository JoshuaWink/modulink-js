Below is the same “links → chain → middleware → connect → app” flow, but with `connect(...)` actually wiring routes (or cron/CLI commands) immediately when you call it—so there’s no extra “runConnects” step. As soon as you call `modulink.connect(fn)`, it invokes your `fn(app, modulink)`, and that handler registers routes (or schedules jobs, or registers CLI commands) on the spot.

---

## 1. Library: `modulink-js/index.js`

```js
// modulink-js/index.js
// --------------------

// A minimal Modulink implementation that:
// 1) Stores your "app" reference (Express, Fastify, etc.),
// 2) Holds any instance‐level middleware you install,
// 3) Exposes `createContext()` so chains know how to build ctx,
// 4) Provides `connect(fn)` which immediately calls your function
//    so that it can hook routes/cron/CLI directly into your app.

export function createModuLink(app) {
  const instance = {
    app,
    _instanceMiddleware: [],

    // (a) Allow adding instance‐level middleware that will run
    //     before any chain‐level middleware or links.
    use(mw) {
      instance._instanceMiddleware.push(mw);
      return instance;
    },

    // (b) Build a `ctx` with whatever shape your chains expect.
    //     We merge any pre‐installed instance middleware info (e.g. a logger),
    //     but otherwise leave the shape up to the user.
    createContext(opts = {}) {
      // For example, you might attach a shared logger, a trace‐ID, etc.
      return {
        ...opts,
        // Collect instance middlewares so that chain execution runner can invoke them:
        _instanceMiddleware: instance._instanceMiddleware.slice(),
      };
    },

    // (c) `connect(fn)` simply invokes your function immediately,
    //     passing in (app, modulink) so your `fn` can register routes, cron jobs, CLI commands, etc.
    connect(fn) {
      // Immediately call the user‐provided function, so that
      // the route/cron/CLI is registered at the moment `connect` is invoked.
      fn(instance.app, instance);
      return instance;
    },
  };

  return instance;
}

// (Optional) Basic `chain` implementation placeholder. In reality, you'd import this from modulink-js.
export function chain(...links) {
  let _middleware = [];

  // The chain function: runs instanceMiddleware → chainMiddleware → links in order.
  async function runChain(ctx) {
    // 1. Run instance‐level middleware (in the order they were `use()`-d).
    for (const mw of ctx._instanceMiddleware || []) {
      let calledNext = false;
      await mw(ctx, async () => {
        calledNext = true;
      });
      if (!calledNext) {
        // If a middleware never called next(), we break out early.
        return ctx;
      }
    }

    // 2. Run chain‐level middleware (in the order they were `use()`-d).
    for (const mw of _middleware) {
      let calledNext = false;
      await mw(ctx, async () => {
        calledNext = true;
      });
      if (!calledNext) {
        return ctx;
      }
    }

    // 3. Run each link in sequence, passing (and returning) the same ctx.
    for (const fn of links) {
      ctx = await fn(ctx);
    }
    return ctx;
  }

  // Allow attaching chain‐level middleware:
  runChain.use = function (...mws) {
    _middleware.push(...mws);
    return runChain;
  };

  return runChain;
}
```

In this minimal sketch:

* `createModuLink(app)` returns an object with `.use()`, `.createContext()`, and `.connect()` methods.
* When you call `.connect(fn)`, it immediately executes your `fn(app, modulink)`.
* Your `fn` can call things like `app.post(...)` or `cron.schedule(...)` or register CLI commands.
* `modulink.createContext(...)` merges in any instance‐level middleware that you installed via `modulink.use(...)` so that when the chain runs, it will first invoke those instance‐level middleware functions.

---

## 2. Your Links & Chain Example

```js
// links.js
// --------

// (1) Plain “link” functions: async (ctx) => ctx
export async function validateInputLink(ctx) {
  if (!ctx.payload || !ctx.payload.email) {
    throw new Error('Missing email');
  }
  ctx.validated = { email: ctx.payload.email.trim() };
  return ctx;
}

export async function createUserLink(ctx) {
  const { email } = ctx.validated;
  // Imagine: const newUser = await db.users.insert({ email });
  ctx.newUser = { id: 'abc123', email };
  return ctx;
}

export async function sendWelcomeEmailLink(ctx) {
  // Imagine: await emailClient.send({ to: ctx.newUser.email, template: 'welcome' });
  ctx.emailSent = true;
  return ctx;
}

// (2) Chain‐level middleware example: async (ctx, next) => { … }
export function timingMiddleware(label) {
  return async function timing(ctx, next) {
    const start = Date.now();
    await next();
    const elapsed = Date.now() - start;
    ctx.timings = ctx.timings || {};
    ctx.timings[label] = elapsed;
  };
}
```

```js
// userSignupChain.js
// ------------------
// Compose three links into a single chain, then attach chain‐level middleware.

import { chain } from 'modulink-js';
import {
  validateInputLink,
  createUserLink,
  sendWelcomeEmailLink,
  timingMiddleware,
} from './links.js';

export const userSignupChain = chain(
  validateInputLink,
  createUserLink,
  sendWelcomeEmailLink
)
  // These two timingMiddleware calls run in sequence before/after each group of links:
  .use(timingMiddleware('validate-and-create'), timingMiddleware('send-email'));
```

At this point, `userSignupChain` is a single `async function(ctx)` that:

1. Runs any *instance-level* middleware captured in `ctx._instanceMiddleware`.
2. Runs the two chain‐level middleware (timing).
3. Runs `validateInputLink`, `createUserLink`, and `sendWelcomeEmailLink` in order.
4. Returns the final `ctx` (which now contains fields like `validated`, `newUser`, `emailSent`, and `timings`).

---

## 3. Your App Instantiation & Instance‐Level Middleware

```js
// app.js
// ------

import express from 'express';
import { createModuLink } from 'modulink-js';

// 1. Create your Express app (or any framework you choose):
export const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 2. Create a Modulink instance, passing in *your* app:
export const modulink = createModuLink(app);

// 3. Attach any instance‐level middleware you want (e.g. global logging, global auth, etc.)
modulink.use(async function globalLogger(ctx, next) {
  console.log(`[GlobalLogger] ${new Date().toISOString()} – incoming context type: ${ctx.type}`);
  await next();
});

// You can add more instance middleware as needed:
modulink.use(async function globalErrorCatcher(ctx, next) {
  try {
    await next();
  } catch (err) {
    console.error(`[GlobalError] in ${ctx.type}:`, err);
    // You might attach an error flag to ctx or rethrow
    throw err;
  }
});
```

* `modulink.use(...)` queues up instance‐level middleware functions.
* Later, whenever you call `modulink.createContext({ type: 'http', req, res, payload })`, the returned `ctx` will contain `_instanceMiddleware` = `[globalLogger, globalErrorCatcher]`.
* When the chain runs, it will first invoke each of those before any chain‐level middleware or links.

---

## 4. “Connect” Helpers That Actually Wire Routes/Cron/CLI

Since `connect(...)` calls your function immediately, each helper can register whatever it needs on the spot.

```js
// connect.js
// ----------

import cron from 'node-cron';
import { program } from 'commander';

/**
 * (A) HTTP route helper.
 * Registers an Express route immediately.
 *
 * @param {Express} app
 * @param {ModuLink} modulink
 * @param {String} method    – e.g. 'post', 'get'
 * @param {String} path      – e.g. '/api/signup'
 * @param {Function} chainFn – e.g. userSignupChain
 */
export function connectHttpRoute(app, modulink, method, path, chainFn) {
  app[method.toLowerCase()](path, async (req, res) => {
    try {
      // Build a new context. Include req, res, and parsed payload.
      const ctx = modulink.createContext({
        type: 'http',
        req,
        res,
        payload: req.body,
        params: req.params,
        query: req.query,
      });

      // Run instance‐level middleware + chain‐level middleware + links.
      const resultCtx = await chainFn(ctx);

      // Default: send back JSON with final ctx (or pick specific fields).
      res.json({
        success: true,
        data: resultCtx.newUser || null,
        timings: resultCtx.timings || {},
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });
}

/**
 * (B) Cron job helper.
 * Immediately schedules a cron job.
 *
 * @param {String} cronExpression  – e.g. '0 0 * * *'
 * @param {ModuLink} modulink
 * @param {Function} chainFn       – e.g. cleanupOldUsersChain
 */
export function connectCronJob(cronExpression, modulink, chainFn) {
  cron.schedule(cronExpression, async () => {
    const ctx = modulink.createContext({
      type: 'cron',
      schedule: cronExpression,
    });
    try {
      await chainFn(ctx);
      console.log(`[CRON] ran ${chainFn.name} at ${new Date().toISOString()}`);
    } catch (err) {
      console.error(`[CRON][${chainFn.name}] error:`, err);
    }
  });
}

/**
 * (C) CLI command helper.
 * Immediately registers a CLI command via Commander.
 *
 * @param {String} commandName    – e.g. 'import-data'
 * @param {ModuLink} modulink
 * @param {Function} chainFn      – e.g. importDataChain
 */
export function connectCliCommand(commandName, modulink, chainFn) {
  program
    .command(commandName)
    .description(`Invoke the ${chainFn.name} chain`)
    .action(async (opts) => {
      const ctx = modulink.createContext({
        type: 'cli',
        command: commandName,
        options: opts,
      });
      try {
        await chainFn(ctx);
        console.log(`[CLI] ${commandName} finished successfully.`);
      } catch (err) {
        console.error(`[CLI][${commandName}] error:`, err);
      }
    });
}
```

* Each helper (HTTP, cron, CLI) immediately registers itself.
* No need for a later “runConnects” call—calling `connect(...)` is sufficient to wire up everything.

---

## 5. Putting It All Together in Your “Entry” File

```js
// index.js
// --------

import { app, modulink } from './app.js';
import { userSignupChain } from './userSignupChain.js';
import { cleanupOldUsersChain } from './cleanupChain.js';
import { importDataChain } from './importDataChain.js';

import {
  connectHttpRoute,
  connectCronJob,
  connectCliCommand,
} from './connect.js';

// 1. Register an HTTP endpoint for user signup.
//    As soon as `connect(...)` is called, the Express route exists.
modulink.connect((appInstance, modu) => {
  connectHttpRoute(appInstance, modu, 'post', '/api/signup', userSignupChain);
});

// 2. Register a daily cron job at midnight.
modulink.connect((appInstance, modu) => {
  connectCronJob('0 0 * * *', modu, cleanupOldUsersChain);
});

// 3. Register a CLI command “import-data”.
modulink.connect((appInstance, modu) => {
  connectCliCommand('import-data', modu, importDataChain);
});

// 4. Now you’re free to start your HTTP server and CLI parser.
//    There’s no separate “runConnects()”—everything is already wired.

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HTTP server listening on http://localhost:${PORT}`);
});

// Finally, kick off Commander so that if a CLI command was passed, it will run.
// If none was passed, Commander will do nothing and exit.
program.parse(process.argv);
```

**What happens when you run `node index.js`**:

1. `import { app, modulink } from './app.js'` creates your Express app and a Modulink instance (with no routes yet).
2. Each `modulink.connect(...)` invocation immediately calls your provided callback:

   * The first `connect(...)` calls `connectHttpRoute(...)`, which does `app.post('/api/signup', handler)`.
   * The second `connect(...)` schedules a cron job via `node-cron`.
   * The third `connect(...)` registers a CLI command via Commander.
3. By the time you call `app.listen(...)` in index.js, your `/api/signup` route is already registered.
4. Commander’s `program.parse(process.argv)` ensures that if the user ran `node index.js import-data`, it will invoke `importDataChain`.
5. There is no “later” registration step—calling `connect` was enough to wire everything up.

---

### 6. How This Meets Your Requirements

* **Users still “reinvent the glue code,”** because they write their own `connectHttpRoute`, `connectCronJob`, and `connectCliCommand` helpers (or any other “connect” style function for WebSockets, AWS Lambda, GraphQL subscriptions, etc.).

* **`connect()` immediately wires things** into the app (Express, cron scheduler, CLI), so the application “knows” about each endpoint as soon as you call it. There is no extra “bootstrap” step.

* **Everything remains modular**:

  1. **Links**: tiny `(ctx) ⇒ ctx` functions in `links.js`.
  2. **Chains**: composed via `chain(...)` and `.use(...)` in `userSignupChain.js`.
  3. **Instance‐level middleware**: installed via `modulink.use(...)` in `app.js`.
  4. **Connect‐styled glue**: each call to `modulink.connect()` immediately registers that chain under an “endpoint” of your choice.
  5. **App start**: you still call `app.listen(...)` yourself (and `program.parse(...)` for CLI).

* **In the future**, you can provide a separate “templates” library (e.g. `@modulink/express-adapters`) containing pre-built versions of `connectHttpRoute`, `connectCronJob`, etc. But by default, you keep the core framework lean—users write or auto-generate those adapters as needed.

With this pattern, as soon as someone writes:

```js
modulink.connect((app, modu) => {
  connectHttpRoute(app, modu, 'post', '/api/signup', userSignupChain);
});
```

the `/api/signup` route is live, and the framework (ModuLink) is already aware of how that chain will be invoked (since `connectHttpRoute` calls `modu.createContext(...)` under the hood).
