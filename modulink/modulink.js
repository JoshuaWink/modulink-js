/**
 * @fileoverview ModuLink JavaScript Implementation - Composable Function Chains with Multi-Level Middleware
 * 
 * ModuLink is a powerful library for building composable, maintainable applications using
 * function chains and sophisticated middleware systems. It provides a clean separation
 * between business logic (chains) and application integration (ModuLink instances).
 * 
 * ## Core Concepts
 * 
 * ### Chains
 * Chains are sequences of functions (links) that process data through a context object.
 * Each link receives a context, transforms it, and returns the modified context.
 * Chains support multiple middleware layers for cross-cutting concerns.
 * 
 * ### Links  
 * Links are individual functions that perform specific business logic operations.
 * They follow the pattern: (context) => context
 * Links can be sync or async and should be pure functions when possible.
 * 
 * ### ModuLink Instances
 * ModuLink instances provide the integration layer between chains and applications.
 * They manage middleware, link registries, and framework connections.
 * 
 * ### Context
 * The context object flows through the entire chain, accumulating data and state.
 * It serves as both input and output, maintaining immutability patterns where possible.
 * 
 * ## Middleware System
 * 
 * ModuLink implements a sophisticated multi-level middleware system:
 * 
 * 1. **Instance Middleware** - Global to the ModuLink instance, runs first
 * 2. **Input Middleware** - Runs before each link in a chain  
 * 3. **Link Execution** - The actual business logic
 * 4. **Output Middleware** - Runs after each link in a chain
 * 5. **Global Middleware** - Runs after each link (O(n*m) behavior)
 * 
 * ## Usage Patterns
 * 
 * ### Basic Chain Creation and Execution
 * ```javascript
 * import { chain, createModuLink } from 'modulink';
 * import { addOne, double } from './links/math.js';
 * 
 * // Create and execute chain
 * const myChain = chain(addOne, double);
 * const result = await myChain({ value: 5 }); // { value: 12 }
 * ```
 * 
 * ### Middleware Integration
 * ```javascript
 * import { logger, validator, auditMiddleware } from './middleware/common.js';
 * import { processData, saveData } from './links/data.js';
 * 
 * const myChain = chain(processData, saveData)
 *   .use.onInput(validator)   // Before each link
 *   .use.onOutput(logger)     // After each link  
 *   .use(auditMiddleware);    // After each link (global)
 * ```
 * 
 * ### Application Integration
 * ```javascript
 * // Express integration
 * const app = express();
 * const modulink = createModuLink(app);
 * 
 * modulink.use(authMiddleware); // Instance-level middleware
 * 
 * modulink.connect((app, modulink) => {
 *   app.post('/users', async (req, res) => {
 *     const userChain = modulink.createChain(validateUser, saveUser);
 *     const result = await userChain(modulink.createContext({ body: req.body }));
 *     
 *     if (result.error) {
 *       res.status(400).json({ error: result.error.message });
 *     } else {
 *       res.json(result.user);
 *     }
 *   });
 * });
 * ```
 * 
 * ### Link Registry Pattern
 * ```javascript
 * // Register reusable components
 * modulink
 *   .registerLink('validate', validateInput)
 *   .registerLink('transform', transformData)
 *   .registerLink('save', saveToDatabase);
 * 
 * // Build chains declaratively
 * const processChain = modulink.createChainFromLinks('validate', 'transform', 'save');
 * ```
 * 
 * ## Error Handling
 * 
 * Errors are handled gracefully throughout the system:
 * - Thrown errors are caught and attached to context as `context.error`
 * - Execution stops on error but output middleware still runs
 * - Error contexts maintain all original context data
 * 
 * ## Performance Considerations
 * 
 * - Middleware timings are tracked when metadata is enabled
 * - Core execution bypasses middleware for chain-as-middleware scenarios  
 * - Context objects are cloned appropriately to maintain isolation
 * 
 * ## TypeScript Support
 * 
 * While this is the JavaScript implementation, type definitions are available
 * for enhanced development experience with TypeScript projects.
 * 
 * @version 3.0.0
 * @author ModuLink Team
 * @since 1.0.0
 * 
 * @example
 * // Complete example: User signup workflow
 * import { chain, createModuLink } from 'modulink';
 * import express from 'express';
 * import { validateEmail, createUser, sendWelcome } from './links/user.js';
 * import { generateId } from './utils/id.js';
 * import { db } from './db/index.js';
 * import { emailService } from './services/email.js';
 * 
 * const app = express();
 * const modulink = createModuLink(app);
 * 
 * // Register components (if using a registry pattern)
 * modulink
 *   .registerLink('validateEmail', validateEmail)
 *   .registerLink('createUser', createUser)
 *   .registerLink('sendWelcome', sendWelcome);
 * 
 * // Global middleware
 * modulink.use((ctx) => {
 *   ctx.requestId = generateId();
 *   ctx.startTime = Date.now();
 *   return ctx;
 * });
 * 
 * // Application setup
 * modulink.connect((app) => {
 *   app.post('/signup', async (req, res) => {
 *     const signupChain = chain(validateEmail, createUser, sendWelcome);
 *     const result = await signupChain({
 *       email: req.body.email,
 *       operation: 'signup',
 *       _instanceMiddleware: modulink._instanceMiddleware
 *     });
 *     
 *     if (result.error) {
 *       res.status(400).json({ error: result.error.message });
 *     } else {
 *       res.status(201).json({ 
 *         user: result.user,
 *         requestId: result.requestId 
 *       });
 *     }
 *   });
 * });
 * 
 * app.listen(3000);
 */

