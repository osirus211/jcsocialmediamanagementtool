# Instagram Account Setup Guide

## Issue: "Can't see the Instagram account"

The Instagram OAuth flow completed successfully, but no Instagram Business accounts were found. This means your Instagram account needs to be properly configured.

## Why This Happens

Instagram OAuth works differently than Twitter or Facebook. Instagram requires:
1. **Instagram Business or Creator Account** (not a personal account)
2. **Linked to a Facebook Page** (Instagram must be connected to a Facebook Page)
3. **Admin Access** (You must be an admin of the Facebook Page)

## Step-by-Step Setup

### Step 1: Convert Instagram to Business Account

1. Open Instagram app on your phone
2. Go to your profile
3. Tap the menu (☰) → Settings
4. Tap "Account"
5. Tap "Switch to Professional Account"
6. Choose "Business" or "Creator"
7. Complete the setup

### Step 2: Create or Use Existing Facebook Page

1. Go to [Facebook Pages](https://www.facebook.com/pages/create)
2. Create a new page OR use an existing page you manage
3. Make sure you have **Admin** access to the page

### Step 3: Link Instagram to Facebook Page

**Method 1: Via Instagram App**
1. Open Instagram app
2. Go to Settings → Account → Linked Accounts
3. Tap "Facebook"
4. Log in to Facebook
5. Select the Facebook Page you want to link

**Method 2: Via Facebook Page Settings**
1. Go to your Facebook Page
2. Click "Settings" → "Instagram"
3. Click "Connect Account"
4. Log in to Instagram
5. Authorize the connection

### Step 4: Verify the Connection

1. Go to your Facebook Page
2. Click "Settings" → "Instagram"
3. You should see your Instagram account listed
4. Make sure it shows "Connected"

### Step 5: Reconnect via Our App

1. Go back to the Social Accounts page
2. Click "Connect Account" → "Instagram"
3. Authorize via Facebook
4. Your Instagram Business account should now appear!

## Troubleshooting

### "No Instagram Business accounts found"

**Cause:** Instagram account is not linked to any Facebook Page you manage

**Solution:**
1. Verify you completed Steps 1-3 above
2. Make sure you're an admin of the Facebook Page
3. Check that Instagram is actually linked (Step 4)

### "Instagram account is personal, not business"

**Cause:** Instagram account is still a personal account

**Solution:**
1. Convert to Business or Creator account (Step 1)
2. Wait a few minutes for changes to propagate
3. Try connecting again

### "Permission denied"

**Cause:** Missing required permissions during OAuth

**Solution:**
1. When authorizing, make sure to grant ALL permissions:
   - ✅ Manage your Pages
   - ✅ Publish content to Instagram
   - ✅ Read Instagram insights
2. Don't skip any permission requests
3. Try disconnecting and reconnecting

### "Multiple pages but Instagram not showing"

**Cause:** Instagram is linked to a different page than expected

**Solution:**
1. Check ALL your Facebook Pages
2. Find which page has Instagram linked
3. Make sure you're an admin of that page
4. Try connecting again

## What Gets Connected

When you connect Instagram via our app, the system:
1. Fetches all your Facebook Pages
2. For each page, checks if it has an Instagram Business account
3. Saves all Instagram Business accounts found
4. You can manage multiple Instagram accounts if you have multiple pages

## Requirements Checklist

Before connecting Instagram, verify:
- [ ] Instagram account is Business or Creator (not personal)
- [ ] Instagram is linked to a Facebook Page
- [ ] You are an admin of the Facebook Page
- [ ] Facebook Page has Instagram connected in settings
- [ ] You grant all permissions during OAuth

## Still Having Issues?

### Check Facebook Page Settings
1. Go to Facebook Page → Settings → Instagram
2. If Instagram is not connected, click "Connect Account"
3. If Instagram is connected but you still can't see it, try:
   - Disconnecting Instagram from the page
   - Reconnecting Instagram to the page
   - Waiting 5 minutes
   - Trying OAuth again

### Check Instagram Account Type
1. Open Instagram app
2. Go to Settings → Account
3. Look for "Switch to Personal Account" option
4. If you see this, you're already a Business/Creator account ✅
5. If you see "Switch to Professional Account", you need to convert

### Verify Permissions
The Instagram OAuth requires these Facebook permissions:
- `instagram_basic` - Basic Instagram profile access
- `instagram_content_publish` - Publish content
- `pages_show_list` - List your pages
- `pages_read_engagement` - Read engagement metrics

If you denied any of these, the connection will fail.

## Technical Details

### How Instagram OAuth Works
1. User authorizes via Facebook Login
2. System gets long-lived Facebook token
3. System fetches user's Facebook Pages
4. For each page, system calls: `GET /{page-id}?fields=instagram_business_account`
5. If page has Instagram Business account, it's saved
6. If no pages have Instagram, error is shown

### Why Instagram Uses Facebook
Instagram is owned by Facebook (Meta). Instagram Business accounts must be linked to Facebook Pages for API access. Personal Instagram accounts cannot be accessed via API.

### What's Stored
When Instagram account is connected, we store:
- Instagram Business Account ID
- Username
- Profile picture
- Follower count
- Media count
- Biography
- Website
- Associated Facebook Page ID and name

## Next Steps

Once your Instagram account is properly set up:
1. Complete Steps 1-4 above
2. Return to Social Accounts page
3. Click "Connect Account" → "Instagram"
4. Authorize via Facebook
5. Your Instagram Business account will appear
6. You can now schedule posts to Instagram!

## Support

If you've completed all steps and still can't connect:
1. Check backend logs for detailed error messages
2. Verify Instagram credentials in `.env` file
3. Ensure Facebook App has Instagram permissions enabled
4. Contact support with your Facebook Page ID and Instagram username
