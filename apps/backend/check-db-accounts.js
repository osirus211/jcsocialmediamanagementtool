/**
 * Check Instagram accounts in database
 * 
 * Usage: node check-db-accounts.js
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

    // Find all Instagram accounts
    const accounts = await SocialAccount.find({ provider: 'instagram' }).lean();

    console.log(`Found ${accounts.length} Instagram account(s) in database:`);
    console.log('');

    accounts.forEach((account, index) => {
      console.log(`Account ${index + 1}:`);
      console.log(`  ID: ${account._id}`);
      console.log(`  Workspace ID: ${account.workspaceId}`);
      console.log(`  Provider User ID: ${account.providerUserId}`);
      console.log(`  Account Name: ${account.accountName}`);
      console.log(`  Status: ${account.status}`);
      console.log(`  Username: ${account.metadata?.username || 'N/A'}`);
      console.log(`  Page Name: ${account.metadata?.pageName || 'N/A'}`);
      console.log(`  Followers: ${account.metadata?.followersCount || 0}`);
      console.log(`  Created: ${account.createdAt}`);
      console.log(`  Last Sync: ${account.lastSyncAt || 'Never'}`);
      console.log('');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAccounts();
