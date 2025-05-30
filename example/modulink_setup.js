// example/modulink_setup.js
// Modular ModuLink setup that can be imported and used with any Express app

import { Modulink } from '../index.js';
import * as bl from './business_logic.js';

/**
 * Creates and configures a ModuLink instance with example routes
 * @param {express.Application} app - Express app instance
 * @returns {Modulink} Configured ModuLink instance
 */
export function setupModulink(app) {
  const modulink = new Modulink(app);

  // Add logging middleware
  modulink.use(ctx => {
    console.log(`[${new Date().toISOString()}] ${ctx.req?.method || 'N/A'} ${ctx.req?.path || 'N/A'}`);
    return ctx;
  });

  // Create processing chain
  const processChain = modulink.chain(bl.entry, bl.increment, bl.double, bl.respond);

  // Register HTTP triggers
  modulink.when.http('/api/process', ['POST'], processChain);
  modulink.when.http('/api/demo', ['GET', 'POST'], processChain);

  // Register cron job (only in non-test environment)
  if (process.env.NODE_ENV !== 'test') {
    modulink.when.cron('*/5 * * * *', async () => {
      console.log('[CRON] Running scheduled process...');
      await processChain({ value: Math.floor(Math.random() * 100) });
    });
  }

  // Register CLI command
  modulink.when.cli('demo-process', processChain);

  return modulink;
}

// For backward compatibility, create with basic server if imported directly
import app from './server.js';
const modulink = setupModulink(app);

export default modulink;
