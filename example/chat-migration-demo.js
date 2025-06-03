/**
 * Practical Migration Example: AI Chat UI Chat Module
 * 
 * This demonstrates the ModuLink system for chat functionality
 * using chain() for chain creation and context-based processing.
 */

import { createModulink, createHttpContext, chain, when, errorHandler } from '../index.js';
import express from 'express';

// Mock function imports for demo purposes
const mockEnsureAuthenticated = async (ctx) => {
  ctx.user = { id: 123, authenticated: true };
  return ctx;
};

const mockCreateChatSession = async (ctx) => {
  ctx.session = {
    session_uuid: 'session-' + Math.random().toString(36).substr(2, 9),
    created_at: new Date().toISOString()
  };
  return ctx;
};

const mockListChatSessions = async (ctx) => {
  ctx.chatSessions = [
    { session_uuid: 'session-1', created_at: '2024-01-01T00:00:00Z' },
    { session_uuid: 'session-2', created_at: '2024-01-02T00:00:00Z' }
  ];
  return ctx;
};

const mockGetChatMessages = async (ctx) => {
  const sessionId = ctx.params?.sessionId;
  ctx.chatMessages = [
    { message_uuid: 'msg-1', session_uuid: sessionId, role: 'user', content: 'Hello' },
    { message_uuid: 'msg-2', session_uuid: sessionId, role: 'assistant', content: 'Hi there!' }
  ];
  return ctx;
};

const mockPostChatMessage = async (ctx) => {
  const { sessionId } = ctx.params || {};
  const { role, content } = ctx.body || {};
  
  ctx.newMessage = {
    message_uuid: 'msg-' + Math.random().toString(36).substr(2, 9),
    session_uuid: sessionId,
    role,
    content,
    timestamp: new Date().toISOString(),
    order_in_session: 1
  };
  return ctx;
};

// =============================================================================
// ORIGINAL CHAT MODULE (Legacy Pattern)
// =============================================================================

