import { describe, it, expect } from 'vitest';
import { validateJWTFormat, decodeJWT, isJWTExpired, getTokenExpirationInfo } from '../lib/jwt-browser';
import { generateAppleMusicJWT } from '../lib/jwt';

describe('Apple Music JWT Generation', () => {
  const mockConfig = {
    privateKey: `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgIQ+i9NXlKVnIIg6a
JAZdiXkRpWZCsqZhvRIFUEOGOV6hRANCAARM3jjggIzgnZH3rdHzA71A1fORIZXU
1Kdxvrs/jFKFVg6Wyh2usqbBRDbunQrQD8B0q72sqjVATGi0oF2JLHBM
-----END PRIVATE KEY-----`,
    keyId: 'ABC123DEFG',
    teamId: 'DEF456GHIJ'
  };

  it('should generate a valid JWT token', () => {
    const token = generateAppleMusicJWT(mockConfig);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('should validate JWT format correctly', () => {
    const token = generateAppleMusicJWT(mockConfig);
    
    expect(validateJWTFormat(token)).toBe(true);
    expect(validateJWTFormat('invalid.token')).toBe(false);
    expect(validateJWTFormat('invalid.token.format.extra')).toBe(false);
  });

  it('should decode JWT correctly', () => {
    const token = generateAppleMusicJWT(mockConfig);
    const decoded = decodeJWT(token);
    
    expect(decoded).toBeDefined();
    expect(decoded?.header.alg).toBe('ES256');
    expect(decoded?.header.typ).toBe('JWT');
    expect(decoded?.header.kid).toBe(mockConfig.keyId);
    expect(decoded?.payload.iss).toBe(mockConfig.teamId);
    expect(decoded?.payload.iat).toBeDefined();
    expect(decoded?.payload.exp).toBeDefined();
  });

  it('should not be expired for newly generated tokens', () => {
    const token = generateAppleMusicJWT(mockConfig);
    
    expect(isJWTExpired(token)).toBe(false);
  });

  it('should handle missing configuration', () => {
    expect(() => generateAppleMusicJWT({
      privateKey: '',
      keyId: mockConfig.keyId,
      teamId: mockConfig.teamId
    })).toThrow('Missing required JWT configuration');

    expect(() => generateAppleMusicJWT({
      privateKey: mockConfig.privateKey,
      keyId: '',
      teamId: mockConfig.teamId
    })).toThrow('Missing required JWT configuration');

    expect(() => generateAppleMusicJWT({
      privateKey: mockConfig.privateKey,
      keyId: mockConfig.keyId,
      teamId: ''
    })).toThrow('Missing required JWT configuration');
  });

  it('should handle private key without headers', () => {
    const keyWithoutHeaders = mockConfig.privateKey
      .replace('-----BEGIN PRIVATE KEY-----\n', '')
      .replace('\n-----END PRIVATE KEY-----', '');

    const configWithoutHeaders = {
      ...mockConfig,
      privateKey: keyWithoutHeaders
    };

    const token = generateAppleMusicJWT(configWithoutHeaders);
    expect(token).toBeDefined();
    expect(validateJWTFormat(token)).toBe(true);
  });

  it('should generate tokens with 180-day expiration', () => {
    const token = generateAppleMusicJWT(mockConfig);
    const decoded = decodeJWT(token);
    
    expect(decoded).toBeDefined();
    
    const now = Math.floor(Date.now() / 1000);
    const maxExpiry = now + (180 * 24 * 60 * 60); // 180 days
    const minExpiry = now + (179 * 24 * 60 * 60); // 179 days (buffer for test execution time)
    
    expect(decoded!.payload.exp).toBeGreaterThan(minExpiry);
    expect(decoded!.payload.exp).toBeLessThanOrEqual(maxExpiry);
  });
}); 