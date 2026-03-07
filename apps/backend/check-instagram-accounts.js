/**
 * Instagram Account Diagnostic Script
 * 
 * This script helps diagnose why Instagram accounts aren't being discovered
 * 
 * Usage: node check-instagram-accounts.js <access_token>
 */

const axios = require('axios');

async function checkInstagramAccounts(accessToken) {
  console.log('\n=== INSTAGRAM ACCOUNT DIAGNOSTIC ===\n');
  
  try {
    // Step 1: Check Facebook user
    console.log('Step 1: Checking Facebook user...');
    const userResponse = await axios.get('https://graph.facebook.com/v19.0/me', {
      params: {
        fields: 'id,name',
        access_token: accessToken,
      },
    });
    console.log('✅ Facebook user:', userResponse.data);
    console.log('');

    // Step 2: Get Facebook Pages
    console.log('Step 2: Fetching Facebook Pages...');
    const pagesResponse = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: {
        access_token: accessToken,
      },
    });
    
    const pages = pagesResponse.data.data || [];
    console.log(`✅ Found ${pages.length} Facebook Page(s)`);
    
    if (pages.length === 0) {
      console.log('❌ NO FACEBOOK PAGES FOUND');
      console.log('');
      console.log('To connect Instagram, you need:');
      console.log('1. Create a Facebook Page');
      console.log('2. Convert your Instagram to Business/Creator account');
      console.log('3. Link Instagram to the Facebook Page');
      return;
    }
    
    console.log('');

    // Step 3: Check each page for Instagram Business account
    console.log('Step 3: Checking each page for Instagram Business account...');
    console.log('');
    
    let instagramAccountsFound = 0;
    
    for (const page of pages) {
      console.log(`Page: ${page.name} (ID: ${page.id})`);
      console.log(`  Category: ${page.category || 'N/A'}`);
      console.log(`  Access Token: ${page.access_token ? 'YES' : 'NO'}`);
      
      try {
        // Check for Instagram Business account
        const igResponse = await axios.get(
          `https://graph.facebook.com/v19.0/${page.id}`,
          {
            params: {
              fields: 'instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count}',
              access_token: page.access_token,
            },
          }
        );
        
        if (igResponse.data.instagram_business_account) {
          const ig = igResponse.data.instagram_business_account;
          console.log(`  ✅ Instagram Business Account FOUND:`);
          console.log(`     Username: @${ig.username}`);
          console.log(`     Name: ${ig.name || 'N/A'}`);
          console.log(`     ID: ${ig.id}`);
          console.log(`     Followers: ${ig.followers_count || 0}`);
          console.log(`     Following: ${ig.follows_count || 0}`);
          console.log(`     Posts: ${ig.media_count || 0}`);
          instagramAccountsFound++;
        } else {
          console.log(`  ❌ No Instagram Business account linked to this page`);
        }
      } catch (error) {
        console.log(`  ❌ Error checking Instagram account: ${error.response?.data?.error?.message || error.message}`);
      }
      
      console.log('');
    }
    
    // Summary
    console.log('=== SUMMARY ===');
    console.log(`Facebook Pages: ${pages.length}`);
    console.log(`Instagram Business Accounts: ${instagramAccountsFound}`);
    console.log('');
    
    if (instagramAccountsFound === 0) {
      console.log('❌ NO INSTAGRAM BUSINESS ACCOUNTS FOUND');
      console.log('');
      console.log('Possible reasons:');
      console.log('1. Instagram account is Personal (not Business/Creator)');
      console.log('2. Instagram account is not linked to any Facebook Page');
      console.log('3. You don\'t have admin access to the Facebook Page');
      console.log('');
      console.log('How to fix:');
      console.log('1. Open Instagram app → Settings → Account');
      console.log('2. Tap "Switch to Professional Account"');
      console.log('3. Choose "Business" or "Creator"');
      console.log('4. Link to your Facebook Page');
      console.log('5. Try connecting again');
    } else {
      console.log('✅ Instagram accounts found! They should appear in your app.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Get access token from command line
const accessToken = process.argv[2];

if (!accessToken) {
  console.log('Usage: node check-instagram-accounts.js <access_token>');
  console.log('');
  console.log('To get an access token:');
  console.log('1. Complete the OAuth flow in your app');
  console.log('2. Check the backend console logs for the access token');
  console.log('3. Run this script with that token');
  process.exit(1);
}

checkInstagramAccounts(accessToken);
