// example/verbose_demo.js

import express from 'express';
import { Modulink } from '../modulink/modulink.js';
import * as business from '../business_logic.js';

const app = express();
app.use(express.json());

const modu = new Modulink(app);

// Middleware for logging
modu.use(Modulink.logging());

// Chain: increment then double, then respond
const pipeline = modu.chain(
  business.increment,
  business.double,
  business.respond
);

// Pure function for CLI logic
async function processCLICommand(ctx) {
  const initialValue = ctx.value !== undefined ? parseInt(ctx.value, 10) : 100;
  if (isNaN(initialValue)) {
    return { error: 'Invalid initial value in --data. Must be a number.' };
  }
  let currentCtx = { value: initialValue };
  return await pipeline(currentCtx);
}

// HTTP GET endpoint
modu.when.http('/api/value', ['GET'], async ctx => {
  let value = ctx.value;
  if (ctx.query && ctx.query.value !== undefined) {
    value = ctx.query.value;
  }
  if (value === undefined && ctx._req && ctx._req.query && ctx._req.query.value !== undefined) {
    value = ctx._req.query.value;
  }
  const initialValue = value !== undefined ? parseInt(value, 10) : 1;
  if (isNaN(initialValue)) {
    console.error('[GET /api/value] Invalid initial value provided:', value);
    return { error: 'Invalid initial value. Must be a number.' };
  }
  let currentCtx = { value: initialValue };
  console.log('[GET /api/value] Initial context:', currentCtx);
  const result = await pipeline(currentCtx);
  console.log('[GET /api/value] Result:', result);
  return result;
});

// HTTP POST endpoint
modu.when.http('/api/process', ['POST'], async ctx => {
  const initialValue = ctx.value !== undefined ? parseInt(ctx.value, 10) : 10;
  if (isNaN(initialValue)) {
    console.error('[POST /api/process] Invalid initial value provided:', ctx.value);
    return { error: 'Invalid initial value. Must be a number.' };
  }
  let currentCtx = { value: initialValue };
  console.log('[POST /api/process] Initial context:', currentCtx);
  const result = await pipeline(currentCtx);
  console.log('[POST /api/process] Result:', result);
  return result;
});

// CLI command and Cron job: only register when running directly
// ES modules don't have require.main, use import.meta.url check instead
if (import.meta.url === `file://${process.argv[1]}`) {
  // Cron job: logs processed value every minute
  modu.when.cron('* * * * *', async () => {
    let currentCtx = { value: 5 };
    console.log('[CRON] Initial context for scheduled job:', currentCtx);
    const result = await pipeline(currentCtx);
    console.log('[CRON] Processed value:', result);
  });

  modu.when.cli('process-cli', async ctx => {
    const result = await processCLICommand(ctx);
    console.log(JSON.stringify(result));
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
    return result;
  });
  
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Verbose demo app running on http://localhost:${PORT}`);
    console.log('Try:');
    console.log(`  curl http://localhost:${PORT}/api/value`);
    console.log(`  curl http://localhost:${PORT}/api/value?value=7`);
    console.log(`  curl -X POST -H "Content-Type: application/json" -d '{"value": 20}' http://localhost:${PORT}/api/process`);
    console.log(`  node example/verbose_demo.js process-cli --data '{"value": 50}'`);
  });
}

export { app, modu, pipeline, processCLICommand };
