#!/usr/bin/env node

/**
 * Apple Music Setup Verification Script
 * 
 * This script helps verify your Apple Developer setup for MusicKit
 */

import fs from 'fs';

function main() {
  console.log('🔍 Apple Music Setup Verification\n');
  
  // Check if .env file exists
  if (!fs.existsSync('.env')) {
    console.log('❌ .env file not found');
    console.log('   Run: cp .env.example .env');
    return;
  }
  
  // Read .env file
  const envContent = fs.readFileSync('.env', 'utf8');
  const hasOpenAI = envContent.includes('VITE_OPENAI_API_KEY=') && !envContent.includes('your_openai_api_key_here');
  const hasAppleToken = envContent.includes('VITE_APPLE_MUSIC_TOKEN=') && !envContent.includes('your_apple_music_token_here');
  
  console.log('📋 Environment Variables:');
  console.log(`   OpenAI API Key: ${hasOpenAI ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Apple Music Token: ${hasAppleToken ? '✅ Set' : '❌ Missing'}`);
  
  if (hasAppleToken) {
    // Extract and analyze the token
    const tokenMatch = envContent.match(/VITE_APPLE_MUSIC_TOKEN=(.+)/);
    if (tokenMatch) {
      const token = tokenMatch[1].trim();
      console.log('\n🔑 Token Analysis:');
      console.log(`   Length: ${token.length} characters`);
      console.log(`   Format: ${token.startsWith('eyJ') ? '✅ Valid JWT format' : '❌ Invalid format'}`);
      
      if (token.startsWith('eyJ')) {
        try {
          // Decode JWT header and payload (without verification)
          const [headerB64, payloadB64] = token.split('.');
          const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
          const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
          
          console.log(`   Algorithm: ${header.alg}`);
          console.log(`   Key ID: ${header.kid}`);
          console.log(`   Team ID: ${payload.iss}`);
          console.log(`   Expires: ${new Date(payload.exp * 1000).toLocaleString()}`);
          console.log(`   Origins: ${payload.origin ? '✅ Set' : '❌ Missing'}`);
          
          // Check expiration
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp < now) {
            console.log('   ⚠️  Token is EXPIRED!');
          } else {
            console.log('   ✅ Token is valid (not expired)');
          }
          
        } catch (error) {
          console.log('   ❌ Could not decode token');
        }
      }
    }
  }
  
  console.log('\n📝 Next Steps:');
  
  if (!hasAppleToken) {
    console.log('1. Generate Apple Music token:');
    console.log('   node scripts/generate-apple-token.js <p8-file> <key-id> <team-id>');
  }
  
  console.log('2. Verify your Apple Developer Key has MusicKit enabled:');
  console.log('   → Go to https://developer.apple.com/account/resources/authkeys/list');
  console.log('   → Check that your key shows "MusicKit" in the services column');
  console.log('   → If not, create a new key with MusicKit enabled');
  
  console.log('3. Common issues:');
  console.log('   → Key missing MusicKit permissions');
  console.log('   → Wrong Team ID or Key ID');
  console.log('   → Token expired');
  console.log('   → Bundle ID mismatch');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 