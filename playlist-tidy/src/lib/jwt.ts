import jwt from 'jsonwebtoken';

export interface AppleMusicJWTConfig {
  privateKey: string;
  keyId: string;
  teamId: string;
}

/**
 * Generates a properly signed JWT token for Apple Music API
 * 
 * Key fixes implemented:
 * 1. Uses ES256 (ECDSA with SHA-256) algorithm as required by Apple
 * 2. Includes required 'typ: JWT' header field
 * 3. Uses only Apple-supported payload claims (iss, iat, exp)
 * 4. Proper private key handling for ECDSA
 * 5. Maximum 180-day expiration as per Apple's requirements
 */
export function generateAppleMusicJWT(config: AppleMusicJWTConfig): string {
  const { privateKey, keyId, teamId } = config;

  // Validate inputs
  if (!privateKey || !keyId || !teamId) {
    throw new Error('Missing required JWT configuration: privateKey, keyId, and teamId are all required');
  }

  // Ensure private key is in correct format
  let formattedKey = privateKey;
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    // If it's just the key content, wrap it properly
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
  }

  try {
    // Generate JWT with proper Apple Music requirements
    const token = jwt.sign(
      {
        // Only include Apple-supported claims
        iss: teamId, // Issuer (Team ID)
        // iat and exp are automatically added by jsonwebtoken
      },
      formattedKey,
      {
        algorithm: 'ES256', // ECDSA with SHA-256 (required by Apple)
        expiresIn: '180d',  // Maximum allowed by Apple (180 days)
        keyid: keyId        // Key ID from Apple Developer Portal
      }
    );

    return token;
  } catch (error) {
    console.error('JWT generation failed:', error);
    throw new Error(`Failed to generate Apple Music JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates a JWT token format (basic validation, not signature verification)
 */
export function validateJWTFormat(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Try to decode header and payload
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Check required fields
    return (
      header.alg === 'ES256' &&
      header.typ === 'JWT' &&
      !!header.kid &&
      !!payload.iss &&
      !!payload.iat &&
      !!payload.exp
    );
  } catch {
    return false;
  }
}

/**
 * Extracts information from a JWT token without verification
 */
export function decodeJWT(token: string): { header: any; payload: any } | null {
  try {
    const decoded = jwt.decode(token, { complete: true });
    return decoded as { header: any; payload: any };
  } catch {
    return null;
  }
}

/**
 * Checks if a JWT token is expired
 */
export function isJWTExpired(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) {
      return true;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now;
  } catch {
    return true;
  }
} 