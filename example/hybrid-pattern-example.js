/**
 * ModuLink-JS Hybrid Configuration Ledger + Factory Pattern Example
 * 
 * This example demonstrates the new hybrid pattern that combines:
 * - Configuration Ledger: Central storage for chain configurations
 * - Factory Pattern: Dynamic chain creation with caching and lazy loading
 * - Feature Flags: Environment-specific behavior control
 * - Function Registry: Reusable chain functions (links)
 * 
 * Functions are the links of the chain, middleware are the observers between links.
 */

import express from 'express';
import { Modulink } from '../modulink/modulink.js';

const app = express();
const modu = new Modulink(app);

// ============================================================================
// 1. REGISTER REUSABLE FUNCTIONS (CHAIN LINKS)
// ============================================================================

// Authentication functions
modu.registerFunction('validateToken', (params = {}) => async (ctx) => {
  const token = ctx.headers?.authorization?.replace('Bearer ', '');
  if (!token) {
    ctx.error = { message: 'No token provided', code: 401 };
    return ctx;
  }
  
  // Simulate token validation
  if (params.strict && token !== 'valid-token') {
    ctx.error = { message: 'Invalid token', code: 401 };
    return ctx;
  }
  
  ctx.user = { id: 123, name: 'John Doe', role: 'user' };
  ctx.authenticated = true;
  return ctx;
});

modu.registerFunction('requireRole', (params = {}) => async (ctx) => {
  if (!ctx.user) {
    ctx.error = { message: 'Authentication required', code: 401 };
    return ctx;
  }
  
  if (params.role && ctx.user.role !== params.role) {
    ctx.error = { message: 'Insufficient permissions', code: 403 };
    return ctx;
  }
  
  return ctx;
});

// Data processing functions
modu.registerFunction('validateInput', (params = {}) => async (ctx) => {
  const { requiredFields = [] } = params;
  
  for (const field of requiredFields) {
    if (!ctx.body?.[field]) {
      ctx.error = { message: `Missing required field: ${field}`, code: 400 };
      return ctx;
    }
  }
  
  ctx.validatedInput = ctx.body;
  return ctx;
});

modu.registerFunction('processData', (params = {}) => async (ctx) => {
  const { operation = 'default' } = params;
  
  // Simulate data processing
  if (operation === 'transform') {
    ctx.processedData = {
      ...ctx.validatedInput,
      processed: true,
      timestamp: new Date().toISOString()
    };
  } else {
    ctx.processedData = ctx.validatedInput;
  }
  
  return ctx;
});

modu.registerFunction('saveToDatabase', (params = {}) => async (ctx) => {
  const { table = 'default' } = params;
  
  // Simulate database save
  ctx.savedRecord = {
    id: Math.random().toString(36).substr(2, 9),
    table,
    data: ctx.processedData,
    createdAt: new Date().toISOString()
  };
  
  return ctx;
});

// Response functions
modu.registerFunction('sendResponse', (params = {}) => async (ctx) => {
  if (ctx.error) {
    ctx.res.status(ctx.error.code || 500).json({
      error: ctx.error.message,
      timestamp: new Date().toISOString()
    });
  } else {
    ctx.res.json({
      success: true,
      data: ctx.savedRecord || ctx.processedData || ctx.data,
      timestamp: new Date().toISOString()
    });
  }
  
  return ctx;
});

// ============================================================================
// 2. CONFIGURE CHAIN TEMPLATES
// ============================================================================

// Basic authentication chain
modu.configureChain('basicAuth', {
  version: '1.0.0',
  description: 'Basic token-based authentication',
  errorHandling: 'continue',
  links: [
    { type: 'function', name: 'validateToken', params: { strict: false } }
  ]
});

// Strict authentication chain
modu.configureChain('strictAuth', {
  version: '1.0.0',
  description: 'Strict authentication with role validation',
  errorHandling: 'stop',
  links: [
    { type: 'function', name: 'validateToken', params: { strict: true } },
    { type: 'function', name: 'requireRole', params: { role: 'admin' } }
  ]
});

// Data processing chain
modu.configureChain('processUserData', {
  version: '1.0.0',
  description: 'Process and save user data',
  errorHandling: 'continue',
  links: [
    { 
      type: 'function', 
      name: 'validateInput', 
      params: { requiredFields: ['name', 'email'] } 
    },
    { 
      type: 'function', 
      name: 'processData', 
      params: { operation: 'transform' } 
    },
    { 
      type: 'function', 
      name: 'saveToDatabase', 
      params: { table: 'users' } 
    }
  ]
});

// Complete API endpoint chain
modu.configureChain('userApiEndpoint', {
  version: '1.0.0',
  description: 'Complete user API endpoint with auth and data processing',
  errorHandling: 'continue',
  links: [
    { type: 'function', name: 'validateToken', params: { strict: true } },
    { 
      type: 'function', 
      name: 'validateInput', 
      params: { requiredFields: ['name', 'email'] } 
    },
    { 
      type: 'function', 
      name: 'processData', 
      params: { operation: 'transform' } 
    },
    { 
      type: 'function', 
      name: 'saveToDatabase', 
      params: { table: 'users' } 
    },
    { type: 'function', name: 'sendResponse' }
  ]
});

// ============================================================================
// 3. SET FEATURE FLAGS
// ============================================================================

