# 🔑 MusicKit API Key Setup Guide

## Step 1: Prepare Your Files

1. **Locate your downloaded .p8 file** - it should be named something like `AuthKey_XXXXXXXXXX.p8`
2. **Copy the .p8 file** to the `playlist-tidy/scripts/` directory
3. **Note down these values from Apple Developer Portal:**
   - **Key ID**: The 10-character ID from your filename (the X's in `AuthKey_XXXXXXXXXX.p8`)
   - **Team ID**: Your 10-character Team ID from the Apple Developer portal

## Step 2: Configure the JWT Generator

1. Open `playlist-tidy/scripts/generate-jwt.cjs`
2. Update the `CONFIG` object at the top:

```javascript
const CONFIG = {
  // Replace with your actual Key ID (10 characters)
  keyId: 'ABC123DEFG',
  
  // Replace with your actual Team ID (10 characters)  
  teamId: 'DEF456GHIJ',
  
  // Update the filename to match your .p8 file
  keyFilePath: './AuthKey_ABC123DEFG.p8'
};
```

## Step 3: Generate Your JWT Token

Run the JWT generation script:

```bash
cd playlist-tidy
npm run generate-jwt
```

This will:
- ✅ Validate your configuration
- 🔑 Generate a JWT token valid for 6 months
- 📋 Show you the token and next steps

## Step 4: Add Token to Environment

1. Create a `.env` file in the `playlist-tidy/` directory
2. Add your token:

```env
VITE_APPLE_MUSIC_TOKEN=your_generated_jwt_token_here
```

## Step 5: Test Your Setup

1. **Restart your development server:**
   ```bash
   npm run dev
   ```

2. **Open your app** and try to authorize with Apple Music
3. **Check the browser console** for any authentication errors

## 🔍 Troubleshooting

### Common Issues:

**"Key file not found"**
- Make sure the .p8 file is in the `scripts/` directory
- Check that the filename in `CONFIG.keyFilePath` matches exactly

**"Invalid key format"**
- Ensure you downloaded the correct .p8 file from Apple Developer Portal
- The file should start with `-----BEGIN PRIVATE KEY-----`

**"403 Forbidden" errors**
- Double-check your Key ID and Team ID are correct
- Verify the API key has "Media Services (MusicKit)" enabled in Apple Developer Portal

**Token expires**
- The token is valid for 6 months
- Re-run `npm run generate-jwt` to generate a new one

## 📋 What You Need From Apple Developer Portal:

1. **API Key with MusicKit enabled**
   - Go to Certificates, Identifiers & Profiles
   - Keys → Create new key
   - Enable "Media Services (MusicKit)"
   - Download the .p8 file

2. **Your identifiers:**
   - Key ID (from the downloaded filename)
   - Team ID (from your account settings)

---

🎵 Once setup is complete, your app should be able to access Apple Music playlists! 