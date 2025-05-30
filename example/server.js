// example/server.js
// Pure Express app factory - no ModuLink, just basic Express setup

import express from 'express';
import cors from 'cors';

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Basic health check route
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });
  
  return app;
}

const app = createApp();

export default app;
export { createApp };
