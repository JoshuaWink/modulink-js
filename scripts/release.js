#!/usr/bin/env node

/**
 * Release Script for ModuLink-JS
 * Handles the complete release workflow
 * Usage: npm run release [patch|minor|major]
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Execute command and handle errors
 * @param {string} command - Command to execute
 * @param {string} description - Description for logging
 */
function runCommand(command, description) {
  try {
    console.log(`🔄 ${description}...`);
    execSync(command, { stdio: 'inherit', cwd: path.dirname(__dirname) });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

/**
 * Check if working directory is clean
 */
function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: path.dirname(__dirname) });
    if (status.trim()) {
      console.log('📋 Uncommitted changes detected:');
      console.log(status);
      console.log('\n⚠️  Please commit or stash changes before releasing.');
      
      const response = process.env.FORCE_RELEASE || '';
      if (response.toLowerCase() !== 'yes') {
        console.log('Set FORCE_RELEASE=yes to bypass this check.');
        process.exit(1);
      }
    } else {
      console.log('✅ Working directory is clean');
    }
  } catch (error) {
    console.warn('⚠️  Could not check git status (not in git repo or git not available)');
  }
}

/**
 * Run the complete release workflow
 * @param {string} incrementType - Version increment type
 */
function release(incrementType = 'patch') {
  console.log(`🚀 Starting ModuLink-JS release process (${incrementType} increment)...\n`);
  
  // Step 1: Check git status
  checkGitStatus();
  
  // Step 2: Run tests
  runCommand('npm test', 'Running test suite');
  
  // Step 3: Increment version
  runCommand(`npm run version:${incrementType}`, `Incrementing ${incrementType} version`);
  
  // Step 4: Add changes to git
  try {
    runCommand('git add package.json docs/migration.md', 'Staging version changes');
    
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const newVersion = packageJson.version;
    
    runCommand(`git commit -m "chore: bump version to ${newVersion}"`, 'Committing version changes');
    
    console.log(`\n🎉 Release ${newVersion} prepared!`);
    console.log(`\n📋 Next steps:`);
    console.log(`   git push origin main        # Push changes`);
    console.log(`   git push origin v${newVersion}  # Push tag`);
    console.log(`\n   Or run: git push && git push --tags`);
    
  } catch (error) {
    console.warn('⚠️  Could not commit changes (not in git repo or no changes to commit)');
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    console.log(`\n🎉 Version updated to ${packageJson.version}!`);
  }
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const incrementType = args[0] || 'patch';
  
  if (!['patch', 'minor', 'major'].includes(incrementType)) {
    console.error('❌ Invalid increment type. Use: patch, minor, or major');
    console.log('\n🔄 Usage:');
    console.log('   npm run release        # Patch increment (default)');
    console.log('   npm run release patch  # Patch increment');
    console.log('   npm run release minor  # Minor increment');
    console.log('   npm run release major  # Major increment');
    process.exit(1);
  }
  
  release(incrementType);
}

// Run the script
main();
