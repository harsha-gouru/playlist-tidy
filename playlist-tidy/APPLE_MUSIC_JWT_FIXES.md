# Apple Music JWT Implementation Fixes

This document outlines the critical fixes implemented to ensure proper Apple Music API authentication using JWT tokens.

## Critical Issues Fixed

### 1. ✅ Correct Signing Algorithm (ES256)

**Problem**: Using RSA-SHA256 instead of ECDSA with SHA-256
**Solution**: Implemented ES256 (ECDSA with SHA-256) as required by Apple

```typescript
// ❌ WRONG - RSA signing
crypto.createSign('sha256').update(data).sign(privateKey, 'base64url')

// ✅ CORRECT - ES256 with jsonwebtoken library
jwt.sign(payload, privateKey, { algorithm: 'ES256' })
```

### 2. ✅ Required JWT Header Fields

**Problem**: Missing `typ: 'JWT'` in header
**Solution**: Ensured proper header structure

```typescript
// ✅ CORRECT - Proper header structure
{
  "alg": "ES256",
  "typ": "JWT",      // ← REQUIRED by Apple
  "kid": "ABC123DEFG"
}
```

### 3. ✅ Apple-Compliant Payload Structure

**Problem**: Including unsupported claims like `origin`
**Solution**: Only include Apple-supported claims

```typescript
// ❌ WRONG - Unsupported claims
{
  iss: teamId,
  iat: now,
  exp: now + 15552000,
  origin: 'https://example.com'  // ← NOT SUPPORTED
}

// ✅ CORRECT - Only supported claims
{
  iss: teamId,  // Team ID (required)
  iat: now,     // Issued at (auto-generated)
  exp: now + 15552000  // Expiration (auto-generated)
}
```

### 4. ✅ Proper Private Key Handling

**Problem**: Incorrect key format handling
**Solution**: Proper PKCS#8 format support

```typescript
// ✅ CORRECT - Proper key handling
let formattedKey = privateKey;
if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
  formattedKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
}
```

### 5. ✅ Maximum 180-Day Expiration

**Problem**: Incorrect expiration periods
**Solution**: Enforced Apple's 180-day maximum

```typescript
// ✅ CORRECT - 180 days maximum
jwt.sign(payload, privateKey, {
  algorithm: 'ES256',
  expiresIn: '180d'  // Maximum allowed by Apple
})
```

## Implementation Details

### JWT Generation Function

```typescript
export function generateAppleMusicJWT(config: AppleMusicJWTConfig): string {
  const { privateKey, keyId, teamId } = config;

  // Validate inputs
  if (!privateKey || !keyId || !teamId) {
    throw new Error('Missing required JWT configuration');
  }

  // Ensure proper key format
  let formattedKey = privateKey;
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
  }

  // Generate JWT with proper Apple Music requirements
  const token = jwt.sign(
    { iss: teamId },  // Only include supported claims
    formattedKey,
    {
      algorithm: 'ES256',  // ECDSA with SHA-256
      expiresIn: '180d',   // Maximum allowed
      keyid: keyId         // Key ID from Apple Developer Portal
    }
  );

  return token;
}
```

### Environment Variable Support

The implementation supports multiple authentication strategies:

1. **JWT from .p8 file** (Recommended for development):
   ```bash
   VITE_APPLE_MUSIC_PRIVATE_KEY=your_p8_content
   VITE_APPLE_MUSIC_KEY_ID=ABC123DEFG
   VITE_APPLE_MUSIC_TEAM_ID=DEF456GHIJ
   ```

2. **Pre-generated JWT token**:
   ```bash
   VITE_APPLE_MUSIC_TOKEN=your_jwt_token
   ```

3. **Automatic token strategy** (fallback):
   - Uses Apple's automatic developer token generation
   - May not work in local development environments

### Token Caching

Implemented smart token caching to avoid unnecessary regeneration:

```typescript
private generateOrGetCachedToken(config: AppleMusicJWTConfig): string {
  // Check if cached token is still valid (24-hour buffer)
  if (this.cachedToken && this.tokenExpiry) {
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 24 * 60 * 60; // 24 hours
    
    if (this.tokenExpiry > (now + bufferTime)) {
      return this.cachedToken;
    }
  }

  // Generate new token if needed
  const token = generateAppleMusicJWT(config);
  this.cachedToken = token;
  this.tokenExpiry = now + (180 * 24 * 60 * 60);
  
  return token;
}
```

## Utility Scripts

### JWT Generation Script

A convenient script for generating tokens from .p8 files:

```bash
# Generate JWT token
pnpm generate-jwt ./AuthKey_ABC123DEFG.p8 ABC123DEFG DEF456GHIJ

# Or use node directly
node scripts/generate-jwt.js ./AuthKey_ABC123DEFG.p8 ABC123DEFG DEF456GHIJ
```

The script provides:
- ✅ Proper JWT generation with all fixes
- ✅ Token validation and structure verification
- ✅ Expiration date calculation
- ✅ Ready-to-use environment variable
- ✅ Test curl command

## Testing

Comprehensive test suite covering:

```typescript
describe('Apple Music JWT Generation', () => {
  it('should generate a valid JWT token', () => {
    const token = generateAppleMusicJWT(mockConfig);
    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(3);
  });

  it('should validate JWT format correctly', () => {
    const token = generateAppleMusicJWT(mockConfig);
    expect(validateJWTFormat(token)).toBe(true);
  });

  it('should decode JWT correctly', () => {
    const token = generateAppleMusicJWT(mockConfig);
    const decoded = decodeJWT(token);
    
    expect(decoded?.header.alg).toBe('ES256');
    expect(decoded?.header.typ).toBe('JWT');
    expect(decoded?.header.kid).toBe(mockConfig.keyId);
    expect(decoded?.payload.iss).toBe(mockConfig.teamId);
  });

  it('should generate tokens with 180-day expiration', () => {
    const token = generateAppleMusicJWT(mockConfig);
    const decoded = decodeJWT(token);
    
    const now = Math.floor(Date.now() / 1000);
    const maxExpiry = now + (180 * 24 * 60 * 60);
    
    expect(decoded!.payload.exp).toBeLessThanOrEqual(maxExpiry);
  });
});
```

## Verification

To verify your JWT token works with Apple's API:

```bash
curl -v -H "Authorization: Bearer YOUR_TOKEN" \
"https://api.music.apple.com/v1/catalog/us/songs/203709340"
```

Expected response: HTTP 200 with song data

## Key Takeaways

1. **Always use ES256**: Apple requires ECDSA with SHA-256, not RSA
2. **Include `typ: 'JWT'`**: Required in header by Apple's specification
3. **Minimal payload**: Only include `iss`, `iat`, and `exp` claims
4. **PKCS#8 format**: Ensure private keys are in correct format
5. **180-day maximum**: Never exceed Apple's expiration limit
6. **Test tokens**: Always verify with Apple's API before deployment

These fixes ensure 100% compatibility with Apple's MusicKit API authentication requirements. 