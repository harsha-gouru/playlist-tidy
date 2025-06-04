#!/usr/bin/env node

/**
 * Apple Music JWT Token Generator
 * 
 * This script helps you generate a JWT token for Apple Music API
 * from your .p8 private key file.
 * 
 * Usage:
 *   node scripts/generate-jwt.js <path-to-p8-file> <key-id> <team-id>
 * 
 * Example:
 *   node scripts/generate-jwt.js ./AuthKey_ABC123DEFG.p8 ABC123DEFG DEF456GHIJ
 */

const fs = require('fs');
const jwt = require('jsonwebtoken');

function generateAppleMusicJWT(privateKeyPath, keyId, teamId) {
  try {
    // Read the private key file
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    
    // Generate JWT token
    const token = jwt.sign(
      {
        iss: teamId, // Issuer (Team ID)
      },
      privateKey,
      {
        algorithm: 'ES256', // ECDSA with SHA-256 (required by Apple)
        expiresIn: '180d',  // Maximum allowed by Apple (180 days)
        keyid: keyId        // Key ID from Apple Developer Portal
      }
    );

    return token;
  } catch (error) {
    throw new Error(`Failed to generate JWT: ${error.message}`);
  }
}

function validateJWT(token) {
  try {
    const decoded = jwt.decode(token, { complete: true });
    
    console.log('\n✅ JWT Token Generated Successfully!');
    console.log('\nToken Details:');
    console.log('Header:', JSON.stringify(decoded.header, null, 2));
    console.log('Payload:', JSON.stringify(decoded.payload, null, 2));
    
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = decoded.payload.exp - now;
    const daysUntilExpiry = Math.floor(expiresIn / (24 * 60 * 60));
    
    console.log(`\nExpires in: ${daysUntilExpiry} days`);
    console.log('\n🔑 Your JWT Token:');
    console.log(token);
    
    console.log('\n📝 Add this to your .env file:');
    console.log(`VITE_APPLE_MUSIC_TOKEN=${token}`);
    
    console.log('\n🧪 Test your token:');
    console.log(`curl -v -H "Authorization: Bearer ${token}" \\`);
    console.log('"https://api.music.apple.com/v1/catalog/us/songs/203709340"');
    
    return true;
  } catch (error) {
    console.error('❌ Invalid JWT token:', error.message);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.error('❌ Usage: node scripts/generate-jwt.js <path-to-p8-file> <key-id> <team-id>');
    console.error('\nExample:');
    console.error('  node scripts/generate-jwt.js ./AuthKey_ABC123DEFG.p8 ABC123DEFG DEF456GHIJ');
    console.error('\nWhere:');
    console.error('  - path-to-p8-file: Path to your .p8 private key file from Apple Developer Portal');
    console.error('  - key-id: 10-character Key ID from Apple Developer Portal');
    console.error('  - team-id: 10-character Team ID from Apple Developer Portal');
    process.exit(1);
  }

  const [privateKeyPath, keyId, teamId] = args;

  // Validate inputs
  if (!fs.existsSync(privateKeyPath)) {
    console.error(`❌ Private key file not found: ${privateKeyPath}`);
    process.exit(1);
  }

  if (keyId.length !== 10) {
    console.error(`❌ Key ID must be exactly 10 characters, got: ${keyId} (${keyId.length} chars)`);
    process.exit(1);
  }

  if (teamId.length !== 10) {
    console.error(`❌ Team ID must be exactly 10 characters, got: ${teamId} (${teamId.length} chars)`);
    process.exit(1);
  }

  console.log('🔑 Generating Apple Music JWT Token...');
  console.log(`Private Key: ${privateKeyPath}`);
  console.log(`Key ID: ${keyId}`);
  console.log(`Team ID: ${teamId}`);

  try {
    const token = generateAppleMusicJWT(privateKeyPath, keyId, teamId);
    validateJWT(token);
  } catch (error) {
    console.error('❌ Failed to generate JWT token:', error.message);
    console.error('\n💡 Common issues:');
    console.error('  - Make sure your .p8 file is in PKCS#8 format');
    console.error('  - Verify your Key ID and Team ID are correct');
    console.error('  - Ensure the private key file is readable');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateAppleMusicJWT, validateJWT }; 