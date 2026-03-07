/**
 * Phase 1 Validation: Seed Test Accounts
 * 
 * Creates 5 test social accounts with tokens expiring within 1 hour
 */

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');

// Encryption utilities
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || 'a'.repeat(64), 'hex');
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

const SocialAccountSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  provider: { type: String, required: true },
  providerUserId: { type: String, required: true },
  accountName: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String },
  tokenExpiresAt: { type: Date },
  encryptionKeyVersion: { type: Number, default: 1 },
  scopes: { type: [String], default: [] },
  status: { type: String, default: 'active' },
  lastRefreshedAt: { type: Date },
  lastError: { type: String },
  lastErrorAt: { type: Date },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const SocialAccount = mongoose.model('SocialAccount', SocialAccountSchema);

async function seedTestAccounts() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/social-scheduler');
    console.log('✅ MongoDB connected');

    // Create test workspace
    const testWorkspaceId = new mongoose.Types.ObjectId();
    console.log('📦 Test Workspace ID:', testWorkspaceId.toString());

    // Delete existing test accounts
    const deleted = await SocialAccount.deleteMany({
      accountName: { $regex: /^PHASE1_TEST_/ }
    });
    console.log(`🗑️  Deleted ${deleted.deletedCount} existing test accounts`);

    // Create 5 test accounts with tokens expiring in 30-60 minutes
    const accounts = [];
    const providers = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube'];
    
    for (let i = 0; i < 5; i++) {
      const expiresAt = new Date(Date.now() + (30 + i * 6) * 60 * 1000); // 30, 36, 42, 48, 54 minutes
      
      const account = await SocialAccount.create({
        workspaceId: testWorkspaceId,
        provider: providers[i],
        providerUserId: `test_user_${i + 1}`,
        accountName: `PHASE1_TEST_${providers[i].toUpperCase()}_${i + 1}`,
        accessToken: encrypt(`test_access_token_${i + 1}`),
        refreshToken: encrypt(`test_refresh_token_${i + 1}`),
        tokenExpiresAt: expiresAt,
        encryptionKeyVersion: 1,
        scopes: ['read', 'write'],
        status: 'active',
        metadata: {
          testAccount: true,
          phase: 'phase1_validation',
        },
      });

      accounts.push(account);
      
      console.log(`✅ Created: ${account.accountName}`);
      console.log(`   ID: ${account._id}`);
      console.log(`   Provider: ${account.provider}`);
      console.log(`   Expires: ${expiresAt.toISOString()}`);
      console.log(`   Minutes until expiry: ${Math.round((expiresAt - Date.now()) / 60000)}`);
    }

    console.log('\n📊 Summary:');
    console.log(`   Total accounts created: ${accounts.length}`);
    console.log(`   Workspace ID: ${testWorkspaceId.toString()}`);
    console.log(`   All tokens expire within 1 hour`);
    console.log(`   Status: active`);
    console.log(`   Ready for scheduler scan`);

    console.log('\n🔍 Verification Query:');
    console.log(`   db.socialaccounts.find({ accountName: /^PHASE1_TEST_/ })`);

    await mongoose.disconnect();
    console.log('\n✅ Seeding complete');
  } catch (error) {
    console.error('❌ Error seeding test accounts:', error);
    process.exit(1);
  }
}

seedTestAccounts();
