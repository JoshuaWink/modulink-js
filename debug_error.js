import { chain, errorHandler } from './index.js';

// Test case to debug error handling
const customHandler = (error, ctx) => {
  console.log('Custom handler called with:', error.message);
  return {
    ...ctx,
    customError: `Custom: ${error.message}`
  };
};

const errorChain = chain(
  async (ctx) => {
    console.log('Before error link, ctx:', ctx);
    throw new Error('Test error');
  }
).use(errorHandler(customHandler));

async function test() {
  console.log('Starting test...');
  const result = await errorChain({ initial: true });
  console.log('Final result:', result);
}

test().catch(console.error);
