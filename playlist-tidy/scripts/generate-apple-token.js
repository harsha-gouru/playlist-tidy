#!/usr/bin/env node

/**
 * Apple Music JWT Token Generator
 * 
 * This script generates a JWT token for Apple Music API using your .p8 private key.
 * 
 * Usage:
 *   node scripts/generate-apple-token.js <path-to-p8-file> <key-id> <team-id>
 * 
 * Example:
 *   node scripts/generate-apple-token.js ./AuthKey_ABC123DEF4.p8 ABC123DEF4 XYZ987WVU6
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple JWT implementation (no external dependencies)
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateJWT(privateKey, keyId, teamId) {
  const now = Math.floor(Date.now() / 1000);
  
  // JWT Header
  const header = {
    alg: 'ES256',
    kid: keyId
  };
  
  // JWT Payload
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + (6 * 30 * 24 * 60 * 60), // 6 months
    origin: ['https://localhost:5174', 'http://localhost:5174', 'https://localhost:5173', 'http://localhost:5173']
  };
  
  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  // Create signature
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createSign('sha256')
    .update(signingInput)
    .sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${signingInput}.${signature}`;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.error('Usage: node generate-apple-token.js <path-to-p8-file> <key-id> <team-id>');
    console.error('');
    console.error('Example:');
    console.error('  node generate-apple-token.js ./AuthKey_ABC123DEF4.p8 ABC123DEF4 XYZ987WVU6');
    console.error('');
    console.error('You can find your Key ID and Team ID in the Apple Developer portal:');
    console.error('  - Key ID: In the filename (AuthKey_KEYID.p8) or in the Keys section');
    console.error('  - Team ID: In your Apple Developer account settings');
    process.exit(1);
  }
  
  const [p8FilePath, keyId, teamId] = args;
  
  // Validate inputs
  if (!fs.existsSync(p8FilePath)) {
    console.error(`Error: File not found: ${p8FilePath}`);
    process.exit(1);
  }
  
  if (keyId.length !== 10) {
    console.error(`Error: Key ID should be 10 characters long, got: ${keyId}`);
    process.exit(1);
  }
  
  if (teamId.length !== 10) {
    console.error(`Error: Team ID should be 10 characters long, got: ${teamId}`);
    process.exit(1);
  }
  
  try {
    // Read the private key
    const privateKey = fs.readFileSync(p8FilePath, 'utf8');
    
    // Generate JWT
    const token = generateJWT(privateKey, keyId, teamId);
    
    console.log('✅ Apple Music JWT Token generated successfully!');
    console.log('');
    console.log('Add this to your .env file:');
    console.log('');
    console.log(`VITE_APPLE_MUSIC_TOKEN=${token}`);
    console.log('');
    console.log('The token is valid for 6 months.');
    
  } catch (error) {
    console.error('Error generating token:', error.message);
    process.exit(1);
  }
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 