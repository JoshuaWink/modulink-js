/**
 * ModuLink Implementation for JavaScript
 * 
 * Template System (Minimalist) - Users implement everything themselves.
 * ModuLink provides the patterns and utilities.
 */

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
 * Connect Builder for user-implemented integration logic.
 * Provides utilities and patterns while users control all integration.
 */
class ConnectBuilder {
  constructor(options) {
    this.options = options;
  }

  /**
   * Create context with standard utilities.
   * @param {Object} data - Context data
   * @returns {Object} Enhanced context
   */
  createContext(data) {
    return {
      ...data,
      timestamp: new Date().toISOString(),
      requestId: this.generateId(),
      // Additional standard utilities can be added here
    };
  }

  /**
   * Generate a unique request ID.
   * @returns {string} Unique ID
   */
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Helper utility for error handling.
   * @param {Function} handler - Handler function
   * @returns {Function} Wrapped handler with error handling
   */
  withErrorHandling(handler) {
    return async (ctx) => {
      try {
        return await handler(ctx);
      } catch (error) {
        console.error('Handler error:', error);
        return { ...ctx, error: error.message };
      }
    };
  }

  /**
   * Helper utility for logging.
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  log(message, data = {}) {
    if (this.options.enableLogging) {
      console.log(`[ModuLink] ${message}`, data);
    }
  }
}

/**
 * Factory function to create a ModuLink instance.
 * 
 * @param {ModulinkOptions} [options] - Configuration options
 * @returns {Object} ModuLink instance API
 */
export function createModulink(options = null) {
  if (!options) {
    options = new ModulinkOptions();
  }

  // Internal state
  const globalMiddleware = [];

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
   * Register a global middleware function.
   * @param {Middleware} middleware - Middleware function
   */
  function use(middleware) {
    globalMiddleware.push(middleware);
    log(`Global middleware registered`);
  }

  /**
   * Connect system - users build their own integration implementations.
   * ModuLink provides patterns and utilities.
   * 
   * @param {Function} builderFunction - Function that receives ConnectBuilder
   */
  function connect(builderFunction) {
    log('Connect system initialized');
    
    const builder = new ConnectBuilder(options);
    
    // Call the user's builder function with our utilities
    return builderFunction(builder);
  }

  /**
   * Shutdown function to clean up resources.
   */
  function shutdown() {
    log('ModuLink shutdown complete');
  }

  // Return the ModuLink API
  return {
    // Core composition functions
    createChain,
    
    // Middleware registration
    use,
    
    // Connect system (users implement everything)
    connect,
    
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
