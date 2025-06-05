/**
 * ModuLink Types System for JavaScript
 * 
 * Complete type definitions for building modular applications:
 * - Ctx: Enhanced context object with metadata, performance, and observability features
 * - Link: Single function that performs an action with/on context
 * - Chain: Series of links with advanced middleware positioning and observability
 * - EnhancedChain: Chain with middleware API (.use(), .onInput(), .onOutput())
 * - Trigger: Function that starts the chain reaction
 * - Middleware: Observer/transformer function with positioning options
 * 
 * Each component has single responsibility. Provides consistency across HTTP, cron, CLI, and message processing.
 */

/**
 * @typedef {Object} Ctx
 * Context Type - Enhanced context object that stores information passed between components.
 * 
 * @property {string} [trigger] - Type of trigger ('http', 'cron', 'cli', 'message')
 * @property {string} [timestamp] - ISO timestamp
 * @property {Object} [_meta] - Internal metadata for middleware communication
 * @property {Object} [_metadata] - Chain execution metadata including performance and middleware counts
 * @property {Object} [_metadata.performance] - Performance tracking data
 * @property {Array} [_metadata.performance.inputMiddlewareTimings] - Input middleware execution times
 * @property {Array} [_metadata.performance.outputMiddlewareTimings] - Output middleware execution times  
 * @property {Array} [_metadata.performance.globalMiddlewareTimings] - Global middleware execution times
 * @property {Object} [_metadata.middlewareCounts] - Count of middleware by type
 * @property {number} [_metadata.middlewareCounts.input] - Number of input middleware
 * @property {number} [_metadata.middlewareCounts.output] - Number of output middleware
 * @property {number} [_metadata.middlewareCounts.global] - Number of global middleware
 * @property {string} [_metadata.chainId] - Unique chain execution identifier
 * @property {number} [_metadata.startTime] - Chain start timestamp
 * @property {number} [_metadata.endTime] - Chain end timestamp
 * @property {number} [_metadata.totalDuration] - Total chain execution duration
 * @property {Object} [_currentLink] - Information about currently executing link
 * @property {string} [_currentLink.name] - Name of current link
 * @property {number} [_currentLink.index] - Index of current link
 * @property {number} [_currentLink.length] - Total number of links
 * @property {boolean} [_currentLink.isAsync] - Whether current link is async
 * @property {Array} [_instanceMiddleware] - Instance-level middleware
 * @property {Object} [_observedBy] - Tracking of middleware that have observed this context
 * @property {Object} [_loggingMetrics] - Logging middleware metrics
 * @property {Object} [_performanceMetrics] - Performance tracking metrics
 * @property {Object} [timings] - Function/chain execution timings
 * @property {Object} [error] - Error information if chain execution failed
 * @property {string} [error.message] - Error message
 * @property {string} [error.name] - Error name
 * @property {string} [error.stack] - Error stack trace
 * @property {boolean} [cached] - Whether result was retrieved from cache
 * @property {Object} [retryInfo] - Retry execution information
 * @property {number} [retryInfo.attempts] - Number of retry attempts
 * @property {boolean} [retryInfo.successful] - Whether retry was successful
 * @property {number} [retryInfo.maxRetries] - Maximum retry attempts configured
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
 * @typedef {Object} EnhancedChain
 * Enhanced Chain with middleware API and positioning capabilities.
 * 
 * @property {function(Ctx): Promise<Ctx>} call - Execute the chain
 * @property {function(...Middleware): EnhancedChain} use - Add general middleware (runs after each link)
 * @property {Object} use.onInput - Input middleware positioning API
 * @property {function(...Middleware): EnhancedChain} use.onInput - Add input middleware (runs before each link)
 * @property {Object} use.onOutput - Output middleware positioning API  
 * @property {function(...Middleware): EnhancedChain} use.onOutput - Add output middleware (runs after each link)
 * @property {function(...Middleware): EnhancedChain} onInput - Direct input middleware method
 * @property {function(...Middleware): EnhancedChain} onOutput - Direct output middleware method
 * @property {function(): Object} _debugInfo - Get chain debugging information
 * @property {Chain} coreExecution - Core chain execution without middleware (for chain-as-middleware)
 */

/**
 * @typedef {function(Chain, Ctx?): Promise<Ctx>} Trigger
 * A Trigger starts the chain reaction with optional initial context.
 * Initiates the execution flow and returns the final context.
 */

