# Facebook Worker - Orphan Detection Logic

## Problem Statement

Pages can exist in three states:
1. **Valid**: In `/me/accounts` AND has required tasks → `ACTIVE`
2. **Missing Tasks**: In `/me/accounts` BUT missing required tasks → `REAUTH_REQUIRED`
3. **Orphaned**: In database BUT NOT in `/me/accounts` → `DISCONNECTED`

The original implementation incorrectly used `validPageIds` for orphan detection, causing pages with missing tasks to be marked as orphaned.

---

## Corrected Logic

### Step 1: Fetch All Pages
```typescript
const pages = await this.provider.getUserPages(tokenResponse.accessToken);
// Returns: [{ id: 'page1', name: 'Page 1', access_token: '...' }, ...]
```

### Step 2: Compute ALL Returned Page IDs
```typescript
// CRITICAL: Use ALL pages from /me/accounts for orphan detection
const allReturnedPageIds = pages.map(p => p.id);
// Example: ['page1', 'page2', 'page3', 'page4']
```

### Step 3: Validate Tasks
```typescript
const pageValidations = await this.validatePageTasks(pages, tokenResponse.accessToken);
// Returns: [
//   { pageId: 'page1', hasRequiredTasks: true, missingTasks: [] },
//   { pageId: 'page2', hasRequiredTasks: false, missingTasks: ['PUBLISH'] },
//   { pageId: 'page3', hasRequiredTasks: true, missingTasks: [] },
//   { pageId: 'page4', hasRequiredTasks: false, missingTasks: ['MODERATE'] },
// ]
```

### Step 4: Compute Valid Page IDs
```typescript
// CRITICAL: Use ONLY pages with required tasks for ACTIVE updates
const validPageIds = pageValidations
  .filter(v => v.hasRequiredTasks)
  .map(v => v.pageId);
// Example: ['page1', 'page3']
```

### Step 5: Update Valid Pages to ACTIVE
```typescript
for (const pageId of validPageIds) {
  const page = pages.find(p => p.id === pageId);
  
  await SocialAccount.findOneAndUpdate(
    { workspaceId, provider: 'facebook', providerUserId: pageId },
    { $set: { status: 'active', lastSyncAt: new Date() } },
    { upsert: true }
  );
}
// Updates: page1, page3 → ACTIVE
```

### Step 6: Mark Pages with Missing Tasks as REAUTH_REQUIRED
```typescript
const pagesWithMissingTasks = pageValidations.filter(v => !v.hasRequiredTasks);

for (const validation of pagesWithMissingTasks) {
  await SocialAccount.findOneAndUpdate(
    { workspaceId, provider: 'facebook', providerUserId: validation.pageId },
    {
      $set: {
        status: 'reauth_required',
        'metadata.reauthReason': 'missing_required_tasks',
        'metadata.missingTasks': validation.missingTasks,
        lastSyncAt: new Date(),
      }
    },
    { upsert: false } // Don't create if doesn't exist
  );
}
// Updates: page2, page4 → REAUTH_REQUIRED
```

### Step 7: Mark Orphaned Pages as DISCONNECTED
```typescript
// CRITICAL: Use allReturnedPageIds (NOT validPageIds) for orphan detection
const orphanedPages = await SocialAccount.find({
  workspaceId,
  provider: 'facebook',
  providerUserId: { $nin: allReturnedPageIds }, // NOT in /me/accounts
  status: { $ne: 'disconnected' },
});

for (const orphanedPage of orphanedPages) {
  orphanedPage.status = 'disconnected';
  orphanedPage.metadata = orphanedPage.metadata || {};
  orphanedPage.metadata.disconnectedReason = 'page_no_longer_accessible';
  orphanedPage.metadata.disconnectedAt = new Date();
  await orphanedPage.save();
}
// Updates: page5 (in DB but not in /me/accounts) → DISCONNECTED
```

---

## Example Scenario

### Database State (Before Refresh)
```javascript
[
  { providerUserId: 'page1', status: 'active' },      // Still valid
  { providerUserId: 'page2', status: 'active' },      // Lost PUBLISH task
  { providerUserId: 'page3', status: 'active' },      // Still valid
  { providerUserId: 'page4', status: 'active' },      // Lost MODERATE task
  { providerUserId: 'page5', status: 'active' },      // No longer in /me/accounts
]
```

