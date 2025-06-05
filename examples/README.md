# ModuLink Examples - Full Discussion Implementation

This directory contains a complete implementation of the ModuLink pattern described in `docs/full-discussion.md`.

## Overview

The implementation demonstrates the new pattern where:

1. **Links** are simple `async (ctx) => ctx` functions
2. **Chains** compose links with middleware using `chain(...links).use(...middleware)`
3. **Instance middleware** runs before any chain-level middleware
4. **`connect()` immediately executes** connection functions to wire routes/cron/CLI

## Files

- `links.js` - Individual link functions for various operations
- `userSignupChain.js` - Composes signup links with timing middleware
- `cleanupChain.js` - Composes cleanup links for cron jobs
- `importDataChain.js` - Composes data import links for CLI
- `app.js` - Express app setup with ModuLink instance and global middleware
- `connect.js` - Helper functions for connecting chains to HTTP/cron/CLI
- `index.js` - Main entry point that wires everything together

## Usage

### Start the HTTP Server

```bash
cd examples
node index.js
```

This will start the server on http://localhost:3000 with:
- POST /api/signup endpoint
- Daily cron job for cleanup
- CLI command registration

### Test the HTTP Endpoint

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Run CLI Commands

```bash
node index.js import-data --filename test.json
```

## Key Features Demonstrated

1. **Immediate Connect Execution**: Routes/cron/CLI are registered as soon as `connect()` is called
2. **Instance Middleware**: Global logging and error handling that runs before all chains
3. **Chain Middleware**: Timing middleware that runs for specific chains
4. **Modular Links**: Individual functions that can be reused across different chains
5. **Context Flow**: Rich context objects that flow through the entire pipeline

## Architecture

```
Instance Middleware → Chain Middleware → Links
       ↓                    ↓            ↓
   globalLogger       timingMiddleware   validateInputLink
   globalErrorCatcher                    createUserLink
                                        sendWelcomeEmailLink
```

This demonstrates the complete "links → chain → middleware → connect → app" flow described in the full discussion document.
