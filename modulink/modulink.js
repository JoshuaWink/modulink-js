/**
 * ModuLink JavaScript Modulink Library - Ergonomic API
 * 
 * Provides a unified interface for registering HTTP, cron, message, and CLI triggers,
 * as well as middleware and chain utilities for modular application development.
 * Features hybrid configuration ledger + factory pattern for better modularity.
 * 
 * Functions are the links of the chain, and middleware acts as fittings between links.
 * 
 * @example
 * import express from 'express';
 * import { Modulink } from './modulink.js';
 * const app = express();
 * const modu = new Modulink(app);
 * 
 * modu.when.http('/hello', ['GET'], async ctx => ({ message: 'Hello, world!' }));
 * 
 * modu.use(async ctx => {
 *   // Middleware fitting logic
 *   return ctx;
 * });
 */

import express from 'express';
import cron from 'node-cron';
import { Command } from 'commander';

/**
 * Configuration Ledger - Central configuration storage for chain management
 */
class ConfigurationLedger {
  constructor() {
    this.configurations = new Map();
    this.featureFlags = new Map();
    this.environments = new Map();
    this.functionRegistry = new Map(); // Renamed from componentRegistry
  }

  /**
   * Register a chain configuration
   */
  registerConfiguration(name, config) {
    this.configurations.set(name, {
      ...config,
      createdAt: new Date(),
      version: config.version || '1.0.0'
    });
  }

  /**
   * Get a configuration by name
   */
  getConfiguration(name) {
    return this.configurations.get(name);
  }

  /**
   * Register reusable chain functions (links)
   */
  registerFunction(name, func) {
    this.functionRegistry.set(name, func);
  }

  /**
   * Get a function by name
   */
  getFunction(name) {
    return this.functionRegistry.get(name);
  }

