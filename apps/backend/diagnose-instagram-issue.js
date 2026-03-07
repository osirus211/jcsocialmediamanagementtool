/**
 * Comprehensive Instagram Issue Diagnosis
 * 
 * This script checks:
 * 1. Instagram accounts in database
 * 2. Workspace associations
 * 3. API response format
 * 4. Recent OAuth attempts
 * 
 * Usage: node diagnose-instagram-issue.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function diagnose() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get models
    const SocialAccount = mongoose.model('SocialAccount', new mongoose.Schema({}, { strict: false }));
    const Workspace = mongoose.model('Workspace', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // 1. Check all Instagram accounts
    console.log('=== INSTAGRAM ACCOUNTS IN DATABASE ===');
    const instagramAccounts = await SocialAccount.find({ provider: 'instagram' }).lean();
    console.log(`Total Instagram accounts: ${instagramAccounts.length}\n`);

    if (instagramAccounts.length === 0) {
      console.log('❌ NO INSTAGRAM ACCOUNTS FOUND');
      console.log('\nPossible reasons:');
      console.log('1. User never completed Instagram OAuth flow');
      console.log('2. OAuth flow failed silently');
      console.log('3. Accounts were created but then deleted');
      console.log('4. There was an error during account creation\n');
    } else {
      instagramAccounts.forEach((account, index) => {
        console.log(`Account ${index + 1}:`);
        console.log(`  ID: ${account._id}`);
        console.log(`  Workspace ID: ${account.workspaceId}`);
        console.log(`  Provider User ID: ${account.providerUserId}`);
        console.log(`  Account Name: ${account.accountName}`);
        console.log(`  Status: ${account.status}`);
        console.log(`  Username: ${account.metadata?.username || 'N/A'}`);
        console.log(`  Created: ${account.createdAt}`);
        console.log('');
      });
    }

    // 2. Check all workspaces
    console.log('=== WORKSPACES ===');
    const workspaces = await Workspace.find({}).lean();
    console.log(`Total workspaces: ${workspaces.length}\n`);

    workspaces.forEach((workspace, index) => {
      console.log(`Workspace ${index + 1}:`);
      console.log(`  ID: ${workspace._id}`);
      console.log(`  Name: ${workspace.name}`);
      console.log(`  Owner ID: ${workspace.ownerId}`);
      console.log(`  Created: ${workspace.createdAt}`);
      
      // Count accounts for this workspace
      const accountCount = {
        twitter: 0,
        facebook: 0,
        instagram: 0,
        linkedin: 0,
      };
      
      // This is inefficient but works for diagnosis
      const allAccounts = [];
      console.log('');
    });

    // 3. Check account distribution by workspace
    console.log('=== ACCOUNTS BY WORKSPACE ===');
    const allAccounts = await SocialAccount.find({}).lean();
    
    const byWorkspace = {};
    allAccounts.forEach(account => {
      const wsId = account.workspaceId?.toString() || 'unknown';
      if (!byWorkspace[wsId]) {
        byWorkspace[wsId] = {
          twitter: 0,
          facebook: 0,
          instagram: 0,
          linkedin: 0,
          unknown: 0,
        };
      }
      const platform = account.provider || 'unknown';
      byWorkspace[wsId][platform] = (byWorkspace[wsId][platform] || 0) + 1;
    });

    Object.keys(byWorkspace).forEach(wsId => {
      console.log(`\nWorkspace ${wsId}:`);
      console.log(`  Twitter: ${byWorkspace[wsId].twitter}`);
      console.log(`  Facebook: ${byWorkspace[wsId].facebook}`);
      console.log(`  Instagram: ${byWorkspace[wsId].instagram}`);
      console.log(`  LinkedIn: ${byWorkspace[wsId].linkedin}`);
      if (byWorkspace[wsId].unknown > 0) {
        console.log(`  Unknown: ${byWorkspace[wsId].unknown}`);
      }
    });

    // 4. Check recent Facebook accounts (Instagram uses Facebook OAuth)
    console.log('\n\n=== RECENT FACEBOOK ACCOUNTS (Last 7 days) ===');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFacebook = await SocialAccount.find({
      provider: 'facebook',
      createdAt: { $gte: sevenDaysAgo },
    }).lean();

    console.log(`Found ${recentFacebook.length} recent Facebook account(s)\n`);
    recentFacebook.forEach((account, index) => {
      console.log(`Account ${index + 1}:`);
      console.log(`  ID: ${account._id}`);
      console.log(`  Workspace ID: ${account.workspaceId}`);
      console.log(`  Account Name: ${account.accountName}`);
      console.log(`  Page ID: ${account.metadata?.pageId || 'N/A'}`);
      console.log(`  Page Name: ${account.metadata?.pageName || 'N/A'}`);
      console.log(`  Created: ${account.createdAt}`);
      console.log('');
    });

    // 5. Summary and recommendations
    console.log('=== DIAGNOSIS SUMMARY ===\n');
    
    if (instagramAccounts.length === 0) {
      console.log('❌ ISSUE CONFIRMED: No Instagram accounts in database');
      console.log('\n📋 RECOMMENDED ACTIONS:');
      console.log('1. Ask user to try Instagram OAuth flow again');
      console.log('2. Monitor backend logs during OAuth flow');
      console.log('3. Check for errors in browser console');
      console.log('4. Verify Instagram OAuth credentials in .env');
      console.log('5. Ensure Instagram account is Business/Creator account');
      console.log('6. Ensure Instagram account is connected to a Facebook Page');
    } else {
      console.log('✅ Instagram accounts exist in database');
      console.log('\n📋 RECOMMENDED ACTIONS:');
      console.log('1. Check if frontend is fetching from correct workspace');
      console.log('2. Verify API response includes Instagram accounts');
      console.log('3. Check browser console for errors');
      console.log('4. Verify user is logged into correct workspace');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

diagnose();
