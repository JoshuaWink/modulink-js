// userSignupChain.js
// ------------------
// Compose three links into a single chain, then attach chain‐level middleware.

import { chain } from '../index.js';
import {
  validateInputLink,
  createUserLink,
  sendWelcomeEmailLink,
  timingMiddleware,
} from './links.js';

export const userSignupChain = chain(
  validateInputLink,
  createUserLink,
  sendWelcomeEmailLink
)
  // These two timingMiddleware calls run in sequence before/after each group of links:
  .use(timingMiddleware('validate-and-create'), timingMiddleware('send-email'));