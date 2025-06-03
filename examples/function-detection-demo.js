/**
 * Enhanced Function Name Detection Demo
 * 
 * Demonstrates the new automatic function name detection and efficient timestamp system
 * in ModuLink-JS chains with enhanced logging middleware.
 */

import { chain, logging, errorHandler } from '../index.js';
import { createHttpContext } from '../modulink/types.js';

// Sample business logic functions with various naming patterns
async function authenticateUser(ctx) {
  console.log('🔐 Authenticating user...');
  
  if (!ctx.headers?.authorization) {
    ctx.error = { message: 'No authorization header', code: 401 };
    return ctx;
  }
  
  const token = ctx.headers.authorization.replace('Bearer ', '');
  ctx.user = { id: 123, name: 'John Doe', token };
  ctx.authenticated = true;
  
  return ctx;
}

const validateInput = async (ctx) => {
  console.log('✅ Validating input data...');
  
  if (!ctx.body?.email) {
    ctx.error = { message: 'Email is required', code: 400 };
    return ctx;
  }
  
  ctx.validatedInput = {
    email: ctx.body.email,
    name: ctx.body.name || 'Anonymous'
  };
  
  return ctx;
};

function processUserData(ctx) {
  console.log('⚙️ Processing user data...');
  
  if (ctx.error) return ctx;
  
  ctx.processedData = {
    ...ctx.validatedInput,
    processedAt: new Date().toISOString(),
    userId: ctx.user?.id || 'unknown'
  };
  
  return ctx;
}

// Anonymous function for testing detection
const formatResponse = function(ctx) {
  console.log('📋 Formatting response...');
  
  if (ctx.error) {
    ctx.response = {
      success: false,
      error: ctx.error.message,
      code: ctx.error.code || 500
    };
  } else {
    ctx.response = {
      success: true,
      data: ctx.processedData,
      timestamp: new Date().toISOString()
    };
  }
  
  return ctx;
};

// Arrow function for testing detection
const sendResponse = (ctx) => {
  console.log('📤 Sending response...');
  
  if (ctx.res) {
    const statusCode = ctx.error ? ctx.error.code || 500 : 200;
    ctx.res.status(statusCode).json(ctx.response);
  }
  
  return ctx;
};

// Enhanced logging configurations for demonstration
const basicLogging = logging({
  level: 'info',
  detectFunctionNames: true,
  logTiming: true
});

const detailedLogging = logging({
  level: 'debug',
  detectFunctionNames: true,
  logInput: true,
  logOutput: true,
  logTiming: true,
  enablePerformanceTracking: true
});

const minimalLogging = logging({
  level: 'info',
  detectFunctionNames: true,
  useSharedTimestamp: true,
  enablePerformanceTracking: false
});

// Create different chains to demonstrate various logging levels
export const basicChain = chain(
  authenticateUser,
  validateInput,
  processUserData,
  formatResponse,
  sendResponse
).use(basicLogging)
 .use(errorHandler());

export const detailedChain = chain(
  authenticateUser,
  validateInput,
  processUserData,
  formatResponse,
  sendResponse
).use(detailedLogging)
 .use(errorHandler());

export const performanceOptimizedChain = chain(
  authenticateUser,
  validateInput,
  processUserData,
  formatResponse,
  sendResponse
).use(minimalLogging)
 .use(errorHandler());

// Demonstration function
export async function runFunctionDetectionDemo() {
  console.log('\n🎯 ModuLink-JS Enhanced Function Name Detection Demo\n');
  console.log('='.repeat(60));
  
  // Test case 1: Successful execution
  console.log('\n📋 Test Case 1: Successful Execution with Basic Logging');
  console.log('-'.repeat(40));
  
  const successContext = createHttpContext({
    headers: { authorization: 'Bearer valid-token' },
    body: { email: 'test@example.com', name: 'Test User' }
  });
  
  const result1 = await basicChain(successContext);
  console.log('Result:', result1.response);
  
  // Test case 2: Error scenario with detailed logging
  console.log('\n📋 Test Case 2: Error Scenario with Detailed Logging');
  console.log('-'.repeat(40));
  
  const errorContext = createHttpContext({
    headers: {}, // Missing authorization
    body: { name: 'Test User' } // Missing email
  });
  
  const result2 = await detailedChain(errorContext);
  console.log('Error Result:', result2.response);
  
  // Test case 3: Performance optimized execution
  console.log('\n📋 Test Case 3: Performance Optimized Execution');
  console.log('-'.repeat(40));
  
  const perfContext = createHttpContext({
    headers: { authorization: 'Bearer perf-token' },
    body: { email: 'perf@example.com', name: 'Performance Test' }
  });
  
  const result3 = await performanceOptimizedChain(perfContext);
  console.log('Performance Result:', result3.response);
  
  // Test case 4: Demonstrate function name detection capabilities
  console.log('\n📋 Test Case 4: Function Name Detection Analysis');
  console.log('-'.repeat(40));
  
  if (result1._observedBy?.enhancedLogging) {
    const logging = result1._observedBy.enhancedLogging;
    console.log('Detected Function:', logging.functionName);
    console.log('Performance Metrics:', logging.performance);
  }
  
  if (result1._metadata) {
    console.log('Chain Metadata:');
    console.log('- Chain ID:', result1._metadata.chainId);
    console.log('- Total Duration:', result1._metadata.totalDuration + 'ms');
    console.log('- Link Count:', result1._metadata.linkCount);
    console.log('- Shared Timestamp Used:', !!result1._metadata.sharedTimestamp);
  }
  
  console.log('\n✨ Enhanced Features Demonstrated:');
  console.log('✅ Automatic function name detection (named, anonymous, arrow functions)');
  console.log('✅ Efficient timestamp sharing across middleware chain');
  console.log('✅ Performance tracking with minimal overhead');
  console.log('✅ Function signature analysis (parameter count, async detection)');
  console.log('✅ Memory usage monitoring');
  console.log('✅ Conditional logging based on configuration');
  
  return { result1, result2, result3 };
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFunctionDetectionDemo().catch(console.error);
}
