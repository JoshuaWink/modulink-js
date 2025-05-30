# ModuLink-JS Version Management

This directory contains scripts for managing versions and releases of the ModuLink-JS library.

## Scripts

### `version.js`
Handles semantic version incrementation and documentation updates.

**Usage:**
```bash
# Show current version and options
npm run version

# Increment patch version (1.0.0 → 1.0.1)
npm run version:patch

# Increment minor version (1.0.0 → 1.1.0)
npm run version:minor

# Increment major version (1.0.0 → 2.0.0)
npm run version:major
```

**Features:**
- Updates `package.json` version
- Updates migration documentation with version history
- Creates git tag with version annotation
- Follows semantic versioning standards

### `release.js`
Complete release workflow including testing, versioning, and git operations.

**Usage:**
```bash
# Release with patch increment (default)
npm run release

# Release with specific increment type
npm run release:patch
npm run release:minor
npm run release:major
```

**Workflow:**
1. Checks git working directory status
2. Runs complete test suite
3. Increments version using `version.js`
4. Commits version changes to git
5. Creates annotated git tag
6. Provides next steps for pushing changes

## Semantic Versioning

ModuLink-JS follows [Semantic Versioning](https://semver.org/) (SemVer):

- **PATCH** (1.0.0 → 1.0.1): Bug fixes and small improvements
- **MINOR** (1.0.0 → 1.1.0): New features that are backward compatible
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes that are not backward compatible

## Examples

### Simple Version Increment
```bash
# Just increment version without release workflow
npm run version:patch
```

### Full Release Process
```bash
# Complete release with testing and git operations
npm run release:minor
```

### Force Release (bypass git check)
```bash
# Release even with uncommitted changes
FORCE_RELEASE=yes npm run release
```

## Integration with Git

The scripts automatically:
- Create annotated git tags (e.g., `v1.0.1`)
- Add commit messages in conventional format
- Check for uncommitted changes before release
- Provide instructions for pushing changes

## Output

The scripts provide clear feedback with emojis and color coding:
- ✅ Success messages
- ❌ Error messages  
- ⚠️ Warning messages
- 🔄 Progress indicators
- 📋 Next step instructions

## Error Handling

- Validates increment types (patch/minor/major)
- Checks for git repository presence
- Verifies test suite passes before release
- Handles missing files gracefully
- Provides helpful error messages
