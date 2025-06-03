/**
 * Clean Chain Architecture Examples
 * 
 * Demonstrates the separation of concerns between chain execution and observability:
 * - Simple chains with no metadata bloat
 * - Conditional observability using dedicated middleware
 * - Advanced middleware positioning (onInput/onOutput)
 * - Performance optimization patterns
 * - Real-world use cases
 */

import { 
  chain, 
  logging, 
  performanceTracker, 
  timing, 
  errorHandler,
  when,
  parallel,
  transform,
  retry 
} from '../index.js';
import { createHttpContext, createCliContext } from '../modulink/types.js';

// ============================================================================
// 1. SIMPLE CHAIN EXAMPLES - NO METADATA BLOAT
// ============================================================================

console.log('🔗 1. Simple Chain Examples - Clean Execution\n');

// Basic data processing links
function validateInput(ctx) {
  if (!ctx.data || typeof ctx.data.value !== 'number') {
    return { ...ctx, error: new Error('Invalid input: value must be a number') };
  }
  return { ...ctx, validated: true };
}

function doubleValue(ctx) {
  return { ...ctx, data: { ...ctx.data, value: ctx.data.value * 2 } };
}

function addTen(ctx) {
  return { ...ctx, data: { ...ctx.data, value: ctx.data.value + 10 } };
}

function formatResult(ctx) {
  return { 
    ...ctx, 
    result: {
      originalValue: ctx.data.value / 2 - 10, // reverse calculation
      processedValue: ctx.data.value,
      operations: ['double', 'add_ten']
    }
  };
}

// Example 1: Ultra-light chain - no middleware, no metadata
async function simpleChainExample() {
  console.log('📦 Simple Chain (No Middleware):');
  
  const simpleChain = chain(validateInput, doubleValue, addTen, formatResult);
  
  const result = await simpleChain({ 
    data: { value: 5 } 
  });
  
  console.log('  Input:', { data: { value: 5 } });
  console.log('  Output:', result.result);
  console.log('  Metadata keys:', Object.keys(result).filter(k => k.startsWith('_')).length);
  console.log('  ✅ Zero metadata bloat - pure execution\n');
  
  return result;
}

// ============================================================================
// 2. CONDITIONAL OBSERVABILITY - MIDDLEWARE ONLY WHEN NEEDED
// ============================================================================

console.log('🔍 2. Conditional Observability Examples\n');

// Example 2: Development vs Production chains
async function conditionalObservabilityExample() {
  console.log('🛠️  Development Mode (Full Observability):');
  
  // Development: Full observability
  const devChain = chain(validateInput, doubleValue, addTen, formatResult)
    .use.onInput(logging({ logInput: true, level: 'debug' }))
    .use.onOutput(logging({ logOutput: true, level: 'debug' }))
    .use(performanceTracker({ trackMemory: true, trackTimings: true }))
    .use(timing('dev-processing'));
  
  const devResult = await devChain({ data: { value: 3 } });
  console.log('  Metadata present:', Object.keys(devResult).filter(k => k.startsWith('_')).length > 0);
  console.log('  Performance tracked:', !!devResult._metadata);
  console.log('  Logging captured:', !!devResult._observedBy?.logging);
  console.log('  Timing recorded:', !!devResult.timings);
  
  console.log('\n🚀 Production Mode (Clean Execution):');
  
  // Production: Clean execution
  const prodChain = chain(validateInput, doubleValue, addTen, formatResult);
  
  const prodResult = await prodChain({ data: { value: 3 } });
  console.log('  Metadata present:', Object.keys(prodResult).filter(k => k.startsWith('_')).length > 0);
  console.log('  Clean execution confirmed:', !prodResult._metadata && !prodResult._observedBy);
  console.log('  ✅ Same logic, zero overhead in production\n');
  
  return { devResult, prodResult };
}

// ============================================================================
// 3. MIDDLEWARE POSITIONING EXAMPLES
// ============================================================================

console.log('🎯 3. Advanced Middleware Positioning\n');

// Example 3: Input vs Output middleware positioning
async function middlewarePositioningExample() {
  console.log('🔄 Input/Output Middleware Positioning:');
  
  const executionOrder = [];
  
  // Middleware tracking execution order
  const inputTracker = (label) => (ctx) => {
    executionOrder.push(`input:${label}`);
    return ctx;
  };
  
  const outputTracker = (label) => (ctx) => {
    executionOrder.push(`output:${label}`);
    return ctx;
  };
  
  const linkTracker = (label) => (ctx) => {
    executionOrder.push(`link:${label}`);
    return ctx;
  };
  
  // Chain with positioned middleware
  const positionedChain = chain(
    linkTracker('validate'),
    linkTracker('process')
  )
    .use.onInput(inputTracker('security'), inputTracker('logging'))
    .use.onOutput(outputTracker('metrics'), outputTracker('audit'));
  
  await positionedChain({});
  
  console.log('  Execution order:');
  executionOrder.forEach((step, i) => console.log(`    ${i + 1}. ${step}`));
  console.log('  ✅ Perfect control over middleware execution\n');
  
  return executionOrder;
}

