// example/app.js
// Simple, complete example showing ModuLink setup and server start

import express from 'express';
import cors from 'cors';
import { createModulink, createHttpContext, chain, catchErrors } from '../index.js';
import * as bl from './business_logic.js';

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create ModuLink instance
const modulink = createModulink();

// Create processing chain using chain
const processChain = chain(
  bl.entry,
  bl.increment,
  bl.double,
  bl.respond
);

// Create context middleware
app.use((req, res, next) => {
  req.ctx = createHttpContext(req, res);
  next();
});

// Register HTTP routes
app.post('/api/process', async (req, res) => {
  const chain = catchErrors(processChain);
  await chain(req.ctx);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ModuLink example server running on http://localhost:${PORT}`);
  console.log(`Try: curl -X POST -H "Content-Type: application/json" -d '{"value": 42}' http://localhost:${PORT}/api/process`);
});

export { app, modulink };
