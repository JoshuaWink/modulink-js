/**
 * Business Logic Examples for ModuLink
 * Used by tests to demonstrate business logic patterns
 */

/**
 * Simple processing function that adds a processed flag
 * @param {Object} ctx - Context to process
 * @returns {Object} Processed context
 */
export function processData(ctx) {
  return {
    ...ctx,
    processed: true,
    timestamp: Date.now()
  };
}

/**
 * Validation function that checks for required fields
 * @param {Object} ctx - Context to validate
 * @returns {Object} Validated context or error context
 */
export function validateInput(ctx) {
  if (!ctx.data) {
    return {
      ...ctx,
      error: new Error('Missing required data field'),
      valid: false
    };
  }
  
  return {
    ...ctx,
    valid: true
  };
}

/**
 * Transform function that modifies data
 * @param {Object} ctx - Context to transform
 * @returns {Object} Transformed context
 */
export function transformData(ctx) {
  if (ctx.data && typeof ctx.data === 'object') {
    return {
      ...ctx,
      data: {
        ...ctx.data,
        transformed: true,
        transformedAt: new Date().toISOString()
      }
    };
  }
  
  return {
    ...ctx,
    transformed: false
  };
}

/**
 * Async processing function
 * @param {Object} ctx - Context to process
 * @returns {Promise<Object>} Processed context
 */
export async function asyncProcess(ctx) {
  // Simulate async work
  await new Promise(resolve => setTimeout(resolve, 10));
  
  return {
    ...ctx,
    asyncProcessed: true,
    processedAt: Date.now()
  };
}

/**
 * Error simulation function for testing error handling
 * @param {Object} ctx - Context
 * @throws {Error} Always throws an error
 */
export function errorFunction(ctx) {
  throw new Error('Simulated business logic error');
}

/**
 * Conditional processing based on context flags
 * @param {Object} ctx - Context to process
 * @returns {Object} Conditionally processed context
 */
export function conditionalProcess(ctx) {
  if (ctx.shouldProcess) {
    return {
      ...ctx,
      conditionallyProcessed: true
    };
  }
  
  return ctx;
}

/**
 * Entry function - passes through context unchanged
 * @param {Object} ctx - Context to pass through
 * @returns {Object} Same context
 */
export function entry(ctx) {
  return ctx || {};
}

/**
 * Increment function - adds 1 to the value
 * @param {Object} ctx - Context with value property
 * @returns {Object} Context with incremented value
 */
export function increment(ctx) {
  return {
    ...ctx,
    value: (ctx.value || 0) + 1
  };
}

/**
 * Double function - multiplies value by 2
 * @param {Object} ctx - Context with value property
 * @returns {Object} Context with doubled value
 */
export function double(ctx) {
  // Test expects NaN when value is undefined
  return {
    ...ctx,
    value: ctx.value * 2
  };
}

/**
 * Respond function - adds response formatting
 * @param {Object} ctx - Context to format
 * @returns {Object} Context with response formatting
 */
export function respond(ctx) {
  return {
    result: ctx.value
  };
}
