// example/modulink_setup.js
import app from './server.js';
import { Modulink } from '../index.js';
import * as bl from '../business_logic.js';

const modu = new Modulink(app);

// Middleware
modu.use(ctx => {
  // e.g. auth validation
  return ctx;
});

// Chain
const chain = modu.chain(bl.entry, bl.increment, bl.double, bl.respond);

// HTTP
modu.when.http('/api/process', ['POST'], chain);

// Cron
modu.when.cron('* * * * *', chain);

// CLI
modu.when.cli('process', chain);

export default modu;
