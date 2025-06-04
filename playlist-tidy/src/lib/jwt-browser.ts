/**
 * Browser-compatible JWT utilities for Apple Music
 * 
 * This module only handles JWT decoding and validation.
 * JWT generation should be done server-side or via the Node.js script.
 */

export interface AppleMusicJWTConfig {
  privateKey: string;
  keyId: string;
  teamId: string;
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
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Checks if a JWT token is expired
 */
export function isJWTExpired(token: string): boolean {
  try {
    const decoded = decodeJWT(token);
    if (!decoded || !decoded.payload.exp) {
      return true;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return decoded.payload.exp < now;
  } catch {
    return true;
  }
}

/**
 * Gets token expiration info
 */
export function getTokenExpirationInfo(token: string): {
  isExpired: boolean;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
} {
  try {
    const decoded = decodeJWT(token);
    if (!decoded || !decoded.payload.exp) {
      return {
        isExpired: true,
        expiresAt: null,
        daysUntilExpiry: null
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date(decoded.payload.exp * 1000);
    const isExpired = decoded.payload.exp < now;
    const daysUntilExpiry = isExpired ? 0 : Math.floor((decoded.payload.exp - now) / (24 * 60 * 60));

    return {
      isExpired,
      expiresAt,
      daysUntilExpiry
    };
  } catch {
    return {
      isExpired: true,
      expiresAt: null,
      daysUntilExpiry: null
    };
  }
} 