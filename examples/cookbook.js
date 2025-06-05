/**
 * ModuLink Comprehensive Cookbook Example
 * 
 * This file demonstrates ALL patterns and features of the ModuLink hybrid architecture:
 * 
 * 1. Business Logic Chains - Pure functions for processing
 * 2. Integration Patterns - HTTP, CLI, standalone, background tasks
 * 3. Connect Patterns - Auto-detection of single vs two-parameter functions
 * 4. Middleware Systems - Instance-level and chain-level middleware
 * 5. Context Management - Rich context objects with metadata
 * 6. Error Handling - Graceful error propagation and recovery
 * 7. Real-World Examples - Complete working patterns
 * 
 * Run this example:
 * node examples/cookbook.js
 * 
 * Or with specific modes:
 * WEB_MODE=true node examples/cookbook.js          # Web server mode
 * node examples/cookbook.js process-file data.json # CLI mode
 * BACKGROUND_MODE=true node examples/cookbook.js   # Background worker mode
 */

import express from 'express';
import { createModuLink, chain } from '../index.js';

// =============================================================================
// SECTION 1: BUSINESS LOGIC CHAINS (Pure Functions)
// =============================================================================

console.log('\n🔗 SECTION 1: Business Logic Chains (Pure Functions)');
console.log('===============================================');

// Simple validation link
const validateInput = (ctx) => {
  console.log('  📝 Validating input...');
  
  if (ctx.error) return ctx; // Skip if already errored
  
  if (!ctx.data) {
    return { ...ctx, error: new Error('No data provided') };
  }
  
  if (typeof ctx.data !== 'object') {
    return { ...ctx, error: new Error('Data must be an object') };
  }
  
  return { ...ctx, validated: true };
};

// Data processing link
const processData = async (ctx) => {
  console.log('  ⚙️ Processing data...');
  
  if (ctx.error) return ctx; // Skip if errored
  
  // Simulate async processing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const processed = {
    ...ctx.data,
    processed: true,
    timestamp: new Date().toISOString(),
    processingTime: 100
  };
  
  return { ...ctx, processedData: processed };
};

