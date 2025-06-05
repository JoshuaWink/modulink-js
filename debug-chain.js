import { chain } from './modulink/simple-chain.js';

async function debugChain() {
  console.log('=== Testing Basic Chain ===');
  
  const link1 = (ctx) => {
    console.log('Link1 executing with:', ctx);
    return { ...ctx, link1: true };
  };
  
  const link2 = (ctx) => {
    console.log('Link2 executing with:', ctx);
    return { ...ctx, link2: true };
  };
  
  const chainFn = chain(link1, link2);
  console.log('Chain created');
  
  const result = await chainFn({ initial: true });
  console.log('Chain result:', result);
  
  console.log('\n=== Testing Chain with Middleware ===');
  
  const middleware1 = (ctx) => {
    console.log('Middleware1 executing with:', ctx);
    return { ...ctx, middleware1: true };
  };
  
  const chainWithMiddleware = chain(link1, link2).use(middleware1);
  console.log('Chain with middleware created');
  
  const result2 = await chainWithMiddleware({ initial: true });
  console.log('Chain with middleware result:', result2);
}

debugChain().catch(console.error);
