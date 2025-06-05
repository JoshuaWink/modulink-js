// index.js
// --------

import { app, modulink } from './app.js';
import { userSignupChain } from './userSignupChain.js';
import { cleanupOldUsersChain } from './cleanupChain.js';
import { importDataChain } from './importDataChain.js';
import { program } from 'commander';

import {
  connectHttpRoute,
  connectCronJob,
  connectCliCommand,
} from './connect.js';

// 1. Register an HTTP endpoint for user signup.
//    As soon as `connect(...)` is called, the Express route exists.
modulink.connect((appInstance, modu) => {
  connectHttpRoute(appInstance, modu, 'post', '/api/signup', userSignupChain);
});

// 2. Register a daily cron job at midnight.
modulink.connect((appInstance, modu) => {
  connectCronJob('0 0 * * *', modu, cleanupOldUsersChain);
});

// 3. Register a CLI command "import-data".
modulink.connect((appInstance, modu) => {
  connectCliCommand('import-data', modu, importDataChain);
});

// 4. Now you're free to start your HTTP server and CLI parser.
//    There's no separate "runConnects()"—everything is already wired.

const PORT = process.env.PORT || 3000;

// Check if we're being run as a CLI command
const isCliMode = process.argv.length > 2 && process.argv[2] !== 'serve';

if (isCliMode) {
  // CLI mode - parse commands and exit
  const { program } = await import('commander');
  program.parse(process.argv);
} else {
  // Server mode - start HTTP server
  app.listen(PORT, () => {
    console.log(`HTTP server listening on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  POST /api/signup - User signup');
    console.log('');
    console.log('CLI commands:');
    console.log('  node index.js import-data --filename data.json');
    console.log('');
    console.log('Cron jobs:');
    console.log('  Daily cleanup at midnight (00:00)');
  });
}