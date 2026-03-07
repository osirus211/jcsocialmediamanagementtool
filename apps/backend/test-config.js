// Test YouTube config loading
const path = require('path');
const dotenv = require('dotenv');

// Load .env file
const result = dotenv.config({ path: path.join(__dirname, '.env') });

if (result.error) {
  console.error('Error loading .env:', result.error);
  process.exit(1);
}

console.log('=== Environment Variables ===');
console.log('YOUTUBE_CLIENT_ID:', process.env.YOUTUBE_CLIENT_ID ? `SET (${process.env.YOUTUBE_CLIENT_ID.substring(0, 30)}...)` : 'NOT SET');
console.log('YOUTUBE_CLIENT_SECRET:', process.env.YOUTUBE_CLIENT_SECRET ? `SET (${process.env.YOUTUBE_CLIENT_SECRET.substring(0, 15)}...)` : 'NOT SET');
console.log('YOUTUBE_CALLBACK_URL:', process.env.YOUTUBE_CALLBACK_URL || 'NOT SET');
console.log('');

// Try to import and use the config
console.log('=== Loading TypeScript Config ===');
try {
  // Use ts-node to load TypeScript config
  require('ts-node/register');
  const { config } = require('./src/config/index.ts');
  
  console.log('Config loaded successfully!');
  console.log('');
  console.log('=== YouTube OAuth Config ===');
  console.log('clientId:', config.oauth?.youtube?.clientId ? `SET (${config.oauth.youtube.clientId.substring(0, 30)}...)` : 'NOT SET');
  console.log('clientSecret:', config.oauth?.youtube?.clientSecret ? `SET (${config.oauth.youtube.clientSecret.substring(0, 15)}...)` : 'NOT SET');
  console.log('callbackUrl:', config.oauth?.youtube?.callbackUrl || 'NOT SET');
  console.log('');
  
  if (config.oauth?.youtube?.clientId && config.oauth?.youtube?.clientSecret) {
    console.log('✅ YouTube OAuth is properly configured!');
  } else {
    console.log('❌ YouTube OAuth is NOT configured');
    console.log('Missing:', [
      !config.oauth?.youtube?.clientId && 'clientId',
      !config.oauth?.youtube?.clientSecret && 'clientSecret'
    ].filter(Boolean).join(', '));
  }
} catch (error) {
  console.error('Error loading config:', error.message);
  console.error('Stack:', error.stack);
}
