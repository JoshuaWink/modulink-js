/**
 * Advanced Middleware Positioning System Demo
 * 
 * Demonstrates the new onInput/onOutput middleware positioning capabilities
 * in ModuLink-JS chains for precise control over middleware execution.
 */

import { chain, logging, errorHandler } from '../index.js';
import { createHttpContext } from '../modulink/types.js';

// === BUSINESS LOGIC FUNCTIONS ===

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

function validatePermissions(ctx) {
  console.log('🛡️ Validating permissions...');
  
  if (ctx.error) return ctx;
  
  if (!ctx.user) {
    ctx.error = { message: 'User not authenticated', code: 401 };
    return ctx;
  }
  
  ctx.permissionsValidated = true;
  return ctx;
}

function processBusinessLogic(ctx) {
  console.log('⚙️ Processing business logic...');
  
  if (ctx.error) return ctx;
  
  ctx.processedData = {
    userId: ctx.user.id,
    processedAt: new Date().toISOString(),
    operation: 'businessLogic'
  };
  
  return ctx;
}

function formatResponse(ctx) {
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
}

// === SPECIALIZED MIDDLEWARE ===

// Input Validation Middleware (runs BEFORE each link)
const inputValidationMiddleware = (ctx) => {
  console.log('  🔍 [INPUT] Validating input for next operation...');
  
  // Check if required context properties are present
  if (!ctx.headers && !ctx.authenticated) {
    console.log('  ⚠️ [INPUT] Missing required context properties');
  }
  
  ctx.inputValidation = {
    timestamp: new Date().toISOString(),
    validated: true
  };
  
  return ctx;
};

// Security Audit Middleware (runs BEFORE security-related links)
const securityAuditMiddleware = (ctx) => {
  console.log('  📝 [SECURITY] Auditing security operation...');
  
  ctx.securityAudit = {
    timestamp: new Date().toISOString(),
    operation: 'security_check',
    userId: ctx.user?.id || 'anonymous'
  };
  
  return ctx;
};

// Response Sanitization Middleware (runs AFTER each link)
const responseSanitizationMiddleware = (ctx) => {
  console.log('  🧹 [OUTPUT] Sanitizing response...');
  
  // Remove sensitive data from context
  if (ctx.user && ctx.user.token) {
    ctx.user = { ...ctx.user, token: '[REDACTED]' };
  }
  
  ctx.sanitized = true;
  return ctx;
};

// Performance Monitoring Middleware (runs AFTER each link)
const performanceMonitoringMiddleware = (ctx) => {
  console.log('  📊 [PERFORMANCE] Recording performance metrics...');
  
  ctx.performanceMetrics = {
    ...ctx.performanceMetrics,
    [Date.now()]: {
      memoryUsage: process.memoryUsage().heapUsed,
      timestamp: new Date().toISOString()
    }
  };
  
  return ctx;
};

// Global Logging Middleware (legacy behavior - runs after each link)
const globalLoggingMiddleware = (ctx) => {
  console.log('  📋 [GLOBAL] Global operation logging...');
  
  ctx.globalLogs = (ctx.globalLogs || []).concat({
    timestamp: new Date().toISOString(),
    operation: 'logged'
  });
  
  return ctx;
};

// === CHAIN CONFIGURATIONS ===

// Configuration 1: Basic Input/Output Middleware
console.log('\n🔧 Configuration 1: Basic Input/Output Middleware');
export const basicAdvancedChain = chain(
  authenticateUser,
  validatePermissions,
  processBusinessLogic,
  formatResponse
)
.use.onInput(inputValidationMiddleware)
.onOutput(responseSanitizationMiddleware)
.use(errorHandler());

// Configuration 2: Targeted Security Middleware
console.log('🔧 Configuration 2: Targeted Security Operations');
export const securityFocusedChain = chain(
  authenticateUser,
  validatePermissions,
  processBusinessLogic,
  formatResponse
)
.use.onInput(securityAuditMiddleware)  // Runs before auth & validation
.onOutput(responseSanitizationMiddleware)  // Runs after each link
.use(globalLoggingMiddleware)  // Global middleware (legacy behavior)
.use(errorHandler());

// Configuration 3: Performance Monitoring Chain
console.log('🔧 Configuration 3: Performance Monitoring');
export const performanceMonitoredChain = chain(
  authenticateUser,
  validatePermissions,
  processBusinessLogic,
  formatResponse
)
.use.onInput(inputValidationMiddleware)
.onOutput(performanceMonitoringMiddleware, responseSanitizationMiddleware)
.use(globalLoggingMiddleware)
.use(errorHandler());

// Configuration 4: Complex Multi-Phase Middleware
console.log('🔧 Configuration 4: Complex Multi-Phase Setup');
export const complexAdvancedChain = chain(
  authenticateUser,
  validatePermissions,
  processBusinessLogic,
  formatResponse
)
.use.onInput(
  inputValidationMiddleware,
  securityAuditMiddleware
)
.onOutput(
  performanceMonitoringMiddleware,
  responseSanitizationMiddleware
)
.use(
  globalLoggingMiddleware,
  logging({ detectFunctionNames: true, enablePerformanceTracking: true })
)
.use(errorHandler());

