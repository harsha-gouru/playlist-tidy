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
const path = require('path');

// Configuration - UPDATE THESE VALUES
const CONFIG = {
  // Your Key ID (from the filename AuthKey_XXXXXXXXXX.p8)
  keyId: 'DVCZFX66RB',
  
  // Your Team ID (from Apple Developer portal)
  teamId: '8V5BPU7WJQ',
  
  // Path to your .p8 file (relative to this script)
  keyFilePath: '/Users/lonesolitaro/Downloads/AuthKey_DVCZFX66RB.p8'
};

function generateJWT() {
  try {
    console.log('🔑 Generating MusicKit JWT token...');
    console.log('📋 Configuration:', {
      keyId: CONFIG.keyId,
      teamId: CONFIG.teamId,
      keyFilePath: CONFIG.keyFilePath
    });

    // Check if the key file exists
    if (!fs.existsSync(CONFIG.keyFilePath)) {
      console.error('❌ Key file not found:', CONFIG.keyFilePath);
      console.log('💡 Make sure you:');
      console.log('   1. Downloaded the .p8 file from Apple Developer portal');
      console.log('   2. Placed it in the scripts/ directory');
      console.log('   3. Updated the keyFilePath in this script');
      return;
    }

    // Read the private key
    const privateKey = fs.readFileSync(CONFIG.keyFilePath).toString();
    console.log('✅ Private key loaded successfully');

    // Generate the JWT token with origin claim for web security
    const payload = {
      // Add origin claim for web security (restricts token to specific domains)
      origin: ['http://localhost:5174', 'http://localhost:5173', 'https://yourdomain.com']
    };
    
    const jwtToken = jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      expiresIn: '180d', // 6 months
      issuer: CONFIG.teamId,
      header: {
        alg: 'ES256',
        kid: CONFIG.keyId
      }
    });

    console.log('🎉 JWT token generated successfully!');
    console.log('📝 Token length:', jwtToken.length, 'characters');
    console.log('');
    console.log('🔐 Your JWT Token:');
    console.log('----------------------------------------');
    console.log(jwtToken);
    console.log('----------------------------------------');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Copy the token above');
    console.log('2. Add it to your .env file as: VITE_APPLE_MUSIC_TOKEN=your_token_here');
    console.log('3. Restart your development server');
    console.log('');

    // Decode and show token info
    const decoded = jwt.decode(jwtToken, { complete: true });
    console.log('🔍 Token Information:');
    console.log('   Algorithm:', decoded.header.alg);
    console.log('   Key ID:', decoded.header.kid);
    console.log('   Team ID:', decoded.payload.iss);
    console.log('   Expires:', new Date(decoded.payload.exp * 1000).toLocaleString());

  } catch (error) {
    console.error('❌ Error generating JWT:', error.message);
    
    if (error.message.includes('ENOENT')) {
      console.log('💡 File not found. Make sure the .p8 file path is correct.');
    } else if (error.message.includes('invalid key')) {
      console.log('💡 Invalid key format. Make sure you downloaded the correct .p8 file.');
    }
  }
}

// Run the generator
generateJWT();

module.exports = { generateJWT }; 