/**
 * ModuLink Implementation for JavaScript
 * 
 * Hybrid Architecture:
 * 1. Chains handle business logic as pure functions
 * 2. ModuLink instances handle integration (HTTP/cron/CLI/messaging)
 * 3. Multi-level middleware system (instance + chain level)
 * 4. Everything remains modular and swappable
 */

import {
  createContext,
  createHttpContext,
  createCronContext,
  createCliContext,
  createMessageContext,
  createErrorContext,
  getCurrentTimestamp
} from './types.js';

/**
 * Creates a composable chain of functions with multi-level middleware support.
 * 
 * The chain function is the core building block of ModuLink. It combines multiple 
 * functions (links) into a single executable chain with sophisticated middleware 
 * capabilities at three levels: input, output, and global.
 * 
 * Execution Order:
 * 1. Instance-level middleware (from ModuLink instance)
 * 2. For each link:
 *    - onInput middleware
 *    - The link function itself
 *    - onOutput middleware
 *    - Global middleware (after each link)
 * 
 * Context Flow:
 * Each function receives a context object and should return a modified context.
 * The context flows through the entire chain, accumulating changes.
 * 
 * Error Handling:
 * If any function throws an error or returns a context with an `error` property,
 * the chain stops executing and returns the error context.
 * 
 * @param {...Function} links - Functions to chain together. Each should accept
 *                              a context object and return a context object.
 *                              Can be async or sync functions.
 * 
 * @returns {Function} An enhanced chain function with middleware APIs:
 *   - chain(ctx) - Execute the chain with given context
 *   - chain.use(...middleware) - Add global middleware (runs after each link)
 *   - chain.use.onInput(...middleware) - Add input middleware (runs before each link)
 *   - chain.use.onOutput(...middleware) - Add output middleware (runs after each link)
 *   - chain.onInput(...middleware) - Direct access to add input middleware
 *   - chain.onOutput(...middleware) - Direct access to add output middleware
 *   - chain.coreExecution(ctx) - Execute without middleware (for chain-as-middleware)
 *   - chain._debugInfo() - Get debug information about the chain
 * 
 * @example
 * // Basic chain creation with imported links
 * import { addOne, double } from './links/math.js';
 * 
 * const myChain = chain(addOne, double);
 * 
 * // Execute the chain
 * const result = await myChain({ value: 5 });
 * console.log(result.value); // 12 (5 + 1 = 6, 6 * 2 = 12)
 * 
 * @example
 * // Chain with middleware using imported components
 * import { addOne, double } from './links/math.js';
 * import { logger, validator } from './middleware/common.js';
 * 
 * const myChain = chain(addOne, double)
 *   .use.onInput(validator)  // Runs before each link
 *   .use.onOutput(logger)    // Runs after each link
 *   .use(timestampMiddleware);  // Runs after each link (global middleware)
 * 
 * @example
 * // Empty chain for testing
 * const emptyChain = chain();
 * const result = await emptyChain({ test: true });
 * console.log(result); // { test: true }
 * 
 * @example
 * // Async links from separate modules
 * import { fetchData, processData } from './links/api.js';
 * 
 * const asyncChain = chain(fetchData, processData);
 * 
 * @example
 * // Error handling with imported link
 * import { validateInput } from './links/validation.js';
 * 
 * const errorChain = chain(validateInput);
 * const result = await errorChain({ shouldFail: true });
 * console.log(result.error); // Error object
 */