// === DEMONSTRATION FUNCTION ===

export async function runAdvancedMiddlewareDemo() {
  console.log('\n🎯 ModuLink-JS Advanced Middleware Positioning Demo\n');
  console.log('='.repeat(70));
  
  // Test case 1: Basic Input/Output Middleware
  console.log('\n📋 Test Case 1: Basic Input/Output Middleware');
  console.log('-'.repeat(50));
  
  const basicContext = createHttpContext({
    headers: { authorization: 'Bearer valid-token' },
    body: { operation: 'basic-test' }
  });
  
  const result1 = await basicAdvancedChain(basicContext);
  console.log('✅ Basic Result:', result1.response);
  console.log('   Input validated:', !!result1.inputValidation);
  console.log('   Response sanitized:', !!result1.sanitized);
  
  // Test case 2: Security-Focused Chain
  console.log('\n📋 Test Case 2: Security-Focused Operations');
  console.log('-'.repeat(50));
  
  const securityContext = createHttpContext({
    headers: { authorization: 'Bearer security-token' },
    body: { operation: 'security-test' }
  });
  
  const result2 = await securityFocusedChain(securityContext);
  console.log('✅ Security Result:', result2.response);
  console.log('   Security audited:', !!result2.securityAudit);
  console.log('   Global logs count:', result2.globalLogs?.length || 0);
  
  // Test case 3: Performance Monitoring
  console.log('\n📋 Test Case 3: Performance Monitoring');
  console.log('-'.repeat(50));
  
  const perfContext = createHttpContext({
    headers: { authorization: 'Bearer perf-token' },
    body: { operation: 'performance-test' }
  });
  
  const result3 = await performanceMonitoredChain(perfContext);
  console.log('✅ Performance Result:', result3.response);
  console.log('   Performance metrics collected:', !!result3.performanceMetrics);
  console.log('   Metrics count:', Object.keys(result3.performanceMetrics || {}).length);
  
  // Test case 4: Complex Multi-Phase
  console.log('\n📋 Test Case 4: Complex Multi-Phase Middleware');
  console.log('-'.repeat(50));
  
  const complexContext = createHttpContext({
    headers: { authorization: 'Bearer complex-token' },
    body: { operation: 'complex-test' }
  });
  
  const result4 = await complexAdvancedChain(complexContext);
  console.log('✅ Complex Result:', result4.response);
  
  // Test case 5: Error Handling with Advanced Middleware
  console.log('\n📋 Test Case 5: Error Handling with Advanced Middleware');
  console.log('-'.repeat(50));
  
  const errorContext = createHttpContext({
    headers: {}, // Missing authorization to trigger error
    body: { operation: 'error-test' }
  });
  
  const result5 = await complexAdvancedChain(errorContext);
  console.log('✅ Error Result:', result5.response);
  console.log('   Error handled gracefully:', !!result5.error);
  console.log('   Output middleware still ran:', !!result5.sanitized);
  
  // Middleware Configuration Analysis
  console.log('\n📋 Middleware Configuration Analysis');
  console.log('-'.repeat(50));
  
  const debugInfo = complexAdvancedChain._debugInfo();
  console.log('🔧 Complex Chain Configuration:');
  console.log('   Links:', debugInfo.linkCount);
  console.log('   Input middleware:', debugInfo.middlewareCounts.input);
  console.log('   Output middleware:', debugInfo.middlewareCounts.output);
  console.log('   Global middleware:', debugInfo.middlewareCounts.global);
  console.log('   Total middleware:', debugInfo.totalMiddleware);
  
  // Performance Comparison
  if (result4._metadata?.performance) {
    console.log('\n📊 Performance Metrics:');
    console.log('   Input middleware timings:', result4._metadata.performance.inputMiddlewareTimings?.length || 0);
    console.log('   Output middleware timings:', result4._metadata.performance.outputMiddlewareTimings?.length || 0);
    console.log('   Global middleware timings:', result4._metadata.performance.globalMiddlewareTimings?.length || 0);
    console.log('   Total chain duration:', result4._metadata.totalDuration + 'ms');
  }
  
  console.log('\n✨ Advanced Middleware Positioning Features Demonstrated:');
  console.log('✅ Input middleware (onInput) - runs BEFORE each link');
  console.log('✅ Output middleware (onOutput) - runs AFTER each link');
  console.log('✅ Global middleware (use) - legacy behavior, runs after links');
  console.log('✅ Chained middleware registration');
  console.log('✅ Performance tracking for all middleware phases');
  console.log('✅ Error handling with middleware execution');
  console.log('✅ Middleware configuration debugging');
  console.log('✅ Complex multi-phase middleware configurations');
  
  return { result1, result2, result3, result4, result5, debugInfo };
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAdvancedMiddlewareDemo().catch(console.error);
}
