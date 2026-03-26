# Database Migration Guide

This guide explains how to migrate your production database from the old schema to the new schema.

## Overview

The migration script handles the following changes:

### Schema Changes

#### User Collection
- ✅ Add `isSuperAdmin` field (default: false, **or true if user is currently an admin**)
- ✅ Add `adminStatus` field (default: "none", or "approved" if isAdmin=true)
- ✅ Add `sessionLimit` field (default: 10)
- ✅ Add `remainingSessions` field (default: 10)
- ✅ Add optional fields: `appliedForAdminAt`, `organization`, `requestedSessions`
- 🌟 **Existing admins (isAdmin=true) are automatically promoted to superAdmin**

#### Proposal Collection
- ✅ No changes needed (already matches new schema)

#### TopProposal Collection
- ✅ No changes needed (already matches new schema)

#### Settings Collection
- ✅ Rename `phase2DurationHours` → `sessionLimitHours`
- ✅ Add "blue" to theme enum

#### Session Collection
- ✅ Add `createdBy` field (set to null for existing sessions)

#### New Collections
The following collections will be automatically created when first used:
- `SessionRequest`
- `BudgetSession`
- `BudgetVote`
- `BudgetResult`

## Prerequisites

1. **Environment Variable**: Add production database URI to your `.env.local` or `.env` file
   ```env
   MONGODB_URI=mongodb+srv://...../development  # Your dev database
   MONGODB_URI_PRODUCTION=mongodb+srv://...../production  # For migrations
   ```

   **Important**: The migration script prioritizes `MONGODB_URI_PRODUCTION` if set, allowing you to keep your development database in `MONGODB_URI` while migrating production separately.

   The script will automatically check `.env.local` first, then fall back to `.env`.

   Alternatively, set it as an environment variable:
   ```bash
   export MONGODB_URI_PRODUCTION="your-production-mongodb-connection-string"
   ```

2. **Node.js**: Node.js 18+ required (for ES modules support)

3. **Backup Space**: Ensure you have sufficient disk space for the backup file

## Usage

### Step 1: Test the Migration (Dry Run)

First, run a dry-run to see what changes will be made **without modifying the database**:

```bash
node scripts/migrate-database.js --dry-run
```

This will:
- Connect to the database
- Show what changes would be made
- **NOT create a backup** (no changes are made)
- **NOT modify any data**

### Step 2: Create a Backup Only (Optional)

If you want to create a backup before testing:

```bash
node scripts/migrate-database.js --backup-only
```

This will:
- Connect to the database
- Create a timestamped backup in `backups/` directory
- Exit without making any changes

### Step 3: Run the Migration

When you're ready to perform the actual migration:

```bash
node scripts/migrate-database.js --migrate
```

This will:
1. ✅ Connect to the production database
2. ✅ Create a complete backup to `backups/database-backup-[timestamp].json`
3. ✅ Migrate all collections according to the new schema
4. ✅ Validate the migration
5. ✅ Display results and any issues

## Safety Features

### Automatic Backup
- Every migration (except dry-run) creates a timestamped backup
- Backups are stored in `backups/` directory
- Each backup includes all collections and documents

### Validation
After migration, the script validates:
- ✅ All users have required new fields
- ✅ No proposals have removed fields
- ✅ Settings have been properly renamed
- ✅ All migrations completed successfully

### Dry Run Mode
- Test migrations without making changes
- See exactly what will be modified
- No backup created (since no changes are made)

## Example Output

### Dry Run
```
🚀 Starting database migration...
Mode: DRY RUN (no changes will be made)

✅ Connected to MongoDB

⚠️  Skipping backup in dry-run mode

🔄 Running migrations...

👤 Migrating User collection...
  Found 150 users
  ✓ Updated user: user1@example.com (4 fields)
  ✓ Updated user: user2@example.com (4 fields)
  Would update 150 users

📝 Migrating Proposal collection...
  Found 45 proposals
  ✓ Updated proposal: Fix the park
  Would update 45 proposals

...

✅ Dry run completed. No changes were made.
   Run with --migrate to perform the actual migration.
```

### Live Migration
```
🚀 Starting database migration...
Mode: LIVE MIGRATION

✅ Connected to MongoDB

📦 Starting database backup...
Found 10 collections
  Backing up users...
    ✓ 150 documents
  Backing up proposals...
    ✓ 45 documents
  ...

✅ Backup completed: backups/database-backup-2025-01-20T10-30-00.000Z.json
   Size: 2458340 bytes

🔄 Running migrations...
[... migration steps ...]

✅ Validating migration...
  User collection:
    ✅ All users have adminStatus
    ✅ All users have sessionLimit
  Proposal collection:
    ✅ No proposals have estimatedCost field
  ...

✅ Migration completed successfully!

📊 Summary:
  Backup file: backups/database-backup-2025-01-20T10-30-00.000Z.json
  Mode: Live migration
```

## Rollback

If something goes wrong, you can restore from the backup:

### Option 1: Using mongorestore (Recommended)

If you have `mongodump` backups:
```bash
mongorestore --uri="your-mongodb-uri" --drop /path/to/backup
```

### Option 2: Manual Restoration from JSON

1. Load the backup JSON file
2. Use a MongoDB GUI tool (MongoDB Compass, Studio 3T) to import the data
3. Or write a script to restore from the JSON backup:

```javascript
import mongoose from 'mongoose';
import fs from 'fs/promises';

const backup = JSON.parse(await fs.readFile('backups/database-backup-[timestamp].json', 'utf-8'));

// Restore each collection
for (const [collectionName, documents] of Object.entries(backup.collections)) {
  const collection = mongoose.connection.db.collection(collectionName);
  await collection.deleteMany({});
  await collection.insertMany(documents);
}
```

## Troubleshooting

### "MONGODB_URI not found"
Ensure your `.env.local` or `.env` file contains:
```env
MONGODB_URI_PRODUCTION=mongodb+srv://username:password@cluster.mongodb.net/production
```

Or at minimum:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
```

Or set it as an environment variable:
```bash
export MONGODB_URI_PRODUCTION="mongodb+srv://username:password@cluster.mongodb.net/production"
```

### "Failed to connect to MongoDB"
Check:
- Network connectivity
- MongoDB URI is correct
- Firewall rules allow connection
- MongoDB server is running

### Migration fails mid-way
- Check the backup file in `backups/` directory
- Review the error message
- Consider restoring from backup and trying again

## Post-Migration Checklist

After successful migration:

- [ ] Verify the application works correctly
- [ ] Test user login and admin features
- [ ] Test budget session creation (new feature)
- [ ] Check settings page
- [ ] Test proposal creation and voting
- [ ] Monitor error logs for any schema-related issues
- [ ] Keep the backup file for at least 7 days

## Support

If you encounter issues:
1. Check the backup file was created
2. Review the error messages carefully
3. Test with `--dry-run` first
4. Consider restoring from backup if needed

## Advanced: Custom MongoDB Backup

For more robust backups, use `mongodump`:

```bash
# Create binary backup
mongodump --uri="your-mongodb-uri" --out=./mongodb-backup-$(date +%Y%m%d-%H%M%S)

# Restore from binary backup
mongorestore --uri="your-mongodb-uri" --drop ./mongodb-backup-[timestamp]
```

Binary backups are:
- Faster to restore
- More reliable for large databases
- Better for production use
- Can be compressed

## Notes

- The migration is idempotent (safe to run multiple times)
- Existing data is preserved where possible
- New fields get sensible defaults
- Removed fields are backed up in the JSON file
- The script validates all changes before completion