modu.setFeatureFlag('strictValidation', true, { environment: 'production' });
modu.setFeatureFlag('detailedLogging', true, { environment: 'development' });
modu.setFeatureFlag('betaFeatures', false);

// ============================================================================
// 4. ENVIRONMENT-SPECIFIC CONFIGURATIONS
// ============================================================================

modu.setEnvironmentConfig('development', {
  logLevel: 'debug',
  cacheEnabled: false,
  strictMode: false
});

modu.setEnvironmentConfig('production', {
  logLevel: 'error',
  cacheEnabled: true,
  strictMode: true
});

// ============================================================================
// 5. REGISTER HTTP ENDPOINTS USING CONFIGURED PIPELINES
// ============================================================================

// Basic user endpoint with dynamic chain selection
modu.when.http('/api/users', ['POST'], async (ctx) => {
  // Choose chain based on feature flags and environment
  const isProd = process.env.NODE_ENV === 'production';
  const useStrictAuth = modu.isFeatureEnabled('strictValidation', { environment: process.env.NODE_ENV });
  
  const chainName = useStrictAuth ? 'userApiEndpoint' : 'processUserData';
  
  // Create and execute chain
  const chain = modu.createChain(chainName);
  const result = await chain(ctx);
  
  // Handle response if not already sent
  if (!ctx.res.headersSent) {
    if (result.error) {
      ctx.res.status(result.error.code || 500).json({
        error: result.error.message,
        chain: chainName
      });
    } else {
      ctx.res.json({
        success: true,
        data: result.savedRecord || result.processedData,
        chain: chainName
      });
    }
  }
  
  return result;
});

// Admin endpoint with strict authentication
modu.when.http('/api/admin/users', ['POST'], async (ctx) => {
  const chain = modu.createChain('strictAuth');
  const authResult = await chain(ctx);
  
  if (authResult.error) {
    ctx.res.status(authResult.error.code || 500).json({
      error: authResult.error.message
    });
    return authResult;
  }
  
  // Continue with data processing
  const processChain = modu.createChain('processUserData');
  const result = await processChain(ctx);
  
  ctx.res.json({
    success: true,
    data: result.savedRecord,
    adminAccess: true
  });
  
  return result;
});

// Statistics endpoint
modu.when.http('/api/stats', ['GET'], async (ctx) => {
  const stats = modu.getStatistics();
  
  ctx.res.json({
    pipelineStatistics: stats,
    featureFlags: {
      strictValidation: modu.isFeatureEnabled('strictValidation'),
      detailedLogging: modu.isFeatureEnabled('detailedLogging'),
      betaFeatures: modu.isFeatureEnabled('betaFeatures')
    },
    environment: process.env.NODE_ENV || 'development'
  });
  
  return ctx;
});

// ============================================================================
// 6. DEMONSTRATE DYNAMIC PIPELINE COMPOSITION
// ============================================================================

// Example of runtime pipeline composition
async function demonstrateDynamicComposition() {
  console.log('\n=== Dynamic Pipeline Composition Demo ===');
  
  // Create a custom pipeline by combining configurations
  const customPipeline = async (ctx) => {
    // Use basic auth first
    const authPipeline = modu.createPipeline('basicAuth');
    ctx = await authPipeline(ctx);
    
    if (ctx.error) {
      return ctx;
    }
    
    // Then process data
    const dataPipeline = modu.createPipeline('processUserData');
    ctx = await dataPipeline(ctx);
    
    return ctx;
  };
  
  // Test the custom pipeline
  const testCtx = {
    headers: { authorization: 'Bearer valid-token' },
    body: { name: 'Test User', email: 'test@example.com' }
  };
  
  const result = await customPipeline(testCtx);
  console.log('Custom pipeline result:', result.savedRecord);
  
  // Show cache statistics
  console.log('Cache statistics:', modu.getStatistics());
}

// ============================================================================
// 7. START SERVER AND DEMO
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`\n🚀 ModuLink Hybrid Pattern Demo Server running on port ${PORT}`);
  console.log('\n📋 Available endpoints:');
  console.log('  POST /api/users       - Create user (dynamic pipeline selection)');
  console.log('  POST /api/admin/users - Create user (admin access required)');
  console.log('  GET  /api/stats       - View pipeline statistics');
  
  console.log('\n🔧 Feature flags:');
  console.log(`  strictValidation: ${modu.isFeatureEnabled('strictValidation')}`);
  console.log(`  detailedLogging: ${modu.isFeatureEnabled('detailedLogging')}`);
  console.log(`  betaFeatures: ${modu.isFeatureEnabled('betaFeatures')}`);
  
  console.log(`\n🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Run the dynamic composition demo
  await demonstrateDynamicComposition();
  
  console.log('\n💡 Try these curl commands:');
  console.log(`
# Create user (will use appropriate pipeline based on environment)
curl -X POST http://localhost:${PORT}/api/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer valid-token" \\
  -d '{"name": "John Doe", "email": "john@example.com"}'

# Try admin endpoint (requires valid token)
curl -X POST http://localhost:${PORT}/api/admin/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer valid-token" \\
  -d '{"name": "Admin User", "email": "admin@example.com"}'

# View statistics
curl http://localhost:${PORT}/api/stats
  `);
});

export default app;
