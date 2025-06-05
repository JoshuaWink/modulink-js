/**
 * ModuLink JS Library Entry Point
 * 
 * Hybrid Architecture Implementation:
 * - Chains handle business logic as pure functions
 * - ModuLink instances handle integration (HTTP/cron/CLI/messaging)  
 * - Multi-level middleware system (instance + chain level)
 * - Everything remains modular and swappable
 * - Support for both single and two-parameter connect patterns
 */

// Primary exports - Hybrid Architecture
export { createModuLink, chain } from './modulink/modulink.js';

// Type creators
export {
  createContext,
  createHttpContext,
  createCronContext,
  createCliContext,
  createMessageContext,
  createErrorContext,
  getCurrentTimestamp
} from './modulink/types.js';

// Utility functions
export {
  when,
  errorHandler,
  validate,
  retry,
  transform,
  addData,
  pick,
  omit,
  parallel,
  race,
  debounce,
  throttle,
  cache,
  timing,
  performanceTracker,
  transformMiddleware,
  logging,
  parallelMiddleware
} from './modulink/utils.js';
export * as utils from './modulink/utils.js';