function initializeChatModuleLegacy(app, modulink) {
  console.log('\n=== Legacy Pattern Migration Example ===');
  
  // Original pipeline registrations
  modulink.registerPipeline('createChatSession', [
    mockEnsureAuthenticated,
    mockCreateChatSession,
    async (ctx) => {
      if (ctx.error) {
        console.error('Error in createChatSession:', ctx.error);
        return ctx;
      }
      if (ctx.session && ctx.session.session_uuid) {
        console.log(`Session created: ${ctx.session.session_uuid}`);
        ctx.statusCode = 201;
      }
      return ctx;
    }
  ]);

  modulink.registerPipeline('listChatSessions', [
    mockEnsureAuthenticated,
    mockListChatSessions,
    async (ctx) => {
      if (ctx.error) {
        console.error('Error in listChatSessions:', ctx.error);
      } else if (ctx.chatSessions) {
        console.log(`Found ${ctx.chatSessions.length} sessions`);
        ctx.statusCode = 200;
      }
      return ctx;
    }
  ]);

  modulink.registerPipeline('getChatMessages', [
    mockEnsureAuthenticated,
    mockGetChatMessages,
    async (ctx) => {
      if (ctx.error) {
        console.error('Error in getChatMessages:', ctx.error);
      } else if (ctx.chatMessages) {
        console.log(`Found ${ctx.chatMessages.length} messages`);
        ctx.statusCode = 200;
      }
      return ctx;
    }
  ]);

  modulink.registerPipeline('postChatMessage', [
    mockEnsureAuthenticated,
    mockPostChatMessage,
    async (ctx) => {
      if (ctx.error) {
        console.error('Error in postChatMessage:', ctx.error);
      } else if (ctx.newMessage) {
        console.log(`Message posted: ${ctx.newMessage.message_uuid}`);
        ctx.statusCode = 201;
      }
      return ctx;
    }
  ]);

  // Legacy route registration (simplified)
  app.post('/api/chat/sessions', async (req, res) => {
    try {
      const { finalCtx, responseSent } = await modulink.execute('createChatSession', { req, res });
      if (!responseSent) {
        res.status(finalCtx.statusCode || 500).json({
          success: !finalCtx.error,
          session: finalCtx.session,
          error: finalCtx.error
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('✅ Legacy chat module initialized');
}

// =============================================================================
// MIGRATED CHAT MODULE (Hybrid Pattern)
// =============================================================================

function initializeChatModuleHybrid(app, modulink) {
  console.log('\n=== Hybrid Pattern Migration Example ===');
  
  // Step 1: Register reusable components
  registerChatComponents(modulink);
  
  // Step 2: Configure pipeline templates
  configureChatPipelines(modulink);
  
  // Step 3: Set feature flags and environment configs
  setupChatEnvironment(modulink);
  
  // Step 4: Register routes using new pattern
  registerChatRoutes(app, modulink);
  
  console.log('✅ Hybrid chat module initialized');
}

function registerChatComponents(modulink) {
  // Authentication component
  modulink.registerComponent('ensureAuthenticated', () => mockEnsureAuthenticated);
  
  // Session management components
  modulink.registerComponent('createSession', (params = {}) => async (ctx) => {
    const result = await mockCreateChatSession(ctx);
    if (params.trackMetrics) {
      console.log(`Session creation metrics: ${JSON.stringify(params)}`);
    }
    return result;
  });
  
  modulink.registerComponent('listSessions', (params = {}) => async (ctx) => {
    const result = await mockListChatSessions(ctx);
    if (params.limit) {
      result.chatSessions = result.chatSessions.slice(0, params.limit);
    }
    return result;
  });
  
  // Message management components
  modulink.registerComponent('getMessages', (params = {}) => async (ctx) => {
    const result = await mockGetChatMessages(ctx);
    if (params.includeMetadata) {
      result.chatMessages = result.chatMessages.map(msg => ({
        ...msg,
        metadata: { retrieved_at: new Date().toISOString() }
      }));
    }
    return result;
  });
  
  modulink.registerComponent('postMessage', (params = {}) => async (ctx) => {
    const result = await mockPostChatMessage(ctx);
    if (params.autoRespond) {
      // Simulate AI response
      result.aiResponse = {
        message_uuid: 'ai-' + Math.random().toString(36).substr(2, 9),
        session_uuid: result.newMessage.session_uuid,
        role: 'assistant',
        content: 'This is an AI response to: ' + result.newMessage.content,
        timestamp: new Date().toISOString()
      };
    }
    return result;
  });
  
  // Validation components
  modulink.registerComponent('validateChatRequest', (params = {}) => async (ctx) => {
    const { requiredFields = [] } = params;
    
    for (const field of requiredFields) {
      if (!ctx.body?.[field]) {
        ctx.error = { message: `${field} is required`, code: 400 };
        return ctx;
      }
    }
    
    // Role validation for messages
    if (ctx.body?.role && !['user', 'assistant', 'system'].includes(ctx.body.role)) {
      ctx.error = { message: 'Invalid role', code: 400 };
      return ctx;
    }
    
    return ctx;
  });
  
  // Logging and response components
  modulink.registerComponent('logChatActivity', (params = {}) => async (ctx) => {
    const { operation = 'unknown' } = params;
    
    if (ctx.error) {
      console.error(`Error in ${operation}:`, ctx.error);
    } else {
      const success = ctx.session || ctx.chatSessions || ctx.chatMessages || ctx.newMessage;
      if (success) {
        console.log(`✅ ${operation} completed successfully`);
        ctx.statusCode = params.successCode || 200;
      }
    }
    return ctx;
  });
  
  modulink.registerComponent('sendChatResponse', (params = {}) => async (ctx) => {
    const { format = 'standard' } = params;
    
    if (ctx.error) {
      ctx.res.status(ctx.error.code || 500).json({
        success: false,
        error: ctx.error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      let responseData = {};
      
      if (ctx.session) responseData.session = ctx.session;
      if (ctx.chatSessions) responseData.sessions = ctx.chatSessions;
      if (ctx.chatMessages) responseData.messages = ctx.chatMessages;
      if (ctx.newMessage) responseData.message = ctx.newMessage;
      if (ctx.aiResponse) responseData.aiResponse = ctx.aiResponse;
      
      if (format === 'enhanced') {
        responseData.metadata = {
          timestamp: new Date().toISOString(),
          version: '2.0.0',
          requestId: Math.random().toString(36).substr(2, 9)
        };
      }
      
      ctx.res.status(ctx.statusCode || 200).json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString()
      });
    }
    
    return ctx;
  });
}

function configureChatPipelines(modulink) {
  // Basic session creation pipeline
  modulink.configurePipeline('createChatSessionBasic', {
    version: '1.0.0',
    description: 'Basic chat session creation',
    errorHandling: 'continue',
    steps: [
      { type: 'component', name: 'ensureAuthenticated' },
      { type: 'component', name: 'createSession' },
      { 
        type: 'component', 
        name: 'logChatActivity', 
        params: { operation: 'createSession', successCode: 201 } 
      },
      { type: 'component', name: 'sendChatResponse' }
    ]
  });
  
  // Enhanced session creation with metrics
  modulink.configurePipeline('createChatSessionEnhanced', {
    version: '2.0.0',
    description: 'Enhanced chat session creation with metrics',
    errorHandling: 'continue',
    steps: [
      { type: 'component', name: 'ensureAuthenticated' },
      { 
        type: 'component', 
        name: 'createSession', 
        params: { trackMetrics: true } 
      },
      { 
        type: 'component', 
        name: 'logChatActivity', 
        params: { operation: 'createSession', successCode: 201 } 
      },
      { 
        type: 'component', 
        name: 'sendChatResponse', 
        params: { format: 'enhanced' } 
      }
    ]
  });
  
  // Session listing pipeline
  modulink.configurePipeline('listChatSessions', {
    version: '1.0.0',
    description: 'List chat sessions',
    errorHandling: 'continue',
    steps: [
      { type: 'component', name: 'ensureAuthenticated' },
      { type: 'component', name: 'listSessions' },
      { 
        type: 'component', 
        name: 'logChatActivity', 
        params: { operation: 'listSessions' } 
      },
      { type: 'component', name: 'sendChatResponse' }
    ]
  });
  
  // Message retrieval pipeline
  modulink.configurePipeline('getChatMessages', {
    version: '1.0.0',
    description: 'Get chat messages',
    errorHandling: 'continue',
    steps: [
      { type: 'component', name: 'ensureAuthenticated' },
      { type: 'component', name: 'getMessages' },
      { 
        type: 'component', 
        name: 'logChatActivity', 
        params: { operation: 'getMessages' } 
      },
      { type: 'component', name: 'sendChatResponse' }
    ]
  });
  
  // Basic message posting
  modulink.configurePipeline('postChatMessageBasic', {
    version: '1.0.0',
    description: 'Basic message posting',
    errorHandling: 'continue',
    steps: [
      { type: 'component', name: 'ensureAuthenticated' },
      { 
        type: 'component', 
        name: 'validateChatRequest', 
        params: { requiredFields: ['role', 'content'] } 
      },
      { type: 'component', name: 'postMessage' },
      { 
        type: 'component', 
        name: 'logChatActivity', 
        params: { operation: 'postMessage', successCode: 201 } 
      },
      { type: 'component', name: 'sendChatResponse' }
    ]
  });
  
  // AI-enhanced message posting
  modulink.configurePipeline('postChatMessageAI', {
    version: '2.0.0',
    description: 'AI-enhanced message posting',
    errorHandling: 'continue',
    steps: [
      { type: 'component', name: 'ensureAuthenticated' },
      { 
        type: 'component', 
        name: 'validateChatRequest', 
        params: { requiredFields: ['role', 'content'] } 
      },
      { 
        type: 'component', 
        name: 'postMessage', 
        params: { autoRespond: true } 
      },
      { 
        type: 'component', 
        name: 'logChatActivity', 
        params: { operation: 'postMessageAI', successCode: 201 } 
      },
      { 
        type: 'component', 
        name: 'sendChatResponse', 
        params: { format: 'enhanced' } 
      }
    ]
  });
}

function setupChatEnvironment(modulink) {
  // Feature flags
  modulink.setFeatureFlag('enhancedSessions', true, { environment: 'development' });
  modulink.setFeatureFlag('aiResponses', true, { environment: 'production' });
  modulink.setFeatureFlag('detailedLogging', true, { environment: 'development' });
  
  // Environment-specific configurations
  modulink.setEnvironmentConfig('development', {
    sessionEnhancements: true,
    aiAutoRespond: false,
    logLevel: 'debug'
  });
  
  modulink.setEnvironmentConfig('production', {
    sessionEnhancements: false,
    aiAutoRespond: true,
    logLevel: 'error'
  });
}

function registerChatRoutes(app, modulink) {
  // Create chat session - dynamic pipeline selection
  app.post('/api/chat/sessions', async (req, res) => {
    try {
      const useEnhanced = modulink.isFeatureEnabled('enhancedSessions');
      const pipelineName = useEnhanced ? 'createChatSessionEnhanced' : 'createChatSessionBasic';
      
      const pipeline = modulink.createPipeline(pipelineName);
      await pipeline({ req, res });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });
  
  // List chat sessions
  app.get('/api/chat/sessions', async (req, res) => {
    try {
      const pipeline = modulink.createPipeline('listChatSessions');
      await pipeline({ req, res });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });
  
  // Get chat messages
  app.get('/api/chat/sessions/:sessionId/messages', async (req, res) => {
    try {
      const pipeline = modulink.createPipeline('getChatMessages');
      await pipeline({ req, res, params: req.params });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });
  
  // Post chat message - dynamic pipeline selection
  app.post('/api/chat/sessions/:sessionId/messages', async (req, res) => {
    try {
      const useAI = modulink.isFeatureEnabled('aiResponses');
      const pipelineName = useAI ? 'postChatMessageAI' : 'postChatMessageBasic';
      
      const pipeline = modulink.createPipeline(pipelineName);
      await pipeline({ req, res, params: req.params, body: req.body });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });
  
  // Statistics endpoint
  app.get('/api/chat/stats', async (req, res) => {
    try {
      const stats = modulink.getStatistics();
      res.json({
        pipelineStatistics: stats,
        featureFlags: {
          enhancedSessions: modulink.isFeatureEnabled('enhancedSessions'),
          aiResponses: modulink.isFeatureEnabled('aiResponses'),
          detailedLogging: modulink.isFeatureEnabled('detailedLogging')
        },
        cacheInfo: 'Cache statistics available via modulink.getStatistics()'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// =============================================================================
// DEMO EXECUTION
// =============================================================================

async function runMigrationDemo() {
  console.log('🚀 ModuLink Chat Module Migration Demo');
  console.log('=====================================');
  
  const app = express();
  app.use(express.json());
  
  // Initialize ModuLink instances for comparison
  const modulinkLegacy = createModulink();
  const modulinkHybrid = createModulink();
  
  // Set up legacy pattern (now using ModuLink)
  initializeChatModuleLegacy(app, modulinkLegacy);
  
  // Set up hybrid pattern
  initializeChatModuleHybrid(app, modulinkHybrid);
  
  // Test legacy pattern
  console.log('\n=== Testing ModuLink Pattern ===');
  try {
    const legacyResult = await modulinkLegacy.execute('createChatSession', {
      req: { body: {} },
      res: { 
        status: (code) => ({ 
          json: (data) => console.log('Legacy Response:', { code, data }) 
        }) 
      }
    });
    console.log('Legacy execution completed');
  } catch (error) {
    console.error('Legacy error:', error.message);
  }
  
  // Test hybrid pattern
  console.log('\n=== Testing Hybrid Pattern ===');
  try {
    const createSessionPipeline = modulinkHybrid.createPipeline('createChatSessionEnhanced');
    const hybridResult = await createSessionPipeline({
      req: { body: {} },
      res: { 
        status: (code) => ({ 
          json: (data) => console.log('Hybrid Response:', { code, data }) 
        }) 
      }
    });
    console.log('Hybrid execution completed');
  } catch (error) {
    console.error('Hybrid error:', error.message);
  }
  
  // Show statistics
  console.log('\n=== Pipeline Statistics ===');
  const stats = modulinkHybrid.getStatistics();
  console.log('Cache statistics:', stats);
  
  console.log('\n=== Migration Benefits Demonstrated ===');
  console.log('✅ Component reusability across pipelines');
  console.log('✅ Dynamic pipeline selection via feature flags');
  console.log('✅ Environment-specific configurations');
  console.log('✅ Pipeline caching and performance tracking');
  console.log('✅ Parameterized component instantiation');
  console.log('✅ Backward compatibility maintained');
  
  return { modulinkLegacy, modulinkHybrid };
}

// Run the demo
runMigrationDemo().catch(console.error);

export { runMigrationDemo, initializeChatModuleLegacy, initializeChatModuleHybrid };