// ============================================================================
// 4. REAL-WORLD USE CASES
// ============================================================================

console.log('🌍 4. Real-World Use Cases\n');

// Example 4: HTTP API processing with conditional middleware
async function httpApiExample() {
  console.log('🌐 HTTP API Processing:');
  
  // Simulate API request
  const mockReq = {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer valid-token' },
    body: { userId: 123, action: 'updateProfile', data: { name: 'John Doe' } }
  };
  
  const mockRes = {
    json: (data) => console.log('    📤 Response:', JSON.stringify(data, null, 2)),
    status: (code) => ({ json: (data) => console.log(`    📤 Error ${code}:`, JSON.stringify(data, null, 2)) })
  };
  
  // API processing links
  function authenticateUser(ctx) {
    const token = ctx.headers?.authorization?.replace('Bearer ', '');
    if (!token || token !== 'valid-token') {
      return { ...ctx, error: new Error('Authentication failed') };
    }
    return { ...ctx, user: { id: ctx.body.userId, authenticated: true } };
  }
  
  function validateApiRequest(ctx) {
    if (!ctx.body?.action || !ctx.body?.data) {
      return { ...ctx, error: new Error('Invalid request format') };
    }
    return { ...ctx, validated: true };
  }
  
  function processUserUpdate(ctx) {
    return { 
      ...ctx, 
      processedData: {
        userId: ctx.user.id,
        updatedFields: ctx.body.data,
        processedAt: new Date().toISOString()
      }
    };
  }
  
  function sendApiResponse(ctx) {
    if (ctx.error) {
      ctx.res.status(400).json({ error: ctx.error.message });
    } else {
      ctx.res.json({ 
        success: true, 
        data: ctx.processedData,
        timestamp: new Date().toISOString()
      });
    }
    return ctx;
  }
  
  // Development API chain (with observability)
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  let apiChain = chain(
    authenticateUser,
    validateApiRequest,
    processUserUpdate,
    sendApiResponse
  );
  
  // Add observability only in development
  if (isDevelopment) {
    apiChain = apiChain
      .use.onInput(logging({ level: 'debug', detectFunctionNames: true }))
      .use(performanceTracker({ trackTimings: true }))
      .use(timing('api-request'));
  }
  
  // Add error handling in all environments
  apiChain = apiChain.use(errorHandler());
  
  const httpCtx = createHttpContext(mockReq, mockRes);
  const result = await apiChain(httpCtx);
  
  console.log('  ✅ API processed with conditional observability\n');
  return result;
}

// Example 5: Data pipeline with performance optimization
async function dataPipelineExample() {
  console.log('⚡ Data Pipeline with Performance Optimization:');
  
  // Simulate data processing links
  async function fetchData(ctx) {
    // Simulate async data fetch
    await new Promise(resolve => setTimeout(resolve, 10));
    return { 
      ...ctx, 
      rawData: [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 }
      ]
    };
  }
  
  function transformData(ctx) {
    return {
      ...ctx,
      transformedData: ctx.rawData.map(item => ({
        ...item,
        value: item.value * 2,
        transformed: true
      }))
    };
  }
  
  function aggregateData(ctx) {
    const total = ctx.transformedData.reduce((sum, item) => sum + item.value, 0);
    return {
      ...ctx,
      aggregatedData: {
        items: ctx.transformedData,
        total,
        count: ctx.transformedData.length,
        average: total / ctx.transformedData.length
      }
    };
  }
  
  // High-performance chain (no middleware)
  console.log('  🏃‍♂️ High-performance mode:');
  const fastChain = chain(fetchData, transformData, aggregateData);
  
  const startTime = Date.now();
  const fastResult = await fastChain({});
  const fastDuration = Date.now() - startTime;
  
  console.log(`    ⚡ Processed in ${fastDuration}ms`);
  console.log(`    📊 Result: ${fastResult.aggregatedData.count} items, total: ${fastResult.aggregatedData.total}`);
  
  // Monitored chain (with observability)
  console.log('  📊 Monitored mode:');
  const monitoredChain = chain(fetchData, transformData, aggregateData)
    .use(performanceTracker({ trackMemory: true, trackTimings: true }))
    .use(timing('data-pipeline'));
  
  const monitoredStartTime = Date.now();
  const monitoredResult = await monitoredChain({});
  const monitoredDuration = Date.now() - monitoredStartTime;
  
  console.log(`    📊 Processed in ${monitoredDuration}ms (overhead: ${monitoredDuration - fastDuration}ms)`);
  console.log(`    🔍 Chain ID: ${monitoredResult._metadata?.chainId}`);
  console.log(`    ⏱️  Pipeline timing: ${monitoredResult.timings?.['data-pipeline']?.duration}ms`);
  console.log('  ✅ Flexible performance/observability trade-off\n');
  
  return { fastResult, monitoredResult, performance: { fastDuration, monitoredDuration } };
}

