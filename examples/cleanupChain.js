// cleanupChain.js
// ---------------
// Chain for cleaning up old users (cron job example)

import { chain } from '../index.js';
import {
  findOldUsersLink,
  deleteOldUsersLink,
  timingMiddleware,
} from './links.js';

export const cleanupOldUsersChain = chain(
  findOldUsersLink,
  deleteOldUsersLink
)
  .use(timingMiddleware('cleanup-operation'));