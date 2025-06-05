/**
 * Simple chain implementation based on the full discussion pattern
 * Implements: instanceMiddleware → chainMiddleware → links in order
 */

/**
 * Enhanced chain function that supports instance middleware and advanced middleware positioning
 * Implements the pattern: instanceMiddleware → chainMiddleware → links in order
 * 
 * @param {...Function} links - Links to chain together
 * @returns {Function} Enhanced chain with .use() API
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

  // Helper function to execute middleware (function or chain)
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
  
  // Helper function to create error context
  function createErrorContext(error, ctx) {
    return {
      ...ctx,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }

  // The main chain execution function
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
          instance: instanceMiddleware.length,
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

  // Core execution function (clean chain logic without middleware)
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

  // Create shared chaining methods
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
