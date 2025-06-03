/**
 * ModuLink Tests for JavaScript
 * 
 * Tests the ModuLink system functionality including:
 * - Context creation and manipulation
 * - Link composition and chaining
 * - Middleware application
 * - Error handling
 * - Utility functions
 */

import {
  createContext,
  createHttpContext,
  createCronContext,
  createCliContext,
  createMessageContext,
  createErrorContext,
  getCurrentTimestamp
} from '../modulink/types.js';

import { createModulink } from '../modulink/modulink.js';

import {
  chain,
  when,
  errorHandler,
  timing,
  logging,
  validate,
  retry,
  transform,
  addData,
  pick,
  omit,
  parallel,
  race,
  cache
} from '../modulink/utils.js';

describe('ModuLink System', () => {
  
  describe('Context Creation', () => {
    test('should create basic context', () => {
      const ctx = createContext({ trigger: 'test' });
      
      expect(ctx.trigger).toBe('test');
      expect(ctx.timestamp).toBeDefined();
      expect(typeof ctx.timestamp).toBe('string');
    });

    test('should create HTTP context', () => {
      const ctx = createHttpContext({
        method: 'POST',
        path: '/api/test',
        headers: { 'content-type': 'application/json' },
        body: { data: 'test' }
      });
      
      expect(ctx.trigger).toBe('http');
      expect(ctx.method).toBe('POST');
      expect(ctx.path).toBe('/api/test');
      expect(ctx.headers['content-type']).toBe('application/json');
      expect(ctx.body.data).toBe('test');
    });

    test('should create cron context', () => {
      const ctx = createCronContext({
        expression: '0 0 * * *',
        jobName: 'daily-cleanup'
      });
      
      expect(ctx.trigger).toBe('cron');
      expect(ctx.expression).toBe('0 0 * * *');
      expect(ctx.jobName).toBe('daily-cleanup');
    });

    test('should create CLI context', () => {
      const ctx = createCliContext({
        command: 'process',
        args: ['--input', 'test.txt'],
        options: { verbose: true }
      });
      
      expect(ctx.trigger).toBe('cli');
      expect(ctx.command).toBe('process');
      expect(ctx.args).toEqual(['--input', 'test.txt']);
      expect(ctx.options.verbose).toBe(true);
    });

    test('should create message context', () => {
      const ctx = createMessageContext({
        topic: 'user.created',
        payload: { userId: 123 },
        metadata: { source: 'api' }
      });
      
      expect(ctx.trigger).toBe('message');
      expect(ctx.topic).toBe('user.created');
      expect(ctx.payload.userId).toBe(123);
      expect(ctx.metadata.source).toBe('api');
    });

    test('should create error context', () => {
      const error = new Error('Test error');
      const originalCtx = { userId: 123 };
      const ctx = createErrorContext(error, originalCtx);
      
      expect(ctx.userId).toBe(123);
      expect(ctx.error.message).toBe('Test error');
      expect(ctx.error.name).toBe('Error');
      expect(ctx.error.stack).toBeDefined();
    });
  });

  // compose() functionality removed - using chain() instead
  describe('Chain-Based Composition', () => {
    test('should chain sync links', async () => {
      const link1 = (ctx) => ({ ...ctx, step1: true });
      const link2 = (ctx) => ({ ...ctx, step2: true });
      const link3 = (ctx) => ({ ...ctx, step3: true });
      
      const chainFn = chain(link1, link2, link3);
      const result = await chainFn({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.step1).toBe(true);
      expect(result.step2).toBe(true);
      expect(result.step3).toBe(true);
    });

    test('should chain async links', async () => {
      const link1 = async (ctx) => ({ ...ctx, async1: true });
      const link2 = async (ctx) => ({ ...ctx, async2: true });
      
      const chainFn = chain(link1, link2);
      const result = await chainFn({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.async1).toBe(true);
      expect(result.async2).toBe(true);
    });

    test('should chain mixed sync/async links', async () => {
      const syncLink = (ctx) => ({ ...ctx, sync: true });
      const asyncLink = async (ctx) => ({ ...ctx, async: true });
      
      const chainFn = chain(syncLink, asyncLink);
      const result = await chainFn({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.sync).toBe(true);
      expect(result.async).toBe(true);
    });

    test('should stop chain execution on error', async () => {
      const link1 = (ctx) => ({ ...ctx, step1: true });
      const link2 = (ctx) => { throw new Error('Link 2 failed'); };
      const link3 = (ctx) => ({ ...ctx, step3: true });
      
      const chainFn = chain(link1, link2, link3);
      const result = await chainFn({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.step1).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Link 2 failed');
      expect(result.step3).toBeUndefined();
    });
  });

  describe('Conditional Execution', () => {
    test('should execute when condition is true', async () => {
      const condition = (ctx) => ctx.shouldExecute === true;
      const chain = (ctx) => ({ ...ctx, executed: true });
      
      const conditionalChain = when(condition, chain);
      const result = await conditionalChain({ shouldExecute: true });
      
      expect(result.executed).toBe(true);
    });

    test('should not execute when condition is false', async () => {
      const condition = (ctx) => ctx.shouldExecute === true;
      const chain = (ctx) => ({ ...ctx, executed: true });
      
      const conditionalChain = when(condition, chain);
      const result = await conditionalChain({ shouldExecute: false });
      
      expect(result.executed).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should catch errors and add to context using middleware', async () => {
      const errorChain = chain(
        async () => {
          throw new Error('Test error');
        }
      ).use(errorHandler());
      
      const result = await errorChain({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Test error');
    });

    test('should use custom error handler middleware', async () => {
      const customHandler = (error, ctx) => ({
        ...ctx,
        customError: `Custom: ${error.message}`
      });
      
      const errorChain = chain(
        async () => {
          throw new Error('Test error');
        }
      ).use(errorHandler(customHandler));
      
      const result = await errorChain({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.customError).toBe('Custom: Test error');
    });
  });

  describe('Timing', () => {
    test('should measure execution time', async () => {
      const slowChain = async (ctx) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { ...ctx, processed: true };
      };
      
      const timedChain = timing(slowChain, 'slow-operation');
      const result = await timedChain({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.processed).toBe(true);
      expect(result.timings).toBeDefined();
      expect(result.timings['slow-operation']).toBeDefined();
      expect(result.timings['slow-operation'].duration).toBeGreaterThan(90);
    });
  });

  describe('Validation', () => {
    test('should validate successfully', async () => {
      const validator = (ctx) => ctx.userId !== undefined;
      const chain = (ctx) => ({ ...ctx, validated: true });
      
      const validatedChain = validate(validator, chain);
      const result = await validatedChain({ userId: 123 });
      
      expect(result.userId).toBe(123);
      expect(result.validated).toBe(true);
    });

    test('should fail validation', async () => {
      const validator = (ctx) => ctx.userId !== undefined;
      const chain = (ctx) => ({ ...ctx, validated: true });
      
      const validatedChain = validate(validator, chain);
      const result = await validatedChain({ name: 'John' });
      
      expect(result.name).toBe('John');
      expect(result.validated).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Validation failed');
    });

    test('should use custom validation message', async () => {
      const validator = (ctx) => ctx.userId ? true : 'User ID is required';
      const chain = (ctx) => ({ ...ctx, validated: true });
      
      const validatedChain = validate(validator, chain);
      const result = await validatedChain({ name: 'John' });
      
      expect(result.error.message).toBe('User ID is required');
    });
  });

  describe('Retry Logic', () => {
    test('should retry failed operations', async () => {
      let attempts = 0;
      const flakyChain = async (ctx) => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { ...ctx, attempts, success: true };
      };
      
      const retryChain = retry(flakyChain, 5, 10);
      const result = await retryChain({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(result.retryInfo.attempts).toBe(3);
      expect(result.retryInfo.successful).toBe(true);
    });

    test('should fail after max retries', async () => {
      const alwaysFailChain = async () => {
        throw new Error('Always fails');
      };
      
      const retryChain = retry(alwaysFailChain, 2, 10);
      const result = await retryChain({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Always fails');
      expect(result.retryInfo.attempts).toBe(3);
      expect(result.retryInfo.successful).toBe(false);
    });
  });

  describe('Transform and Data Manipulation', () => {
    test('should transform context', async () => {
      const transformer = (ctx) => ({
        ...ctx,
        userId: ctx.user_id,
        displayName: `${ctx.firstName} ${ctx.lastName}`
      });
      
      const chain = transform(transformer);
      const result = await chain({
        user_id: 123,
        firstName: 'John',
        lastName: 'Doe'
      });
      
      expect(result.userId).toBe(123);
      expect(result.displayName).toBe('John Doe');
    });

    test('should add data to context', async () => {
      const chain = addData({ processed: true, timestamp: '2023-01-01' });
      const result = await chain({ userId: 123 });
      
      expect(result.userId).toBe(123);
      expect(result.processed).toBe(true);
      expect(result.timestamp).toBe('2023-01-01');
    });

    test('should pick specific keys', async () => {
      const chain = pick(['userId', 'name']);
      const result = await chain({
        userId: 123,
        name: 'John',
        email: 'john@example.com',
        password: 'secret'
      });
      
      expect(result.userId).toBe(123);
      expect(result.name).toBe('John');
      expect(result.email).toBeUndefined();
      expect(result.password).toBeUndefined();
    });

    test('should omit specific keys', async () => {
      const chain = omit(['password', 'secret']);
      const result = await chain({
        userId: 123,
        name: 'John',
        email: 'john@example.com',
        password: 'secret',
        secret: 'hidden'
      });
      
      expect(result.userId).toBe(123);
      expect(result.name).toBe('John');
      expect(result.email).toBe('john@example.com');
      expect(result.password).toBeUndefined();
      expect(result.secret).toBeUndefined();
    });
  });

  describe('Parallel Execution', () => {
    test('should execute chains in parallel', async () => {
      const chain1 = async (ctx) => ({ ...ctx, result1: 'A' });
      const chain2 = async (ctx) => ({ ...ctx, result2: 'B' });
      const chain3 = async (ctx) => ({ ...ctx, result3: 'C' });
      
      const parallelChain = parallel(chain1, chain2, chain3);
      const result = await parallelChain({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.result1).toBe('A');
      expect(result.result2).toBe('B');
      expect(result.result3).toBe('C');
    });

    test('should handle errors in parallel execution', async () => {
      const chain1 = async (ctx) => ({ ...ctx, result1: 'A' });
      const chain2 = async () => { throw new Error('Chain 2 failed'); };
      
      const parallelChain = parallel(chain1, chain2);
      const result = await parallelChain({ initial: true });
      
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Chain 2 failed');
    });
  });

  describe('Cache', () => {
    test('should cache results', async () => {
      let executionCount = 0;
      const expensiveChain = async (ctx) => {
        executionCount++;
        return { ...ctx, result: `execution-${executionCount}` };
      };
      
      const keyFn = (ctx) => ctx.userId.toString();
      const cachedChain = cache(expensiveChain, keyFn, 60000);
      
      // First execution
      const result1 = await cachedChain({ userId: 123 });
      expect(result1.result).toBe('execution-1');
      expect(executionCount).toBe(1);
      
      // Second execution with same key should use cache
      const result2 = await cachedChain({ userId: 123 });
      expect(result2.result).toBe('execution-1');
      expect(result2.cached).toBe(true);
      expect(executionCount).toBe(1);
      
      // Different key should execute again
      const result3 = await cachedChain({ userId: 456 });
      expect(result3.result).toBe('execution-2');
      expect(executionCount).toBe(2);
    });
  });

  describe('Chain Function (New API)', () => {
    test('should execute links in sequence', async () => {
      const link1 = (ctx) => ({ ...ctx, step: 1 });
      const link2 = (ctx) => ({ ...ctx, step: 2 });
      const link3 = (ctx) => ({ ...ctx, step: 3 });
      
      const chainFn = chain(link1, link2, link3);
      const result = await chainFn({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.step).toBe(3); // Last step wins
    });

    test('should handle async links', async () => {
      const asyncLink1 = async (ctx) => ({ ...ctx, async1: true });
      const syncLink = (ctx) => ({ ...ctx, sync: true });
      const asyncLink2 = async (ctx) => ({ ...ctx, async2: true });
      
      const chainFn = chain(asyncLink1, syncLink, asyncLink2);
      const result = await chainFn({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.async1).toBe(true);
      expect(result.sync).toBe(true);
      expect(result.async2).toBe(true);
    });

    test('should support middleware with .use()', async () => {
      const link1 = (ctx) => ({ ...ctx, link1: true });
      const link2 = (ctx) => ({ ...ctx, link2: true });
      
      const middleware1 = (ctx) => ({ ...ctx, middleware1: true });
      const middleware2 = (ctx) => ({ ...ctx, middleware2: true });
      
      const chainFn = chain(link1, link2)
        .use(middleware1)
        .use(middleware2);
      
      const result = await chainFn({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.link1).toBe(true);
      expect(result.link2).toBe(true);
      expect(result.middleware1).toBe(true);
      expect(result.middleware2).toBe(true);
    });

    test('should run middleware after each link (O(n*m) behavior)', async () => {
      const executionOrder = [];
      
      const link1 = (ctx) => {
        executionOrder.push('link1');
        return { ...ctx, link1: true };
      };
      const link2 = (ctx) => {
        executionOrder.push('link2');
        return { ...ctx, link2: true };
      };
      
      const middleware1 = (ctx) => {
        executionOrder.push('middleware1');
        return { ...ctx, middleware1: true };
      };
      const middleware2 = (ctx) => {
        executionOrder.push('middleware2');
        return { ...ctx, middleware2: true };
      };
      
      const chainFn = chain(link1, link2)
        .use(middleware1, middleware2);
      
      await chainFn({ initial: true });
      
      // Expected order: link1, middleware1, middleware2, link2, middleware1, middleware2
      expect(executionOrder).toEqual([
        'link1', 'middleware1', 'middleware2',
        'link2', 'middleware1', 'middleware2'
      ]);
    });

    test('should support chaining multiple .use() calls', async () => {
      const link = (ctx) => ({ ...ctx, processed: true });
      
      const chainFn = chain(link)
        .use((ctx) => ({ ...ctx, first: true }))
        .use((ctx) => ({ ...ctx, second: true }))
        .use((ctx) => ({ ...ctx, third: true }));
      
      const result = await chainFn({ initial: true });
      
      expect(result.processed).toBe(true);
      expect(result.first).toBe(true);
      expect(result.second).toBe(true);
      expect(result.third).toBe(true);
    });

    test('should handle errors in links', async () => {
      const link1 = (ctx) => ({ ...ctx, step1: true });
      const errorLink = () => {
        throw new Error('Link failed');
      };
      const link3 = (ctx) => ({ ...ctx, step3: true });
      
      const chainFn = chain(link1, errorLink, link3);
      const result = await chainFn({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.step1).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Link failed');
      expect(result.step3).toBeUndefined(); // Should not execute after error
    });

    test('should handle errors in middleware', async () => {
      const link1 = (ctx) => ({ ...ctx, step1: true });
      const link2 = (ctx) => ({ ...ctx, step2: true });
      
      const goodMiddleware = (ctx) => ({ ...ctx, good: true });
      const errorMiddleware = () => {
        throw new Error('Middleware failed');
      };
      
      const chainFn = chain(link1, link2)
        .use(goodMiddleware, errorMiddleware);
      
      const result = await chainFn({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.step1).toBe(true);
      expect(result.good).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Middleware failed');
      expect(result.step2).toBeUndefined(); // Should not execute after middleware error
    });

    test('should stop middleware execution on error', async () => {
      const executionOrder = [];
      
      const link1 = (ctx) => {
        executionOrder.push('link1');
        return { ...ctx, step1: true };
      };
      const link2 = (ctx) => {
        executionOrder.push('link2');
        return { ...ctx, step2: true };
      };
      
      const middleware1 = (ctx) => {
        executionOrder.push('middleware1');
        return { ...ctx, middleware1: true };
      };
      const errorMiddleware = () => {
        executionOrder.push('errorMiddleware');
        throw new Error('Middleware error');
      };
      const middleware3 = (ctx) => {
        executionOrder.push('middleware3');
        return { ...ctx, middleware3: true };
      };
      
      const chainFn = chain(link1, link2)
        .use(middleware1, errorMiddleware, middleware3);
      
      await chainFn({ initial: true });
      
      // Should stop at errorMiddleware and not continue to middleware3 or link2
      expect(executionOrder).toEqual([
        'link1', 'middleware1', 'errorMiddleware'
      ]);
    });

    test('should handle async middleware', async () => {
      const link = (ctx) => ({ ...ctx, processed: true });
      
      const asyncMiddleware1 = async (ctx) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { ...ctx, async1: true };
      };
      const syncMiddleware = (ctx) => ({ ...ctx, sync: true });
      const asyncMiddleware2 = async (ctx) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { ...ctx, async2: true };
      };
      
      const chainFn = chain(link)
        .use(asyncMiddleware1, syncMiddleware, asyncMiddleware2);
      
      const result = await chainFn({ initial: true });
      
      expect(result.processed).toBe(true);
      expect(result.async1).toBe(true);
      expect(result.sync).toBe(true);
      expect(result.async2).toBe(true);
    });

    test('should work with empty chain', async () => {
      const chainFn = chain();
      const result = await chainFn({ initial: true });
      
      expect(result.initial).toBe(true);
    });

    test('should work with single link', async () => {
      const singleLink = (ctx) => ({ ...ctx, single: true });
      const chainFn = chain(singleLink);
      const result = await chainFn({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.single).toBe(true);
    });

    test('should preserve context across links and middleware', async () => {
      const link1 = (ctx) => ({ ...ctx, count: (ctx.count || 0) + 1 });
      const link2 = (ctx) => ({ ...ctx, count: ctx.count + 10 });
      
      const middleware = (ctx) => ({ ...ctx, count: ctx.count * 2 });
      
      const chainFn = chain(link1, link2).use(middleware);
      const result = await chainFn({ initial: true });
      
      // Expected: 0 -> 1 (link1) -> 2 (middleware) -> 12 (link2) -> 24 (middleware)
      expect(result.count).toBe(24);
    });

    test('should support future onInput/onOutput methods (warning test)', async () => {
      const link = (ctx) => ({ ...ctx, processed: true });
      const middleware = (ctx) => ({ ...ctx, middleware: true });
      
      // Capture console.warn
      const originalWarn = console.warn;
      const warnMessages = [];
      console.warn = (message) => warnMessages.push(message);
      
      try {
        const chainFn = chain(link)
          .use.onInput(middleware)
          .use.onOutput(middleware);
        
        const result = await chainFn({ initial: true });
        
        expect(result.processed).toBe(true);
        expect(result.middleware).toBe(true);
        expect(warnMessages).toContain('use.onInput() not yet implemented, using default onOutput behavior');
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe('ModuLink Factory', () => {
    test('should create modular chains', async () => {
      const modu = createModulink();
      
      // Register individual links
      modu.registerLink('step1', (ctx) => ({ ...ctx, step1: true }));
      modu.registerLink('step2', async (ctx) => ({ ...ctx, step2: true }));
      
      // Create chain from registered links
      const link1 = modu.getLink('step1');
      const link2 = modu.getLink('step2');
      const chain = modu.createChain(link1, link2);
      
      const result = await chain({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.step1).toBe(true);
      expect(result.step2).toBe(true);
    });

    test('should apply global middleware', async () => {
      const modu = createModulink();
      
      // Add global middleware
      modu.use(async (ctx) => ({ ...ctx, middleware1: true }));
      modu.use(async (ctx) => ({ ...ctx, middleware2: true }));
      
      // Create simple chain
      const link = (ctx) => ({ ...ctx, processed: true });
      const chain = modu.createChain(link);
      
      const result = await chain({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.middleware1).toBe(true);
      expect(result.middleware2).toBe(true);
      expect(result.processed).toBe(true);
    });

    test('should register and use named chains', async () => {
      const modu = createModulink();
      
      const testChain = async (ctx) => ({ ...ctx, namedChain: true });
      modu.registerChain('testChain', testChain);
      
      const retrievedChain = modu.getChain('testChain');
      const result = await retrievedChain({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.namedChain).toBe(true);
    });
  });
});
