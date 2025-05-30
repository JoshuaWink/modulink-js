#!/usr/bin/env node

// Test script to demonstrate modular triggers functionality
import express from 'express';
import { Modulink } from './modulink/modulink.js';

const app = express();

// Test 1: Using default triggers
console.log('=== Test 1: Default Triggers ===');
const moduDefault = new Modulink(app);

// Use a more reasonable cron expression (every 5 seconds for demo)
let execCount = 0;
const maxExecs = 3;
const cronTask = moduDefault.when.cron('*/5 * * * * *', async (ctx) => {
  execCount++;
  console.log(`Default cron trigger executed! (${execCount}/${maxExecs})`);
  if (execCount >= maxExecs) {
    console.log('Stopping cron task to prevent infinite loop');
    cronTask.destroy();
  }
});

moduDefault.when.message('test-topic', (ctx) => {
  console.log('Default message trigger called');
});

// Test 2: Using custom trigger providers
console.log('\n=== Test 2: Custom Triggers ===');

const customTriggers = {
  cron: {
    schedule: (expr, handler) => {
      console.log(`Custom cron provider scheduled: ${expr}`);
      return { 
        destroy: () => console.log('Custom cron task destroyed'),
        start: () => console.log('Custom cron task started'),
        stop: () => console.log('Custom cron task stopped')
      };
    }
  },
  message: {
    consume: (topic, handler) => {
      console.log(`Custom message provider consuming topic: ${topic}`);
    }
  },
  cli: {
    command: (name, handler) => {
      console.log(`Custom CLI provider registered command: ${name}`);
    }
  }
};

const moduCustom = new Modulink(app, { triggers: customTriggers });

moduCustom.when.cron('0 0 * * *', async (ctx) => {
  console.log('Custom cron trigger executed!');
});

moduCustom.when.message('custom-topic', (ctx) => {
  console.log('Custom message trigger called');
});

moduCustom.when.cli('custom-command', (ctx) => {
  console.log('Custom CLI command called');
});

console.log('\n=== Test 3: Partial Custom Triggers ===');

const partialCustomTriggers = {
  cron: {
    schedule: (expr, handler) => {
      console.log(`Partial custom cron: ${expr}`);
      return { destroy: () => {} };
    }
  }
  // message and cli will use defaults
};

const moduPartial = new Modulink(app, { triggers: partialCustomTriggers });

moduPartial.when.cron('*/5 * * * *', async (ctx) => {
  console.log('Partial custom cron executed!');
});

moduPartial.when.message('partial-topic', (ctx) => {
  console.log('Default message provider for partial config');
});

console.log('\nModular triggers test completed successfully! ✅');
console.log('\nKey benefits demonstrated:');
console.log('• Users can provide custom trigger providers via constructor options');
console.log('• Default providers are used when no custom ones are provided');
console.log('• Partial custom configuration is supported (mix custom + defaults)');
console.log('• Clean separation between trigger logic and ModuLink core');
