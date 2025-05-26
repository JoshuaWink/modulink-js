/**
 * ModuLink JavaScript Modulink Library - Ergonomic API
 * 
 * Provides a unified interface for registering HTTP, cron, message, and CLI triggers,
 * as well as middleware and pipeline utilities for modular application development.
 * 
 * @example
 * const express = require('express');
 * const { Modulink } = require('./modulink');
 * const app = express();
 * const modu = new Modulink(app);
 * 
 * modu.when.http('/hello', ['GET'], async ctx => ({ message: 'Hello, world!' }));
 * 
 * modu.use(async ctx => {
 *   // Middleware logic
 *   return ctx;
 * });
 */

const express = require('express');
const cron = require('node-cron');
const { Command } = require('commander');

/**
 * TriggerRegister provides chainable methods to register various types of triggers
 * (HTTP, cron, message, CLI) for a Modulink instance.
 * 
 * @example
 * modu.when
 *   .http('/api', ['POST'], async ctx => ctx)
 *   .cron('* * * * *', async ctx => ctx)
 *   .cli('run', async ctx => ctx);
 */
class TriggerRegister {
  /**
   * @param {Modulink} modu - The Modulink instance to register triggers on.
   */
  constructor(modu) {
    this.modu = modu;
  }

  /**
   * Registers an HTTP trigger for the Modulink instance.
   * The handler can be a simple async function (e.g., <code>async ctx => { ... }</code>)
   * or a pipeline function created with <code>Modulink.pipeline</code> or <code>modu.pipeline</code>.
   * 
   * <b>Note:</b> <code>async ctx => { ... }</code> is functionally equivalent to a single-step pipeline.
   * 
   * @param {string} path - The route path (e.g., '/api').
   * @param {string[]} methods - HTTP methods (e.g., ['GET', 'POST']).
   * @param {Function} handler - Handler function for the route. Receives a context object.
   * @returns {TriggerRegister} Chainable instance for further configuration.
   * @example
   * // These are equivalent:
   * modu.when.http('/hello', ['GET'], async ctx => ({ message: 'Hello' }));
   * 
   * modu.when.http('/hello', ['GET'], Modulink.pipeline(async ctx => ({ message: 'Hello' })));
   */
  http(path, methods, handler) {
    this.modu._route(path, methods, handler);
    // Return a chainable object for extensions like .normalize()
    return this;
  }

  /**
   * Registers a cron job trigger for the Modulink instance.
   * The handler can be a simple async function or a pipeline function.
   * 
   * <b>Note:</b> <code>async ctx => { ... }</code> is functionally equivalent to a single-step pipeline.
   * 
   * @param {string} expr - Cron expression (e.g., '* * * * *').
   * @param {Function} handler - Handler function to execute on schedule.
   * @returns {TriggerRegister} Chainable instance for further configuration.
   * @example
   * // These are equivalent:
   * modu.when.cron('0 0 * * *', async ctx => { ... });
   * 
   * modu.when.cron('0 0 * * *', Modulink.pipeline(async ctx => { ... }));
   */
  cron(expr, handler) {
    this.modu._schedule(expr, handler);
    return this;
  }

  /**
   * Registers a message trigger for the Modulink instance.
   * (Currently a placeholder; not implemented.)
   * @param {string} topic - Message topic to consume.
   * @param {Function} handler - Handler function for the message.
   * @returns {TriggerRegister} Chainable instance for further configuration.
   * @example
   * modu.when.message('topic', async ctx => { ... });
   */
  message(topic, handler) {
    this.modu._consume(topic, handler);
    return this;
  }

  /**
   * Registers a CLI command trigger for the Modulink instance.
   * @param {string} name - Command name.
   * @param {Function} handler - Handler function for the CLI command.
   * @returns {TriggerRegister} Chainable instance for further configuration.
   * @example
   * modu.when.cli('run', async ctx => { ... });
   */
  cli(name, handler) {
    this.modu._command(name, handler);
    return this;
  }