  /**
   * Set feature flag
   */
  setFeatureFlag(name, enabled, conditions = {}) {
    this.featureFlags.set(name, { enabled, conditions });
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(name, context = {}) {
    const flag = this.featureFlags.get(name);
    if (!flag) return false;
    
    if (!flag.enabled) return false;
    
    // Check conditions if any
    if (flag.conditions.environment && context.environment !== flag.conditions.environment) {
      return false;
    }
    
    return true;
  }

  /**
   * Set environment-specific configuration
   */
  setEnvironmentConfig(environment, config) {
    this.environments.set(environment, config);
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig(environment) {
    return this.environments.get(environment) || {};
  }
}

/**
 * ChainFactory - Creates and caches chains based on configurations
 * Functions are the links, middleware are the fittings between links
 */
class ChainFactory {
  constructor(ledger) {
    this.ledger = ledger;
    this.cache = new Map();
    this.statistics = new Map();
  }

  /**
   * Create a chain from configuration
   */
  createChain(configName, parameters = {}) {
    const cacheKey = `${configName}:${JSON.stringify(parameters)}`;
    
    // Return cached chain if available
    if (this.cache.has(cacheKey)) {
      this.updateStatistics(configName, 'cache_hit');
      return this.cache.get(cacheKey);
    }

    const config = this.ledger.getConfiguration(configName);
    if (!config) {
      throw new Error(`Chain configuration "${configName}" not found`);
    }

    // Build chain links
    const links = this.buildLinks(config, parameters);
    
    // Create chain function
    const chain = this.compileChain(links, config, parameters);
    
    // Cache the chain
    this.cache.set(cacheKey, chain);
    this.updateStatistics(configName, 'cache_miss');
    
    return chain;
  }

  /**
   * Build chain links from configuration
   */
  buildLinks(config, parameters) {
    const links = [];
    
    for (const linkConfig of config.links || config.steps || []) {
      let link;
      
      if (linkConfig.type === 'function' || linkConfig.type === 'component') {
        // Use registered function (link)
        const func = this.ledger.getFunction(linkConfig.name);
        if (!func) {
          throw new Error(`Chain function "${linkConfig.name}" not found`);
        }
        link = this.instantiateFunction(func, linkConfig.params, parameters);
      } else if (linkConfig.type === 'inline') {
        // Inline function definition
        link = new Function('ctx', linkConfig.code);
      } else if (typeof linkConfig === 'function') {
        // Direct function reference
        link = linkConfig;
      }
      
      // Apply middleware fittings if defined
      if (linkConfig.middleware) {
        link = this.wrapWithMiddleware(link, linkConfig.middleware);
      }
      
      links.push(link);
    }
    
    return links;
  }

  /**
   * Instantiate a function with parameters
   */
  instantiateFunction(func, linkParams = {}, globalParams = {}) {
    const params = { ...globalParams, ...linkParams };
    
    if (typeof func === 'function') {
      return func(params);
    } else if (func.create) {
      return func.create(params);
    } else {
      return func;
    }
  }

  /**
   * Wrap link with middleware fittings
   */
  wrapWithMiddleware(link, middlewareConfigs) {
    let wrappedLink = link;
    
    for (const mwConfig of middlewareConfigs) {
      const middleware = this.ledger.getFunction(mwConfig.name);
      if (middleware) {
        wrappedLink = middleware(wrappedLink, mwConfig.params);
      }
    }
    
    return wrappedLink;
  }

  /**
   * Compile chain into executable function
   */
  compileChain(links, config, parameters) {
    return async function(ctx) {
      let result = ctx;
      
      for (const link of links) {
        try {
          result = await link(result);
        } catch (error) {
          if (config.errorHandling === 'stop') {
            throw error;
          } else if (config.errorHandling === 'continue') {
            result.error = { message: error.message, link: link.name || 'anonymous' };
          }
        }
      }
      
      return result;
    };
  }

  /**
   * Update chain usage statistics
   */
  updateStatistics(configName, event) {
    if (!this.statistics.has(configName)) {
      this.statistics.set(configName, { cache_hits: 0, cache_misses: 0, executions: 0 });
    }
    
    const stats = this.statistics.get(configName);
    stats[event] = (stats[event] || 0) + 1;
  }

  /**
   * Get chain statistics
   */
  getStatistics(configName = null) {
    if (configName) {
      return this.statistics.get(configName);
    }
    return Object.fromEntries(this.statistics);
  }

  /**
   * Clear cache
   */
  clearCache(pattern = null) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

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
 * as well as middleware and chain utilities for modular application development.
 * Enhanced with hybrid configuration ledger + factory pattern for better modularity.
 * 
 * Functions are the links of the chain, middleware are the fittings between links.
 * 
 * - Use `modu.when.http`, `modu.when.cron`, etc. to register triggers.
 * - Use `modu.use` to add middleware fittings to chains.
 * - Use `Modulink.chain` or `modu.chain` to compose processing functions (deprecated).
 * - Use `modu.configureChain` to define reusable chain configurations.
 * - Use `modu.createChain` to create chains from configurations.
 * 
 * @example
 * import express from 'express';
 * import { Modulink } from './modulink.js';
 * const app = express();
 * const modu = new Modulink(app);
 * 
 * // Register an HTTP GET endpoint
 * modu.when.http('/hello', ['GET'], async ctx => ({ message: 'Hello' }));
 * 
 * // Register middleware fitting
 * modu.use(Modulink.logging());
 * 
 * // Configure a reusable chain
 * modu.configureChain('userAuth', {
 *   links: [
 *     { type: 'function', name: 'validateToken' },
 *     { type: 'function', name: 'loadUser' }
 *   ]
 * });
 * 
 * // Use the configured chain
 * const authChain = modu.createChain('userAuth');
 * result = await authChain(ctx);
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
    this.pipelines = {}; // Legacy named pipelines (deprecated)
    this.config = { throwErrors: false };
    this.cronTasks = []; // Track cron jobs for cleanup
    
    // Initialize configuration ledger and chain factory
    this.ledger = new ConfigurationLedger();
    this.factory = new ChainFactory(this.ledger);
    
    // Set default environment
    this.environment = process.env.NODE_ENV || 'development';
    
    /**
     * Chainable trigger registration API.
     * @type {TriggerRegister}
     */
    this.when = new TriggerRegister(this);

    // Show migration guidance for users still using legacy patterns
    if (!process.env.MODULINK_SUPPRESS_DEPRECATION_WARNINGS) {
      this.log('📢 ModuLink Migration Notice: Consider upgrading to the new hybrid configuration pattern for better modularity!');
      this.log('   Functions are the links of your chain, middleware are the fittings that connect them.');
      this.log('   Learn more: https://github.com/your-repo/modulink-js/docs/migration.md');
      this.log('   To suppress this message, set MODULINK_SUPPRESS_DEPRECATION_WARNINGS=true');
    }
  }

  /**
   * Simple logger for ModuLink internal messages.
   * @param {string} message - The message to log.
   */
  log(message) {
    console.log(`[ModuLink] ${message}`);
  }

  /**
   * Registers a middleware fitting function to be applied between chain links.
   * @param {(ctx: object) => object | Promise<object>} mw - Middleware fitting function.
   * @example
   * modu.use(Modulink.logging());
   */
  use(mw) {
    this.middleware.push(mw);
  }

  /**
   * Configure a reusable chain
   * @param {string} name - Chain configuration name
   * @param {Object} config - Chain configuration
   * @example
   * modu.configureChain('userAuth', {
   *   version: '1.0.0',
   *   description: 'User authentication chain',
   *   errorHandling: 'stop',
   *   links: [
   *     { type: 'function', name: 'validateToken' },
   *     { type: 'function', name: 'loadUser' }
   *   ]
   * });
   */
  configureChain(name, config) {
    this.ledger.registerConfiguration(name, config);
    this.log(`Chain configuration registered: ${name}`);
  }

  /**
   * @deprecated Use `configureChain()` instead for the new chain-based approach.
   * Configure a reusable pipeline (legacy method)
   */
  configurePipeline(name, config) {
    console.warn(`[ModuLink DEPRECATED] configurePipeline() is deprecated. Use configureChain() instead:
    
    // Instead of: modu.configurePipeline('${name}', config)
    // Use: modu.configureChain('${name}', config)
    
    Also change 'steps' to 'links' in your configuration.`);
    
    // Convert steps to links for backward compatibility
    if (config.steps) {
      config.links = config.steps;
      delete config.steps;
    }
    
    this.ledger.registerConfiguration(name, config);
    this.log(`Pipeline configuration registered (legacy): ${name}`);
  }

  /**
   * Register a reusable chain function (link)
   * @param {string} name - Function name
   * @param {Function|Object} func - Function or object
   * @example
   * modu.registerFunction('validateToken', (params) => async (ctx) => {
   *   // Token validation logic
   *   return ctx;
   * });
   */
  registerFunction(name, func) {
    this.ledger.registerFunction(name, func);
    this.log(`Chain function registered: ${name}`);
  }

  /**
   * @deprecated Use `registerFunction()` instead for the new function-first approach.
   * Register a reusable component (legacy method)
   */
  registerComponent(name, component) {
    console.warn(`[ModuLink DEPRECATED] registerComponent() is deprecated. Use registerFunction() instead:
    
    // Instead of: modu.registerComponent('${name}', component)
    // Use: modu.registerFunction('${name}', component)`);
    
    this.ledger.registerFunction(name, component);
    this.log(`Component registered (legacy): ${name}`);
  }

  /**
   * Create a chain from configuration
   * @param {string} configName - Configuration name
   * @param {Object} parameters - Runtime parameters
   * @returns {Function} Chain function
   * @example
   * const authChain = modu.createChain('userAuth', { strict: true });
   * const result = await authChain(ctx);
   */
  createChain(configName, parameters = {}) {
    return this.factory.createChain(configName, parameters);
  }

  /**
   * @deprecated Use `createChain()` instead for the new chain-based approach.
   * Create a pipeline from configuration (legacy method)
   */
  createPipeline(configName, parameters = {}) {
    console.warn(`[ModuLink DEPRECATED] createPipeline() is deprecated. Use createChain() instead:
    
    // Instead of: modu.createPipeline('${configName}')
    // Use: modu.createChain('${configName}')`);
    
    return this.factory.createChain(configName, parameters);
  }

  /**
   * Set feature flag
   * @param {string} name - Feature flag name
   * @param {boolean} enabled - Whether feature is enabled
   * @param {Object} conditions - Conditions for enabling feature
   * @example
   * modu.setFeatureFlag('newUserFlow', true, { environment: 'production' });
   */
  setFeatureFlag(name, enabled, conditions = {}) {
    this.ledger.setFeatureFlag(name, enabled, conditions);
  }

  /**
   * Check if feature is enabled
   * @param {string} name - Feature flag name
   * @param {Object} context - Context for feature evaluation
   * @returns {boolean} Whether feature is enabled
   */
  isFeatureEnabled(name, context = {}) {
    return this.ledger.isFeatureEnabled(name, { ...context, environment: this.environment });
  }

  /**
   * Set environment-specific configuration
   * @param {string} environment - Environment name
   * @param {Object} config - Environment configuration
   */
  setEnvironmentConfig(environment, config) {
    this.ledger.setEnvironmentConfig(environment, config);
  }

  /**
   * Get chain factory statistics
   * @param {string} configName - Optional specific configuration name
   * @returns {Object} Statistics object
   */
  getStatistics(configName = null) {
    return this.factory.getStatistics(configName);
  }

  /**
   * Clear chain cache
   * @param {string} pattern - Optional pattern to match for selective clearing
   */
  clearCache(pattern = null) {
    this.factory.clearCache(pattern);
  }

  /**
   * Cleanup method to destroy all cron tasks and prevent memory leaks
   * This is particularly useful in test environments where Jest needs to exit cleanly
   * @example
   * afterAll(() => {
   *   modu.cleanup();
   * });
   */
  cleanup() {
    // Destroy all cron tasks
    this.cronTasks.forEach(task => {
      if (task && typeof task.destroy === 'function') {
        task.destroy();
      }
    });
    this.cronTasks = [];
  }

  /**
   * Creates a chain of processing functions.
   * This is the modern replacement for the deprecated pipeline method.
   * 
   * @param  {...Function|Array} stepsOrArray - Functions to compose in the chain, or array of functions plus context.
   * @returns {Function|*} Chain function that processes context through all steps, or direct result if context provided.
   * @example
   * const processChain = modu.chain(step1, step2, step3);
   * const result = await processChain(ctx);
   * 
   * // Or with direct execution:
   * const result = await modu.chain([step1, step2], ctx);
   */
  chain(...stepsOrArray) {
    // Support both signatures:
    // 1. modu.chain(step1, step2, step3) - returns function
    // 2. modu.chain([step1, step2], context) - executes directly
    
    if (stepsOrArray.length === 2 && Array.isArray(stepsOrArray[0]) && typeof stepsOrArray[1] === 'object') {
      // Direct execution: modu.chain([steps], context)
      const [steps, context] = stepsOrArray;
      const chainFunction = this.chain(...steps);
      return chainFunction(context);
    }
    
    // Function creation: modu.chain(step1, step2, step3)
    const pipelineFunctions = stepsOrArray;
    const globalMiddleware = this.middleware;

    // Use an arrow function here to correctly bind `this`
    return async (initialCtx) => {
      let ctx = initialCtx;

      // Execute global middleware before the main chain steps
      for (const mw of globalMiddleware) {
        try {
          ctx = await mw(ctx, async (c) => c); // Pass a no-op next for now
        } catch (error) {
          console.error(`[ModuLink Global Middleware Error] Error in middleware "${mw.name || 'anonymous middleware'}":`, error);
          console.error('[ModuLink Global Middleware Error] Context at time of error:', JSON.stringify(ctx, null, 2));
          throw error;
        }
      }

      // Execute main chain functions
      for (const fn of pipelineFunctions) {
        try {
          ctx = await fn(ctx);
        } catch (error) {
          let errorMessage = `Error in function "${fn.name || 'anonymous'}"`;
          if (error instanceof Error) {
            errorMessage += `: ${error.message}`;
            this.log(`${errorMessage}\\nStack: ${error.stack}`);
          } else {
            try {
              errorMessage += `: ${JSON.stringify(error)}`;
            } catch (stringifyError) {
              errorMessage += ': (unstringifyable error object)';
            }
            this.log(errorMessage);
          }
          
          this.log(`[ModuLink Instance Chain Error] ${errorMessage}`, 'error', ctx);
          ctx.error = { 
            message: error.message || 'An error occurred in the chain.', 
            step: fn.name || 'anonymous' 
          };
          if (this.config.throwErrors) {
            throw error; // Re-throw if configured to do so
          }
        }
      }
      return ctx;
    };
  }

  /**
   * Creates a pipeline function from the provided steps and instance middleware.
   * 
   * @deprecated Use the new hybrid configuration approach with `modu.configurePipeline()` and `modu.createPipeline()` for better modularity and maintainability.
   * @see {@link https://github.com/your-repo/modulink-js/docs/migration.md} Migration Guide
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
    console.warn(`[ModuLink DEPRECATED] modu.pipeline() is deprecated. Use the new hybrid configuration approach:
    
    // Instead of: modu.pipeline(step1, step2)
    // Use:
    modu.configurePipeline('myPipeline', {
      steps: [
        { type: 'component', name: 'step1Component' },
        { type: 'component', name: 'step2Component' }
      ]
    });
    const pipeline = modu.createPipeline('myPipeline');
    
    See migration guide: https://github.com/your-repo/modulink-js/docs/migration.md`);
    
    const allSteps = [...steps, ...this.middleware]; // Note: Middleware runs AFTER main steps if appended here. Consider order.
                                                  // If middleware should wrap or run before, adjust this logic.
                                                  // For now, let's assume middleware runs after defined steps or intermingled if .use is called between step definitions.
                                                  // Corrected: a global middleware should wrap each step, or the whole pipeline.
                                                  // The current .use() implementation adds to a list, and pipeline() iterates through them.
                                                  // Let's refine how global middleware interacts or if it's primarily for pipeline-specific additions.
                                                  // For a truly global try-catch per step, it must be in the loop.

    // Let's clarify the middleware application. If `this.middleware` are global interceptors,
    // they should ideally wrap each step or the entire pipeline execution.
    // The current `modu.use` adds to `this.middleware` and `modu.pipeline` iterates them.
    // This means they run sequentially. If a middleware is for logging/error handling per step,
    // it needs to be structured differently or this loop needs to be more complex.

    // Given the current structure of `modu.use` adding to a list that `modu.pipeline` iterates,
    // the try...catch here will cover functions passed directly to `modu.pipeline(...)`
    // and any functions added via `modu.use(...)` that are part of `allSteps`.

    const pipelineFunctions = steps;
    const globalMiddleware = this.middleware;

    // Use an arrow function here to correctly bind `this`
    return async (initialCtx) => {
      let ctx = initialCtx;

      // Execute global middleware before the main pipeline steps
      for (const mw of globalMiddleware) {
        try {
          ctx = await mw(ctx, async (c) => c); // Pass a no-op next for now, or adjust middleware signature
        } catch (error) {
          console.error(`[ModuLink Global Middleware Error] Error in middleware "${mw.name || 'anonymous middleware'}":`, error);
          console.error('[ModuLink Global Middleware Error] Context at time of error:', JSON.stringify(ctx, null, 2));
          throw error;
        }
      }

      // Execute main pipeline functions
      for (const fn of pipelineFunctions) {
        try {
          ctx = await fn(ctx);
        } catch (error) {
          let errorMessage = `Error in function "${fn.name || 'anonymous'}"`;
          if (error instanceof Error) {
            errorMessage += `: ${error.message}`;
            // Also log stack for better debugging, but not to the client-facing ctx.error
            this.log(`${errorMessage}\\nStack: ${error.stack}`); // Removed 'error' and {} as second/third args, log takes one string arg.
          } else {
            // Fallback for non-Error objects thrown
            try {
              errorMessage += `: ${JSON.stringify(error)}`;
            } catch (stringifyError) {
              errorMessage += ': (unstringifyable error object)';
            }
            this.log(errorMessage); // Removed 'error' and {}
          }
          
          this.log(`[ModuLink Instance Pipeline Error] ${errorMessage}`, 'error', ctx);
          ctx.error = { 
            message: error.message || 'An error occurred in the pipeline.', 
            step: fn.name || 'anonymous' 
          };
          if (this.config.throwErrors) {
            throw error; // Re-throw if configured to do so
          }
        }
      }
      return ctx;
    };
  }

  /**
   * Alias for Modulink.pipeline.
   * 
   * @deprecated Use the new hybrid configuration approach with `modu.configurePipeline()` and `modu.createPipeline()` for better modularity and maintainability.
   * @see {@link https://github.com/your-repo/modulink-js/docs/migration.md} Migration Guide
   * 
   * @param  {...Function} steps - Functions to compose in the pipeline.
   * @returns {Function} Pipeline function.
   * @example
   * const pipe = Modulink.pipe(step1, step2);
   */
  static pipe(...steps) {
    console.warn(`[ModuLink DEPRECATED] Modulink.pipe() is deprecated. Use the new hybrid configuration approach:
    
    // Instead of: Modulink.pipe(step1, step2)
    // Use:
    modu.configurePipeline('myPipeline', {
      steps: [
        { type: 'component', name: 'step1Component' },
        { type: 'component', name: 'step2Component' }
      ]
    });
    const pipeline = modu.createPipeline('myPipeline');
    
    See migration guide: https://github.com/your-repo/modulink-js/docs/migration.md`);
    
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
      throw new Error('Express app is required for HTTP routes');
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
    const task = cron.schedule(expr, async () => {
      await handler({});
    }, {
      scheduled: false // Don't start automatically in test environment
    });
    
    // Track the task for cleanup
    this.cronTasks.push(task);
    
    // Only start the task if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      task.start();
    }
    
    return task;
  }

