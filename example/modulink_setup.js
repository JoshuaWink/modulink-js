// example/modulink_setup.js
const app = require('./server');
const { Modulink } = require('modulink-js');
const bl = require('../business_logic');

const modu = new Modulink(app);

// Middleware
modu.use(ctx => {
  // e.g. auth validation
  return ctx;
});

// Chain
const chain = modu.link([bl.entry, bl.increment, bl.double, bl.respond]);

// HTTP
modu.when.http('/api/process', ['POST'], chain);

// Cron
modu.when.cron('* * * * *', chain);

// CLI
modu.when.cli('process', chain);

module.exports = modu;