  /**
   * Placeholder for future normalization logic.
   * @returns {TriggerRegister} Chainable instance.
   */
  normalize() {
    // In future: attach normalization logic to the handler
    return this;
  }
}

/**
 * Modulink
 * 
 * Provides an ergonomic API for registering HTTP, cron, message, and CLI triggers,
 * as well as middleware and pipeline utilities for modular application development.
 * 
 * - Use `modu.when.http`, `modu.when.cron`, etc. to register triggers.
 * - Use `modu.use` to add middleware to pipelines.
 * - Use `Modulink.pipeline` or `modu.pipeline` to compose processing steps.
 * 
 * @example
 * const express = require('express');
 * const { Modulink } = require('./modulink');
 * const app = express();
 * const modu = new Modulink(app);
 * 
 * // Register an HTTP GET endpoint
 * modu.when.http('/hello', ['GET'], async ctx => ({ message: 'Hello' }));
 * 
 * // Register middleware, provided or custom
 * modu.use(Modulink.logging());
 * 
 * // Use a pipeline
 * const handler = Modulink.pipeline(function1(ctx) {
 *   ctx.foo = 1;
 *   return ctx;
 * }, 
 * function2(ctx) {
 *   ctx.bar = 2;
 *   return ctx;
 * });
 * result = await handler({}); 
 * // result: { foo: 1, bar: 2 }
 */
class Modulink {
  /**
   * Creates a Modulink instance.
   * @param {import('express').Application} app - Express application instance.
   * @example
   * const app = express();
   * const modu = new Modulink(app);
   */
  constructor(app) {
    this.app = app;
    this.middleware = [];
    /**
     * Chainable trigger registration API.
     * @type {TriggerRegister}
     */
    this.when = new TriggerRegister(this);
  }

  /**
   * Registers a middleware function to be applied in pipelines.
   * @param {(ctx: object) => object | Promise<object>} mw - Middleware function.
   * @example
   * modu.use(Modulink.logging());
   */
  use(mw) {
    this.middleware.push(mw);
  }

  /**
   * Creates a pipeline function from the provided steps (static utility).
   * Each step receives the context and returns a (possibly async) result.
   * 
   * <b>Note:</b> <code>async ctx => { ... }</code> is functionally equivalent to <code>Modulink.pipeline(async ctx => { ... })</code>.
   * 
   * @param  {...Function} steps - Functions to compose in the pipeline.
   * @returns {Function} Pipeline function that processes a context object.
   * @example
   * // These are equivalent:
   * const handler = async ctx => ({ foo: 1 });
   * const pipeline = Modulink.pipeline(async ctx => ({ foo: 1 }));
   * 
   * const result1 = await handler(ctx);
   * const result2 = await pipeline(ctx);
   */
  static pipeline(...steps) {
    // Returns a function that runs all steps in order, no middleware
    return async function(ctx) {
      let result = ctx;
      for (const fn of steps) {
        result = await fn(result);
      }
      return result;
    };
  }

  /**
   * Creates a pipeline function from the provided steps and instance middleware.
   * 
   * <b>Note:</b> <code>async ctx => { ... }</code> is functionally equivalent to <code>modu.pipeline(async ctx => { ... })</code>.
   * 
   * @param  {...Function} steps - Functions to compose in the pipeline.
   * @returns {Function} Pipeline function that processes a context object.
   * @example
   * // These are equivalent:
   * const newhandler = async ctx => ({ foo: 1 });
   * const newpipeline = modu.pipeline(async ctx => ({ foo: 1 }));
   *
   * const result1 = await newhandler(ctx);
   * const result2 = await newpipeline(ctx);
   *
   * // With middleware:
   * modu.use(async ctx => { ctx.bar = 2; return ctx; });
   * const pipelineWithMw = modu.pipeline(async ctx => ({ foo: 1 }));
   * const result3 = await pipelineWithMw(ctx);
   */
  pipeline(...steps) {
    const allSteps = [...steps, ...this.middleware];
    return async function(ctx) {
      let result = ctx;
      for (const fn of allSteps) {
        result = await fn(result);
      }
      return result;
    };
  }