export function chain(...links) {
  let _middleware = [];
  let _onInputMiddleware = [];
  let _onOutputMiddleware = [];

  // Allow empty chains for testing purposes
  if (links.length === 0) {
    const emptyChain = async function(ctx) {
      return ctx || {};
    };
    emptyChain.use = function(...mws) { 
      _middleware.push(...mws);
      return emptyChain; 
    };
    emptyChain.use.onInput = function(...mws) { 
      _onInputMiddleware.push(...mws);
      return emptyChain; 
    };
    emptyChain.use.onOutput = function(...mws) { 
      _onOutputMiddleware.push(...mws);
      return emptyChain; 
    };
    emptyChain.onInput = function(...mws) { 
      _onInputMiddleware.push(...mws);
      return emptyChain; 
    };
    emptyChain.onOutput = function(...mws) { 
      _onOutputMiddleware.push(...mws);
      return emptyChain; 
    };
    emptyChain.coreExecution = emptyChain;
    emptyChain._debugInfo = function() {
      return {
        linkCount: 0,
        middlewareCounts: {
          input: _onInputMiddleware.length,
          output: _onOutputMiddleware.length,
          global: _middleware.length
        },
        totalMiddleware: _onInputMiddleware.length + _onOutputMiddleware.length + _middleware.length
      };
    };
    return emptyChain;
  }

  // Validate all links are functions
  links.forEach((link, index) => {
    if (typeof link !== 'function') {
      throw new Error(`Link at index ${index} must be a function`);
    }
  });

  /**
   * Executes middleware, handling both function and chain middleware types.
   * 
   * This internal helper function properly executes middleware while handling
   * special cases like chain-as-middleware to prevent infinite recursion.
   * 
   * @param {Function|Object} middleware - Middleware to execute. Can be:
   *   - A regular function that accepts context and returns context
   *   - A chain object with coreExecution method (for chain-as-middleware)
   * @param {Object} ctx - The context object to pass to middleware
   * 
   * @returns {Promise<Object>} The modified context object
   * 
   * @throws {Error} If middleware is not a function or valid chain
   * 
   * @example
   * // Regular function middleware (imported)
   * import { logMiddleware } from './middleware/logging.js';
   * await executeMiddleware(logMiddleware, { id: 123 });
   * 
   * @example
   * // Chain as middleware (imported)
   * import { subChain } from './chains/processing.js';
   * await executeMiddleware(subChain, { data: 'test' });
   */
  async function executeMiddleware(middleware, ctx) {
    if (!ctx._meta) {
      ctx._meta = {};
    }
    
    if (typeof middleware === 'function') {
      return await middleware(ctx);
    } else if (middleware && typeof middleware.coreExecution === 'function') {
      // Chain as middleware - use core execution to avoid middleware recursion
      const middlewareCtx = { ...ctx, _meta: { ...ctx._meta } };
      const result = await middleware.coreExecution(middlewareCtx);
      // Merge _meta changes back to original context
      if (result._meta) {
        ctx._meta = { ...ctx._meta, ...result._meta };
      }
      return ctx;
    } else {
      throw new Error('Middleware must be a function or a chain');
    }
  }
  
  /**
   * Creates a standardized error context from any error type.
   * 
   * This helper ensures that all errors in the chain system are properly
   * formatted as Error objects and attached to the context in a consistent way.
   * 
   * @param {any} error - The error to wrap. Can be an Error object, string, or any value
   * @param {Object} ctx - The current context object
   * 
   * @returns {Object} Context object with standardized error property
   * 
   * @example
   * // String error
   * const errorCtx = createErrorContext('Something failed', { id: 123 });
   * console.log(errorCtx.error instanceof Error); // true
   * console.log(errorCtx.id); // 123
   * 
   * @example
   * // Error object
   * const err = new Error('Custom error');
   * const errorCtx = createErrorContext(err, { data: 'test' });
   * console.log(errorCtx.error === err); // true
   */
  function createErrorContext(error, ctx) {
    return {
      ...ctx,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }

  /**
   * Main chain execution function with full middleware support.
   * 
   * This function orchestrates the complete execution of a chain with all
   * middleware layers. It implements the full middleware stack:
   * 1. Instance-level middleware (from ModuLink instances)
   * 2. Input middleware (before each link)
   * 3. Link execution
   * 4. Output middleware (after each link)
   * 5. Global middleware (after each link)
   * 
   * The function also handles performance tracking, error propagation,
   * and metadata management throughout the execution.
   * 
   * @param {Object} ctx - The context object to execute the chain with
   * @param {Array} [ctx._instanceMiddleware] - Instance-level middleware array
   * @param {Object} [ctx._metadata] - Metadata object for tracking execution
   * @param {Object} [ctx._meta] - Meta information object
   * 
   * @returns {Promise<Object>} The final context after chain execution
   * 
   * @example
   * const myChain = chain(linkA, linkB);
   * const result = await myChain({
   *   data: 'input',
   *   _instanceMiddleware: [logger, validator]
   * });
   */
  async function runChain(ctx) {
    if (!ctx._meta) {
      ctx._meta = {};
    }

    // Initialize metadata for middleware tracking
    const instanceMiddleware = ctx._instanceMiddleware || [];
    const hasMiddleware = instanceMiddleware.length > 0 || _onInputMiddleware.length > 0 || _onOutputMiddleware.length > 0 || _middleware.length > 0;
    
    if (hasMiddleware) {
      const metadata = {
        ...(ctx._metadata || {}),
        middlewareCounts: {
          input: _onInputMiddleware.length,
          output: _onOutputMiddleware.length,
          global: _middleware.length
        },
        performance: {
          ...(ctx._metadata?.performance || {}),
          instanceMiddlewareTimings: ctx._metadata?.performance?.instanceMiddlewareTimings || [],
          inputMiddlewareTimings: ctx._metadata?.performance?.inputMiddlewareTimings || [],
          outputMiddlewareTimings: ctx._metadata?.performance?.outputMiddlewareTimings || [],
          globalMiddlewareTimings: ctx._metadata?.performance?.globalMiddlewareTimings || []
        }
      };
      
      ctx = {
        ...ctx,
        _metadata: metadata
      };
    }

    try {
      // 1. Run instance‐level middleware first
      for (const mw of instanceMiddleware) {
        try {
          // Check if middleware expects next() callback
          if (mw.length > 1) {
            let calledNext = false;
            await mw(ctx, async () => {
              calledNext = true;
            });
            if (!calledNext) {
              return ctx;
            }
          } else {
            // Simple middleware that transforms context
            ctx = await mw(ctx) || ctx;
          }
        } catch (error) {
          return createErrorContext(error, ctx);
        }
      }

      // 2. Execute links in sequence with middleware after each link
      for (let i = 0; i < links.length; i++) {
        const link = links[i];

        // Set up link context information for middleware
        const linkInfo = {
          name: link.name || 'anonymous',
          index: i,
          length: links.length,
          isAsync: link.constructor.name === 'AsyncFunction'
        };
        ctx = {
          ...ctx,
          _currentLink: linkInfo
        };

        // Execute onInput middleware for this link
        for (const middleware of _onInputMiddleware) {
          try {
            const startTime = Date.now();
            ctx = await executeMiddleware(middleware, ctx);
            const endTime = Date.now();
            
            // Record timing if we're tracking metadata
            if (ctx._metadata?.performance?.inputMiddlewareTimings) {
              const newTiming = {
                name: middleware.name || 'anonymous',
                duration: endTime - startTime
              };
              ctx = {
                ...ctx,
                _metadata: {
                  ...ctx._metadata,
                  performance: {
                    ...ctx._metadata.performance,
                    inputMiddlewareTimings: [...ctx._metadata.performance.inputMiddlewareTimings, newTiming]
                  }
                }
              };
            }
            
            if (ctx.error) {
              return ctx;
            }
          } catch (error) {
            return createErrorContext(error, ctx);
          }
        }

        // Execute the link itself
        try {
          ctx = await link(ctx);
        } catch (error) {
          ctx = createErrorContext(error, ctx);
        }

        // Execute onOutput middleware for this link (should run even on error)
        for (const middleware of _onOutputMiddleware) {
          try {
            const startTime = Date.now();
            ctx = await executeMiddleware(middleware, ctx);
            const endTime = Date.now();
            
            // Record timing if we're tracking metadata
            if (ctx._metadata?.performance?.outputMiddlewareTimings) {
              const newTiming = {
                name: middleware.name || 'anonymous',
                duration: endTime - startTime
              };
              ctx = {
                ...ctx,
                _metadata: {
                  ...ctx._metadata,
                  performance: {
                    ...ctx._metadata.performance,
                    outputMiddlewareTimings: [...ctx._metadata.performance.outputMiddlewareTimings, newTiming]
                  }
                }
              };
            }
          } catch (error) {
            ctx = createErrorContext(error, ctx);
          }
        }

        // Execute general middleware after this link (O(n*m) behavior)
        for (const middleware of _middleware) {
          try {
            const startTime = Date.now();
            
            // Check if middleware expects next() callback
            if (middleware.length > 1) {
              let calledNext = false;
              await middleware(ctx, async () => {
                calledNext = true;
              });
              if (!calledNext) {
                break;
              }
            } else {
              // Simple middleware that transforms context
              const result = await middleware(ctx);
              if (result) {
                ctx = result;
              }
            }
            
            const endTime = Date.now();
            
            // Record timing if we're tracking metadata
            if (ctx._metadata?.performance?.globalMiddlewareTimings) {
              const newTiming = {
                name: middleware.name || 'anonymous',
                duration: endTime - startTime
              };
              ctx = {
                ...ctx,
                _metadata: {
                  ...ctx._metadata,
                  performance: {
                    ...ctx._metadata.performance,
                    globalMiddlewareTimings: [...ctx._metadata.performance.globalMiddlewareTimings, newTiming]
                  }
                }
              };
            }
            
            // Stop immediately if middleware threw an error
            if (ctx.error) {
              break;
            }
          } catch (error) {
            ctx = createErrorContext(error, ctx);
            break; // Stop immediately on error
          }
        }
        
        // Clean up link info
        const { _currentLink, _linkInfo, ...cleanCtx } = ctx;
        ctx = cleanCtx;

        // Stop execution if there's an error (after middleware has run)
        if (ctx.error) {
          break;
        }
      }

      return ctx;
    } catch (error) {
      return createErrorContext(error, ctx);
    }
  }

  /**
   * Core execution function that runs the chain without any middleware.
   * 
   * This function provides the pure chain execution logic, running only the
   * links in sequence without any middleware layers. It's used internally
   * when a chain is used as middleware to prevent middleware recursion.
   * 
   * Unlike the main runChain function, this:
   * - Skips all middleware (instance, input, output, global)
   * - Only executes the core links in sequence
   * - Still handles error propagation and context flow
   * - Maintains the same error handling patterns
   * 
   * @param {Object} ctx - The context object to execute the chain with
   * @param {Object} [ctx._meta] - Meta information object (will be initialized if missing)
   * 
   * @returns {Promise<Object>} The final context after chain execution
   * 
   * @example
   * // Using coreExecution directly (rarely needed)
   * const myChain = chain(linkA, linkB);
   * const result = await myChain.coreExecution({ data: 'test' });
   * 
   * @example
   * // More commonly used when chain is middleware
   * const subChain = chain(processData, validateData);
   * const mainChain = chain(fetchData)
   *   .use(subChain); // subChain.coreExecution is called internally
   */
  async function coreExecution(ctx) {
    if (!ctx._meta) {
      ctx._meta = {};
    }

    let currentCtx = ctx;

    for (let i = 0; i < links.length; i++) {
      const link = links[i];

      try {
        currentCtx = await link(currentCtx);
      } catch (error) {
        return createErrorContext(error, currentCtx);
      }

      // Stop execution if there's an error
      if (currentCtx.error) {
        break;
      }
    }

    return currentCtx;
  }

  /**
   * Creates a proxy chain that enables fluent API chaining for middleware.
   * 
   * This internal helper creates a new function that wraps the target chain
   * while preserving all its properties and methods. It enables the fluent
   * API pattern where middleware addition methods return a new chain proxy
   * that can be further chained.
   * 
   * The proxy maintains all the functionality of the original chain while
   * allowing for method chaining like: chain.use(...).onInput(...).onOutput(...)
   * 
   * @param {Function} targetChain - The chain function to wrap with proxy
   * 
   * @returns {Function} A proxy function with all chain methods for fluent API
   * 
   * @example
   * // This enables fluent chaining
   * const myChain = chain(linkA, linkB)
   *   .use(globalMiddleware)
   *   .onInput(inputMiddleware)
   *   .onOutput(outputMiddleware);
   * 
   * // Each method call returns a new proxy that can be further chained
   */
  function createChainProxy(targetChain) {
    const proxy = async function(ctx) {
      return await targetChain(ctx);
    };
    
    // Copy all static properties
    Object.setPrototypeOf(proxy, targetChain);
    Object.assign(proxy, targetChain);
    
    // Create proper chaining API
    proxy.use = function(...middlewares) {
      for (const middleware of middlewares) {
        _middleware.push(middleware);
      }
      return createChainProxy(targetChain);
    };
    
    proxy.use.onInput = function(...middlewares) {
      for (const middleware of middlewares) {
        _onInputMiddleware.push(middleware);
      }
      return createChainProxy(targetChain);
    };
    
    proxy.use.onOutput = function(...middlewares) {
      for (const middleware of middlewares) {
        _onOutputMiddleware.push(middleware);
      }
      return createChainProxy(targetChain);
    };
    
    // Add individual chaining methods for direct access
    proxy.onInput = function(...middlewares) {
      for (const middleware of middlewares) {
        _onInputMiddleware.push(middleware);
      }
      return createChainProxy(targetChain);
    };
    
    proxy.onOutput = function(...middlewares) {
      for (const middleware of middlewares) {
        _onOutputMiddleware.push(middleware);
      }
      return createChainProxy(targetChain);
    };
    
    proxy.coreExecution = coreExecution;
    
    // Add _debugInfo method for chain introspection
    proxy._debugInfo = function() {
      return {
        linkCount: links.length,
        middlewareCounts: {
          input: _onInputMiddleware.length,
          output: _onOutputMiddleware.length,
          global: _middleware.length
        },
        totalMiddleware: _onInputMiddleware.length + _onOutputMiddleware.length + _middleware.length
      };
    };
    
    return proxy;
  }

  // Allow attaching chain‐level middleware:
  runChain.use = function (...mws) {
    _middleware.push(...mws);
    return runChain;
  };

  // .use.onInput() method for input-specific middleware
  runChain.use.onInput = function(...middlewares) {
    for (const middleware of middlewares) {
      _onInputMiddleware.push(middleware);
    }
    return createChainProxy(runChain);
  };

  // .use.onOutput() method for output-specific middleware
  runChain.use.onOutput = function(...middlewares) {
    for (const middleware of middlewares) {
      _onOutputMiddleware.push(middleware);
    }
    return createChainProxy(runChain);
  };

  // Add individual chaining methods for direct access
  runChain.onInput = function(...middlewares) {
    for (const middleware of middlewares) {
      _onInputMiddleware.push(middleware);
    }
    return createChainProxy(runChain);
  };
  
  runChain.onOutput = function(...middlewares) {
    for (const middleware of middlewares) {
      _onOutputMiddleware.push(middleware);
    }
    return createChainProxy(runChain);
  };

  // Expose core execution for chain-as-middleware usage
  runChain.coreExecution = coreExecution;

  // Add _debugInfo method for chain introspection
  runChain._debugInfo = function() {
    return {
      linkCount: links.length,
      middlewareCounts: {
        input: _onInputMiddleware.length,
        output: _onOutputMiddleware.length,
        global: _middleware.length
      },
      totalMiddleware: _onInputMiddleware.length + _onOutputMiddleware.length + _middleware.length
    };
  };

  return runChain;
}

/**
 * Creates a new ModuLink instance for integrating chains with applications.
 * 
 * ModuLink instances serve as the integration layer between your pure business
 * logic chains and various application frameworks (Express, Fastify, CLI, etc.).
 * They provide:
 * - Instance-level middleware that runs before all chains
 * - Application integration via the connect pattern
 * 
 * The instance can work in two modes:
 * 1. Standalone mode (app = null) - for CLI tools, workers, etc.
 * 2. Framework mode (app provided) - integrates with web frameworks
 * 
 * @param {Object} [app=null] - Optional application instance to integrate with.
 *                              Can be Express app, Fastify instance, etc.
 *                              If null, works in standalone mode.
 * 
 * @returns {Object} ModuLink instance with the following methods:
 *   - use(middleware) - Add instance-level middleware
 *   - connect(fn) - Integration function for framework setup
 * 
 * @example
 * // Standalone mode (no framework)
 * import { validateUser, saveUser } from './links/user.js';
 * 
 * const modulink = createModuLink();
 * 
 * // Create and execute chain directly
 * const signupChain = chain(validateUser, saveUser);
 * const result = await signupChain({ 
 *   email: 'test@example.com',
 *   _instanceMiddleware: modulink._instanceMiddleware 
 * });
 * 
 * @example
 * // Express integration
 * import express from 'express';
 * import { validateInput, createUser, sendEmail } from './links/user.js';
 * import { requestLogger } from './middleware/logging.js';
 * 
 * const app = express();
 * const modulink = createModuLink(app);
 * 
 * // Add global logging middleware
 * modulink.use(requestLogger);
 * 
 * // Set up routes using connect pattern
 * modulink.connect((app) => {
 *   app.post('/signup', async (req, res) => {
 *     const userChain = chain(validateInput, createUser, sendEmail);
 *     const result = await userChain({ 
 *       body: req.body,
 *       operation: 'signup',
 *       _instanceMiddleware: modulink._instanceMiddleware
 *     });
 *     
 *     if (result.error) {
 *       res.status(400).json({ error: result.error.message });
 *     } else {
 *       res.json({ user: result.user });
 *     }
 *   });
 * });
 * 
 * @example
 * // CLI tool integration
 * import { parseArgs, executeCommand, formatOutput } from './links/cli.js';
 * import { performanceTracker, completionLogger } from './middleware/cli.js';
 * 
 * const modulink = createModuLink();
 * 
 * // Register CLI-specific middleware
 * modulink.use(performanceTracker);
 * modulink.use(completionLogger);
 * 
 * // Set up CLI commands
 * modulink.connect(() => {
 *   const processCommand = chain(parseArgs, executeCommand, formatOutput);
 *   
 *   process.argv.slice(2).forEach(async (command) => {
 *     const result = await processCommand({ 
 *       command,
 *       _instanceMiddleware: modulink._instanceMiddleware
 *     });
 *     if (result.error) {
 *       console.error(result.error.message);
 *       process.exit(1);
 *     }
 *   });
 * });
 * 
 * @example
 * // Worker/background service
 * import { fetchJob, processJob, markComplete } from './links/jobs.js';
 * import { logger } from './utils/logging.js';
 * 
 * modulink.connect(() => {
 *   const jobProcessor = chain(fetchJob, processJob, markComplete);
 *   
 *   setInterval(async () => {
 *     const result = await jobProcessor({ 
 *       source: 'cron',
 *       _instanceMiddleware: modulink._instanceMiddleware
 *     });
 *     if (result.error) {
 *       logger.error('Job processing failed:', result.error);
 *     }
 *   }, 60000); // Every minute
 * });
 * 
 * @example
 * // Method chaining after connect
 * import { globalMiddleware } from './middleware/global.js';
 * 
 * modulink
 *   .use(globalMiddleware)
 *   .connect((app) => {
 *     // Setup routes...
 *   });
 * */
export function createModuLink(app = null) {
  const instance = {
    app,
    _instanceMiddleware: [],

    /**
     * Adds instance-level middleware that runs before all chain execution.
     * 
     * Instance middleware is global to this ModuLink instance and will be
     * executed before any chain-level middleware or links. This is useful
     * for cross-cutting concerns like logging, authentication, request
     * tracking, and performance monitoring.
     * 
     * Middleware execution order:
     * 1. Instance middleware (this method)
     * 2. Chain input middleware  
     * 3. Link execution
     * 4. Chain output middleware
     * 5. Chain global middleware
     * 
     * @param {Function} mw - Middleware function that accepts context and
     *                        returns modified context. Can be async.
     *                        Signature: (ctx) => ctx or (ctx, next) => void
     * 
     * @returns {Object} The ModuLink instance for method chaining
     * 
     * @example
     * // Simple middleware (imported)
     * import { requestIdGenerator, timestampMiddleware } from './middleware/common.js';
     * 
     * modulink.use(requestIdGenerator);
     * modulink.use(timestampMiddleware);
     * 
     * @example
     * // Async middleware with logging (imported)
     * import { operationLogger } from './middleware/logging.js';
     * 
     * modulink.use(operationLogger);
     * 
     * @example
     * // Express-style middleware with next() (imported)
     * import { authMiddleware } from './middleware/auth.js';
     * 
     * modulink.use(authMiddleware);
     * 
     * @example
     * // Method chaining with imported middleware
     * import { authMiddleware, loggingMiddleware, validationMiddleware } from './middleware/index.js';
     * 
     * modulink
     *   .use(authMiddleware)
     *   .use(loggingMiddleware)
     *   .use(validationMiddleware);
     */
    use(mw) {
      instance._instanceMiddleware.push(mw);
      return instance;
    },

    /**
     * Connects your application setup logic to the ModuLink instance.
     * 
     * The connect method is the integration point where you wire up your
     * chains with your application framework (Express, Fastify, CLI, etc.).
     * It immediately executes your setup function with appropriate parameters
     * based on the function signature.
     * 
     * Since you're calling connect() on a ModuLink instance, that instance is
     * already available in the callback's closure scope. The connect method
     * simply passes the app for convenience:
     * 
     * - No parameters: fn() - Access app via modulink.app in closure
     * - Single parameter: fn(app) - App passed directly for convenience
     * 
     * @param {Function} fn - Setup function to execute. Can accept 0 or 1 parameters:
     *                        - fn() - No params, access via closure (modulink.app)
     *                        - fn(app) - Single param, app passed for convenience
     * 
     * @returns {Object} The ModuLink instance for method chaining
     * 
     * @example
     * // Express integration with app parameter
     * import express from 'express';
     * import { validateUser, saveUser } from './links/user.js';
     * 
     * const app = express();
     * const modulink = createModuLink(app);
     * 
     * modulink.connect((app) => {
     *   // Set up routes - app passed as parameter
     *   app.post('/users', async (req, res) => {
     *     const userChain = chain(validateUser, saveUser);
     *     const result = await userChain({ 
     *       body: req.body,
     *       _instanceMiddleware: modulink._instanceMiddleware
     *     });
     *     
     *     if (result.error) {
     *       res.status(400).json({ error: result.error.message });
     *     } else {
     *       res.json(result.user);
     *     }
     *   });
     * });
     * 
     * @example
     * // No parameter pattern - access via closure
     * modulink.connect(() => {
     *   const app = modulink.app; // Access app via the instance
     *   
     *   app.get('/health', (req, res) => {
     *     res.json({ status: 'ok' });
     *   });
     * });
     * 
     * @example
     * // CLI application (no app framework)
     * import { parseArgs, executeCommand, formatOutput } from './links/cli.js';
     * 
     * const modulink = createModuLink(); // No app
     * 
     * modulink.connect(() => {
     *   const processCommand = chain(parseArgs, executeCommand, formatOutput);
     *   
     *   process.argv.slice(2).forEach(async (command) => {
     *     const result = await processCommand({ 
     *       command,
     *       _instanceMiddleware: modulink._instanceMiddleware
     *     });
     *     if (result.error) {
     *       console.error(result.error.message);
     *       process.exit(1);
     *     }
     *   });
     * });
     * 
     * @example
     * // Worker/background service
     * import { fetchJob, processJob, markComplete } from './links/jobs.js';
     * import { logger } from './utils/logging.js';
     * 
     * modulink.connect(() => {
     *   const jobProcessor = chain(fetchJob, processJob, markComplete);
     *   
     *   setInterval(async () => {
     *     const result = await jobProcessor({ 
     *       source: 'cron',
     *       _instanceMiddleware: modulink._instanceMiddleware
     *     });
     *     if (result.error) {
     *       logger.error('Job processing failed:', result.error);
     *     }
     *   }, 60000); // Every minute
     * });
     * 
     * @example
     * // Method chaining after connect
     * import { globalMiddleware } from './middleware/global.js';
     * 
     * modulink
     *   .use(globalMiddleware)
     *   .connect((app) => {
     *     // Setup routes...
     *   });
     */
    connect(fn) {
      // Check function arity to determine which pattern to use
      if (fn.length === 0) {
        // No parameters: fn() - access app and modulink via closure/scope
        fn();
      } else {
        // Single parameter: fn(app) - pass app directly, modulink available as calling context
        fn(instance.app);
      }
      return instance;
    },
  };

  return instance;
}
