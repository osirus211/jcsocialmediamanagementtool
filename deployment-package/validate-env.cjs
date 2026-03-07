const fs = require('fs');
const path = require('path');

console.log('🔍 PRODUCTION ENVIRONMENT VALIDATION\n');
console.log('='.repeat(60));

const envPath = process.argv[2] || '.env.production';

if (!fs.existsSync(envPath)) {
  console.error('❌ ERROR: .env.production file not found!');
  console.error('   Create it from .env.production.template');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const errors = [];
const warnings = [];

// Required fields
const required = {
  'NODE_ENV': 'production',
  'MONGODB_URI': /^mongodb(\+srv)?:\/\/.+/,
  'REDIS_HOST': /.+/,
  'REDIS_PASSWORD': /.{8,}/,
  'JWT_SECRET': /.{32,}/,
  'JWT_REFRESH_SECRET': /.{32,}/,
  'ENCRYPTION_KEY': /.{64,}/,
  'FRONTEND_URL': /^https:\/\/.+/,
  'API_URL': /^https:\/\/.+/,
};

// OAuth fields (at least one platform required)
const oauthFields = [
  'GOOGLE_CLIENT_ID',
  'TWITTER_CLIENT_ID',
  'FACEBOOK_APP_ID',
  'INSTAGRAM_CLIENT_ID',
];

// Billing fields
const billingFields = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

console.log('\n📋 Checking required fields...\n');

// Check required fields
Object.keys(required).forEach(key => {
  const match = envContent.match(new RegExp(${key}=(.+)));
  const value = match ? match[1].trim() : null;
  
  if (!value || value.includes('REPLACE')) {
    errors.push(${key} is missing or not configured);
    console.log(❌ : NOT SET);
  } else if (typeof required[key] === 'string') {
    if (value !== required[key]) {
      errors.push(${key} must be '');
      console.log(❌ : INVALID (must be ''));
    } else {
      console.log(✅ : OK);
    }
  } else if (required[key] instanceof RegExp) {
    if (!required[key].test(value)) {
      errors.push(${key} format is invalid);
      console.log(❌ : INVALID FORMAT);
    } else {
      console.log(✅ : OK);
    }
  }
});

// Check OAuth (at least one required)
console.log('\n📋 Checking OAuth configuration...\n');
let hasOAuth = false;
oauthFields.forEach(key => {
  const match = envContent.match(new RegExp(${key}=(.+)));
  const value = match ? match[1].trim() : null;
  
  if (value && !value.includes('REPLACE')) {
    console.log(✅ : CONFIGURED);
    hasOAuth = true;
  } else {
    console.log(⚠️  : NOT SET);
  }
});

if (!hasOAuth) {
  errors.push('At least one OAuth provider must be configured');
}

// Check AI Provider
console.log('\n📋 Checking AI configuration...\n');
const aiProvider = envContent.match(/AI_PROVIDER=(.+)/)?.[1]?.trim();
if (aiProvider === 'mock') {
  errors.push('AI_PROVIDER must not be "mock" in production');
  console.log('❌ AI_PROVIDER: MOCK (must be openai or anthropic)');
} else if (aiProvider) {
  console.log(✅ AI_PROVIDER: );
}

// Check billing
console.log('\n📋 Checking billing configuration...\n');
billingFields.forEach(key => {
  const match = envContent.match(new RegExp(${key}=(.+)));
  const value = match ? match[1].trim() : null;
  
  if (!value || value.includes('REPLACE')) {
    warnings.push(${key} not configured - billing will not work);
    console.log(⚠️  : NOT SET);
  } else {
    console.log(✅ : CONFIGURED);
  }
});

// Check log level
const logLevel = envContent.match(/LOG_LEVEL=(.+)/)?.[1]?.trim();
if (logLevel === 'debug') {
  warnings.push('LOG_LEVEL should be "info" or "warn" in production, not "debug"');
  console.log('\n⚠️  LOG_LEVEL: debug (should be info or warn)');
}

// Check for localhost
if (envContent.includes('localhost') || envContent.includes('127.0.0.1')) {
  errors.push('Configuration contains localhost - must use production URLs');
  console.log('\n❌ Found localhost in configuration');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log('\n✅ All checks passed! Environment is production-ready.\n');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log('\n❌ ERRORS (must fix):');
    errors.forEach((err, i) => {
      console.log(   . );
    });
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (should fix):');
    warnings.forEach((warn, i) => {
      console.log(   . );
    });
  }
  
  console.log('\n');
  process.exit(errors.length > 0 ? 1 : 0);
}
