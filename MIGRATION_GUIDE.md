# Migration Guide: Upgrading to Hybrid Configuration Ledger + Factory Pattern

This guide shows how to migrate existing AI Chat UI modules from the legacy registration pattern to the new hybrid configuration ledger + factory pattern.

## Overview of Changes

The new pattern provides:
- **Configuration Ledger**: Central storage for pipeline configurations
- **Factory Pattern**: Dynamic pipeline creation with caching
- **Component Registry**: Reusable pipeline components
- **Feature Flags**: Environment-specific behavior control
- **Better Performance**: Caching and lazy loading

## Migration Strategy

### Phase 1: Backward Compatibility
The new pattern is fully backward compatible. Existing `registerPipeline()` and `execute()` calls will continue to work.

### Phase 2: Gradual Migration
Migrate modules one by one to the new pattern.

### Phase 3: Full Migration
Remove legacy patterns and use only the new hybrid approach.

## Before & After Examples

### Chat Module Migration

#### Before (Legacy Pattern)
```javascript
// src/chat/chatPipelines.js
export function registerChatPipelines(modu) {
  // Message processing pipeline
  modu.registerPipeline('processMessage', [
    async (ctx) => {
      // Validate message
      if (!ctx.body?.message) {
        ctx.error = { message: 'Message is required', code: 400 };
        return ctx;
      }
      ctx.validatedMessage = ctx.body.message;
      return ctx;
    },
    async (ctx) => {
      // Process with AI
      if (ctx.error) return ctx;
      // ... AI processing logic
      ctx.aiResponse = await processWithAI(ctx.validatedMessage);
      return ctx;
    },
    async (ctx) => {
      // Save to history
      if (ctx.error) return ctx;
      ctx.savedMessage = await saveToHistory(ctx.validatedMessage, ctx.aiResponse);
      return ctx;
    }
  ]);

  // Usage in route
  modu.when.http('/api/chat', ['POST'], async (ctx) => {
    const result = await modu.execute('processMessage', ctx);
    if (result.finalCtx.error) {
      ctx.res.status(result.finalCtx.error.code || 500).json({
        error: result.finalCtx.error.message
      });
    } else {
      ctx.res.json({
        response: result.finalCtx.aiResponse,
        messageId: result.finalCtx.savedMessage.id
      });
    }
    return result.finalCtx;
  });
}
```

#### After (Hybrid Pattern)
```javascript
// src/chat/chatComponents.js
export function registerChatComponents(modu) {
  // Register reusable components
  modu.registerComponent('validateMessage', (params = {}) => async (ctx) => {
    const { field = 'message', required = true } = params;
    
    if (required && !ctx.body?.[field]) {
      ctx.error = { message: `${field} is required`, code: 400 };
      return ctx;
    }
    
    ctx.validatedMessage = ctx.body[field];
    return ctx;
  });

  modu.registerComponent('processWithAI', (params = {}) => async (ctx) => {
    if (ctx.error) return ctx;
    
    const { model = 'default', temperature = 0.7 } = params;
    
    // AI processing logic
    ctx.aiResponse = await processWithAI(ctx.validatedMessage, { model, temperature });
    return ctx;
  });

  modu.registerComponent('saveToHistory', (params = {}) => async (ctx) => {
    if (ctx.error) return ctx;
    
    const { includeMetadata = true } = params;
    
    ctx.savedMessage = await saveToHistory(
      ctx.validatedMessage, 
      ctx.aiResponse,
      includeMetadata ? { model: params.model, timestamp: new Date() } : {}
    );
    return ctx;
  });

  modu.registerComponent('sendChatResponse', () => async (ctx) => {
    if (ctx.error) {
      ctx.res.status(ctx.error.code || 500).json({
        error: ctx.error.message
      });
    } else {
      ctx.res.json({
        response: ctx.aiResponse,
        messageId: ctx.savedMessage?.id,
        timestamp: new Date().toISOString()
      });
    }
    return ctx;
  });
}

// src/chat/chatConfigurations.js
export function configureChatPipelines(modu) {
  // Basic chat pipeline
  modu.configurePipeline('chatBasic', {
    version: '1.0.0',
    description: 'Basic chat message processing',
    errorHandling: 'continue',
    steps: [
      { type: 'component', name: 'validateMessage' },
      { type: 'component', name: 'processWithAI', params: { model: 'gpt-3.5-turbo' } },
      { type: 'component', name: 'saveToHistory' },
      { type: 'component', name: 'sendChatResponse' }
    ]
  });

  // Advanced chat pipeline with different AI model
  modu.configurePipeline('chatAdvanced', {
    version: '1.0.0',
    description: 'Advanced chat with GPT-4',
    errorHandling: 'continue',
    steps: [
      { type: 'component', name: 'validateMessage' },
      { 
        type: 'component', 
        name: 'processWithAI', 
        params: { model: 'gpt-4', temperature: 0.5 } 
      },
      { type: 'component', name: 'saveToHistory', params: { includeMetadata: true } },
      { type: 'component', name: 'sendChatResponse' }
    ]
  });

  // Set feature flags
  modu.setFeatureFlag('advancedChat', true, { environment: 'production' });
}

// src/chat/chatRoutes.js
export function registerChatRoutes(modu) {
  modu.when.http('/api/chat', ['POST'], async (ctx) => {
    // Dynamic pipeline selection based on feature flags
    const useAdvanced = modu.isFeatureEnabled('advancedChat');
    const pipelineName = useAdvanced ? 'chatAdvanced' : 'chatBasic';
    
    // Create and execute pipeline
    const pipeline = modu.createPipeline(pipelineName);
    return await pipeline(ctx);
  });
}
```

### LLM Module Migration

