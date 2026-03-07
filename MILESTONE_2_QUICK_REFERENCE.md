# Milestone 2 - Quick Reference

## Rollback Script Commands

```bash
# Dry run (default - no changes)
npm run rollback:v2-to-v1

# Execute rollback
npm run rollback:v2-to-v1 -- --execute

# Run tests
npm test -- scripts/__tests__/rollback-v2-to-v1.test.ts
```

## What It Does

1. Checks publishing queue is drained
2. Finds all accounts with `connectionVersion='v2'`
3. Sets `connectionVersion='v1'`
4. Preserves all encrypted tokens and metadata

## Safety Features

- ✅ Blocks if queue has active/waiting jobs
- ✅ Idempotent (safe to run twice)
- ✅ Dry-run by default
- ✅ Preserves encrypted tokens
- ✅ Detailed logging

## Example Output

```
Connected to MongoDB
Checking publishing queue status...
Queue status { waiting: 0, active: 0, delayed: 0, failed: 0 }
✅ Queue drained - safe to proceed
Found 2 V2 accounts
⚠️  EXECUTE MODE - Rolling back accounts...
Account rolled back successfully { accountId: '...', platform: 'twitter' }
Account rolled back successfully { accountId: '...', platform: 'linkedin' }
Rollback complete { totalV2Accounts: 2, rolledBack: 2, errors: 0 }
✅ Rollback complete.
```

## When to Use

- **Before Milestone 3**: Test rollback works before enabling upgrades
- **Production Issues**: Quickly rollback V2 accounts if problems arise
- **Testing**: Verify rollback mechanism before deploying upgrades

## Verification

```bash
# Check V2 count (should be 0 after rollback)
mongosh --eval "db.socialaccounts.find({connectionVersion:'v2'}).count()"

# Check V1 count
mongosh --eval "db.socialaccounts.find({connectionVersion:'v1'}).count()"
```

---

**Milestone**: 2 (Rollback Script)
**Status**: Complete
**Next**: Milestone 3 (V1→V2 Upgrade)
