/**
 * Standalone ModuLink Example - No App Framework Required
 * 
 * This demonstrates using ModuLink for non-web scenarios:
 * - CLI scripts
 * - Background workers
 * - File processing
 * - Data pipelines
 */

import { createModuLink, chain } from '../index.js';
import fs from 'fs';
import path from 'path';

// Business logic chains
const validateFile = (ctx) => {
  const { filename } = ctx;
  if (!filename) {
    return { ...ctx, error: new Error('Filename is required') };
  }
  
  if (!fs.existsSync(filename)) {
    return { ...ctx, error: new Error(`File not found: ${filename}`) };
  }
  
  return { ...ctx, validated: true };
};

const readFile = (ctx) => {
  try {
    const content = fs.readFileSync(ctx.filename, 'utf8');
    return { ...ctx, content, size: content.length };
  } catch (error) {
    return { ...ctx, error };
  }
};

const processData = (ctx) => {
  if (ctx.error) return ctx;
  
  const lines = ctx.content.split('\n');
  const wordCount = ctx.content.split(/\s+/).length;
  
  return {
    ...ctx,
    stats: {
      lines: lines.length,
      words: wordCount,
      characters: ctx.content.length,
      size: ctx.size
    }
  };
};

const generateReport = (ctx) => {
  if (ctx.error) return ctx;
  
  const report = {
    file: ctx.filename,
    processed: new Date().toISOString(),
    ...ctx.stats
  };
  
  return { ...ctx, report };
};

// Create processing chain
const fileProcessor = chain(validateFile, readFile, processData, generateReport);

// Create ModuLink instance without app
const modulink = createModuLink();

// Add instance-level middleware
modulink.use(async (ctx, next) => {
  console.log(`[FileProcessor] Starting: ${ctx.filename || 'unknown'}`);
  ctx.startTime = Date.now();
  await next();
});

modulink.use(async (ctx, next) => {
  await next();
  if (ctx.startTime) {
    const duration = Date.now() - ctx.startTime;
    console.log(`[FileProcessor] Completed in ${duration}ms`);
  }
});

// Connect using single parameter pattern
modulink.connect((modulink) => {
  const filename = process.argv[2];
  
  if (!filename) {
    console.error('Usage: node standalone-example.js <filename>');
    process.exit(1);
  }
  
  const ctx = modulink.createContext({ 
    filename,
    type: 'file-processing',
    requestId: Math.random().toString(36).substr(2, 9)
  });
  
  fileProcessor(ctx).then(result => {
    if (result.error) {
      console.error('Error:', result.error.message);
      process.exit(1);
    }
    
    if (result.report) {
      console.log('\n📊 File Analysis Report:');
      console.log('═'.repeat(40));
      console.log(`File: ${result.report.file}`);
      console.log(`Lines: ${result.report.lines}`);
      console.log(`Words: ${result.report.words}`);
      console.log(`Characters: ${result.report.characters}`);
      console.log(`Size: ${result.report.size} bytes`);
      console.log(`Processed: ${result.report.processed}`);
      console.log('═'.repeat(40));
    } else {
      console.log('Processing completed but no report generated');
      console.log('Result:', result);
    }
    
    process.exit(0);
  }).catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
});

// Alternative: Connect using two parameter pattern (app will be null)
/*
modulink.connect((app, modulink) => {
  console.log('App framework:', app); // Will be null
  
  // Same processing logic as above...
});
*/