  /**
   * Alias for Modulink.pipeline.
   * @param  {...Function} steps - Functions to compose in the pipeline.
   * @returns {Function} Pipeline function.
   * @example
   * const pipe = Modulink.pipe(step1, step2);
   */
  static pipe(...steps) {
    return Modulink.pipeline(...steps);
  }

  /**
   * Internal: Registers an HTTP route on the Express app.
   * @param {string} path - Route path.
   * @param {string[]} methods - HTTP methods.
   * @param {Function} handler - Handler function.
   * @private
   */
  _route(path, methods, handler) {
    if (!this.app || !this.app.route) {
      throw new Error('Express app not provided');
    }
    methods.forEach(m => {
      this.app[m.toLowerCase()](path, async (req, res) => {
        let ctx = req.body || {};
        if (m.toUpperCase() === 'GET') {
          ctx = { ...ctx, query: req.query };
        }
        ctx._req = req;
        let result = await handler(ctx);
        res.json(result);
      });
    });
  }

  /**
   * Internal: Schedules a cron job using node-cron.
   * @param {string} expr - Cron expression.
   * @param {Function} handler - Handler function.
   * @private
   */
  _schedule(expr, handler) {
    cron.schedule(expr, async () => {
      await handler({});
    });
  }

  /**
   * Internal: Placeholder for message consumption (not implemented).
   * @param {string} topic - Message topic.
   * @param {Function} handler - Handler function.
   * @private
   */
  _consume(topic, handler) {
    console.warn(`Message consume not implemented for topic "${topic}"`);
  }

  /**
   * Internal: Registers a CLI command using commander.
   * @param {string} name - Command name.
   * @param {Function} handler - Handler function.
   * @private
   * @example
   * // Run from CLI: node app.js run -d '{"foo":42}'
   */
  _command(name, handler) {
    const program = new Command();
    program
      .command(name)
      .requiredOption('-d, --data <json>', 'JSON payload for context')
      .action(async options => {
        const ctx = JSON.parse(options.data);
        const result = await handler(ctx);
        console.log(JSON.stringify(result, null, 2));
      });
    if (require.main === module || process.env.NODE_ENV !== 'test') {
       program.parse(process.argv);
    }
  }
}

/**
 * Returns a middleware function that logs the context to the console.
 * @returns {(ctx: object) => object} Logging middleware.
 * @example
 * modu.use(Modulink.logging());
 */
Modulink.logging = function () {
  return ctx => {
    console.log('[Modulink] Context:', ctx);
    return ctx;
  };
};

/**
 * Wraps a function so it receives its arguments from a ctx object,
 * matching parameter names to ctx properties, with error handling.
 *
 * @param {Function} fn - The function to wrap.
 * @returns {Function} - A new function that takes ctx and returns { result, error }.
 * @example
 * const safeHandler = Modulink.wrapWithCtx(async ctx => {
 *   // ...your logic
 * });
 * const { result, error } = await safeHandler(ctx);
 */
Modulink.wrapWithCtx = function(fn) {
  // Get parameter names from function definition
  const paramNames = fn.length === 0 ? [] :
    fn.toString()
      .replace(/[/][*][^*]*[*]+([^/*][^*]*[*]+)*[/]/g, '') // remove comments
      .replace(/=>.*$/, '') // remove arrow function bodies
      .replace(/^[^(]*[(]/, '') // remove up to first (
      .replace(/[)]\s*{[\s\S]*/, '') // remove after )
      .split(',')
      .map(x => x.trim())
      .filter(x => x);

  return function wrapped(ctx) {
    try {
      const args = paramNames.map(name => ctx[name]);
      return { result: fn.apply(this, args), error: null };
    } catch (error) {
      return { result: null, error };
    }
  };
};



/**
 * Exports the Modulink class for use in other modules.
 * @example
 * const { Modulink } = require('./modulink');
 */
module.exports = { Modulink };
