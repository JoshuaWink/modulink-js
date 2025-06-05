/**
 * Clean Chain Architecture Tests
 * 
 * Tests for the refactored chain system with proper separation of concerns:
 * - Clean chain execution (no metadata bloat)
 * - Dedicated middleware for observability with internal context systems
 * - Conditional metadata only when explicitly requested
 */

import { jest } from '@jest/globals';
import { 
  createModuLink,
  chain,
  logging, 
  performanceTracker, 
  timing, 
  errorHandler,
  when,
  transform,
  parallel 
} from '../index.js';
import { createHttpContext } from '../modulink/types.js';

describe('Clean Chain Architecture', () => {
  
  // Create ModuLink instance for middleware chain support
  let modu;
  
  beforeEach(() => {
    modu = createModuLink();
  });
  
  // Test helper functions
  function addOne(ctx) {
    return { ...ctx, value: (ctx.value || 0) + 1 };
  }
  
  function addTwo(ctx) {
    return { ...ctx, value: (ctx.value || 0) + 2 };
  }
  
  async function asyncAdd(ctx) {
    await new Promise(resolve => setTimeout(resolve, 1));
    return { ...ctx, value: (ctx.value || 0) + 10 };
  }
  
  function errorLink(ctx) {
    throw new Error('Test error');
  }

  describe('Clean Chain Execution', () => {
    
    test('should execute simple chain without metadata bloat', async () => {
      const simpleChain = chain(addOne, addTwo);
      
      const result = await simpleChain({ value: 0 });
      
      expect(result.value).toBe(3);
      expect(result._metadata).toBeUndefined();
      expect(result._observedBy).toBeUndefined();
      expect(result._performance).toBeUndefined();
    });
    
    test('should handle async links correctly', async () => {
      const asyncChain = chain(addOne, asyncAdd, addTwo);
      
      const result = await asyncChain({ value: 0 });
      
      expect(result.value).toBe(13); // 0 + 1 + 10 + 2
      expect(result._metadata).toBeUndefined();
    });
    
    test('should stop execution on error', async () => {
      const errorChain = chain(addOne, errorLink, addTwo);
      
      const result = await errorChain({ value: 0 });
      
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Test error');
      expect(result.value).toBe(1); // Only first link executed
    });
    
    test('should maintain context through chain', async () => {
      const contextChain = chain(
        (ctx) => ({ ...ctx, step1: true }),
        (ctx) => ({ ...ctx, step2: true }),
        (ctx) => ({ ...ctx, step3: true })
      );
      
      const result = await contextChain({ initial: true });
      
      expect(result.initial).toBe(true);
      expect(result.step1).toBe(true);
      expect(result.step2).toBe(true);
      expect(result.step3).toBe(true);
    });
  });

  describe('Middleware Positioning', () => {
    
    test('should support onInput middleware', async () => {
      const inputOrder = [];
      
      const inputMw1 = (ctx) => {
        inputOrder.push('input1');
        return ctx;
      };
      
      const inputMw2 = (ctx) => {
        inputOrder.push('input2');
        return ctx;
      };
      
      const link = (ctx) => {
        inputOrder.push('link');
        return ctx;
      };
      
      const chainWithInput = chain(link)
        .use.onInput(inputMw1, inputMw2);
      
      await chainWithInput({});
      
      expect(inputOrder).toEqual(['input1', 'input2', 'link']);
    });
    
    test('should support onOutput middleware', async () => {
      const outputOrder = [];
      
      const outputMw1 = (ctx) => {
        outputOrder.push('output1');
        return ctx;
      };
      
      const outputMw2 = (ctx) => {
        outputOrder.push('output2');
        return ctx;
      };
      
      const link = (ctx) => {
        outputOrder.push('link');
        return ctx;
      };
      
      const chainWithOutput = chain(link)
        .use.onOutput(outputMw1, outputMw2);
      
      await chainWithOutput({});
      
      expect(outputOrder).toEqual(['link', 'output1', 'output2']);
    });
    
    test('should support mixed input/output middleware', async () => {
      const executionOrder = [];
      
      const inputMw = (ctx) => {
        executionOrder.push('input');
        return ctx;
      };
      
      const outputMw = (ctx) => {
        executionOrder.push('output');
        return ctx;
      };
      
      const link1 = (ctx) => {
        executionOrder.push('link1');
        return ctx;
      };
      
      const link2 = (ctx) => {
        executionOrder.push('link2');
        return ctx;
      };
      
      const mixedChain = chain(link1, link2)
        .use.onInput(inputMw)
        .use.onOutput(outputMw);
      
      await mixedChain({});
      
      expect(executionOrder).toEqual([
        'input', 'link1', 'output',
        'input', 'link2', 'output'
      ]);
    });
    
    test('should handle middleware errors gracefully', async () => {
      const errorMw = (ctx) => {
        throw new Error('Middleware error');
      };
      
      const link = (ctx) => ({ ...ctx, executed: true });
      
      const chainWithErrorMw = chain(link)
        .use.onInput(errorMw);
      
      const result = await chainWithErrorMw({});
      
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Middleware error');
      expect(result.executed).toBeUndefined(); // Link should not execute
    });
  });

  describe('Performance Tracker Middleware', () => {
    
    test('should only add metadata when performance tracker is used', async () => {
      // Without performance tracker
      const simpleChain = chain(addOne, addTwo);
      const simpleResult = await simpleChain({ value: 0 });
      
      expect(simpleResult._performanceMetrics).toBeUndefined();
      
      // With performance tracker (exposing metrics)
      const trackedChain = chain(addOne, addTwo)
        .use(performanceTracker({ exposeMetrics: true }));
      const trackedResult = await trackedChain({ value: 0 });
      
      expect(trackedResult._performanceMetrics).toBeDefined();
      expect(trackedResult._performanceMetrics.chainId).toBeDefined();
      expect(trackedResult._performanceMetrics.totalExecutions).toBeGreaterThan(0);
    });
    
    test('should track memory when enabled', async () => {
      const memoryTracker = performanceTracker({ 
        trackMemory: true,
        exposeMetrics: true // Need to expose to see the data
      });
      
      const trackedChain = chain(addOne, addTwo)
        .use(memoryTracker);
      
      const result = await trackedChain({ value: 0 });
      
      expect(result._performanceMetrics).toBeDefined();
      expect(result._performanceMetrics.totalExecutions).toBeGreaterThan(0);
    });
    
    test('should have minimal impact when not tracking', async () => {
      const minimalTracker = performanceTracker({ 
        trackTimings: false,
        trackMemory: false,
        generateChainId: false
      });
      
      const chainWithMinimal = chain(addOne, addTwo)
        .use(minimalTracker);
      
      const result = await chainWithMinimal({ value: 0 });
      
      expect(result.value).toBe(3);
      // Debug: Log metadata to see what's actually there
      console.log('Minimal tracker metadata:', result._metadata);
      console.log('Metadata keys:', Object.keys(result._metadata || {}));
      // Should have minimal metadata impact
      expect(Object.keys(result._metadata || {}).length).toBeLessThanOrEqual(1);
    });
  });

  describe('Enhanced Logging Middleware', () => {
    
    test('should detect function names from context', async () => {
      // Capture console output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      function namedFunction(ctx) {
        return { ...ctx, processed: true };
      }
      
      const loggingChain = chain(namedFunction)
        .use(logging({ exposeLogs: true }));
      
      const result = await loggingChain({});
      
      expect(result._loggingMetrics).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('namedFunction')
      );
      
      consoleSpy.mockRestore();
    });
    
    test('should handle anonymous functions gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const anonymousFunction = function(ctx) {
        return { ...ctx, processed: true };
      };
      
      const loggingChain = chain(anonymousFunction)
        .use(logging());
      
      await loggingChain({});
      
      // Should show "anonymous" for unnamed functions
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('anonymous')
      );
      
      consoleSpy.mockRestore();
    });
    
    test('should support different log levels', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const debugLogging = logging({ level: 'debug' });
      const errorLogging = logging({ level: 'error' });
      
      const debugChain = chain(addOne).use(debugLogging);
      const errorChain = chain(addOne).use(errorLogging);
      
      await debugChain({});
      await errorChain({});
      
      // Should have logged with different levels
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Timing Middleware', () => {
    
    test('should track execution timing', async () => {
      const timingMw = timing('test-execution', { exposeTiming: true });
      
      const timedChain = chain(
        async (ctx) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return ctx;
        }
      ).use(timingMw);
      
      const result = await timedChain({});
      
      expect(result.timings).toBeDefined();
      expect(result.timings['test-execution']).toBeDefined();
      expect(result.timings['test-execution'].duration).toBeGreaterThan(0);
      expect(result.timings['test-execution'].timestamp).toBeDefined();
    });
    
    test('should use default label when none provided', async () => {
      const timingMw = timing(undefined, { exposeTiming: true });
      
      const timedChain = chain(addOne).use(timingMw);
      const result = await timedChain({});
      
      expect(result.timings.execution).toBeDefined();
    });
  });

  describe('Integration with Existing Utilities', () => {
    
    test('should work with error handler', async () => {
      const chainWithErrors = chain(addOne, errorLink, addTwo)
        .use(errorHandler())
        .use(logging({ exposeLogs: true }));
      
      const result = await chainWithErrors({ value: 0 });
      
      expect(result.error).toBeDefined();
      expect(result.value).toBe(1);
      expect(result._loggingMetrics).toBeDefined();
    });
    
    test('should work with conditional execution', async () => {
      const conditionalChain = chain(
        addOne,
        when((ctx) => ctx.value > 0, chain(addTwo)),
        (ctx) => ({ ...ctx, final: true })
      ).use(logging({ exposeLogs: true }));
      
      const result = await conditionalChain({ value: 0 });
      
      expect(result.value).toBe(3); // 0 + 1 + 2
      expect(result.final).toBe(true);
      expect(result._loggingMetrics).toBeDefined();
    });
    
    test('should work with transform utility', async () => {
      const transformChain = chain(
        transform((ctx) => ({ ...ctx, transformed: true })),
        addOne
      ).use(performanceTracker({ exposeMetrics: true }));
      
      const result = await transformChain({ value: 5 });
      
      expect(result.value).toBe(6);
      expect(result.transformed).toBe(true);
      expect(result._performanceMetrics).toBeDefined();
    });
    
    test('should work with parallel execution', async () => {
      const parallelChain = chain(
        parallel(
          (ctx) => ({ ...ctx, path1: true }),
          (ctx) => ({ ...ctx, path2: true })
        )
      ).use(logging({ exposeLogs: true })).use(timing({ exposeTiming: true }));
      
      const result = await parallelChain({});
      
      expect(result.path1).toBe(true);
      expect(result.path2).toBe(true);
      expect(result._loggingMetrics).toBeDefined();
      expect(result.timings).toBeDefined();
    });
  });

  describe('Performance and Memory Efficiency', () => {
    
    test('should have minimal overhead for simple chains', async () => {
      const startMemory = process.memoryUsage().heapUsed;
      
      // Execute simple chain many times
      const simpleChain = chain(addOne, addTwo);
      
      for (let i = 0; i < 1000; i++) {
        await simpleChain({ value: i });
      }
      
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;
      
      // Should have minimal memory increase (< 5MB for 1000 executions with garbage collection)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
    
    test('should be performant with multiple middleware', async () => {
      const complexChain = chain(addOne, addTwo, asyncAdd)
        .use.onInput(logging())
        .use.onOutput(performanceTracker())
        .use(timing());
      
      const start = Date.now();
      
      // Execute 100 times
      for (let i = 0; i < 100; i++) {
        await complexChain({ value: i });
      }
      
      const duration = Date.now() - start;
      
      // Should complete 100 executions in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Backward Compatibility', () => {
    
    test('should maintain compatibility with legacy .use() method', async () => {
      const legacyChain = chain(addOne, addTwo)
        .use(logging({ exposeLogs: true }))
        .use(timing({ exposeTiming: true }));
      
      const result = await legacyChain({ value: 0 });
      
      expect(result.value).toBe(3);
      expect(result._loggingMetrics).toBeDefined();
      expect(result.timings).toBeDefined();
    });
    
    test('should work with HTTP context', async () => {
      const httpCtx = createHttpContext({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { test: true }
      });
      
      const httpChain = chain(
        (ctx) => ({ ...ctx, processed: true })
      ).use(logging({ exposeLogs: true }));
      
      const result = await httpChain(httpCtx);
      
      expect(result.processed).toBe(true);
      expect(result.method).toBe('POST');
      expect(result._loggingMetrics).toBeDefined();
    });
  });
});
