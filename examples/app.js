// app.js
// ------

import express from 'express';
import { createModuLink } from '../index.js';

// 1. Create your Express app (or any framework you choose):
export const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 2. Create a Modulink instance, passing in *your* app:
export const modulink = createModuLink(app);

// 3. Attach any instance‐level middleware you want (e.g. global logging, global auth, etc.)
modulink.use(async function globalLogger(ctx, next) {
  console.log(`[GlobalLogger] ${new Date().toISOString()} – incoming context type: ${ctx.type}`);
  await next();
});

// You can add more instance middleware as needed:
modulink.use(async function globalErrorCatcher(ctx, next) {
  try {
    await next();
  } catch (err) {
    console.error(`[GlobalError] in ${ctx.type}:`, err);
    // You might attach an error flag to ctx or rethrow
    throw err;
  }
});