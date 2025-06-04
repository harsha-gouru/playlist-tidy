# Browser Compatibility Fix for JWT Handling

## Problem

The `jsonwebtoken` library is a Node.js-specific library that cannot run in the browser because it depends on Node.js modules like `buffer`, `crypto`, and `fs`. When trying to use it in the browser, you get errors like:

```
Module "buffer" has been externalized for browser compatibility. Cannot access "buffer.Buffer" in client code.
Uncaught TypeError: Cannot read properties of undefined (reading 'from')
```

## Solution

We've split the JWT functionality into two parts:

### 1. Server-Side JWT Generation (`src/lib/jwt.ts`)
- Uses the full `jsonwebtoken` library
- Handles JWT token generation with proper ECDSA signing
- Only runs in Node.js environment (tests and utility scripts)

### 2. Browser-Compatible JWT Utilities (`src/lib/jwt-browser.ts`)
- Pure JavaScript implementation using browser APIs
- Handles JWT decoding, validation, and expiration checking
- No external dependencies
- Runs in the browser

## Implementation Details

### Browser-Compatible Functions

```typescript
// Validates JWT format without signature verification
export function validateJWTFormat(token: string): boolean

// Decodes JWT header and payload using atob()
export function decodeJWT(token: string): { header: any; payload: any } | null

// Checks if token is expired
export function isJWTExpired(token: string): boolean

// Gets detailed expiration information
export function getTokenExpirationInfo(token: string): {
  isExpired: boolean;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
}
```

### Updated Apple Music API

The `AppleMusicAPI` class now:
- ✅ Only accepts pre-generated JWT tokens via `VITE_APPLE_MUSIC_TOKEN`
- ✅ Uses browser-compatible JWT utilities for token validation
- ✅ Provides helpful logging about token expiration
- ✅ Falls back to automatic token strategy if no token provided

### JWT Generation Workflow

1. **Generate JWT server-side** using the utility script:
   ```bash
   pnpm generate-jwt ./AuthKey_ABC123DEFG.p8 ABC123DEFG DEF456GHIJ
   ```

2. **Copy the generated token** to your `.env` file:
   ```bash
   VITE_APPLE_MUSIC_TOKEN=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkFCQzEyM0RFRkcifQ...
   ```

3. **Browser validates and uses** the token without needing to generate it

## Vite Configuration

Updated `vite.config.ts` to exclude Node.js-specific libraries:

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['jsonwebtoken', 'fs', 'crypto', 'buffer']
    }
  },
  optimizeDeps: {
    exclude: ['jsonwebtoken']
  }
})
```

## Benefits

1. **✅ Browser Compatibility**: No more Node.js dependency errors
2. **✅ Security**: JWT generation happens server-side only
3. **✅ Performance**: Smaller bundle size (no Node.js polyfills)
4. **✅ Maintainability**: Clear separation of concerns
5. **✅ Testing**: Both server and browser code can be tested

## Testing

All tests continue to pass:
- Server-side JWT generation tests use the full `jsonwebtoken` library
- Browser-compatible utilities are tested with real JWT tokens
- Apple Music API integration works with pre-generated tokens

## Migration Guide

### Before (Broken in Browser)
```typescript
// ❌ This doesn't work in browser
import { generateAppleMusicJWT } from './jwt';

// Client-side JWT generation (fails)
const token = generateAppleMusicJWT({ privateKey, keyId, teamId });
```

### After (Browser Compatible)
```typescript
// ✅ This works in browser
import { isJWTExpired, getTokenExpirationInfo } from './jwt-browser';

// Use pre-generated token
const token = import.meta.env.VITE_APPLE_MUSIC_TOKEN;
if (isJWTExpired(token)) {
  console.warn('Token expired, please generate a new one');
}
```

## Key Takeaways

1. **JWT Generation**: Always do this server-side or via Node.js scripts
2. **JWT Validation**: Can be done client-side with pure JavaScript
3. **Environment Variables**: Use `VITE_APPLE_MUSIC_TOKEN` for pre-generated tokens
4. **Token Management**: Monitor expiration and regenerate as needed
5. **Security**: Never expose private keys to the browser

This approach ensures maximum compatibility while maintaining security and functionality. 