  /**
   * Internal: Placeholder for message consumption (not implemented).
   * @param {string} topic - Message topic.
   * @param {Function} handler - Handler function.
   * @private
   */
  _consume(topic, handler) {
    console.warn('Message consumption not yet implemented');
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
    if (import.meta.url === `file://${process.argv[1]}` && process.env.NODE_ENV !== 'test') {
       program.parse(process.argv);
    }
  }

  /**
   * Registers a named pipeline.
   * 
   * @deprecated Use the new hybrid configuration approach with `modu.configurePipeline()` for better modularity and maintainability.
   * @see {@link https://github.com/your-repo/modulink-js/docs/migration.md} Migration Guide
   * 
   * @param {string} name - The name of the pipeline.
   * @param {Function[] | Function} pipelineStepsOrFunction - An array of functions or a single function.
   */
  registerPipeline(name, pipelineStepsOrFunction) {
    console.warn(`[ModuLink DEPRECATED] registerPipeline() is deprecated. Use the new hybrid configuration approach:
    
    // Instead of: modu.registerPipeline('myPipeline', [step1, step2])
    // Use:
    modu.configurePipeline('myPipeline', {
      steps: [
        { type: 'component', name: 'step1Component' },
        { type: 'component', name: 'step2Component' }
      ]
    });
    
    See migration guide: https://github.com/your-repo/modulink-js/docs/migration.md`);
    
    if (typeof name !== 'string') {
      this.log('Error: Pipeline name must be a string.');
      return;
    }
    if (typeof pipelineStepsOrFunction === 'function') {
      this.pipelines[name] = [pipelineStepsOrFunction];
    } else if (Array.isArray(pipelineStepsOrFunction) && pipelineStepsOrFunction.every(step => typeof step === 'function')) {
      this.pipelines[name] = pipelineStepsOrFunction;
    } else {
      this.log('Error: Pipeline steps must be a function or an array of functions.');
    }
    this.log(`Pipeline registered: ${name}`);
  }

