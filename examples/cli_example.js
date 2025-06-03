/**
 * CLI Example - ModuLink System
 * 
 * This example demonstrates how to use ModuLink with Commander.js for CLI applications:
 * - CLI command integration
 * - File processing workflows
 * - Progress tracking
 * - Configuration management
 * - Error handling in CLI context
 */

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  createContext,
  createCliContext,
  chain,
  catchErrors,
  timing,
  when,
  validate,
  transform
} from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File processing functions using ModuLink
async function validateInputDirectory(ctx) {
  console.log('🔍 Validating input directory...');
  
  const inputDir = ctx.input_dir;
  const errors = ctx.errors || [];
  
  if (!inputDir) {
    errors.push({ message: 'Input directory not specified', code: 'INPUT_ERROR' });
    return { ...ctx, errors };
  }
  
  try {
    const stats = await fs.stat(inputDir);
    if (!stats.isDirectory()) {
      errors.push({ message: `Input path is not a directory: ${inputDir}`, code: 'INPUT_ERROR' });
    }
    // Check if directory is readable by trying to read it
    await fs.access(inputDir, fs.constants.R_OK);
  } catch (error) {
    if (error.code === 'ENOENT') {
      errors.push({ message: `Input directory does not exist: ${inputDir}`, code: 'INPUT_ERROR' });
    } else if (error.code === 'EACCES') {
      errors.push({ message: `Input directory is not readable: ${inputDir}`, code: 'INPUT_ERROR' });
    } else {
      errors.push({ message: `Error accessing input directory: ${error.message}`, code: 'INPUT_ERROR' });
    }
  }
  
  return { ...ctx, errors };
}

async function createOutputDirectory(ctx) {
  if (ctx.errors && ctx.errors.length > 0) {
    return ctx;
  }
  
  console.log('📁 Creating output directory...');
  
  const outputDir = ctx.output_dir;
  if (!outputDir) {
    return { ...ctx, errors: [{ message: 'Output directory not specified', code: 'OUTPUT_ERROR' }] };
  }
  
  try {
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`✅ Output directory ready: ${outputDir}`);
    return { ...ctx, output_path: outputDir };
  } catch (error) {
    return { ...ctx, errors: [{ message: `Failed to create output directory: ${error.message}`, code: 'OUTPUT_ERROR' }] };
  }
}

async function scanFiles(ctx) {
  if (ctx.errors && ctx.errors.length > 0) {
    return ctx;
  }
  
  console.log('🔍 Scanning for files...');
  
  const inputDir = ctx.input_dir;
  const filePattern = ctx.file_pattern || '*.txt';
  
  try {
    const files = await fs.readdir(inputDir);
    
    // Simple pattern matching (just extension for now)
    const extension = filePattern.replace('*', '');
    const filteredFiles = files
      .filter(file => file.endsWith(extension))
      .map(file => path.join(inputDir, file));
    
    console.log(`📄 Found ${filteredFiles.length} files to process`);
    
    return {
      ...ctx,
      files: filteredFiles,
      total_files: filteredFiles.length,
      processed_files: 0
    };
  } catch (error) {
    return { ...ctx, errors: [{ message: `Failed to scan files: ${error.message}`, code: 'SCAN_ERROR' }] };
  }
}

async function processFiles(ctx) {
  if (ctx.errors && ctx.errors.length > 0) {
    return ctx;
  }
  
  const files = ctx.files || [];
  const outputDir = ctx.output_dir;
  const processedFiles = [];
  const failedFiles = [];
  
  console.log(`⚙️  Processing ${files.length} files...`);
  
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Simple processing: add timestamp and line count
      const lines = content.split('\n');
      const processedContent = {
        original_file: filePath,
        processed_at: new Date().toISOString(),
        line_count: lines.length,
        word_count: content.split(/\s+/).filter(word => word.length > 0).length,
        character_count: content.length,
        first_10_lines: lines.slice(0, 10)
      };
      
      // Write processed file
      const inputFile = path.parse(filePath);
      const outputFile = path.join(outputDir, `${inputFile.name}_processed.json`);
      
      await fs.writeFile(outputFile, JSON.stringify(processedContent, null, 2));
      
      processedFiles.push({
        input: filePath,
        output: outputFile,
        stats: {
          lines: lines.length,
          words: processedContent.word_count,
          characters: content.length
        }
      });
      
      // Progress indicator
      console.log(`  ✅ [${i + 1}/${files.length}] Processed: ${inputFile.base}`);
      
    } catch (error) {
      failedFiles.push({
        file: filePath,
        error: error.message
      });
      console.log(`  ❌ [${i + 1}/${files.length}] Failed: ${path.basename(filePath)} - ${error.message}`);
    }
  }
  
  return {
    ...ctx,
    processed_files: processedFiles,
    failed_files: failedFiles,
    processing_complete: true
  };
}

