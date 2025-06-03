/**
 * ModuLink Implementation for JavaScript
 * 
 * Factory function for creating ModuLink instances with function-based composition.
 */

import express from 'express';
import cron from 'node-cron';
import { Command } from 'commander';
import { chain } from './utils.js';
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
 * Configuration options for ModuLink.
 */
export class ModulinkOptions {
  constructor({
    environment = 'development',
    enableLogging = true
  } = {}) {
    this.environment = environment;
    this.enableLogging = enableLogging;
  }
}

/**
 * Factory function to create a ModuLink instance.
 * 
 * @param {express.Application} [app] - Optional Express app instance
 * @param {ModulinkOptions} [options] - Configuration options
 * @returns {Object} ModuLink instance API
 */
export function createModulink(app = null, options = null) {
  if (!options) {
    options = new ModulinkOptions();
  }

  // Internal state
  const globalMiddleware = [];
  const linkMiddleware = new Map();
  const chainMiddleware = new Map();
  const registeredChains = new Map();
  const registeredLinks = new Map();
  const cronTasks = [];

  /**
   * Internal logging function.
   * @param {string} message - Log message
   */
  function log(message) {
    if (options.enableLogging) {
      console.log(`[ModuLink] ${message}`);
    }
  }

  /**
   * Convert a link to an async function.
   * @param {Link} link - The link function
   * @returns {Chain} Async wrapper function
   */
  function ensureAsyncLink(link) {
    return async function(ctx) {
      if (typeof link === 'function') {
        const result = link(ctx);
        return result instanceof Promise ? await result : result;
      }
      return ctx;
    };
  }

  /**
   * Apply middleware to a link by name.
   * @param {string} name - Link name
   * @param {Link} link - The link function
   * @returns {Chain} Wrapped async function
   */
  function applyLinkMiddleware(name, link) {
    const middleware = linkMiddleware.get(name) || [];
    const asyncLink = ensureAsyncLink(link);
    
    return async function(ctx) {
      let result = ctx;
      
      // Apply middleware in sequence
      for (const mw of middleware) {
        result = await mw(result);
        if (result.error) break;
      }
      
      // Execute the link if no error
      if (!result.error) {
        result = await asyncLink(result);
      }
      
      return result;
    };
  }

  /**
   * Apply middleware to a chain by name.
   * @param {string} name - Chain name
   * @param {Chain} chain - The chain function
   * @returns {Chain} Wrapped chain function
   */
  function applyChainMiddleware(name, chain) {
    const middleware = chainMiddleware.get(name) || [];
    
    return async function(ctx) {
      let result = ctx;
      
      // Apply middleware in sequence
      for (const mw of middleware) {
        result = await mw(result);
        if (result.error) break;
      }
      
      // Execute the chain if no error
      if (!result.error) {
        result = await chain(result);
      }
      
      return result;
    };
  }

  /**
   * Create a chain of links with enhanced middleware support.
   * Delegates to the universal chain() function for consistent behavior.
   * 
   * @param {...Link} links - Links to chain together
   * @returns {Chain} Enhanced chain with .use() API
   */
  function createChain(...links) {
    // Delegate to the universal chain function and apply global middleware
    const chainInstance = chain(...links);
    
    // Apply global middleware to this chain
    if (globalMiddleware.length > 0) {
      return chainInstance.use(...globalMiddleware);
    }
    
    return chainInstance;
  }

  /**
   * Create a named chain with middleware support.
   * @param {string} name - Chain name
   * @param {...Link} links - Links to chain together
   * @returns {Chain} Named chain function
   */
  function createNamedChain(name, ...links) {
    const chain = createChain(...links);
    return applyChainMiddleware(name, chain);
  }

  /**
   * Register a global middleware function.
   * @param {Middleware} middleware - Middleware function
   */
  function use(middleware) {
    globalMiddleware.push(middleware);
    log(`Global middleware registered`);
  }

  /**
   * Register middleware for a specific link.
   * @param {string} linkName - Link name
   * @param {Middleware} middleware - Middleware function
   */
  function useLink(linkName, middleware) {
    if (!linkMiddleware.has(linkName)) {
      linkMiddleware.set(linkName, []);
    }
    linkMiddleware.get(linkName).push(middleware);
    log(`Link middleware registered for: ${linkName}`);
  }

  /**
   * Register middleware for a specific chain.
   * @param {string} chainName - Chain name
   * @param {Middleware} middleware - Middleware function
   */
  function useChain(chainName, middleware) {
    if (!chainMiddleware.has(chainName)) {
      chainMiddleware.set(chainName, []);
    }
    chainMiddleware.get(chainName).push(middleware);
    log(`Chain middleware registered for: ${chainName}`);
  }

  /**
   * Register a reusable chain.
   * @param {string} name - Chain name
   * @param {Chain} chain - Chain function
   */
  function registerChain(name, chain) {
    registeredChains.set(name, chain);
    log(`Chain registered: ${name}`);
  }

  /**
   * Register a reusable link.
   * @param {string} name - Link name
   * @param {Link} link - Link function
   */
  function registerLink(name, link) {
    registeredLinks.set(name, link);
    log(`Link registered: ${name}`);
  }

  /**
   * Get a registered chain by name.
   * @param {string} name - Chain name
   * @returns {Chain|undefined} Chain function
   */
  function getChain(name) {
    return registeredChains.get(name);
  }

  /**
   * Get a registered link by name.
   * @param {string} name - Link name
   * @returns {Link|undefined} Link function
   */
  function getLink(name) {
    return registeredLinks.get(name);
  }

  /**
   * HTTP trigger - register route handler.
   * @param {string} path - Route path
   * @param {string[]} methods - HTTP methods
   * @param {Chain} handler - Handler chain
   */
  function http(path, methods, handler) {
    if (!app) {
      throw new Error('Express app required for HTTP triggers');
    }

    for (const method of methods) {
      app[method.toLowerCase()](path, async (req, res) => {
        try {
          const ctx = createHttpContext({
            request: req,
            method: req.method,
            path: req.path,
            headers: req.headers,
            body: req.body,
            query: req.query
          });

          const result = await handler(ctx);
          
          if (result.error) {
            res.status(500).json({ error: result.error.message });
          } else {
            res.json(result);
          }
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
    }
    
    log(`HTTP route registered: ${methods.join(',')} ${path}`);
  }

  /**
   * Cron trigger - schedule job.
   * @param {string} expression - Cron expression
   * @param {Chain} handler - Handler chain
   */
  function cronJob(expression, handler) {
    const task = cron.schedule(expression, async () => {
      try {
        const ctx = createCronContext({ expression });
        await handler(ctx);
      } catch (error) {
        log(`Cron job error: ${error.message}`);
      }
    });
    
    cronTasks.push(task);
    log(`Cron job scheduled: ${expression}`);
  }

  /**
   * CLI trigger - register command.
   * @param {string} name - Command name
   * @param {Chain} handler - Handler chain
   */
  function cli(name, handler) {
    const program = new Command();
    program
      .command(name)
      .requiredOption('-d, --data <json>', 'JSON payload for context')
      .action(async (options) => {
        try {
          const data = JSON.parse(options.data);
          const ctx = createCliContext({
            command: name,
            args: process.argv.slice(2),
            options: data
          });
          
          const result = await handler(ctx);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(`CLI command error: ${error.message}`);
          process.exit(1);
        }
      });

    // Only parse if this is the main module
    if (process.argv[1] && process.argv[1].includes(name)) {
      program.parse(process.argv);
    }
    
    log(`CLI command registered: ${name}`);
  }

  /**
   * Message trigger - consume messages (placeholder).
   * @param {string} topic - Message topic
   * @param {Chain} handler - Handler chain
   */
  function message(topic, handler) {
    // Placeholder implementation
    log(`Message consumer registered for topic: ${topic} (not implemented)`);
  }

  /**
   * Shutdown function to clean up resources.
   */
  function shutdown() {
    cronTasks.forEach(task => task.stop());
    cronTasks.length = 0;
    log('ModuLink shutdown complete');
  }

  // Return the ModuLink API
  return {
    // Core composition functions
    createChain,
    createNamedChain,
    
    // Middleware registration
    use,
    useLink,
    useChain,
    
    // Chain and link registry
    registerChain,
    registerLink,
    getChain,
    getLink,
    
    // Trigger functions
    http,
    cron: cronJob,
    cli,
    message,
    
    // Utility functions
    shutdown,
    log,
    
    // Context creators (re-exported for convenience)
    createContext,
    createHttpContext,
    createCronContext,
    createCliContext,
    createMessageContext,
    createErrorContext
  };
}
