/**
 * Helper functions for connecting chains to different trigger types
 * Demonstrates both single and two-parameter connect patterns
 */

import cron from 'node-cron';
import { program } from 'commander';

/**
 * Connect an HTTP route using the new flexible connect patterns
 */
export function connectHttpRoute(modulink, method, path, chain) {
  // Use flexible connect with two parameters for explicit app access
  modulink.connect((app, modu) => {
    if (!app) {
      console.warn(`Cannot register HTTP route ${method} ${path} - no app framework`);
      return;
    }
    
    app[method.toLowerCase()](path, async (req, res) => {
      try {
        const ctx = modu.createContext({ 
          req, 
          res, 
          payload: req.body,
          type: 'http',
          method: method.toUpperCase(),
          path,
          query: req.query,
          headers: req.headers
        });
        
        const result = await chain(ctx);
        
        if (result.error) {
          res.status(500).json({ error: result.error.message });
        } else {
          // Send back success response with relevant data
          res.json({
            success: true,
            data: {
              user: result.newUser,
              emailSent: result.emailSent,
              timings: result.timings
            }
          });
        }
      } catch (err) {
        res.status(400).json({ success: false, message: err.message });
      }
    });
  });
}

/**
 * Connect a cron job using flexible connect (one parameter, no app needed)
 */
export function connectCronJob(modulink, schedule, chain, name = 'unnamed-job') {
  // Use flexible connect with one parameter since no app needed
  modulink.connect((modu) => {
    cron.schedule(schedule, async () => {
      const ctx = modu.createContext({ 
        type: 'cron',
        schedule,
        name,
        timestamp: new Date().toISOString()
      });
      
      try {
        const result = await chain(ctx);
        console.log(`[CronJob:${name}] Completed:`, result.success ? 'SUCCESS' : 'ERROR');
        if (result.deletedCount) {
          console.log(`[CronJob:${name}] Deleted ${result.deletedCount} old records`);
        }
      } catch (error) {
        console.error(`[CronJob:${name}] Error:`, error.message);
      }
    });
    
    console.log(`[CronJob:${name}] Scheduled: ${schedule}`);
  });
}

/**
 * Connect a CLI command using flexible connect (one parameter, no app needed)
 */
export function connectCliCommand(modulink, commandName, chain) {
  // Use flexible connect with one parameter since no app needed
  modulink.connect((modu) => {
    program
      .command(commandName)
      .description(`Invoke the ${chain.name || commandName} chain`)
      .option('-f, --filename <filename>', 'File to process')
      .option('-d, --debug', 'Enable debug output')
      .action(async (opts) => {
        const ctx = modu.createContext({ 
          type: 'cli',
          command: commandName,
          cliArgs: opts,
          invokedAt: new Date().toISOString()
        });
        
        try {
          const result = await chain(ctx);
          console.log(`[CLI:${commandName}] Success:`, result.message || 'Command completed');
          if (result.savedCount) {
            console.log(`[CLI:${commandName}] Saved ${result.savedCount} records`);
          }
        } catch (error) {
          console.error(`[CLI:${commandName}] Error:`, error.message);
          process.exit(1);
        }
      });
  });
}

/**
 * Example showing both flexible connect variations in same function
 */
export function connectFlexible(modulink, config) {
  // Flexible connect with two parameters - good for explicit control
  modulink.connect((app, modu) => {
    if (app) {
      console.log('Running with app framework');
      // Register HTTP routes
      config.routes?.forEach(({ method, path, chain }) => {
        app[method.toLowerCase()](path, async (req, res) => {
          const ctx = modu.createContext({ req, res, type: 'http' });
          const result = await chain(ctx);
          res.json(result);
        });
      });
    } else {
      console.log('Running in standalone mode');
      // Setup background jobs or CLI commands
      config.jobs?.forEach(({ schedule, chain, name }) => {
        cron.schedule(schedule, async () => {
          const ctx = modu.createContext({ type: 'cron', name });
          await chain(ctx);
        });
      });
    }
  });
}

/**
 * Legacy helper functions for backward compatibility
 * These match the old API but are less flexible
 */

export function connectHttpRouteLegacy(app, modulink, method, path, chainFn) {
  app[method.toLowerCase()](path, async (req, res) => {
    try {
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

      const resultCtx = await chainFn(ctx);

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

export function connectCronJobLegacy(cronExpression, modulink, chainFn) {
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

export function connectCliCommandLegacy(commandName, modulink, chainFn) {
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
