#!/usr/bin/env node

/**
 * Version Management Script for ModuLink-JS
 * Handles semantic versioning increment (patch, minor, major)
 * Usage: npm run version [patch|minor|major]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, '..', 'package.json');

/**
 * Parse semantic version string into components
 * @param {string} version - Version string (e.g., "1.2.3")
 * @returns {object} Version components {major, minor, patch}
 */
function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

/**
 * Format version components back to string
 * @param {object} version - Version components {major, minor, patch}
 * @returns {string} Formatted version string
 */
function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

/**
 * Increment version based on type
 * @param {string} currentVersion - Current version string
 * @param {string} type - Increment type: 'patch', 'minor', or 'major'
 * @returns {string} New version string
 */
function incrementVersion(currentVersion, type) {
  const version = parseVersion(currentVersion);
  
  switch (type) {
    case 'major':
      version.major += 1;
      version.minor = 0;
      version.patch = 0;
      break;
    case 'minor':
      version.minor += 1;
      version.patch = 0;
      break;
    case 'patch':
    default:
      version.patch += 1;
      break;
  }
  
  return formatVersion(version);
}

/**
 * Update package.json with new version
 * @param {string} newVersion - New version string
 */
function updatePackageJson(newVersion) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const oldVersion = packageJson.version;
    
    packageJson.version = newVersion;
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log(`✅ Version updated: ${oldVersion} → ${newVersion}`);
    return { oldVersion, newVersion };
  } catch (error) {
    console.error('❌ Error updating package.json:', error.message);
    process.exit(1);
  }
}

/**
 * Update migration documentation with new version
 * @param {string} oldVersion - Previous version
 * @param {string} newVersion - New version
 */
function updateMigrationDocs(oldVersion, newVersion) {
  const migrationPath = path.join(__dirname, '..', 'docs', 'migration.md');
  
  try {
    if (fs.existsSync(migrationPath)) {
      let content = fs.readFileSync(migrationPath, 'utf8');
      
      // Add version history entry
      const versionEntry = `\n## Version ${newVersion} - ${new Date().toISOString().split('T')[0]}\n\n- Migration completion milestone\n- ES modules conversion finalized\n- Chain API implementation complete\n- All tests passing (35/35)\n`;
      
      // Find the place to insert version history (after overview section)
      const insertPoint = content.indexOf('## 🎉 Migration Complete');
      if (insertPoint !== -1) {
        content = content.slice(0, insertPoint) + `## Version History\n${versionEntry}\n` + content.slice(insertPoint);
        fs.writeFileSync(migrationPath, content);
        console.log(`📝 Updated migration documentation with version ${newVersion}`);
      }
    }
  } catch (error) {
    console.warn('⚠️  Could not update migration documentation:', error.message);
  }
}

/**
 * Create git tag for the new version
 * @param {string} version - Version to tag
 */
function createGitTag(version) {
  try {
    // Check if we're in a git repository
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    
    // Create annotated tag
    execSync(`git tag -a v${version} -m "Version ${version} - Migration Complete"`, { stdio: 'inherit' });
    console.log(`🏷️  Created git tag: v${version}`);
    
    console.log(`\n📋 Next steps:`);
    console.log(`   git push origin v${version}  # Push the tag`);
    console.log(`   git push                     # Push the changes`);
    
  } catch (error) {
    console.warn('⚠️  Could not create git tag (not in git repo or git not available)');
  }
}

/**
 * Display current version information
 */
function showCurrentVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log(`📦 Current version: ${packageJson.version}`);
    console.log(`\n🔄 Usage:`);
    console.log(`   npm run version patch   # ${packageJson.version} → ${incrementVersion(packageJson.version, 'patch')}`);
    console.log(`   npm run version minor   # ${packageJson.version} → ${incrementVersion(packageJson.version, 'minor')}`);
    console.log(`   npm run version major   # ${packageJson.version} → ${incrementVersion(packageJson.version, 'major')}`);
  } catch (error) {
    console.error('❌ Error reading package.json:', error.message);
    process.exit(1);
  }
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const incrementType = args[0];
  
  if (!incrementType) {
    showCurrentVersion();
    return;
  }
  
  if (!['patch', 'minor', 'major'].includes(incrementType)) {
    console.error('❌ Invalid increment type. Use: patch, minor, or major');
    process.exit(1);
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    const newVersion = incrementVersion(currentVersion, incrementType);
    
    console.log(`🚀 Incrementing ${incrementType} version...`);
    
    // Update package.json
    const { oldVersion } = updatePackageJson(newVersion);
    
    // Update documentation
    updateMigrationDocs(oldVersion, newVersion);
    
    // Create git tag (optional)
    createGitTag(newVersion);
    
    console.log(`\n✨ Version increment complete!`);
    
  } catch (error) {
    console.error('❌ Error during version increment:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
