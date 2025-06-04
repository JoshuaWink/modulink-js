/**
 * ModuLink-JS Template System Example
 * 
 * This example demonstrates the Template System (Minimalist) approach:
 * - User implements Express integration using connect() system
 * - ModuLink provides patterns and utilities through ConnectBuilder
 * - Function Composition: Chaining links using createChain()
 * - Context-based Processing: Using typed contexts
 * - Error Handling and Logging utilities
 * 
 * Functions are the links of the chain, composition creates the pipeline.
 * Users implement all integration logic themselves.
 */

import express from 'express';
import { createModulink, createHttpContext, when, errorHandler, validate } from '../index.js';

const app = express();
const modu = createModulink();

// ============================================================================
// 1. DEFINE REUSABLE FUNCTIONS (CHAIN LINKS)
// ============================================================================

// Authentication functions
const validateToken = (params = {}) => async (ctx) => {
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
};

const requireRole = (params = {}) => async (ctx) => {
  if (!ctx.user) {
    ctx.error = { message: 'Authentication required', code: 401 };
    return ctx;
  }
  
  if (params.role && ctx.user.role !== params.role) {
    ctx.error = { message: 'Insufficient permissions', code: 403 };
    return ctx;
  }
  
  return ctx;
};

// Data processing functions
const validateInput = (params = {}) => async (ctx) => {
  const { requiredFields = [] } = params;
  
  for (const field of requiredFields) {
    if (!ctx.body?.[field]) {
      ctx.error = { message: `Missing required field: ${field}`, code: 400 };
      return ctx;
    }
  }
  
  ctx.validatedInput = ctx.body;
  return ctx;
};

const processData = (params = {}) => async (ctx) => {
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
};

const saveToDatabase = (params = {}) => async (ctx) => {
  const { table = 'default' } = params;
  
  // Simulate database save
  ctx.savedRecord = {
    id: Math.random().toString(36).substr(2, 9),
    table,
    data: ctx.processedData,
    createdAt: new Date().toISOString()
  };
  
  return ctx;
};

// Response functions
const sendResponse = (params = {}) => async (ctx) => {
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
};

// ============================================================================
// 2. CREATE CHAINS USING CHAIN()
// ============================================================================

// Basic CRUD chain with authentication
const authenticatedCrudChain = chain(
  validateToken({ strict: true }),
  requireRole({ role: 'user' }),
  validateInput({ requiredFields: ['name'] }),
  processData({ operation: 'transform' }),
  saveToDatabase({ table: 'users' }),
  sendResponse()
);

// Public read-only chain
const publicReadChain = chain(
  validateInput({ requiredFields: ['id'] }),
  processData({ operation: 'default' }),
  sendResponse()
);

// Admin-only chain with extra validation
const adminChain = chain(
  validateToken({ strict: true }),
  requireRole({ role: 'admin' }),
  validateInput({ requiredFields: ['data', 'action'] }),
  when(
    (ctx) => ctx.body.action === 'delete',
    chain(
      (ctx) => {
        ctx.deleteConfirmed = true;
        return ctx;
      },
      saveToDatabase({ table: 'audit_log' })
    )
  ),
  processData({ operation: 'transform' }),
  saveToDatabase({ table: 'admin_actions' }),
  sendResponse()
);

// ============================================================================
// 3. DEFINE HTTP ROUTES WITH ERROR HANDLING
// ============================================================================

// Middleware to create HTTP context
app.use(express.json());
app.use((req, res, next) => {
  req.ctx = createHttpContext(req, res);
  next();
});

// POST /api/users - Create user (authenticated)
app.post('/api/users', async (req, res) => {
  const chain = authenticatedCrudChain.use(errorHandler());
  await chain(req.ctx);
});

// GET /api/data/:id - Public read
app.get('/api/data/:id', async (req, res) => {
  req.ctx.body = { id: req.params.id };
  const chain = publicReadChain.use(errorHandler());
  await chain(req.ctx);
});

// POST /api/admin - Admin actions
app.post('/api/admin', async (req, res) => {
  const chain = adminChain.use(errorHandler());
  await chain(req.ctx);
});

// ============================================================================
// 4. ADVANCED PATTERNS WITH MODULINK
// ============================================================================

// Conditional processing based on feature flags
const featureFlagChain = chain(
  validateToken(),
  when(
    (ctx) => process.env.FEATURE_ENHANCED_PROCESSING === 'true',
    chain(
      processData({ operation: 'transform' }),
      (ctx) => {
        ctx.enhanced = true;
        return ctx;
      }
    ),
    processData({ operation: 'default' })
  ),
  saveToDatabase(),
  sendResponse()
);

// Route with feature flags
app.post('/api/enhanced', async (req, res) => {
  const chain = featureFlagChain.use(errorHandler());
  await chain(req.ctx);
});

// ============================================================================
// 5. START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('\nAvailable endpoints:');
  console.log('POST /api/users - Create user (requires auth)');
  console.log('GET /api/data/:id - Get data (public)');
  console.log('POST /api/admin - Admin actions (requires admin role)');
  console.log('POST /api/enhanced - Enhanced processing with feature flags');
  console.log('\nExample requests:');
  console.log('curl -X POST http://localhost:3000/api/users \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -H "Authorization: Bearer valid-token" \\');
  console.log('  -d \'{"name": "John Doe"}\'');
});

export default app;
