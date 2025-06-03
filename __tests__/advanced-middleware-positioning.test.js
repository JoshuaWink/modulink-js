/**
 * Advanced Middleware Positioning System Tests
 * Tests for onInput and onOutput middleware positioning
 */

import { chain, logging, errorHandler } from '../index.js';

describe('Advanced Middleware Positioning System', () => {
  // Test functions
  const linkA = (ctx) => {
    ctx.step = 'a';
    ctx.linkA = true;
    return ctx;
  };

  const linkB = (ctx) => {
    ctx.step = 'b';
    ctx.linkB = true;
    return ctx;
  };

  const inputMiddleware = (ctx) => {
    ctx.inputProcessed = true;
    ctx.inputs = (ctx.inputs || []).concat('input');
    return ctx;
  };

  const outputMiddleware = (ctx) => {
    ctx.outputProcessed = true;
    ctx.outputs = (ctx.outputs || []).concat('output');
    return ctx;
  };

  const globalMiddleware = (ctx) => {
    ctx.globalProcessed = true;
    ctx.globals = (ctx.globals || []).concat('global');
    return ctx;
  };

  test('should support onInput middleware', async () => {
    const testChain = chain(linkA, linkB)
      .use.onInput(inputMiddleware);

    const result = await testChain({ test: true });

    expect(result.inputProcessed).toBe(true);
    expect(result.linkA).toBe(true);
    expect(result.linkB).toBe(true);
    expect(result.inputs).toEqual(['input', 'input']); // Runs before each link
  });

  test('should support onOutput middleware', async () => {
    const testChain = chain(linkA, linkB)
      .use.onOutput(outputMiddleware);

    const result = await testChain({ test: true });

    expect(result.outputProcessed).toBe(true);
    expect(result.linkA).toBe(true);
    expect(result.linkB).toBe(true);
    expect(result.outputs).toEqual(['output', 'output']); // Runs after each link
  });

  test('should support both onInput and onOutput middleware', async () => {
    const testChain = chain(linkA, linkB)
      .use.onInput(inputMiddleware)
      .onOutput(outputMiddleware);

    const result = await testChain({ test: true });

    expect(result.inputProcessed).toBe(true);
    expect(result.outputProcessed).toBe(true);
    expect(result.inputs).toEqual(['input', 'input']);
    expect(result.outputs).toEqual(['output', 'output']);
  });

  test('should support chained middleware registration', async () => {
    const testChain = chain(linkA, linkB)
      .use.onOutput(outputMiddleware)
      .onInput(inputMiddleware)
      .use(globalMiddleware);

    const result = await testChain({ test: true });

    expect(result.inputProcessed).toBe(true);
    expect(result.outputProcessed).toBe(true);
    expect(result.globalProcessed).toBe(true);
    expect(result.inputs).toEqual(['input', 'input']);
    expect(result.outputs).toEqual(['output', 'output']);
    expect(result.globals).toEqual(['global', 'global']);
  });

  test('should execute middleware in correct order: input -> link -> output -> global', async () => {
    const executionOrder = [];

    const trackingInputMw = (ctx) => {
      executionOrder.push('input');
      return ctx;
    };

    const trackingOutputMw = (ctx) => {
      executionOrder.push('output');
      return ctx;
    };

    const trackingGlobalMw = (ctx) => {
      executionOrder.push('global');
      return ctx;
    };

    const trackingLink = (ctx) => {
      executionOrder.push('link');
      return ctx;
    };

    const testChain = chain(trackingLink)
      .use.onInput(trackingInputMw)
      .onOutput(trackingOutputMw)
      .use(trackingGlobalMw);

    await testChain({ test: true });

    expect(executionOrder).toEqual(['input', 'link', 'output', 'global']);
  });

  test('should provide metadata about middleware counts', async () => {
    const testChain = chain(linkA)
      .use.onInput(inputMiddleware, inputMiddleware)
      .onOutput(outputMiddleware)
      .use(globalMiddleware, globalMiddleware, globalMiddleware);

    const result = await testChain({ test: true });

    expect(result._metadata.middlewareCounts).toEqual({
      input: 2,
      output: 1,
      global: 3
    });
  });

  test('should track performance metrics for different middleware phases', async () => {
    const testChain = chain(linkA)
      .use.onInput(inputMiddleware)
      .onOutput(outputMiddleware)
      .use(globalMiddleware);

    const result = await testChain({ test: true });

    expect(result._metadata.performance.inputMiddlewareTimings).toBeDefined();
    expect(result._metadata.performance.outputMiddlewareTimings).toBeDefined();
    expect(result._metadata.performance.globalMiddlewareTimings).toBeDefined();

    expect(result._metadata.performance.inputMiddlewareTimings.length).toBe(1);
    expect(result._metadata.performance.outputMiddlewareTimings.length).toBe(1);
    expect(result._metadata.performance.globalMiddlewareTimings.length).toBe(1);
  });

  test('should stop input middleware chain on error', async () => {
    const errorInputMw = (ctx) => {
      throw new Error('Input middleware error');
    };

    const shouldNotRun = (ctx) => {
      ctx.shouldNotHaveRun = true;
      return ctx;
    };

    const testChain = chain(linkA)
      .use.onInput(errorInputMw, shouldNotRun)
      .use(errorHandler());

    const result = await testChain({ test: true });

    expect(result.error).toBeDefined();
    expect(result.error.message).toBe('Input middleware error');
    expect(result.shouldNotHaveRun).toBeUndefined();
    expect(result.linkA).toBeUndefined(); // Link should not execute after input error
  });

  test('should still run output middleware after link errors', async () => {
    const errorLink = (ctx) => {
      throw new Error('Link error');
    };

    const trackingOutputMw = (ctx) => {
      ctx.outputRanAfterError = true;
      return ctx;
    };

    const testChain = chain(errorLink)
      .use.onOutput(trackingOutputMw)
      .use(errorHandler());

    const result = await testChain({ test: true });

    expect(result.error).toBeDefined();
    expect(result.error.message).toBe('Link error');
    expect(result.outputRanAfterError).toBe(true);
  });

  test('should expose debug information about middleware configuration', () => {
    const testChain = chain(linkA, linkB)
      .use.onInput(inputMiddleware, inputMiddleware)
      .onOutput(outputMiddleware)
      .use(globalMiddleware, globalMiddleware);

    const debugInfo = testChain._debugInfo();

    expect(debugInfo).toEqual({
      linkCount: 2,
      middlewareCounts: {
        input: 2,
        output: 1,
        global: 2
      },
      totalMiddleware: 5
    });
  });

  test('should work with logging middleware and function detection', async () => {
    const testLogging = logging({
      detectFunctionNames: true,
      enablePerformanceTracking: true
    });

    const namedFunction = function testFunction(ctx) {
      ctx.step = 'named';
      return ctx;
    };

    const testChain = chain(namedFunction)
      .use.onInput(testLogging)
      .onOutput(testLogging);

    const result = await testChain({ test: true });

    expect(result._observedBy?.enhancedLogging).toBeDefined();
    expect(result.step).toBe('named');
  });

  test('should handle complex middleware combinations', async () => {
    const mw1 = (ctx) => ({ ...ctx, mw1: true });
    const mw2 = (ctx) => ({ ...ctx, mw2: true });
    const mw3 = (ctx) => ({ ...ctx, mw3: true });
    const mw4 = (ctx) => ({ ...ctx, mw4: true });
    const mw5 = (ctx) => ({ ...ctx, mw5: true });

    const testChain = chain(linkA, linkB)
      .use.onInput(mw1, mw2)
      .onOutput(mw3)
      .use(mw4, mw5);

    const result = await testChain({ test: true });

    expect(result.mw1).toBe(true);
    expect(result.mw2).toBe(true);
    expect(result.mw3).toBe(true);
    expect(result.mw4).toBe(true);
    expect(result.mw5).toBe(true);
    expect(result.linkA).toBe(true);
    expect(result.linkB).toBe(true);
  });
});
