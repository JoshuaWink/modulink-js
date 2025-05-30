// example/app.js
// Simple, complete example showing ModuLink setup and server start

import express from 'express';
import cors from 'cors';
import { Modulink } from '../index.js';
import * as bl from './business_logic.js';

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create ModuLink instance
const modulink = new Modulink(app);

// Add middleware
modulink.use(ctx => {
  console.log(`${ctx.req?.method || 'N/A'} ${ctx.req?.path || 'N/A'}`);
  return ctx;
});

// Create processing chain
const processChain = modulink.chain(bl.entry, bl.increment, bl.double, bl.respond);

// Register triggers
modulink.when.http('/api/process', ['POST'], processChain);
modulink.when.cron('0 * * * *', processChain); // Every hour
modulink.when.cli('process', processChain);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ModuLink example server running on http://localhost:${PORT}`);
  console.log(`Try: curl -X POST -H "Content-Type: application/json" -d '{"value": 42}' http://localhost:${PORT}/api/process`);
});

export { app, modulink };
