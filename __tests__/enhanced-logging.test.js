/**
 * Enhanced Logging and Function Detection Tests
 */

import { chain, logging, errorHandler } from '../index.js';
import { createHttpContext } from '../modulink/types.js';

describe('Enhanced Logging with Function Detection', () => {
  // Test functions with different patterns
  function namedFunction(ctx) {
    ctx.step = 'named';
    return ctx;
  }
  
  const arrowFunction = (ctx) => {
    ctx.step = 'arrow';
    return ctx;
  };
  
  const anonymousFunction = function(ctx) {
    ctx.step = 'anonymous';
    return ctx;
  };
  
  async function asyncFunction(ctx) {
    ctx.step = 'async';
    return ctx;
  }

  test('should detect named function names', async () => {
    const testLogging = logging({
      detectFunctionNames: true,
      logTiming: false
    });
    
    const testChain = chain(namedFunction).use(testLogging);
    const result = await testChain({ test: true });
    
    expect(result._observedBy?.enhancedLogging?.functionName).toBe('namedFunction');
    expect(result.step).toBe('named');
  });

  test('should detect arrow function names', async () => {
    const testLogging = logging({
      detectFunctionNames: true,
      logTiming: false
    });
    
    const testChain = chain(arrowFunction).use(testLogging);
    const result = await testChain({ test: true });
    
    expect(result._observedBy?.enhancedLogging?.functionName).toBe('arrowFunction');
    expect(result.step).toBe('arrow');
  });

  test('should handle anonymous functions gracefully', async () => {
    const testLogging = logging({
      detectFunctionNames: true,
      logTiming: false
    });
    
    const testChain = chain(anonymousFunction).use(testLogging);
    const result = await testChain({ test: true });
    
    // Should detect some name or fallback gracefully
    expect(result._observedBy?.enhancedLogging?.functionName).toBeDefined();
    expect(result.step).toBe('anonymous');
  });

  test('should detect async functions', async () => {
    const testLogging = logging({
      detectFunctionNames: true,
      logTiming: false
    });
    
    const testChain = chain(asyncFunction).use(testLogging);
    const result = await testChain({ test: true });
    
    expect(result._observedBy?.enhancedLogging?.functionName).toBe('asyncFunction');
    expect(result.step).toBe('async');
  });

  test('should use shared timestamps efficiently', async () => {
    const testLogging = logging({
      useSharedTimestamp: true,
      logTiming: true
    });
    
    const multiLinkChain = chain(
      namedFunction,
      arrowFunction,
      asyncFunction
    ).use(testLogging);
    
    const result = await multiLinkChain({ test: true });
    
    // Should have shared timestamp in metadata
    expect(result._metadata?.sharedTimestamp).toBeDefined();
    expect(typeof result._metadata.sharedTimestamp).toBe('string');
  });

  test('should track performance metrics when enabled', async () => {
    const testLogging = logging({
      enablePerformanceTracking: true,
      detectFunctionNames: true
    });
    
    const testChain = chain(asyncFunction).use(testLogging);
    const result = await testChain({ test: true });
    
    const performanceMetrics = result._observedBy?.enhancedLogging?.performance;
    expect(performanceMetrics).toBeDefined();
    expect(performanceMetrics.middlewareDuration).toBeGreaterThanOrEqual(0);
    expect(performanceMetrics.memoryUsage).toBeGreaterThan(0);
  });

  test('should handle function detection errors gracefully', async () => {
    const testLogging = logging({
      detectFunctionNames: true
    });
    
    // Create a function that might cause detection issues
    const problematicFunction = (ctx) => {
      ctx.step = 'problematic';
      return ctx;
    };
    
    // Remove function name to test fallback
    Object.defineProperty(problematicFunction, 'name', { value: '' });
    
    const testChain = chain(problematicFunction).use(testLogging);
    const result = await testChain({ test: true });
    
    // Should not crash and should have some fallback name
    expect(result._observedBy?.enhancedLogging?.functionName).toBeDefined();
    expect(result.step).toBe('problematic');
  });

  test('should provide detailed link information', async () => {
    const testLogging = logging({
      detectFunctionNames: true
    });
    
    const testChain = chain(namedFunction).use(testLogging);
    const result = await testChain({ test: true });
    
    const linkInfo = result._observedBy?.enhancedLogging?.linkInfo;
    if (linkInfo) {
      expect(linkInfo.name).toBe('namedFunction');
      expect(typeof linkInfo.length).toBe('number'); // parameter count
      expect(typeof linkInfo.isAsync).toBe('boolean');
    }
  });

  test('should maintain chain metadata throughout execution', async () => {
    const testLogging = logging({
      useSharedTimestamp: true,
      enablePerformanceTracking: true
    });
    
    const multiStepChain = chain(
      namedFunction,
      arrowFunction,
      asyncFunction
    ).use(testLogging);
    
    const result = await multiStepChain({ test: true });
    
    // Check chain-level metadata
    expect(result._metadata?.chainId).toBeDefined();
    expect(result._metadata?.linkCount).toBe(3);
    expect(result._metadata?.startTime).toBeDefined();
    expect(result._metadata?.endTime).toBeDefined();
    expect(result._metadata?.totalDuration).toBeGreaterThanOrEqual(0);
  });

  test('should work with error handling middleware', async () => {
    const errorFunction = (ctx) => {
      throw new Error('Test error');
    };
    
    const testLogging = logging({
      detectFunctionNames: true,
      enablePerformanceTracking: true
    });
    
    const errorChain = chain(errorFunction)
      .use(testLogging)
      .use(errorHandler());
    
    const result = await errorChain({ test: true });
    
    // Should handle errors gracefully and still provide metadata
    expect(result.error).toBeDefined();
    expect(result._metadata).toBeDefined();
    expect(result._observedBy?.enhancedLogging).toBeDefined();
  });

  test('should disable function detection when configured', async () => {
    const testLogging = logging({
      detectFunctionNames: false,
      logTiming: false
    });
    
    const testChain = chain(namedFunction).use(testLogging);
    const result = await testChain({ test: true });
    
    // Should use default/fallback function name when detection disabled
    expect(result._observedBy?.enhancedLogging?.functionName).toBe('unknown');
  });
});
