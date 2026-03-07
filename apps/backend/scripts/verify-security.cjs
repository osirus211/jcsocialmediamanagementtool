const fs = require('fs');
const path = require('path');

console.log('🔒 MODULE 12 — SECURITY HARDENING VERIFICATION\n');
console.log('='.repeat(60));

const results = {
  jwtSecrets: false,
  refreshTokensHashed: false,
  helmetEnabled: false,
  corsRestricted: false,
  rateLimiterEnabled: false,
  bcryptRounds: false,
  noSensitiveLogs: false,
  mongoInjectionSafe: false,
  envValidation: false,
};

const issues = [];
const fixes = [];

// Check .env file
console.log('\n📋 STEP 1 — Checking JWT Secrets');
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const jwtSecret = envContent.match(/JWT_SECRET=(.+)/)?.[1];
const jwtRefreshSecret = envContent.match(/JWT_REFRESH_SECRET=(.+)/)?.[1];

if (jwtSecret && jwtSecret.length >= 32 && jwtRefreshSecret && jwtRefreshSecret.length >= 32) {
  console.log('✅ JWT secrets strong (>= 32 chars)');
  results.jwtSecrets = true;
} else {
  console.log('❌ JWT secrets weak or missing');
  issues.push('JWT secrets must be >= 32 characters');
}

// Check for helmet
console.log('\n📋 STEP 2 — Checking Helmet');
const serverPath = path.join(__dirname, '../src/server.ts');
if (fs.existsSync(serverPath)) {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  if (serverContent.includes('helmet') && serverContent.includes('app.use(helmet')) {
    console.log('✅ Helmet enabled');
    results.helmetEnabled = true;
  } else {
    console.log('❌ Helmet not enabled');
    issues.push('Helmet middleware not found');
  }
}

// Check CORS
console.log('\n📋 STEP 3 — Checking CORS');
if (fs.existsSync(serverPath)) {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  if (serverContent.includes('cors') && !serverContent.includes('origin: "*"')) {
    console.log('✅ CORS restricted (no wildcard)');
    results.corsRestricted = true;
  } else if (serverContent.includes('origin: "*"')) {
    console.log('❌ CORS allows wildcard (*)');
    issues.push('CORS should not use wildcard origin');
  } else {
    console.log('⚠️  CORS configuration not found');
  }
}

// Check rate limiter
console.log('\n📋 STEP 4 — Checking Rate Limiter');
const authRoutesPath = path.join(__dirname, '../src/routes/auth.routes.ts');
if (fs.existsSync(authRoutesPath)) {
  const authContent = fs.readFileSync(authRoutesPath, 'utf8');
  if (authContent.includes('rateLimit') || authContent.includes('rateLimiter')) {
    console.log('✅ Rate limiter enabled');
    results.rateLimiterEnabled = true;
  } else {
    console.log('❌ Rate limiter not found');
    issues.push('Rate limiter should be enabled on auth routes');
  }
}

// Check bcrypt rounds
console.log('\n📋 STEP 5 — Checking Bcrypt Rounds');
const userModelPath = path.join(__dirname, '../src/models/User.ts');
if (fs.existsSync(userModelPath)) {
  const userContent = fs.readFileSync(userModelPath, 'utf8');
  const bcryptMatch = userContent.match(/bcrypt\.hash.*?(\d+)/);
  if (bcryptMatch && parseInt(bcryptMatch[1]) >= 12) {
    console.log(`✅ Bcrypt rounds >= 12 (found: ${bcryptMatch[1]})`);
    results.bcryptRounds = true;
  } else {
    console.log('❌ Bcrypt rounds < 12 or not found');
    issues.push('Bcrypt should use >= 12 rounds');
  }
}

// Check for sensitive logs
console.log('\n📋 STEP 6 — Checking for Sensitive Logs');
const srcDir = path.join(__dirname, '../src');
let foundSensitiveLogs = false;
function checkDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !file.includes('node_modules')) {
      checkDirectory(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.match(/console\.log.*password/i) || content.match(/console\.log.*token/i)) {
        foundSensitiveLogs = true;
        console.log(`⚠️  Potential sensitive log in: ${filePath}`);
      }
    }
  }
}
checkDirectory(srcDir);
if (!foundSensitiveLogs) {
  console.log('✅ No obvious sensitive logs found');
  results.noSensitiveLogs = true;
} else {
  issues.push('Sensitive data may be logged');
}

// Check mongo injection safety
console.log('\n📋 STEP 7 — Checking Mongo Injection Safety');
if (fs.existsSync(serverPath)) {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  if (serverContent.includes('mongoSanitize') || serverContent.includes('express-mongo-sanitize')) {
    console.log('✅ Mongo sanitization enabled');
    results.mongoInjectionSafe = true;
  } else {
    console.log('❌ Mongo sanitization not found');
    issues.push('express-mongo-sanitize should be enabled');
  }
}

// Check ENV validation
console.log('\n📋 STEP 8 — Checking ENV Validation');
const configPath = path.join(__dirname, '../src/config/index.ts');
if (fs.existsSync(configPath)) {
  const configContent = fs.readFileSync(configPath, 'utf8');
  if (configContent.includes('zod') || configContent.includes('joi') || configContent.includes('throw new Error')) {
    console.log('✅ ENV validation present');
    results.envValidation = true;
  } else {
    console.log('⚠️  ENV validation not found');
  }
}

console.log('\n' + '='.repeat(60));
console.log('📊 SECURITY HARDENING SUMMARY');
console.log('='.repeat(60));

Object.keys(results).forEach(key => {
  const status = results[key] ? '✅' : '❌';
  console.log(`${status} ${key}: ${results[key] ? 'PASS' : 'FAIL'}`);
});

if (issues.length > 0) {
  console.log('\n⚠️  ISSUES FOUND:');
  issues.forEach((issue, i) => {
    console.log(`${i + 1}. ${issue}`);
  });
}

const allPassed = Object.values(results).every(v => v === true);
console.log('\n' + '='.repeat(60));
console.log(`Security hardened: ${allPassed ? 'YES' : 'NO'}`);
console.log('='.repeat(60));

process.exit(allPassed ? 0 : 1);