  /**
   * Executes a registered pipeline by name or an ad-hoc pipeline (array of functions).
   * Returns a promise that resolves with the final context, or rejects if an error occurs AND throwErrors is true.
   * Additionally, returns a boolean indicating if a response was sent by the pipeline.
   * 
   * @deprecated Use the new hybrid configuration approach with `modu.createPipeline()` for better modularity and maintainability.
   * @see {@link https://github.com/your-repo/modulink-js/docs/migration.md} Migration Guide
   * 
   * @param {string | Function[]} nameOrPipeline - The name of the registered pipeline or an array of functions.
   * @param {Object} initialCtx - The initial context object.
   * @returns {Promise<{finalCtx: Object, responseSent: boolean}>} Resolves with final context and responseSent flag.
   */
  async execute(nameOrPipeline, initialCtx = {}) {
    console.warn(`[ModuLink DEPRECATED] execute() is deprecated. Use the new hybrid configuration approach:
    
    // Instead of: await modu.execute('myPipeline', ctx)
    // Use:
    const pipeline = modu.createPipeline('myPipeline');
    const result = await pipeline(ctx);
    
    See migration guide: https://github.com/your-repo/modulink-js/docs/migration.md`);
    
    this.log(`Executing pipeline: ${typeof nameOrPipeline === 'string' ? nameOrPipeline : 'Ad-hoc Pipeline'}`);
    let pipeline;
    let pipelineName = 'Ad-hoc Pipeline';

    if (typeof nameOrPipeline === 'string') {
      pipeline = this.pipelines[nameOrPipeline];
      pipelineName = nameOrPipeline;
      if (!pipeline) {
        const error = new Error(`Pipeline "${nameOrPipeline}" not found.`);
        this.log(`Error: ${error.message}`);
        if (this.config.throwErrors) {
          throw error;
        }
        initialCtx.error = { message: error.message, step: 'pipeline_lookup' };
        // Try to send error response if res is available
        if (initialCtx.res && !initialCtx.res.headersSent) {
          initialCtx.res.status(500).json({ error: error.message, step: 'pipeline_lookup' });
          return { finalCtx: initialCtx, responseSent: true };
        }
        return { finalCtx: initialCtx, responseSent: false };
      }
    } else if (Array.isArray(nameOrPipeline) && nameOrPipeline.every(step => typeof step === 'function')) {
      pipeline = nameOrPipeline;
    } else if (typeof nameOrPipeline === 'function') {
      pipeline = [nameOrPipeline]; // Wrap single function in an array
    }
     else {
      const error = new Error('Invalid pipeline: Must be a registered name, a function, or an array of functions.');
      this.log(`Error: ${error.message}`);
      console.error("[DEBUG MODULINK PRE-IF] nameOrPipeline type:", typeof nameOrPipeline, ", isArray:", Array.isArray(nameOrPipeline));

      if (this.config.throwErrors) {
        throw error;
      }
      initialCtx.error = { message: error.message, step: 'pipeline_validation' };
      if (initialCtx.res && !initialCtx.res.headersSent) {
        initialCtx.res.status(500).json({ error: error.message, step: 'pipeline_validation' });
        return { finalCtx: initialCtx, responseSent: true };
      }
      return { finalCtx: initialCtx, responseSent: false };
    }

    return this._executePipeline(pipeline, initialCtx, pipelineName);
  }