// Response formatting link
const formatResponse = (ctx) => {
  console.log('  📋 Formatting response...');
  
  if (ctx.error) {
    return {
      ...ctx,
      response: {
        success: false,
        error: ctx.error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  return {
    ...ctx,
    response: {
      success: true,
      data: ctx.processedData,
      metadata: {
        validated: ctx.validated,
        timestamp: new Date().toISOString()
      }
    }
  };
};

// File processing links (for CLI/standalone examples)
const readFileData = (ctx) => {
  console.log('  📖 Reading file data...');
  
  if (ctx.error) return ctx;
  
  const filename = ctx.filename || ctx.args?.[0];
  if (!filename) {
    return { ...ctx, error: new Error('No filename provided') };
  }
  
  // Simulate file reading
  const mockFileData = {
    filename,
    content: `Mock content for ${filename}`,
    size: Math.floor(Math.random() * 10000),
    lastModified: new Date().toISOString()
  };
  
  return { ...ctx, fileData: mockFileData };
};

const validateFileData = (ctx) => {
  console.log('  ✅ Validating file data...');
  
  if (ctx.error) return ctx;
  
  if (!ctx.fileData?.content) {
    return { ...ctx, error: new Error('File data is invalid') };
  }
  
  return { ...ctx, fileValidated: true };
};

const processFileContent = (ctx) => {
  console.log('  🔄 Processing file content...');
  
  if (ctx.error) return ctx;
  
  const processed = {
    originalSize: ctx.fileData.size,
    processedSize: ctx.fileData.size * 1.1, // Simulate processing overhead
    lines: ctx.fileData.content.split('\n').length,
    processedAt: new Date().toISOString()
  };
  
  return { ...ctx, fileProcessed: processed };
};

// Create business logic chains
console.log('\n  Creating business logic chains...');

const dataProcessingChain = chain(validateInput, processData, formatResponse);
console.log('  ✅ Created dataProcessingChain: validateInput → processData → formatResponse');

const fileProcessingChain = chain(readFileData, validateFileData, processFileContent);
console.log('  ✅ Created fileProcessingChain: readFileData → validateFileData → processFileContent');

// =============================================================================
// SECTION 2: MIDDLEWARE SYSTEMS
// =============================================================================

console.log('\n🔧 SECTION 2: Middleware Systems');
console.log('============================');

// Instance-level middleware (infrastructure concerns)
const globalLogging = (ctx) => {
  console.log(`  🌍 [GLOBAL] Processing ${ctx.type || 'unknown'} request`);
  return { ...ctx, globalLogged: true };
};

const globalTiming = (ctx) => {
  if (!ctx._instanceStartTime) {
    ctx._instanceStartTime = Date.now();
    console.log('  ⏱️ [GLOBAL] Started timing');
  } else {
    const duration = Date.now() - ctx._instanceStartTime;
    console.log(`  ⏱️ [GLOBAL] Completed in ${duration}ms`);
    ctx._instanceDuration = duration;
  }
  return ctx;
};

const globalSecurity = (ctx) => {
  console.log('  🔒 [GLOBAL] Security check passed');
  return { ...ctx, securityChecked: true };
};

// Chain-level middleware (business logic concerns)
const businessLogging = (ctx) => {
  console.log(`  💼 [BUSINESS] Link: ${ctx._linkInfo?.name || 'unknown'}`);
  return ctx;
};

const businessTiming = (ctx) => {
  if (!ctx._businessStartTime) {
    ctx._businessStartTime = Date.now();
  }
  const linkDuration = Date.now() - ctx._businessStartTime;
  console.log(`  ⏲️ [BUSINESS] Link completed in ${linkDuration}ms`);
  return ctx;
};

const errorHandler = (ctx) => {
  if (ctx.error) {
    console.log(`  ❌ [ERROR] ${ctx.error.message}`);
  }
  return ctx;
};

// Enhanced chains with middleware
console.log('\n  Adding middleware to chains...');

const enhancedDataChain = dataProcessingChain
  .use(businessLogging)
  .use(businessTiming)
  .use(errorHandler);

console.log('  ✅ Enhanced dataProcessingChain with business middleware');

const enhancedFileChain = fileProcessingChain
  .use(businessLogging)
  .use(errorHandler);

console.log('  ✅ Enhanced fileProcessingChain with business middleware');

// =============================================================================
// SECTION 3: INTEGRATION PATTERNS WITH CONNECT AUTO-DETECTION
// =============================================================================

console.log('\n🔌 SECTION 3: Integration Patterns with Connect Auto-Detection');
console.log('==========================================================');

// Determine which mode to run based on environment/arguments
const isWebMode = process.env.WEB_MODE === 'true';
const isBackgroundMode = process.env.BACKGROUND_MODE === 'true';
const hasCliArgs = process.argv.length > 2;

console.log(`\n  🎯 Mode Detection:`);
console.log(`     - Web Mode: ${isWebMode}`);
console.log(`     - Background Mode: ${isBackgroundMode}`);
console.log(`     - CLI Args: ${hasCliArgs ? process.argv.slice(2).join(' ') : 'none'}`);

// =============================================================================
// PATTERN 1: WEB FRAMEWORK INTEGRATION
// =============================================================================

if (isWebMode) {
  console.log('\n🌐 PATTERN 1: Web Framework Integration');
  console.log('====================================');
  
  const app = express();
  app.use(express.json());
  
  const modulink = createModuLink(app);
  
  // Add instance-level middleware
  console.log('\n  Adding instance-level middleware...');
  modulink.use(globalLogging);
  modulink.use(globalTiming);
  modulink.use(globalSecurity);
  console.log('  ✅ Added: globalLogging, globalTiming, globalSecurity');
  
  // FLEXIBLE CONNECT: Auto-detects function arity for convenience
  console.log('\n  🔗 Demonstrating flexible connect with one parameter...');
  modulink.connect((modulink) => {
    console.log('    📍 One-parameter function: receives modulink instance');
    console.log(`    📍 Access app via modulink.app: ${!!modulink.app}`);
    
    // Register health check route
    modulink.app.get('/health', (req, res) => {
      console.log('  🏥 Health check requested');
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        pattern: 'one-parameter-convenience' 
      });
    });
    
    console.log('    ✅ Registered GET /health using modulink.app');
  });
  
  // FLEXIBLE CONNECT: Two parameters for convenience
  console.log('\n  🔗 Demonstrating flexible connect with two parameters...');
  modulink.connect((app, modulink) => {
    console.log('    📍 Two-parameter function: app extracted for convenience');
    console.log(`    📍 app parameter: ${!!app}`);
    console.log(`    📍 modulink parameter: ${!!modulink}`);
    console.log(`    📍 app === modulink.app: ${app === modulink.app}`);
    console.log('    📍 Both reference the same ModuLink instance!');
    
    // Register data processing route using app directly (convenience)
    app.post('/api/process', async (req, res) => {
      console.log('\n  🔄 POST /api/process requested');
      
      const ctx = modulink.createContext({
        type: 'http',
        method: 'POST',
        path: '/api/process',
        data: req.body,
        timestamp: new Date().toISOString()
      });
      
      console.log('    📋 Created HTTP context');
      const result = await enhancedDataChain(ctx);
      
      const statusCode = result.error ? 400 : 200;
      res.status(statusCode).json(result.response);
      console.log(`    📤 Response sent with status ${statusCode}`);
    });
    
    console.log('    ✅ Registered POST /api/process using app parameter (convenience)');
    
    // Register file upload route using modulink.app (same as app!)
    modulink.app.post('/api/upload', async (req, res) => {
      console.log('\n  📤 POST /api/upload requested');
      
      const ctx = modulink.createContext({
        type: 'http',
        method: 'POST',
        path: '/api/upload',
        filename: req.body?.filename || 'upload.txt',
        timestamp: new Date().toISOString()
      });
      
      const result = await enhancedFileChain(ctx);
      
      res.json({
        success: !result.error,
        data: result.fileProcessed,
        error: result.error?.message
      });
      
      console.log('    📤 File upload processing complete');
    });
    
    console.log('    ✅ Registered POST /api/upload using modulink.app (same instance)');
  });
  
  // Start the server
  const PORT = process.env.PORT || 3003;
  app.listen(PORT, () => {
    console.log(`\n🚀 Web server started on port ${PORT}`);
    console.log(`\n📡 Available endpoints:`);
    console.log(`   GET  http://localhost:${PORT}/health`);
    console.log(`   POST http://localhost:${PORT}/api/process`);
    console.log(`   POST http://localhost:${PORT}/api/upload`);
    console.log(`\n💡 Test with:`);
    console.log(`   curl http://localhost:${PORT}/health`);
    console.log(`   curl -X POST http://localhost:${PORT}/api/process -H "Content-Type: application/json" -d '{"name":"test","value":123}'`);
  });
}

// =============================================================================
// PATTERN 2: STANDALONE/CLI MODE
// =============================================================================

else if (hasCliArgs) {
  console.log('\n⌨️ PATTERN 2: CLI/Standalone Mode');
  console.log('==============================');
  
  const modulink = createModuLink(); // No app parameter = standalone mode
  
  // Add instance-level middleware (works in standalone too!)
  console.log('\n  Adding instance-level middleware...');
  modulink.use(globalLogging);
  modulink.use(globalTiming);
  console.log('  ✅ Added: globalLogging, globalTiming');
  
  // flexible connect with one parameter in standalone mode
  console.log('\n  🔗 Demonstrating flexible connect with one parameter in standalone mode...');
  modulink.connect((modulink) => {
    console.log('    📍 One-parameter function called in standalone mode');
    console.log(`    📍 modulink.app is null: ${modulink.app === null}`);
    
    const command = process.argv[2];
    const args = process.argv.slice(3);
    
    console.log(`    📋 Command: ${command}`);
    console.log(`    📋 Arguments: ${args.join(', ')}`);
    
    if (command === 'process-file') {
      const filename = args[0];
      
      const ctx = modulink.createContext({
        type: 'cli',
        command,
        args,
        filename,
        timestamp: new Date().toISOString()
      });
      
      console.log('    📋 Created CLI context for file processing');
      
      enhancedFileChain(ctx).then(result => {
        if (result.error) {
          console.error(`    ❌ Error: ${result.error.message}`);
          process.exit(1);
        } else {
          console.log('    ✅ File processing completed successfully!');
          console.log('    📊 Results:', JSON.stringify(result.fileProcessed, null, 2));
          process.exit(0);
        }
      });
    } else {
      console.log(`    ❓ Unknown command: ${command}`);
      console.log('    💡 Try: node cookbook.js process-file data.json');
      process.exit(1);
    }
  });
  
  // flexible connect with two parameters in standalone mode
  console.log('\n  🔗 Demonstrating flexible connect with two parameters in standalone mode...');
  modulink.connect((app, modulink) => {
    console.log('    📍 Two-parameter function called in standalone mode');
    console.log(`    📍 app parameter is null: ${app === null}`);
    console.log(`    📍 modulink parameter available: ${!!modulink}`);
    console.log(`    📍 app === modulink.app: ${app === modulink.app}`);
    
    // Both are null in standalone mode, but flexible connect still works!
    console.log('    ✅ Flexible connect with two parameters works in standalone mode');
    console.log('    💡 Use conditional logic: if (app) { /* web stuff */ } else { /* standalone */ }');
  });
}

// =============================================================================
// PATTERN 3: BACKGROUND WORKER MODE
// =============================================================================

else if (isBackgroundMode) {
  console.log('\n🔄 PATTERN 3: Background Worker Mode');
  console.log('=================================');
  
  const modulink = createModuLink(); // Standalone mode for background work
  
  // Add instance-level middleware
  modulink.use(globalLogging);
  modulink.use(globalTiming);
  
  // Background job processor
  modulink.connect((modulink) => {
    console.log('    📍 Background worker started');
    
    let jobCount = 0;
    
    const processJob = async () => {
      jobCount++;
      console.log(`\n  🔄 Processing background job #${jobCount}`);
      
      const ctx = modulink.createContext({
        type: 'background-job',
        jobId: jobCount,
        data: {
          task: 'cleanup',
          priority: Math.floor(Math.random() * 5) + 1,
          payload: { items: Math.floor(Math.random() * 100) }
        },
        timestamp: new Date().toISOString()
      });
      
      const result = await enhancedDataChain(ctx);
      
      if (result.error) {
        console.log(`    ❌ Job #${jobCount} failed: ${result.error.message}`);
      } else {
        console.log(`    ✅ Job #${jobCount} completed successfully`);
      }
      
      // Stop after 5 jobs for demo
      if (jobCount >= 5) {
        console.log('\n  🛑 Demo complete - stopping background worker');
        process.exit(0);
      }
    };
    
    // Process jobs every 2 seconds
    console.log('    ⏰ Scheduling jobs every 2 seconds...');
    setInterval(processJob, 2000);
    
    // Process first job immediately
    processJob();
  });
}

// =============================================================================
// PATTERN 4: FLEXIBLE/HYBRID MODE (Default)
// =============================================================================

else {
  console.log('\n🎯 PATTERN 4: Flexible/Hybrid Mode (Default)');
  console.log('==========================================');
  
  console.log('\n  This demonstrates how the same code works in multiple modes');
  console.log('  depending on whether an app framework is provided or not.');
  
  // Create both web and standalone instances
  const app = express();
  app.use(express.json());
  
  const webModulink = createModuLink(app);      // With app framework
  const standaloneModulink = createModuLink();  // Without app framework
  
  // Same middleware works for both
  [webModulink, standaloneModulink].forEach((modulink, index) => {
    const mode = index === 0 ? 'WEB' : 'STANDALONE';
    console.log(`\n  🔧 Setting up ${mode} instance...`);
    
    modulink.use(globalLogging);
    modulink.use(globalTiming);
    
    console.log(`    ✅ Added middleware to ${mode} instance`);
  });
  
  // FLEXIBLE CONNECT FUNCTION - works with or without app
  const setupRoutes = (app, modulink) => {
    const mode = app ? 'WEB' : 'STANDALONE';
    console.log(`\n  🔗 Setting up routes for ${mode} mode...`);
    
    if (app) {
      // Web mode - register HTTP endpoints
      app.get('/flexible', (req, res) => {
        res.json({ 
          message: 'Flexible routing works!', 
          mode: 'web',
          timestamp: new Date().toISOString() 
        });
      });
      
      app.post('/flexible/process', async (req, res) => {
        const ctx = modulink.createContext({
          type: 'http-flexible',
          data: req.body,
          timestamp: new Date().toISOString()
        });
        
        const result = await enhancedDataChain(ctx);
        res.json(result.response);
      });
      
      console.log(`    ✅ Registered HTTP routes for ${mode} mode`);
    } else {
      // Standalone mode - setup CLI or background processing
      console.log(`    💡 ${mode} mode - would setup CLI commands or background tasks`);
      
      const ctx = modulink.createContext({
        type: 'standalone-demo',
        data: { demo: true, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString()
      });
      
      enhancedDataChain(ctx).then(result => {
        console.log(`    ✅ ${mode} processing demo completed`);
        console.log('    📊 Result:', JSON.stringify(result.response, null, 2));
      });
    }
  };
  
  // Apply the same function to both instances - auto-detection works!
  console.log('\n  🔗 Demonstrating auto-detection with the same function...');
  
  webModulink.connect(setupRoutes);        // Detected as 2-parameter: setupRoutes(app, modulink)
  standaloneModulink.connect(setupRoutes); // Detected as 2-parameter: setupRoutes(null, modulink)
  
  // Single-parameter examples
  const singleParamSetup = (modulink) => {
    const mode = modulink.app ? 'WEB' : 'STANDALONE';
    console.log(`\n  📍 Single-parameter setup called for ${mode} mode`);
    
    if (modulink.app) {
      modulink.app.get('/single-param', (req, res) => {
        res.json({ pattern: 'single-parameter', mode });
      });
      console.log(`    ✅ Added single-parameter route for ${mode}`);
    } else {
      console.log(`    💡 ${mode} mode - single parameter pattern works here too`);
    }
  };
  
  webModulink.connect(singleParamSetup);        // Detected as 1-parameter
  standaloneModulink.connect(singleParamSetup); // Detected as 1-parameter
  
  // Start web server
  const PORT = process.env.PORT || 3003;
  app.listen(PORT, () => {
    console.log(`\n🚀 Flexible mode web server started on port ${PORT}`);
    console.log(`\n📡 Available endpoints:`);
    console.log(`   GET  http://localhost:${PORT}/flexible`);
    console.log(`   POST http://localhost:${PORT}/flexible/process`);
    console.log(`   GET  http://localhost:${PORT}/single-param`);
  });
}

// =============================================================================
// SECTION 4: PARAMETER RELATIONSHIP DEMONSTRATION
// =============================================================================

console.log('\n📋 SECTION 4: Parameter Relationship Demonstration');
console.log('================================================');

// Create an instance to demonstrate parameter relationships
const demoApp = express();
const demoModulink = createModuLink(demoApp);

console.log('\n  🔍 Demonstrating parameter relationships...');

// flexible connect with two parameters
demoModulink.connect((app, modulink) => {
  console.log('\n  📊 Flexible Connect - Two Parameters Analysis:');
  console.log(`     - app parameter: ${!!app}`);
  console.log(`     - modulink parameter: ${!!modulink}`);
  console.log(`     - app === modulink.app: ${app === modulink.app}`);
  console.log(`     - Both reference the SAME ModuLink instance!`);
  console.log(`     - app is just modulink.app extracted for convenience`);
});

// flexible connect with one parameter
demoModulink.connect((modulink) => {
  console.log('\n  📊 Flexible Connect - One Parameter Analysis:');
  console.log(`     - modulink parameter: ${!!modulink}`);
  console.log(`     - Access app via modulink.app: ${!!modulink.app}`);
  console.log(`     - Same functionality, just accessed differently`);
});

// Standalone demonstration
const standaloneDemoModulink = createModuLink();

standaloneDemoModulink.connect((app, modulink) => {
  console.log('\n  📊 Standalone Mode - Flexible Connect Analysis:');
  console.log(`     - app parameter: ${app}`);
  console.log(`     - modulink parameter: ${!!modulink}`);
  console.log(`     - app === modulink.app: ${app === modulink.app}`);
  console.log(`     - Both are null in standalone mode`);
});

// =============================================================================
// SECTION 5: REAL-WORLD USAGE EXAMPLES
// =============================================================================

console.log('\n🌍 SECTION 5: Real-World Usage Examples');
console.log('=====================================');

// Example: E-commerce order processing
const validateOrder = (ctx) => {
  console.log('  🛒 Validating order...');
  if (!ctx.order?.items?.length) {
    return { ...ctx, error: new Error('Order must have items') };
  }
  return { ...ctx, orderValidated: true };
};

const calculateTotal = (ctx) => {
  if (ctx.error) return ctx;
  console.log('  💰 Calculating total...');
  const total = ctx.order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  return { ...ctx, orderTotal: total };
};

const processPayment = async (ctx) => {
  if (ctx.error) return ctx;
  console.log('  💳 Processing payment...');
  // Simulate payment processing
  await new Promise(resolve => setTimeout(resolve, 50));
  return { ...ctx, paymentProcessed: true, transactionId: `txn_${Date.now()}` };
};

const ecommerceChain = chain(validateOrder, calculateTotal, processPayment)
  .use(businessLogging)
  .use(errorHandler);

console.log('\n  🛒 Created e-commerce order processing chain');

// Example: Data pipeline
const extractData = (ctx) => {
  console.log('  📥 Extracting data...');
  if (ctx.error) return ctx;
  return { ...ctx, extractedData: { records: 100, source: 'database' } };
};

const transformData = (ctx) => {
  console.log('  🔄 Transforming data...');
  if (ctx.error) return ctx;
  return { ...ctx, transformedData: { ...ctx.extractedData, transformed: true } };
};

const loadData = (ctx) => {
  console.log('  📤 Loading data...');
  if (ctx.error) return ctx;
  return { ...ctx, loaded: true, destination: 'data-warehouse' };
};

const etlChain = chain(extractData, transformData, loadData)
  .use(businessTiming)
  .use(errorHandler);

console.log('  📊 Created ETL (Extract-Transform-Load) chain');

// Demonstrate real-world usage
if (!isWebMode && !hasCliArgs && !isBackgroundMode) {
  console.log('\n  🧪 Testing real-world chains...');
  
  // Test e-commerce chain
  const orderCtx = {
    type: 'ecommerce',
    order: {
      items: [
        { name: 'Product A', price: 29.99, quantity: 2 },
        { name: 'Product B', price: 15.50, quantity: 1 }
      ]
    },
    timestamp: new Date().toISOString()
  };
  
  ecommerceChain(orderCtx).then(result => {
    console.log('\n  🛒 E-commerce chain result:');
    if (result.error) {
      console.log(`     ❌ Error: ${result.error.message}`);
    } else {
      console.log(`     ✅ Order validated: ${result.orderValidated}`);
      console.log(`     💰 Total: $${result.orderTotal}`);
      console.log(`     💳 Transaction: ${result.transactionId}`);
    }
  });
  
  // Test ETL chain
  const etlCtx = {
    type: 'etl',
    source: 'production-db',
    timestamp: new Date().toISOString()
  };
  
  etlChain(etlCtx).then(result => {
    console.log('\n  📊 ETL chain result:');
    if (result.error) {
      console.log(`     ❌ Error: ${result.error.message}`);
    } else {
      console.log(`     📥 Extracted: ${result.extractedData?.records} records`);
      console.log(`     🔄 Transformed: ${result.transformedData?.transformed}`);
      console.log(`     📤 Loaded to: ${result.destination}`);
    }
  });
}

// =============================================================================
// SECTION 6: USAGE SUMMARY AND NEXT STEPS
// =============================================================================

console.log('\n📚 SECTION 6: Usage Summary');
console.log('=========================');

console.log('\n  🎯 ModuLink Hybrid Architecture Summary:');
console.log('');
console.log('  1️⃣ BUSINESS LOGIC CHAINS:');
console.log('     - Pure functions: validateInput, processData, formatResponse');
console.log('     - Composable: chain(fn1, fn2, fn3)');
console.log('     - Testable: Each function is independently testable');
console.log('');
console.log('  2️⃣ INTEGRATION PATTERNS:');
console.log('     - Web Framework: createModuLink(app)');
console.log('     - Standalone/CLI: createModuLink()');
console.log('     - Background: createModuLink() + setInterval/setTimeout');
console.log('');
console.log('  3️⃣ FLEXIBLE CONNECT AUTO-DETECTION:');
console.log('     - One Parameter: fn(modulink) - access app via modulink.app');
console.log('     - Two Parameters: fn(app, modulink) - app is modulink.app for convenience');
console.log('     - Same Instance: Both variations use the same ModuLink instance');
console.log('');
console.log('  4️⃣ MIDDLEWARE SYSTEMS:');
console.log('     - Instance Level: modulink.use(middleware) - infrastructure concerns');
console.log('     - Chain Level: chain(...).use(middleware) - business logic concerns');
console.log('     - Both Run: Instance middleware + chain middleware both execute');
console.log('');
console.log('  5️⃣ CONTEXT MANAGEMENT:');
console.log('     - Rich Contexts: modulink.createContext({ type, data, ... })');
console.log('     - Error Propagation: ctx.error flows through chains gracefully');
console.log('     - Metadata: ctx._meta for middleware state');

console.log('\n  🚀 To run different patterns:');
console.log('');
console.log('     # Web server mode');
console.log('     WEB_MODE=true node examples/cookbook.js');
console.log('');
console.log('     # CLI mode');
console.log('     node examples/cookbook.js process-file data.json');
console.log('');
console.log('     # Background worker mode');
console.log('     BACKGROUND_MODE=true node examples/cookbook.js');
console.log('');
console.log('     # Flexible/hybrid demo (default)');
console.log('     node examples/cookbook.js');

console.log('\n  📚 Learn more:');
console.log('     - docs/clean-chain-cookbook.md - Complete architectural guide');
console.log('     - examples/index-flexible.js - All patterns in one file');
console.log('     - examples/standalone-example.js - Standalone processing');
console.log('     - README.md - Full documentation');

console.log('\n✨ ModuLink Cookbook Demo Complete! ✨');

// Graceful shutdown for non-web modes
if (!isWebMode && !hasCliArgs && !isBackgroundMode) {
  setTimeout(() => {
    console.log('\n👋 Demo completed. Exiting...');
    process.exit(0);
  }, 2000);
}