// Example 6: Error handling and resilience patterns
async function resilienceExample() {
  console.log('🛡️  Error Handling and Resilience:');
  
  let attemptCount = 0;
  
  function unreliableOperation(ctx) {
    attemptCount++;
    if (attemptCount < 3) {
      throw new Error(`Network timeout (attempt ${attemptCount})`);
    }
    return { ...ctx, data: 'Successfully processed after retries' };
  }
  
  function finalizeResult(ctx) {
    return { ...ctx, finalized: true, attempts: attemptCount };
  }
  
  // Resilient chain with retry and error handling
  const resilientChain = chain(
    retry(chain(unreliableOperation), 3, 100), // 3 retries with 100ms delay
    finalizeResult
  ).use(errorHandler())
   .use(logging({ level: 'info', detectFunctionNames: true }));
  
  const result = await resilientChain({ input: 'test data' });
  
  console.log(`  🔄 Operation succeeded after ${result.attempts} attempts`);
  console.log(`  📦 Result: ${result.data}`);
  console.log('  ✅ Robust error handling with clean architecture\n');
  
  return result;
}

// ============================================================================
// 5. PERFORMANCE COMPARISON
// ============================================================================

async function performanceComparisonExample() {
  console.log('🏃‍♂️ Performance Comparison\n');
  
  const iterations = 1000;
  
  // Lightweight chain
  const lightChain = chain(
    (ctx) => ({ ...ctx, step1: true }),
    (ctx) => ({ ...ctx, step2: true }),
    (ctx) => ({ ...ctx, step3: true })
  );
  
  // Heavy observability chain
  const heavyChain = chain(
    (ctx) => ({ ...ctx, step1: true }),
    (ctx) => ({ ...ctx, step2: true }),
    (ctx) => ({ ...ctx, step3: true })
  )
    .use.onInput(logging({ logInput: true, detectFunctionNames: true }))
    .use.onOutput(logging({ logOutput: true }))
    .use(performanceTracker({ trackMemory: true, trackTimings: true }))
    .use(timing('heavy-processing'));
  
  // Benchmark lightweight execution
  const lightStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    await lightChain({ iteration: i });
  }
  const lightDuration = Date.now() - lightStart;
  
  // Benchmark heavy execution (suppress console output)
  const originalLog = console.log;
  console.log = () => {}; // Suppress logging for benchmark
  
  const heavyStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    await heavyChain({ iteration: i });
  }
  const heavyDuration = Date.now() - heavyStart;
  
  console.log = originalLog; // Restore logging
  
  console.log(`📊 Performance Results (${iterations} iterations):`);
  console.log(`  ⚡ Lightweight: ${lightDuration}ms (${(lightDuration/iterations).toFixed(2)}ms per execution)`);
  console.log(`  🔍 With observability: ${heavyDuration}ms (${(heavyDuration/iterations).toFixed(2)}ms per execution)`);
  console.log(`  📈 Overhead: ${((heavyDuration/lightDuration - 1) * 100).toFixed(1)}%`);
  console.log('  ✅ Clear performance/observability trade-off\n');
  
  return { lightDuration, heavyDuration, iterations };
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runAllExamples() {
  console.log('🎯 ModuLink Clean Chain Architecture Examples\n');
  console.log('Demonstrating separation of concerns: execution vs observability\n');
  console.log('═'.repeat(80) + '\n');
  
  try {
    await simpleChainExample();
    await conditionalObservabilityExample();
    await middlewarePositioningExample();
    await httpApiExample();
    await dataPipelineExample();
    await resilienceExample();
    await performanceComparisonExample();
    
    console.log('✅ All examples completed successfully!');
    console.log('\n🎯 Key Takeaways:');
    console.log('  • Simple chains have zero metadata overhead');
    console.log('  • Observability is conditional and explicit');
    console.log('  • Middleware positioning provides precise control');
    console.log('  • Performance/observability trade-offs are clear');
    console.log('  • Real-world patterns are clean and maintainable');
    
  } catch (error) {
    console.error('❌ Example execution failed:', error.message);
    console.error(error.stack);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export {
  simpleChainExample,
  conditionalObservabilityExample,
  middlewarePositioningExample,
  httpApiExample,
  dataPipelineExample,
  resilienceExample,
  performanceComparisonExample
};
