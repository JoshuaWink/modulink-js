// connect.js
// ----------

import cron from 'node-cron';
import { program } from 'commander';

/**
 * (A) HTTP route helper.
 * Registers an Express route immediately.
 *
 * @param {Express} app
 * @param {ModuLink} modulink
 * @param {String} method    – e.g. 'post', 'get'
 * @param {String} path      – e.g. '/api/signup'
 * @param {Function} chainFn – e.g. userSignupChain
 */
export function connectHttpRoute(app, modulink, method, path, chainFn) {
  app[method.toLowerCase()](path, async (req, res) => {
    try {
      // Build a new context. Include req, res, and parsed payload.
      const ctx = modulink.createContext({
        type: 'http',
        method: req.method,
        path: req.path,
        query: req.query,
        payload: req.body,
        headers: req.headers,
        req,
        res
      });

      // Run instance‐level middleware + chain‐level middleware + links.
      const resultCtx = await chainFn(ctx);

      // Default: send back JSON with final ctx (or pick specific fields).
      res.json({
        success: true,
        data: {
          user: resultCtx.newUser,
          emailSent: resultCtx.emailSent,
          timings: resultCtx.timings
        }
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });
}

/**
 * (B) Cron job helper.
 * Immediately schedules a cron job.
 *
 * @param {String} cronExpression  – e.g. '0 0 * * *'
 * @param {ModuLink} modulink
 * @param {Function} chainFn       – e.g. cleanupOldUsersChain
 */
export function connectCronJob(cronExpression, modulink, chainFn) {
  cron.schedule(cronExpression, async () => {
    const ctx = modulink.createContext({
      type: 'cron',
      schedule: cronExpression,
      scheduledAt: new Date().toISOString()
    });
    try {
      const result = await chainFn(ctx);
      console.log(`[CRON] ran ${chainFn.name} at ${new Date().toISOString()}`);
      console.log(`[CRON] result:`, result.deletedCount ? `Deleted ${result.deletedCount} old users` : 'No action taken');
    } catch (err) {
      console.error(`[CRON][${chainFn.name}] error:`, err);
    }
  });
}

/**
 * (C) CLI command helper.
 * Immediately registers a CLI command via Commander.
 *
 * @param {String} commandName    – e.g. 'import-data'
 * @param {ModuLink} modulink
 * @param {Function} chainFn      – e.g. importDataChain
 */
export function connectCliCommand(commandName, modulink, chainFn) {
  program
    .command(commandName)
    .description(`Invoke the ${chainFn.name} chain`)
    .option('-f, --filename <filename>', 'File to import')
    .action(async (opts) => {
      const ctx = modulink.createContext({
        type: 'cli',
        command: commandName,
        cliArgs: opts,
        invokedAt: new Date().toISOString()
      });
      
      try {
        const result = await chainFn(ctx);
        console.log(`[CLI] Command '${commandName}' completed successfully`);
        console.log(`[CLI] Result:`, result.savedCount ? `Saved ${result.savedCount} records` : 'Processing completed');
      } catch (err) {
        console.error(`[CLI][${commandName}] error:`, err.message);
        process.exit(1);
      }
    });
}