  /**
   * Internal method to execute the steps of a pipeline.
   * @param {Function[]} pipeline - Array of functions representing the pipeline.
   * @param {Object} initialCtx - The initial context object.
   * @param {string} pipelineName - The name of the pipeline (for logging).
   * @returns {Promise<{finalCtx: Object, responseSent: boolean}>} Resolves with final context and responseSent flag.
   * @private
   */
  async _executePipeline(pipelineNameOrSteps, initialCtx) {
    let currentCtx = { ...initialCtx };
    let responseSentByModulink = false;
    let pipelineName;
    let actualPipelineSteps; // Renamed from pipelineSteps to avoid conflict

    if (typeof pipelineNameOrSteps === 'string') {
      pipelineName = pipelineNameOrSteps;
      const pipelineDefinition = this.pipelines[pipelineName];
      if (!pipelineDefinition) {
        this.log(`[ModuLink] Error: Pipeline \"${pipelineName}\" not found.`);
        if (currentCtx.res && !currentCtx.res.headersSent) {
          currentCtx.res.status(500).json({ error: `Pipeline ${pipelineName} not found.` });
        }
        return { finalCtx: currentCtx, responseSent: true }; // Indicate response was (or should have been) sent
      }
      actualPipelineSteps = Array.isArray(pipelineDefinition) ? pipelineDefinition : pipelineDefinition.steps;
      if (!Array.isArray(actualPipelineSteps)) {
        this.log(`[ModuLink] Error: Steps for pipeline \"${pipelineName}\" is not an array.`);
        if (currentCtx.res && !currentCtx.res.headersSent) {
          currentCtx.res.status(500).json({ error: `Invalid configuration for pipeline ${pipelineName}.` });
        }
        return { finalCtx: currentCtx, responseSent: true };
      }
    } else if (Array.isArray(pipelineNameOrSteps)) {
      pipelineName = 'Ad-hoc Pipeline';
      actualPipelineSteps = pipelineNameOrSteps;
    } else {
      this.log('[ModuLink] Error: Invalid pipeline provided to execute. Must be a name or an array of steps.');
      if (currentCtx.res && !currentCtx.res.headersSent) {
        currentCtx.res.status(500).json({ error: 'Invalid pipeline execution request.' });
      }
      return { finalCtx: currentCtx, responseSent: true };
    }

    this.log(`Executing pipeline \"${pipelineName}\". Initial context keys: ${Object.keys(initialCtx).join(', ')}`);

    for (const step of actualPipelineSteps) { // Changed to actualPipelineSteps
      const stepName = step.name || 'anonymous step';
      const stepFunction = typeof step === 'function' ? step : step.execute;

      if (typeof stepFunction !== 'function') {
        this.log(`[ModuLink] Warning: Step \"${stepName}\" in pipeline \"${pipelineName}\" is not a function. Skipping.`);
        continue;
      }

      try {
        // this.logContext(currentCtx, `Before step: ${stepName}`); // Removed this
        this.log(`[ModuLink] Pipeline \"${pipelineName}\": Before step \"${stepName}\"`);
        
        // Log keys before executing the step
        this.log(`[ModuLink] Pipeline \"${pipelineName}\": Before step \"${stepName}\". Context keys: ${Object.keys(currentCtx).join(', ')}`);
        
        currentCtx = await stepFunction(currentCtx); 
        
        // Log keys after executing the step
        let afterStepKeys = 'undefined_or_null_context';
        if (currentCtx) {
            afterStepKeys = Object.keys(currentCtx).join(', ');
        }
        this.log(`[ModuLink] Pipeline \"${pipelineName}\": After step \"${stepName}\". Context keys: ${afterStepKeys}`);

        if (currentCtx && currentCtx.res && currentCtx.res.headersSent) {
          this.log(`[ModuLink] Response sent by step \"${stepName}\" in pipeline \"${pipelineName}\".`);
          responseSentByModulink = true;
          break; 
        }
      } catch (err) {
        this.log(`[ModuLink] Error in pipeline \"${pipelineName}\", step \"${stepName}\": ${err.message}`);
        currentCtx.error = err; 

        if (this.config.throwErrors) {
          throw err; 
        }

        if (this.pipelines[pipelineName] && this.pipelines[pipelineName].onError) {
          try {
            this.log(`[ModuLink] Attempting to use onError handler for pipeline \"${pipelineName}\".`);
            await this.pipelines[pipelineName].onError(currentCtx, err);
            if (currentCtx.res && currentCtx.res.headersSent) {
              this.log(`[ModuLink] Error handled and response sent by onError handler for pipeline \"${pipelineName}\".`);
              responseSentByModulink = true;
              break; 
            } else {
               this.log(`[ModuLink] onError handler for \"${pipelineName}\" executed but did not send a response. Pipeline continues.`);
            }
          } catch (onErrorError) {
            this.log(`[ModuLink] CRITICAL: Error in onError handler for pipeline \"${pipelineName}\": ${onErrorError.message}`);
            if (currentCtx.res && !currentCtx.res.headersSent) {
              currentCtx.res.status(500).json({ error: 'Internal Server Error during pipeline onError handling.' });
              responseSentByModulink = true;
              break; 
            }
          }
        }
        // If config.throwErrors is false, and no pipeline.onError sent a response,
        // ctx.error is set, and the pipeline continues to allow a responder step to handle it.
      }
    } // End of for...of loop for steps

    // Final check: if there's an unhandled error and no response has been sent by a step or error handler
    // and there's a responder as the last step, it might try to send a success response.
    // This is tricky. The responder should ideally check ctx.error.
    // If an error exists and no response sent, and no customErrorHandler, and throwErrors is false,
    // we might have an unhandled error that didn't send a response.
    if (!responseSentByModulink && currentCtx.error && !this.config.throwErrors && 
        !(this.pipelines[pipelineName] && this.pipelines[pipelineName].onError)) {
      if (currentCtx.res && !currentCtx.res.headersSent) {
        this.log(`[ModuLink] Unhandled error in pipeline \"${pipelineName}\" at the end of execution. Sending 500.`);
        currentCtx.res.status(500).json({ 
          error: 'Pipeline error', 
          message: currentCtx.error.message || 'An unspecified error occurred in the pipeline.',
          step: currentCtx.error.step || 'unknown'
        });
        responseSentByModulink = true;
      }
    }

    return { finalCtx: currentCtx, responseSent: responseSentByModulink };
  }

  /**
   * Returns a middleware function that logs the context to the console.
   * @returns {(ctx: object) => object} Logging middleware.
   * @example
   * modu.use(Modulink.logging());
   */
  static logging = function () {
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
  static wrapWithCtx = function(fn) {
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
}

/**
 * Exports the Modulink class and related components for use in other modules.
 * @example
 * import { Modulink, ConfigurationLedger, ChainFactory } from './modulink.js';
 */
export { Modulink, TriggerRegister, ConfigurationLedger, ChainFactory };
