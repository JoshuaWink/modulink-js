// example/modulink_setup.js
// Modular ModuLink setup that can be imported and used with any Express app

import { createModulink, createHttpContext, chain, logging, catchErrors } from '../index.js';
import * as bl from './business_logic.js';

/**
 * Creates and configures a ModuLink instance with example routes
 * @param {express.Application} app - Express app instance
 * @returns {object} Configured chains and handlers
 */
export function setupModulink(app) {
  const modulink = createModulink();

  // Create processing chain
  const processChain = chain(
    logging(),
    bl.entry,
    bl.increment,
    bl.double,
    bl.respond
  );

  // Add context middleware
  app.use((req, res, next) => {
    req.ctx = createHttpContext(req, res);
    next();
  });

  // Register HTTP routes
  app.post('/api/process', async (req, res) => {
    const chain = catchErrors(processChain);
    await chain(req.ctx);
  });

  app.all('/api/demo', async (req, res) => {
    const chain = catchErrors(processChain);
    await chain(req.ctx);
  });

  return { modulink, processChain };
}

// For backward compatibility, create with basic server if imported directly
import app from './server.js';
const { modulink } = setupModulink(app);

export default modulink;
