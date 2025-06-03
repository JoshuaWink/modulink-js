/**
 * ModuLink Types System for JavaScript
 * 
 * Simple function types for building modular applications:
 * - Ctx: Context object for storing information passed between components
 * - Link: Single function that performs an action with/on context
 * - Chain: Series of links chained together 
 * - Trigger: Function that starts the chain reaction
 * - Middleware: Observer function that goes between links (logging, listening, monitoring)
 * 
 * Each component has single responsibility. Provides consistency across HTTP, cron, CLI, and message processing.
 */

/**
 * @typedef {Object} Ctx
 * Context Type - stores information that gets passed from one component to another.
 * Simply holds data, doesn't perform actions.
 */

/**
 * @typedef {function(Ctx): Ctx|Promise<Ctx>} Link
 * A Link is a single function that performs an action with or on context.
 * Has single responsibility - one specific action or transformation.
 * Can be sync or async - the system handles both transparently.
 */

/**
 * @typedef {function(Ctx): Promise<Ctx>} Chain
 * A Chain is a series of links chained together.
 * Executes links in sequence, passing context from one to the next.
 * Always async for consistency.
 */

/**
 * @typedef {function(Chain, Ctx?): Promise<Ctx>} Trigger
 * A Trigger starts the chain reaction with optional initial context.
 * Initiates the execution flow and returns the final context.
 */

/**
 * @typedef {function(Ctx): Promise<Ctx>} Middleware
 * Middleware goes between links in the chain as an observer.
 * Primary purpose: logging, listening, monitoring - NOT transforming.
 * Should observe and potentially add metadata (timestamps, logs) but not change core data.
 * Single responsibility: observation and monitoring.
 */

/**
 * Get current timestamp in ISO format.
 * @returns {string} ISO timestamp
 */
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Create a new context with common fields.
 * 
 * @param {Object} options - Context options
 * @param {string} options.trigger - Type of trigger ('http', 'cron', 'cli', 'message')
 * @param {string} [options.timestamp] - ISO timestamp (auto-generated if not provided)
 * @param {...*} rest - Additional context fields
 * @returns {Ctx} New context object
 */
export function createContext({ trigger = 'unknown', timestamp = null, ...rest } = {}) {
  return {
    trigger,
    timestamp: timestamp || getCurrentTimestamp(),
    ...rest
  };
}

/**
 * Create HTTP-specific context.
 * 
 * @param {Object} options - HTTP context options
 * @param {*} [options.request] - HTTP request object
 * @param {string} [options.method='GET'] - HTTP method
 * @param {string} [options.path='/'] - Request path
 * @param {Object} [options.headers={}] - HTTP headers
 * @param {*} [options.body] - Request body
 * @param {Object} [options.query={}] - Query parameters
 * @param {...*} rest - Additional context fields
 * @returns {Ctx} HTTP context
 */
export function createHttpContext({
  request = null,
  method = 'GET',
  path = '/',
  headers = {},
  body = null,
  query = {},
  ...rest
} = {}) {
  return createContext({
    trigger: 'http',
    request,
    method,
    path,
    headers,
    body,
    query,
    ...rest
  });
}

/**
 * Create cron-specific context.
 * 
 * @param {Object} options - Cron context options
 * @param {string} [options.expression='* * * * *'] - Cron expression
 * @param {string} [options.jobName='unnamed'] - Job name
 * @param {...*} rest - Additional context fields
 * @returns {Ctx} Cron context
 */
export function createCronContext({
  expression = '* * * * *',
  jobName = 'unnamed',
  ...rest
} = {}) {
  return createContext({
    trigger: 'cron',
    expression,
    jobName,
    ...rest
  });
}

/**
 * Create CLI-specific context.
 * 
 * @param {Object} options - CLI context options
 * @param {string} [options.command=''] - Command name
 * @param {string[]} [options.args=[]] - Command arguments
 * @param {Object} [options.options={}] - Command options
 * @param {...*} rest - Additional context fields
 * @returns {Ctx} CLI context
 */
export function createCliContext({
  command = '',
  args = [],
  options = {},
  ...rest
} = {}) {
  return createContext({
    trigger: 'cli',
    command,
    args,
    options,
    ...rest
  });
}

/**
 * Create message-specific context.
 * 
 * @param {Object} options - Message context options
 * @param {string} [options.topic=''] - Message topic
 * @param {*} [options.payload] - Message payload
 * @param {Object} [options.metadata={}] - Message metadata
 * @param {...*} rest - Additional context fields
 * @returns {Ctx} Message context
 */
export function createMessageContext({
  topic = '',
  payload = null,
  metadata = {},
  ...rest
} = {}) {
  return createContext({
    trigger: 'message',
    topic,
    payload,
    metadata,
    ...rest
  });
}

/**
 * Create error context for error handling.
 * 
 * @param {Error} error - The error object
 * @param {Ctx} [originalContext={}] - Original context where error occurred
 * @returns {Ctx} Error context
 */
export function createErrorContext(error, originalContext = {}) {
  return {
    ...originalContext,
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: getCurrentTimestamp()
    }
  };
}
