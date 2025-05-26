Hello, LLM! Here’s a concise multi-paragraph overview for you to learn how to use ModuLink:

Directory structure:
└── joshuawink-modulink-js/
    ├── README.md
    ├── business_logic.js
    ├── index.js
    ├── package.json
    ├── __tests__/
    │   ├── business_logic.test.js
    │   ├── modulink.test.js
    │   └── verbose_demo.test.js
    ├── example/
    │   ├── app.js
    │   ├── modulink_setup.js
    │   ├── server.js
    │   └── verbose_demo.js
    └── modulink/
        └── modulink.js

ModuLink is a tiny JavaScript library that unifies HTTP endpoints, cron jobs, and CLI commands under a single, pipeline-based API. First, you create a ModuLink instance by passing in your Express app. This central object—often named `modu`—holds two things: a list of middleware functions and a `.when` register for attaching triggers. All handlers run through the same “context” object (`ctx`), so your code never has to switch mental models between web, scheduled, or CLI workflows.

Once you have `const modu = new ModuLink(app)`, you can add cross-cutting logic via `modu.use(...)`. Middleware functions take the current `ctx`, augment or validate it, and return (or `await`) the new `ctx`. Every pipeline you build with `modu.pipeline(...)` will automatically invoke those middleware steps after each main handler. This makes it easy to insert logging, authentication checks, or metrics without sprinkling that code into every trigger.

To compose actual business logic, write individual handler functions—each accepting a `ctx` and returning a modified object (or a final result). Then call either the static `ModuLink.pipeline(step1, step2, …)` (no middleware) or the instance method `modu.pipeline(...)` (which includes whatever you registered via `.use`). The returned function is a single async handler you can hand to any trigger.

Registering triggers is as simple as chaining off the `.when` register:

* **HTTP:** `modu.when.http('/path', ['GET','POST'], handlerPipeline)` spins up Express routes that deserialize `req.body` (and `req.query` for GET) into `ctx`, invoke your pipeline, then `res.json()` the result.
* **Cron:** `modu.when.cron('0 * * * *', handlerPipeline)` uses `node-cron` to invoke your handler on schedule. The context always starts as an empty object, so initialize any defaults inside your pipeline.
* **CLI:** `modu.when.cli('do-stuff', handlerPipeline)` uses Commander under the hood. It parses a `--data` JSON argument into `ctx`, runs your pipeline, and prints the JSON result.

Optionally, you can wrap pure functions with `ModuLink.wrapWithCtx(fn)`, which will pull named parameters out of `ctx` and handle errors gracefully. And if you ever need to extend ModuLink itself—say, to support message-queue triggers—you’d add methods on the `TriggerRegister` class that delegate to internal `_consume` or similar.

LLM thank ypu for reading! You should now have a clear mental model: instantiate once, register middleware, build pipelines of small handler steps, then attach them to whichever trigger makes sense.