#### Before (Legacy Pattern)
```javascript
// src/llm/llmPipelines.js
export function registerLLMPipelines(modu) {
  modu.registerPipeline('generateCompletion', [
    async (ctx) => {
      // Validate input
      if (!ctx.body?.prompt) {
        ctx.error = { message: 'Prompt is required', code: 400 };
        return ctx;
      }
      return ctx;
    },
    async (ctx) => {
      // Generate completion
      if (ctx.error) return ctx;
      ctx.completion = await generateCompletion(ctx.body.prompt, ctx.body.options);
      return ctx;
    }
  ]);
}
```

#### After (Hybrid Pattern)
```javascript
// src/llm/llmComponents.js
export function registerLLMComponents(modu) {
  modu.registerComponent('validatePrompt', (params = {}) => async (ctx) => {
    const { maxLength = 4000, minLength = 1 } = params;
    
    if (!ctx.body?.prompt) {
      ctx.error = { message: 'Prompt is required', code: 400 };
      return ctx;
    }
    
    if (ctx.body.prompt.length > maxLength) {
      ctx.error = { message: `Prompt too long (max ${maxLength} chars)`, code: 400 };
      return ctx;
    }
    
    if (ctx.body.prompt.length < minLength) {
      ctx.error = { message: `Prompt too short (min ${minLength} chars)`, code: 400 };
      return ctx;
    }
    
    ctx.validatedPrompt = ctx.body.prompt;
    return ctx;
  });

  modu.registerComponent('generateCompletion', (params = {}) => async (ctx) => {
    if (ctx.error) return ctx;
    
    const options = { ...params, ...ctx.body.options };
    ctx.completion = await generateCompletion(ctx.validatedPrompt, options);
    return ctx;
  });

  modu.registerComponent('filterResponse', (params = {}) => async (ctx) => {
    if (ctx.error) return ctx;
    
    const { enableFiltering = true } = params;
    
    if (enableFiltering) {
      ctx.completion = await applyContentFilter(ctx.completion);
    }
    
    return ctx;
  });
}

// src/llm/llmConfigurations.js
export function configureLLMPipelines(modu) {
  // Basic completion pipeline
  modu.configurePipeline('basicCompletion', {
    version: '1.0.0',
    description: 'Basic text completion',
    steps: [
      { type: 'component', name: 'validatePrompt' },
      { type: 'component', name: 'generateCompletion', params: { model: 'gpt-3.5-turbo' } }
    ]
  });

  // Filtered completion pipeline
  modu.configurePipeline('filteredCompletion', {
    version: '1.0.0',
    description: 'Text completion with content filtering',
    steps: [
      { type: 'component', name: 'validatePrompt', params: { maxLength: 2000 } },
      { type: 'component', name: 'generateCompletion', params: { model: 'gpt-4' } },
      { type: 'component', name: 'filterResponse', params: { enableFiltering: true } }
    ]
  });

  // Set environment-specific configurations
  modu.setEnvironmentConfig('production', {
    enableFiltering: true,
    defaultModel: 'gpt-4'
  });

  modu.setEnvironmentConfig('development', {
    enableFiltering: false,
    defaultModel: 'gpt-3.5-turbo'
  });
}
```

## Migration Steps

### Step 1: Install Enhanced ModuLink
The enhanced version is backward compatible, so you can install it without breaking existing functionality.

### Step 2: Register Components
Start by extracting reusable logic into components:

```javascript
// Extract common validation logic
modu.registerComponent('validateRequest', (params) => async (ctx) => {
  // Common validation logic
});

// Extract common response logic
modu.registerComponent('sendResponse', (params) => async (ctx) => {
  // Common response logic
});
```

### Step 3: Configure Pipelines
Convert existing pipeline registrations to configurations:

```javascript
// Instead of registerPipeline with function array
modu.registerPipeline('myPipeline', [fn1, fn2, fn3]);

// Use configurePipeline with component references
modu.configurePipeline('myPipeline', {
  steps: [
    { type: 'component', name: 'component1' },
    { type: 'component', name: 'component2' },
    { type: 'component', name: 'component3' }
  ]
});
```

### Step 4: Update Route Handlers
Replace execute calls with createPipeline:

```javascript
// Instead of
const result = await modu.execute('myPipeline', ctx);

// Use
const pipeline = modu.createPipeline('myPipeline');
const result = await pipeline(ctx);
```

### Step 5: Add Feature Flags
Implement feature flags for gradual rollout:

```javascript
modu.setFeatureFlag('newFeature', true, { environment: 'development' });

// In routes
if (modu.isFeatureEnabled('newFeature')) {
  // Use new pipeline
} else {
  // Use legacy pipeline
}
```

## Benefits After Migration

1. **Reusability**: Components can be shared across different pipelines
2. **Configurability**: Pipelines can be configured without code changes
3. **Performance**: Caching reduces pipeline creation overhead
4. **Testing**: Individual components are easier to test
5. **Monitoring**: Built-in statistics and performance tracking
6. **Feature Control**: Feature flags enable safe rollouts

## Complete Migration Example

Here's how a complete module migration might look:

```javascript
// chat/index.js - Main module file
import { registerChatComponents } from './chatComponents.js';
import { configureChatPipelines } from './chatConfigurations.js';
import { registerChatRoutes } from './chatRoutes.js';

export function initializeChatModule(modu) {
  // Register reusable components
  registerChatComponents(modu);
  
  // Configure pipelines
  configureChatPipelines(modu);
  
  // Register routes
  registerChatRoutes(modu);
  
  console.log('Chat module initialized with hybrid pattern');
}
```

This migration approach allows you to:
- Maintain backward compatibility
- Migrate incrementally
- Test new patterns alongside legacy code
- Roll back easily if needed
- Gain immediate benefits from the new architecture