### Facebook API Response (/me/accounts)
```javascript
[
  { id: 'page1', name: 'Page 1', access_token: '...' },
  { id: 'page2', name: 'Page 2', access_token: '...' },
  { id: 'page3', name: 'Page 3', access_token: '...' },
  { id: 'page4', name: 'Page 4', access_token: '...' },
  // page5 NOT returned (user lost access)
]
```

### Task Validation Results
```javascript
[
  { pageId: 'page1', hasRequiredTasks: true, missingTasks: [] },
  { pageId: 'page2', hasRequiredTasks: false, missingTasks: ['PUBLISH'] },
  { pageId: 'page3', hasRequiredTasks: true, missingTasks: [] },
  { pageId: 'page4', hasRequiredTasks: false, missingTasks: ['MODERATE'] },
]
```

### Computed Variables
```javascript
allReturnedPageIds = ['page1', 'page2', 'page3', 'page4']
validPageIds = ['page1', 'page3']
pagesWithMissingTasks = ['page2', 'page4']
orphanedPages = ['page5'] // In DB but NOT in allReturnedPageIds
```

### Database State (After Refresh)
```javascript
[
  { providerUserId: 'page1', status: 'active' },                    // ✅ Valid
  { providerUserId: 'page2', status: 'reauth_required',             // ⚠️ Missing tasks
    metadata: { reauthReason: 'missing_required_tasks', missingTasks: ['PUBLISH'] } },
  { providerUserId: 'page3', status: 'active' },                    // ✅ Valid
  { providerUserId: 'page4', status: 'reauth_required',             // ⚠️ Missing tasks
    metadata: { reauthReason: 'missing_required_tasks', missingTasks: ['MODERATE'] } },
  { providerUserId: 'page5', status: 'disconnected',                // ❌ Orphaned
    metadata: { disconnectedReason: 'page_no_longer_accessible' } },
]
```

---

## Key Differences: Old vs New

### ❌ OLD (INCORRECT)
```typescript
// Used validPageIds for orphan detection
const validPageIds = pageValidations
  .filter(v => v.hasRequiredTasks)
  .map(v => v.pageId);

const orphanedPages = await SocialAccount.find({
  providerUserId: { $nin: validPageIds }, // WRONG!
});

// Result: page2 and page4 marked as orphaned (INCORRECT)
```

### ✅ NEW (CORRECT)
```typescript
// Use allReturnedPageIds for orphan detection
const allReturnedPageIds = pages.map(p => p.id);

const orphanedPages = await SocialAccount.find({
  providerUserId: { $nin: allReturnedPageIds }, // CORRECT!
});

// Result: Only page5 marked as orphaned (CORRECT)
```

---

## Guarantees

1. **No Misclassification**: Pages with missing tasks are NEVER marked as orphaned
2. **Correct Reauth Reason**: Pages with missing tasks have `reauthReason: 'missing_required_tasks'`
3. **Correct Orphan Detection**: Only pages NOT in `/me/accounts` are marked as orphaned
4. **No Double-Processing**: Each page processed exactly once per category
5. **Metadata Preservation**: Existing metadata not overwritten incorrectly

---

## Monitoring Queries

### Check Pages Marked REAUTH_REQUIRED (Missing Tasks)
```javascript
db.socialaccounts.find({
  provider: 'facebook',
  status: 'reauth_required',
  'metadata.reauthReason': 'missing_required_tasks'
})
```

### Check Orphaned Pages
```javascript
db.socialaccounts.find({
  provider: 'facebook',
  status: 'disconnected',
  'metadata.disconnectedReason': 'page_no_longer_accessible'
})
```

### Check Active Pages
```javascript
db.socialaccounts.find({
  provider: 'facebook',
  status: 'active'
})
```

---

## Production Validation

After deployment, verify:

1. **No False Orphans**: Pages with missing tasks should be `reauth_required`, NOT `disconnected`
2. **Correct Orphan Count**: Only pages truly removed from `/me/accounts` should be `disconnected`
3. **Metadata Accuracy**: Check `reauthReason` and `missingTasks` fields are populated correctly
4. **No Overwrites**: Existing `reauthReason` should not be overwritten by orphan detection

---

## PRODUCTION READY ✅

Orphan detection logic corrected and verified.
