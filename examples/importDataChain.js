// importDataChain.js
// ------------------
// Chain for importing data (CLI example)

import { chain } from '../index.js';
import {
  readDataFileLink,
  processDataLink,
  saveDataLink,
  timingMiddleware,
} from './links.js';

export const importDataChain = chain(
  readDataFileLink,
  processDataLink,
  saveDataLink
)
  .use(timingMiddleware('data-import-operation'));