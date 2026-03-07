/**
 * Check if Facebook Pages have Instagram Business accounts
 * 
 * Usage: node check-facebook-instagram-link.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function checkFacebookInstagramLink() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const SocialAccount = mongoose.model('SocialAccount', new mongoose.Schema({}, { strict: false }));

    // Get recent Facebook accounts
    const facebookAccounts = await SocialAccount.find({ provider: 'facebook' }).lean();
    
    console.log(`=== FACEBOOK ACCOUNTS (${facebookAccounts.length}) ===\n`);

    facebookAccounts.forEach((account, index) => {
      console.log(`Account ${index + 1}:`);
      console.log(`  ID: ${account._id}`);
      console.log(`  Workspace ID: ${account.workspaceId}`);
      console.log(`  Account Name: ${account.accountName}`);
      console.log(`  Provider User ID: ${account.providerUserId}`);
      console.log(`  Status: ${account.status}`);
      console.log(`  Created: ${account.createdAt}`);
      console.log(`  Metadata:`);
      console.log(`    Page ID: ${account.metadata?.pageId || 'N/A'}`);
      console.log(`    Page Name: ${account.metadata?.pageName || 'N/A'}`);
      console.log(`    Instagram Account ID: ${account.metadata?.instagramAccountId || 'N/A'}`);
      console.log(`    Instagram Username: ${account.metadata?.instagramUsername || 'N/A'}`);
      console.log(`  Full Metadata:`, JSON.stringify(account.metadata, null, 2));
      console.log('');
    });

    console.log('\n=== ANALYSIS ===\n');
    
    const withInstagram = facebookAccounts.filter(acc => 
      acc.metadata?.instagramAccountId || acc.metadata?.instagramUsername
    );
    
    console.log(`Facebook accounts with Instagram data: ${withInstagram.length}`);
    console.log(`Facebook accounts without Instagram data: ${facebookAccounts.length - withInstagram.length}`);
    
    if (withInstagram.length > 0) {
      console.log('\n⚠️  ISSUE FOUND:');
      console.log('Facebook accounts have Instagram data but were saved as Facebook accounts!');
      console.log('These should have been saved as Instagram accounts instead.');
    } else {
      console.log('\n✅ No Instagram data found in Facebook accounts.');
      console.log('This means either:');
      console.log('1. User connected Facebook Pages without Instagram Business accounts');
      console.log('2. User never tried Instagram OAuth flow');
      console.log('3. Instagram OAuth flow is not being triggered');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkFacebookInstagramLink();
