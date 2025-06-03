/**
 * Microservice Architecture Examples
 * 
 * Real-world examples showing how the clean chain architecture
 * works in microservice and distributed system contexts.
 */

import { 
  chain, 
  logging, 
  performanceTracker, 
  timing, 
  errorHandler,
  when,
  parallel,
  retry
} from '../index.js';
import { createHttpContext } from '../modulink/types.js';

// ============================================================================
// 1. USER SERVICE - Authentication & Authorization
// ============================================================================

console.log('👤 User Service Examples\n');

// Authentication links
function validateJWT(ctx) {
  const token = ctx.headers?.authorization?.replace('Bearer ', '');
  if (!token) {
    return { ...ctx, error: new Error('Missing authentication token') };
  }
  
  // Simulate JWT validation
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return { 
      ...ctx, 
      user: { 
        id: payload.userId, 
        role: payload.role,
        authenticated: true 
      } 
    };
  } catch {
    return { ...ctx, error: new Error('Invalid token format') };
  }
}

function checkPermissions(requiredRole = 'user') {
  return function(ctx) {
    if (!ctx.user?.authenticated) {
      return { ...ctx, error: new Error('User not authenticated') };
    }
    
    const roleHierarchy = { admin: 3, user: 2, guest: 1 };
    const userLevel = roleHierarchy[ctx.user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    
    if (userLevel < requiredLevel) {
      return { ...ctx, error: new Error(`Insufficient permissions. Required: ${requiredRole}`) };
    }
    
    return { ...ctx, authorized: true };
  };
}

function rateLimitCheck(ctx) {
  // Simulate rate limiting
  const userId = ctx.user?.id || 'anonymous';
  const limit = ctx.user?.role === 'admin' ? 1000 : 100;
  
  // Mock rate limit counter
  const currentCount = Math.floor(Math.random() * 120);
  
  if (currentCount > limit) {
    return { ...ctx, error: new Error('Rate limit exceeded') };
  }
  
  return { ...ctx, rateLimitStatus: { current: currentCount, limit } };
}

// Example: User authentication service
async function userAuthExample() {
  console.log('🔐 User Authentication Service:');
  
  // Mock JWT token
  const mockToken = Buffer.from(JSON.stringify({
    userId: 'user123',
    role: 'admin',
    exp: Date.now() + 3600000
  })).toString('base64');
  
  const authRequest = {
    method: 'GET',
    headers: { 
      authorization: `Bearer header.${mockToken}.signature`,
      'user-agent': 'MicroserviceClient/1.0'
    },
    url: '/api/protected-resource'
  };
  
  // Production auth chain (lightweight)
  const prodAuthChain = chain(
    validateJWT,
    checkPermissions('user'),
    rateLimitCheck
  );
  
  // Development auth chain (with observability)
  const devAuthChain = chain(
    validateJWT,
    checkPermissions('user'), 
    rateLimitCheck
  )
    .use.onInput(logging({ level: 'debug', logInput: true }))
    .use(performanceTracker({ trackTimings: true }))
    .use(timing('auth-pipeline'));
  
  // Choose chain based on environment
  const authChain = process.env.NODE_ENV === 'production' ? prodAuthChain : devAuthChain;
  
  const ctx = createHttpContext(authRequest, {});
  const result = await authChain(ctx);
  
  if (result.error) {
    console.log('  ❌ Authentication failed:', result.error.message);
  } else {
    console.log(`  ✅ User authenticated: ${result.user.id} (${result.user.role})`);
    console.log(`  📊 Rate limit: ${result.rateLimitStatus.current}/${result.rateLimitStatus.limit}`);
  }
  
  console.log('');
  return result;
}

// ============================================================================
// 2. ORDER SERVICE - E-commerce Processing
// ============================================================================

console.log('🛒 Order Service Examples\n');

// Order processing links
function validateOrderRequest(ctx) {
  const order = ctx.body;
  
  if (!order?.items?.length) {
    return { ...ctx, error: new Error('Order must contain at least one item') };
  }
  
  if (!order.customerId) {
    return { ...ctx, error: new Error('Customer ID is required') };
  }
  
  return { ...ctx, validatedOrder: order };
}

async function checkInventory(ctx) {
  // Simulate async inventory check
  await new Promise(resolve => setTimeout(resolve, 5));
  
  const items = ctx.validatedOrder.items;
  const inventoryResults = items.map(item => ({
    productId: item.productId,
    requested: item.quantity,
    available: Math.floor(Math.random() * 20) + 5,
    reserved: false
  }));
  
  // Check if all items are available
  const unavailableItems = inventoryResults.filter(
    result => result.available < result.requested
  );
  
  if (unavailableItems.length > 0) {
    return { 
      ...ctx, 
      error: new Error(`Insufficient inventory for: ${unavailableItems.map(i => i.productId).join(', ')}`)
    };
  }
  
  return { ...ctx, inventoryCheck: inventoryResults };
}

async function calculatePricing(ctx) {
  // Simulate async pricing calculation
  await new Promise(resolve => setTimeout(resolve, 3));
  
  const items = ctx.validatedOrder.items;
  const pricing = {
    subtotal: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    tax: 0,
    shipping: 9.99,
    total: 0
  };
  
  pricing.tax = pricing.subtotal * 0.08; // 8% tax
  pricing.total = pricing.subtotal + pricing.tax + pricing.shipping;
  
  return { ...ctx, pricing };
}

async function processPayment(ctx) {
  // Simulate payment processing
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // Simulate payment success/failure
  const success = Math.random() > 0.1; // 90% success rate
  
  if (!success) {
    return { ...ctx, error: new Error('Payment processing failed') };
  }
  
  return { 
    ...ctx, 
    payment: {
      transactionId: `txn_${Date.now()}`,
      amount: ctx.pricing.total,
      status: 'completed',
      processedAt: new Date().toISOString()
    }
  };
}

function createOrderRecord(ctx) {
  return {
    ...ctx,
    order: {
      orderId: `ord_${Date.now()}`,
      customerId: ctx.validatedOrder.customerId,
      items: ctx.validatedOrder.items,
      pricing: ctx.pricing,
      payment: ctx.payment,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    }
  };
}

// Example: Order processing service
async function orderProcessingExample() {
  console.log('📦 Order Processing Service:');
  
  const mockOrder = {
    customerId: 'cust_789',
    items: [
      { productId: 'prod_123', quantity: 2, price: 29.99 },
      { productId: 'prod_456', quantity: 1, price: 19.99 }
    ],
    shippingAddress: {
      street: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101'
    }
  };
  
  // High-throughput order chain (minimal observability)
  const highThroughputChain = chain(
    validateOrderRequest,
    checkInventory,
    calculatePricing,
    processPayment,
    createOrderRecord
  ).use(errorHandler());
  
  // Monitored order chain (with observability)
  const monitoredChain = chain(
    validateOrderRequest,
    checkInventory,
    calculatePricing,
    processPayment,
    createOrderRecord
  )
    .use(performanceTracker({ trackTimings: true, trackMemory: true }))
    .use(timing('order-processing'))
    .use(errorHandler());
  
  // Process order with monitoring
  const ctx = { body: mockOrder };
  const result = await monitoredChain(ctx);
  
  if (result.error) {
    console.log('  ❌ Order processing failed:', result.error.message);
  } else {
    console.log(`  ✅ Order created: ${result.order.orderId}`);
    console.log(`  💰 Total amount: $${result.order.pricing.total.toFixed(2)}`);
    console.log(`  ⚡ Processing time: ${result.timings?.['order-processing']?.duration}ms`);
    console.log(`  🧮 Chain ID: ${result._metadata?.chainId}`);
  }
  
  console.log('');
  return result;
}

// ============================================================================
// 3. NOTIFICATION SERVICE - Multi-channel Communication
// ============================================================================

console.log('📢 Notification Service Examples\n');

// Notification links
function validateNotificationRequest(ctx) {
  const notification = ctx.body;
  
  if (!notification.userId && !notification.email && !notification.phone) {
    return { ...ctx, error: new Error('At least one recipient identifier required') };
  }
  
  if (!notification.message) {
    return { ...ctx, error: new Error('Message content is required') };
  }
  
  return { ...ctx, validatedNotification: notification };
}

function determineChannels(ctx) {
  const notification = ctx.validatedNotification;
  const channels = [];
  
  if (notification.email) channels.push('email');
  if (notification.phone) channels.push('sms');
  if (notification.pushToken) channels.push('push');
  
  // Default to email if user ID provided but no specific channels
  if (channels.length === 0 && notification.userId) {
    channels.push('email');
  }
  
  return { ...ctx, targetChannels: channels };
}

async function sendEmail(ctx) {
  if (!ctx.targetChannels.includes('email')) {
    return ctx;
  }
  
  // Simulate email sending
  await new Promise(resolve => setTimeout(resolve, 8));
  
  return {
    ...ctx,
    emailResult: {
      status: 'sent',
      messageId: `email_${Date.now()}`,
      sentAt: new Date().toISOString()
    }
  };
}

async function sendSMS(ctx) {
  if (!ctx.targetChannels.includes('sms')) {
    return ctx;
  }
  
  // Simulate SMS sending
  await new Promise(resolve => setTimeout(resolve, 5));
  
  return {
    ...ctx,
    smsResult: {
      status: 'sent',
      messageId: `sms_${Date.now()}`,
      sentAt: new Date().toISOString()
    }
  };
}

async function sendPushNotification(ctx) {
  if (!ctx.targetChannels.includes('push')) {
    return ctx;
  }
  
  // Simulate push notification
  await new Promise(resolve => setTimeout(resolve, 3));
  
  return {
    ...ctx,
    pushResult: {
      status: 'sent',
      messageId: `push_${Date.now()}`,
      sentAt: new Date().toISOString()
    }
  };
}

function aggregateResults(ctx) {
  const results = [];
  
  if (ctx.emailResult) results.push(ctx.emailResult);
  if (ctx.smsResult) results.push(ctx.smsResult);
  if (ctx.pushResult) results.push(ctx.pushResult);
  
  return {
    ...ctx,
    notificationResults: {
      totalSent: results.length,
      channels: ctx.targetChannels,
      deliveryResults: results,
      processedAt: new Date().toISOString()
    }
  };
}

// Example: Multi-channel notification service
async function notificationServiceExample() {
  console.log('🔔 Multi-channel Notification Service:');
  
  const mockNotification = {
    userId: 'user_456',
    email: 'user@example.com',
    phone: '+1234567890',
    message: 'Your order has been shipped!',
    priority: 'normal'
  };
  
  // Parallel processing approach
  const parallelNotificationChain = chain(
    validateNotificationRequest,
    determineChannels,
    parallel(sendEmail, sendSMS, sendPushNotification),
    aggregateResults
  )
    .use(performanceTracker({ trackTimings: true }))
    .use(timing('notification-processing'))
    .use(errorHandler());
  
  const ctx = { body: mockNotification };
  const result = await parallelNotificationChain(ctx);
  
  if (result.error) {
    console.log('  ❌ Notification failed:', result.error.message);
  } else {
    const results = result.notificationResults;
    console.log(`  ✅ Notifications sent via ${results.channels.join(', ')}`);
    console.log(`  📊 Total delivered: ${results.totalSent} messages`);
    console.log(`  ⚡ Processing time: ${result.timings?.['notification-processing']?.duration}ms`);
  }
  
  console.log('');
  return result;
}

// ============================================================================
// 4. API GATEWAY - Request Routing & Transformation
// ============================================================================

console.log('🌐 API Gateway Examples\n');

// Gateway links
function parseRequestPath(ctx) {
  const path = ctx.url || ctx.path;
  const pathParts = path.split('/').filter(Boolean);
  
  if (pathParts.length < 2) {
    return { ...ctx, error: new Error('Invalid API path format') };
  }
  
  return {
    ...ctx,
    routingInfo: {
      version: pathParts[0], // e.g., 'v1'
      service: pathParts[1], // e.g., 'users'
      resource: pathParts[2], // e.g., 'profile'
      action: pathParts[3] || 'index'
    }
  };
}

function validateApiVersion(ctx) {
  const supportedVersions = ['v1', 'v2'];
  const version = ctx.routingInfo.version;
  
  if (!supportedVersions.includes(version)) {
    return { ...ctx, error: new Error(`Unsupported API version: ${version}`) };
  }
  
  return ctx;
}

function determineUpstreamService(ctx) {
  const serviceMap = {
    users: 'http://user-service:3001',
    orders: 'http://order-service:3002',
    notifications: 'http://notification-service:3003',
    payments: 'http://payment-service:3004'
  };
  
  const service = ctx.routingInfo.service;
  const upstreamUrl = serviceMap[service];
  
  if (!upstreamUrl) {
    return { ...ctx, error: new Error(`Unknown service: ${service}`) };
  }
  
  return {
    ...ctx,
    upstream: {
      url: upstreamUrl,
      service: service,
      timeout: 5000
    }
  };
}

function transformRequest(ctx) {
  // Add gateway headers
  const headers = {
    ...ctx.headers,
    'X-Gateway-Request-Id': `req_${Date.now()}`,
    'X-Gateway-Version': ctx.routingInfo.version,
    'X-Forwarded-For': ctx.clientIp || '127.0.0.1',
    'X-Request-Start': Date.now().toString()
  };
  
  return {
    ...ctx,
    transformedRequest: {
      method: ctx.method,
      headers,
      body: ctx.body,
      url: `${ctx.upstream.url}/${ctx.routingInfo.resource || ''}`,
      timeout: ctx.upstream.timeout
    }
  };
}

async function proxyToUpstream(ctx) {
  // Simulate upstream service call
  await new Promise(resolve => setTimeout(resolve, 15));
  
  // Mock different response scenarios
  const scenarios = ['success', 'error', 'timeout'];
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  
  switch (scenario) {
    case 'success':
      return {
        ...ctx,
        upstreamResponse: {
          status: 200,
          data: { result: 'Success from upstream service' },
          headers: { 'Content-Type': 'application/json' },
          responseTime: 15
        }
      };
    
    case 'error':
      return {
        ...ctx,
        upstreamResponse: {
          status: 500,
          error: 'Internal server error from upstream',
          responseTime: 10
        }
      };
    
    case 'timeout':
      return {
        ...ctx,
        error: new Error('Upstream service timeout')
      };
    
    default:
      return ctx;
  }
}

function transformResponse(ctx) {
  if (ctx.error) {
    return ctx;
  }
  
  const response = ctx.upstreamResponse;
  
  return {
    ...ctx,
    gatewayResponse: {
      status: response.status,
      data: response.data || { error: response.error },
      headers: {
        ...response.headers,
        'X-Gateway-Response-Time': `${Date.now() - parseInt(ctx.transformedRequest.headers['X-Request-Start'])}ms`,
        'X-Served-By': 'api-gateway'
      }
    }
  };
}

// Example: API Gateway request processing
async function apiGatewayExample() {
  console.log('🚪 API Gateway Request Processing:');
  
  const mockGatewayRequest = {
    method: 'GET',
    url: '/v1/users/profile/settings',
    headers: {
      'authorization': 'Bearer token123',
      'content-type': 'application/json',
      'user-agent': 'ClientApp/1.0'
    },
    clientIp: '192.168.1.100'
  };
  
  // Gateway processing chain with comprehensive observability
  const gatewayChain = chain(
    parseRequestPath,
    validateApiVersion,
    determineUpstreamService,
    transformRequest,
    retry(chain(proxyToUpstream), 2, 500), // Retry upstream calls
    transformResponse
  )
    .use.onInput(logging({ level: 'info', detectFunctionNames: true }))
    .use(performanceTracker({ trackTimings: true, trackMemory: true }))
    .use(timing('gateway-processing'))
    .use(errorHandler());
  
  const result = await gatewayChain(mockGatewayRequest);
  
  if (result.error) {
    console.log('  ❌ Gateway processing failed:', result.error.message);
  } else {
    console.log(`  ✅ Request routed to: ${result.upstream.service}`);
    console.log(`  📡 Upstream status: ${result.upstreamResponse?.status}`);
    console.log(`  ⚡ Total processing time: ${result.timings?.['gateway-processing']?.duration}ms`);
    console.log(`  🔧 Chain ID: ${result._metadata?.chainId}`);
  }
  
  console.log('');
  return result;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runMicroserviceExamples() {
  console.log('🎯 ModuLink Microservice Architecture Examples\n');
  console.log('Demonstrating clean chain architecture in distributed systems\n');
  console.log('═'.repeat(80) + '\n');
  
  try {
    await userAuthExample();
    await orderProcessingExample();
    await notificationServiceExample();
    await apiGatewayExample();
    
    console.log('✅ All microservice examples completed successfully!');
    console.log('\n🎯 Key Microservice Benefits:');
    console.log('  • Clean service boundaries with chain composition');
    console.log('  • Conditional observability per service needs');
    console.log('  • High-performance processing for critical paths');
    console.log('  • Comprehensive monitoring for debugging');
    console.log('  • Easy error handling and resilience patterns');
    
  } catch (error) {
    console.error('❌ Microservice example execution failed:', error.message);
    console.error(error.stack);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMicroserviceExamples();
}

export {
  userAuthExample,
  orderProcessingExample,
  notificationServiceExample,
  apiGatewayExample
};
