// Main entry point showing both connect patterns
// Demonstrates flexibility of ModuLink's hybrid architecture

import { app } from './app.js';
import { createModuLink } from '../index.js';
import { userSignupChain } from './userSignupChain.js';
import { cleanupOldUsersChain } from './cleanupChain.js';
import { importDataChain } from './importDataChain.js';
import { program } from 'commander';
import cron from 'node-cron';

// Create ModuLink instance with app
const modulink = createModuLink(app);

// Add instance-level middleware (applies to ALL chains)
modulink.use((ctx) => {
  console.log(`[GlobalLogger] ${new Date().toISOString()} – incoming context type: ${ctx.type}`);
  return ctx;
});

// ============================================
// FLEXIBLE CONNECT: Two parameters (convenience for app access)
// ============================================
console.log('Setting up with flexible connect (two parameters)...');

modulink.connect((app, modulink) => {
  console.log('✅ Flexible connect with two parameters: direct app access for convenience');
  
  // Direct Express route registration - no need to write modulink.app
  app.post('/api/signup', async (req, res) => {
    const ctx = modulink.createContext({ 
      req, 
      res, 
      payload: req.body,
      type: 'http'
    });
    
    const result = await userSignupChain(ctx);
    
    if (result.error) {
      res.status(500).json({ error: result.error.message });
    } else {
      res.json({
        success: true,
        data: {
          user: result.newUser,
          emailSent: result.emailSent,
          timings: result.timings
        }
      });
    }
  });
  
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
});

// ============================================
// PATTERN 2: Single-parameter connect (access app via modulink.app)
// ============================================
console.log('Setting up with flexible connect (one parameter)...');

modulink.connect((modulink) => {
  console.log('✅ Flexible connect with one parameter: using modulink.app for Express access');
  
  // Access app through modulink.app
  modulink.app.get('/api/status', (req, res) => {
    res.json({ 
      status: 'running',
      version: '1.0.0',
      patterns: ['single-param', 'two-param']
    });
  });
  
  modulink.app.get('/api/info', (req, res) => {
    res.json({
      message: 'This route was registered using flexible connect (one parameter)',
      accessPattern: 'modulink.app.get(...)'
    });
  });
});

// ============================================
// FLEXIBLE CONNECT: Background jobs (one parameter, no app needed)
// ============================================
console.log('Setting up background jobs...');

modulink.connect((modu) => {
  console.log('✅ Background jobs: no app needed');
  
  // Cron job for cleanup
  cron.schedule('0 0 * * *', async () => {
    const ctx = modu.createContext({
      type: 'cron',
      schedule: '0 0 * * *',
      job: 'daily-cleanup',
      timestamp: new Date().toISOString()
    });
    
    try {
      const result = await cleanupOldUsersChain(ctx);
      console.log(`[CRON] Daily cleanup completed:`, 
        result.deletedCount ? `Deleted ${result.deletedCount} old users` : 'No action taken');
    } catch (error) {
      console.error(`[CRON] Daily cleanup error:`, error.message);
    }
  });
  
  console.log('📅 Daily cleanup job scheduled for midnight');
});

// ============================================
// PATTERN 4: CLI commands (single-parameter, no app needed)
// ============================================
console.log('Setting up CLI commands...');

modulink.connect((modu) => {
  console.log('✅ CLI commands: no app needed');
  
  program
    .command('import-data')
    .description('Import data from a file')
    .option('-f, --filename <filename>', 'File to import')
    .option('-d, --debug', 'Enable debug output')
    .action(async (opts) => {
      const ctx = modu.createContext({
        type: 'cli',
        command: 'import-data',
        cliArgs: opts,
        invokedAt: new Date().toISOString()
      });
      
      try {
        const result = await importDataChain(ctx);
        console.log(`[CLI] Import completed successfully`);
        if (result.savedCount) {
          console.log(`[CLI] Saved ${result.savedCount} records`);
        }
      } catch (error) {
        console.error(`[CLI] Import error:`, error.message);
        process.exit(1);
      }
    });
});

// ============================================
// PATTERN 5: Conditional setup based on environment
// ============================================
console.log('Setting up conditional features...');

modulink.connect((app, modu) => {
  if (app) {
    console.log('✅ App available: setting up web-specific features');
    
    // Development-only routes
    if (process.env.NODE_ENV === 'development') {
      app.get('/dev/debug', (req, res) => {
        res.json({
          environment: 'development',
          patterns: 'both supported',
          middleware: modu._instanceMiddleware?.length || 0
        });
      });
    }
    
    // API documentation route
    app.get('/api/docs', (req, res) => {
      res.json({
        endpoints: [
          'POST /api/signup - User registration',
          'GET /health - Health check',
          'GET /api/status - Service status',
          'GET /api/info - Pattern info'
        ],
        patterns: {
          'two-parameter': 'fn(app, modu) - explicit app access',
          'single-parameter': 'fn(modu) - app via modu.app'
        }
      });
    });
  } else {
    console.log('⚠️  No app: setting up standalone features only');
    
    // Background monitoring
    setInterval(() => {
      const ctx = modu.createContext({
        type: 'monitor',
        timestamp: new Date().toISOString()
      });
      console.log('[MONITOR] System check completed');
    }, 30000); // Every 30 seconds
  }
});

// ============================================
// Start everything
// ============================================

const PORT = process.env.PORT || 3001;

// Check if we're running CLI commands (look for known commands)
const knownCommands = ['import-data'];
const hasKnownCommand = process.argv.slice(2).some(arg => knownCommands.includes(arg));

if (hasKnownCommand) {
  console.log('🔧 CLI Mode: Running command and exiting...');
  // Parse CLI arguments
  program.parse(process.argv);
} else {
  // Start HTTP server
  app.listen(PORT, () => {
    console.log(`
🚀 ModuLink Hybrid Architecture Demo
================================

📡 Server running on port ${PORT}

📋 HTTP Endpoints (flexible connect - two parameters):
   POST /api/signup     - User signup
   GET  /health         - Health check

📋 HTTP Endpoints (flexible connect - one parameter):  
   GET  /api/status     - Service status
   GET  /api/info       - Pattern information
   GET  /api/docs       - API documentation

⚡ Background Jobs:
   daily-cleanup        - Runs at midnight (00:00)

🔧 CLI Commands:
   node index-flexible.js import-data --filename data.json

🎯 Both connect patterns work seamlessly:
   • fn(app, modu) - explicit app access
   • fn(modu) - app via modu.app

The API automatically detects which pattern to use based on
function arity (number of parameters)!
    `);
  });
}