async function generateReport(ctx) {
  if (ctx.errors && ctx.errors.length > 0) {
    return ctx;
  }
  
  console.log('📊 Generating report...');
  
  const processedFiles = ctx.processed_files || [];
  const failedFiles = ctx.failed_files || [];
  const outputDir = ctx.output_dir;
  
  // Create summary report
  const report = {
    processing_summary: {
      start_time: ctx.start_time,
      end_time: new Date().toISOString(),
      total_files: processedFiles.length + failedFiles.length,
      successful: processedFiles.length,
      failed: failedFiles.length,
      success_rate: processedFiles.length + failedFiles.length > 0 
        ? (processedFiles.length / (processedFiles.length + failedFiles.length)) * 100 
        : 0
    },
    processed_files: processedFiles,
    failed_files: failedFiles,
    configuration: {
      input_dir: ctx.input_dir,
      output_dir: ctx.output_dir,
      file_pattern: ctx.file_pattern || '*.txt'
    }
  };
  
  // Write report
  const reportFile = path.join(outputDir, 'processing_report.json');
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`📄 Report saved: ${reportFile}`);
  console.log(`📈 Processing complete: ${processedFiles.length} successful, ${failedFiles.length} failed`);
  
  return { ...ctx, report, report_file: reportFile };
}

// Create processing pipeline
const fileProcessingPipeline = chain(
  validateInputDirectory,
  createOutputDirectory,
  scanFiles,
  processFiles,
  generateReport
);

// CLI setup
const program = new Command();

program
  .name('modulink-cli-example')
  .description('ModuLink CLI Example')
  .version('2.0.0');