/**
 * @typedef {Object} ModuLink
 * Main ModuLink instance with application management capabilities.
 * 
 * @property {Object} app - Application instance (Express, Fastify, etc.)
 * @property {function(...Middleware): ModuLink} use - Add instance-level middleware
 * @property {function(Function): Function} connect - Auto-detect and connect function to ModuLink
 */

/**
 * @typedef {function(Ctx): Promise<Ctx>|Ctx} Middleware
 * Middleware function that observes or transforms context between links.
 * Can be positioned as input (before links), output (after links), or global middleware.
 * 
 * Middleware types:
 * - Observer: Logging, monitoring, performance tracking (primary purpose)
 * - Transformer: Data transformation, validation, enrichment
 * - Handler: Error handling, caching, retry logic
 * 
 * Positioning:
 * - Input middleware: Runs before each link execution
 * - Output middleware: Runs after each link execution  
 * - Global middleware: Legacy behavior, runs after each link (same as output)
 * 
 * @param {Ctx} ctx - Context object to process
 * @returns {Promise<Ctx>|Ctx} Transformed or observed context
 */

/**
 * @typedef {Object} UtilityFunctions
 * Collection of utility functions for chain and context manipulation.
 * 
 * @property {function(...Link): EnhancedChain} chain - Create enhanced chain with middleware API
 * @property {function(function, Chain): Chain} when - Conditional execution wrapper
 * @property {function(function): Middleware} errorHandler - Error handling middleware
 * @property {function(function, Chain): Chain} validate - Validation wrapper
 * @property {function(Chain, number, number): Chain} retry - Retry wrapper with configurable attempts and delay
 * @property {function(function): Chain} transform - Transform context with function
 * @property {function(Object): Chain} addData - Add data to context
 * @property {function(string[]): Chain} pick - Filter context to specified keys
 * @property {function(string[]): Chain} omit - Remove specified keys from context
 * @property {function(...Chain): Chain} parallel - Execute chains in parallel
 * @property {function(...Chain): Chain} race - Race execution of chains
 * @property {function(Chain, number): Chain} debounce - Debounce chain execution
 * @property {function(Chain, number): Chain} throttle - Throttle chain execution rate
 * @property {function(Chain, function, number): Chain} cache - Cache chain results with TTL
 * @property {function(Function|string, string|Object, Object): Function|Middleware} timing - Timing wrapper/middleware
 * @property {function(Object): Middleware} performanceTracker - Performance tracking middleware
 * @property {function(function): Middleware} transformMiddleware - Transform middleware wrapper
 * @property {function(Object): Middleware} logging - Enhanced logging middleware with function detection
 * @property {function(...Function): Middleware} parallelMiddleware - Parallel execution middleware
 */

/**
 * @typedef {Object} TimingOptions
 * Options for timing middleware.
 * 
 * @property {boolean} [exposeTiming=false] - Whether to expose timing data in context
 */

/**
 * @typedef {Object} PerformanceTrackerOptions
 * Options for performance tracker middleware.
 * 
 * @property {boolean} [exposeMetrics=false] - Whether to expose performance metrics
 * @property {boolean} [trackMemory=false] - Whether to track memory usage
 * @property {boolean} [trackTimings=true] - Whether to track timing information
 * @property {boolean} [generateChainId=true] - Whether to generate unique chain ID
 */

/**
 * @typedef {Object} LoggingOptions
 * Options for logging middleware.
 * 
 * @property {boolean} [detectFunctionNames=true] - Whether to detect function names
 * @property {boolean} [logTiming=false] - Whether to log timing information
 * @property {boolean} [trackPerformance=false] - Whether to track performance metrics
 * @property {boolean} [enablePerformanceTracking=false] - Alternative name for trackPerformance
 * @property {boolean} [exposeMetadata=true] - Whether to expose metadata in context
 * @property {string} [level='INFO'] - Logging level
 */

/**
 * @typedef {Object} ChainDebugInfo
 * Debug information about chain configuration.
 * 
 * @property {number} linkCount - Number of links in the chain
 * @property {Object} middlewareCounts - Count of middleware by type
 * @property {number} middlewareCounts.input - Number of input middleware
 * @property {number} middlewareCounts.output - Number of output middleware
 * @property {number} middlewareCounts.global - Number of global middleware
 * @property {number} totalMiddleware - Total number of middleware functions
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
 * @param {Object} [options={}] - Context options
 * @param {string} [options.trigger='unknown'] - Type of trigger ('http', 'cron', 'cli', 'message')
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
 * @param {Object} [options={}] - HTTP context options
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
 * @param {Object} [options={}] - Cron context options
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
 * @param {Object} [options={}] - CLI context options
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
 * @param {Object} [options={}] - Message context options
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
