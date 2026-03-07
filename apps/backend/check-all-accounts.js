/**
 * Check all social accounts in database
 * 
 * Usage: node check-all-accounts.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function checkAccounts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('');

    // Get SocialAccount model
    const SocialAccount = mongoose.model('SocialAccount', new mongoose.Schema({}, { strict: false }));

    // Find all accounts
    const allAccounts = await SocialAccount.find({}).lean();
    console.log(`Total accounts in database: ${allAccounts.length}`);
    console.log('');

    // Group by platform
    const byPlatform = {};
    allAccounts.forEach(account => {
      const platform = account.provider || 'unknown';
      if (!byPlatform[platform]) {
        byPlatform[platform] = [];
      }
      byPlatform[platform].push(account);
    });

    // Display by platform
    Object.keys(byPlatform).forEach(platform => {
      console.log(`\n=== ${platform.toUpperCase()} (${byPlatform[platform].length} accounts) ===`);
      byPlatform[platform].forEach((account, index) => {
        console.log(`\nAccount ${index + 1}:`);
        console.log(`  ID: ${account._id}`);
        console.log(`  Workspace ID: ${account.workspaceId}`);
        console.log(`  Provider User ID: ${account.providerUserId}`);
        console.log(`  Account Name: ${account.accountName}`);
        console.log(`  Status: ${account.status}`);
        console.log(`  Username: ${account.metadata?.username || 'N/A'}`);
        console.log(`  Created: ${account.createdAt}`);
        console.log(`  Last Sync: ${account.lastSyncAt || 'Never'}`);
      });
    });

    // Check for Instagram specifically
    const instagramAccounts = byPlatform['instagram'] || [];
    if (instagramAccounts.length === 0) {
      console.log('\n⚠️  NO INSTAGRAM ACCOUNTS FOUND');
      console.log('This means either:');
      console.log('1. OAuth flow never completed successfully');
      console.log('2. Accounts were created but then deleted');
      console.log('3. There was an error during account creation');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAccounts();