program
  .command('process')
  .description('Process files in a directory using ModuLink pipeline')
  .requiredOption('-i, --input-dir <path>', 'Input directory containing files to process')
  .requiredOption('-o, --output-dir <path>', 'Output directory for processed files')
  .option('-p, --pattern <pattern>', 'File pattern to match', '*.txt')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (options) => {
    try {
      // Create context for CLI processing
      const ctx = {
        input_dir: options.inputDir,
        output_dir: options.outputDir,
        file_pattern: options.pattern,
        verbose: options.verbose,
        start_time: new Date().toISOString(),
        command: 'process'
      };
      
      console.log('🚀 Starting file processing...');
      console.log(`📂 Input: ${options.inputDir}`);
      console.log(`📁 Output: ${options.outputDir}`);
      console.log(`🔍 Pattern: ${options.pattern}`);
      console.log('-'.repeat(50));
      
      // Run the processing pipeline
      const result = await fileProcessingPipeline(ctx);
      
      // Handle errors
      if (result.errors && result.errors.length > 0) {
        console.log('\n❌ Processing failed with errors:');
        result.errors.forEach(error => {
          console.log(`  - ${error.message} (${error.code})`);
        });
        process.exit(1);
      }
      
      // Success summary
      console.log('\n' + '='.repeat(50));
      console.log('✅ Processing completed successfully!');
      
      const report = result.report || {};
      const summary = report.processing_summary || {};
      
      console.log(`📊 Files processed: ${summary.successful || 0}`);
      console.log(`❌ Files failed: ${summary.failed || 0}`);
      console.log(`📈 Success rate: ${(summary.success_rate || 0).toFixed(1)}%`);
      console.log(`📄 Report saved: ${result.report_file}`);
      
    } catch (error) {
      console.error(`❌ Processing failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Run batch processing from configuration file')
  .requiredOption('-c, --config-file <path>', 'Configuration file (JSON)')
  .action(async (options) => {
    try {
      // Load configuration
      const configData = await fs.readFile(options.configFile, 'utf-8');
      const config = JSON.parse(configData);
      
      console.log(`📋 Loaded configuration from: ${options.configFile}`);
      
      const batches = config.batches || [];
      
      // Process each batch item
      for (let i = 0; i < batches.length; i++) {
        const batchItem = batches[i];
        console.log(`\n🔄 Processing batch ${i + 1}/${batches.length}`);
        console.log(`📂 Input: ${batchItem.input_dir}`);
        console.log(`📁 Output: ${batchItem.output_dir}`);
        
        // Create context for this batch
        const ctx = {
          ...batchItem,
          start_time: new Date().toISOString(),
          command: 'batch',
          batch_number: i + 1
        };
        
        // Run pipeline for this batch
        const result = await fileProcessingPipeline(ctx);
        
        if (result.errors && result.errors.length > 0) {
          console.log(`❌ Batch ${i + 1} failed:`);
          result.errors.forEach(error => {
            console.log(`  - ${error.message}`);
          });
        } else {
          const report = result.report || {};
          const summary = report.processing_summary || {};
          console.log(`✅ Batch ${i + 1} completed: ${summary.successful || 0} files processed`);
        }
      }
      
      console.log(`\n🎉 All ${batches.length} batches completed!`);
      
    } catch (error) {
      console.error(`❌ Batch processing failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze directory structure and file statistics')
  .requiredOption('-i, --input-dir <path>', 'Input directory to analyze')
  .action(async (options) => {
    try {
      // Simple analysis function
      async function analyzeDirectory(ctx) {
        const inputPath = ctx.input_dir;
        
        // Collect statistics
        const stats = {
          total_files: 0,
          total_size: 0,
          file_types: {},
          largest_file: null,
          smallest_file: null
        };
        
        async function processDirectory(dirPath) {
          const items = await fs.readdir(dirPath);
          
          for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stat = await fs.stat(fullPath);
            
            if (stat.isFile()) {
              stats.total_files++;
              const size = stat.size;
              stats.total_size += size;
              
              // Track file types
              const ext = path.extname(item).toLowerCase() || 'no_extension';
              stats.file_types[ext] = (stats.file_types[ext] || 0) + 1;
              
              // Track largest/smallest
              if (!stats.largest_file || size > stats.largest_file.size) {
                stats.largest_file = { path: fullPath, size };
              }
              
              if (!stats.smallest_file || size < stats.smallest_file.size) {
                stats.smallest_file = { path: fullPath, size };
              }
            } else if (stat.isDirectory()) {
              await processDirectory(fullPath);
            }
          }
        }
        
        await processDirectory(inputPath);
        return { ...ctx, analysis: stats };
      }
      
      // Run analysis
      const ctx = { input_dir: options.inputDir };
      const result = await analyzeDirectory(ctx);
      
      // Display results
      const analysis = result.analysis;
      console.log(`📊 Directory Analysis: ${options.inputDir}`);
      console.log('-'.repeat(50));
      console.log(`📄 Total files: ${analysis.total_files}`);
      console.log(`💾 Total size: ${analysis.total_size.toLocaleString()} bytes`);
      console.log('📁 File types:');
      
      Object.entries(analysis.file_types)
        .sort(([,a], [,b]) => b - a)
        .forEach(([ext, count]) => {
          console.log(`  ${ext}: ${count} files`);
        });
      
      if (analysis.largest_file) {
        console.log(`📈 Largest file: ${analysis.largest_file.path} (${analysis.largest_file.size.toLocaleString()} bytes)`);
      }
      
      if (analysis.smallest_file) {
        console.log(`📉 Smallest file: ${analysis.smallest_file.path} (${analysis.smallest_file.size.toLocaleString()} bytes)`);
      }
      
    } catch (error) {
      console.error(`❌ Analysis failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('demo')
  .description('Run a demonstration with sample data')
  .action(async () => {
    try {
      console.log('🎭 ModuLink CLI Demo');
      console.log('='.repeat(50));
      
      // Create temporary demo directory structure
      const { mkdtemp } = await import('fs/promises');
      const { tmpdir } = await import('os');
      
      const tempDir = await mkdtemp(path.join(tmpdir(), 'modulink-demo-'));
      const inputDir = path.join(tempDir, 'input');
      const outputDir = path.join(tempDir, 'output');
      
      // Create demo input directory and files
      await fs.mkdir(inputDir);
      
      // Create sample files
      const sampleFiles = [
        ['sample1.txt', 'Hello ModuLink!\nThis is a sample file.\nLine 3\nLine 4'],
        ['sample2.txt', 'Another sample file\nWith different content\nAnd more lines\nLine 4\nLine 5'],
        ['sample3.txt', 'Short file'],
        ['readme.md', '# Demo\nThis is a markdown file\nNot processed by default pattern']
      ];
      
      for (const [filename, content] of sampleFiles) {
        await fs.writeFile(path.join(inputDir, filename), content);
      }
      
      console.log(`📁 Created demo files in: ${inputDir}`);
      
      // Create context and run pipeline
      const ctx = {
        input_dir: inputDir,
        output_dir: outputDir,
        file_pattern: '*.txt',
        start_time: new Date().toISOString(),
        command: 'demo'
      };
      
      console.log('🚀 Running processing pipeline...');
      const result = await fileProcessingPipeline(ctx);
      
      if (result.errors && result.errors.length > 0) {
        console.log('❌ Demo failed:');
        result.errors.forEach(error => {
          console.log(`  - ${error.message}`);
        });
      } else {
        console.log('✅ Demo completed successfully!');
        
        // Show results
        const report = result.report || {};
        const summary = report.processing_summary || {};
        
        console.log('\n📊 Demo Results:');
        console.log(`  Files processed: ${summary.successful || 0}`);
        console.log(`  Files failed: ${summary.failed || 0}`);
        console.log(`  Output directory: ${outputDir}`);
        
        // List output files
        try {
          const outputFiles = await fs.readdir(outputDir);
          if (outputFiles.length > 0) {
            console.log('\n📄 Generated files:');
            outputFiles.forEach(file => {
              console.log(`  - ${file}`);
            });
          }
        } catch (error) {
          // Output directory might not exist if no files were processed
        }
      }
      
      console.log(`\n🗑️  Demo files created in: ${tempDir}`);
      console.log('   (These will be cleaned up automatically by the OS)');
      
    } catch (error) {
      console.error(`❌ Demo failed: ${error.message}`);
      process.exit(1);
    }
  });

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}
