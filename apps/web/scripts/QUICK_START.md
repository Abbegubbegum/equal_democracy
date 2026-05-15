# Database Migration Quick Start

## TL;DR - Run This

### 1. Add production database URI to .env.local

```env
# .env.local file in project root (or .env)
MONGODB_URI=mongodb+srv://...../development  # Your dev database
MONGODB_URI_PRODUCTION=mongodb+srv://...../production  # Production database for migrations
```

The migration script will use `MONGODB_URI_PRODUCTION` if available, otherwise falls back to `MONGODB_URI`.

### 2. Test first (no changes made)

```bash
npm run migrate:dry-run
```

### 3. Run the migration

```bash
npm run migrate
```

## What This Does

The migration will:

1. ✅ **Backup** your entire database to `backups/` folder
2. ✅ **Add new fields** to User collection (isSuperAdmin, adminStatus, sessionLimit, etc.)
3. 🌟 **Promote existing admins** to superAdmin automatically
4. ✅ **Rename** phase2DurationHours → sessionLimitHours in Settings
5. ✅ **Add** createdBy field to Sessions
6. ✅ **Validate** everything worked correctly

## Commands

```bash
# Test without making changes
npm run migrate:dry-run

# Create backup only
npm run migrate:backup

# Run full migration (includes backup)
npm run migrate
```

## Example

```bash
# 1. Add MONGODB_URI_PRODUCTION to .env.local
# MONGODB_URI_PRODUCTION=mongodb+srv://...../production

# 2. Test migration (shows which database will be targeted)
npm run migrate:dry-run

# Output:
# 🗄️  Target database: production
#    (Using MONGODB_URI_PRODUCTION from environment)
# 🚀 Starting database migration...
# Mode: DRY RUN (no changes will be made)
# ✅ Connected to MongoDB
# 👤 Migrating User collection...
#   Found 150 users
#   Would update 150 users
# ...
# ✅ Dry run completed. No changes were made.

# 3. Run actual migration
npm run migrate

# Output:
# 🚀 Starting database migration...
# Mode: LIVE MIGRATION
# ✅ Connected to MongoDB
# 📦 Starting database backup...
# ✅ Backup completed: backups/database-backup-2025-01-20T10-30-00.000Z.json
# 🔄 Running migrations...
# ✅ Migration completed successfully!
```

## Safety

- ✅ **Automatic backup** before any changes
- ✅ **Dry-run mode** to test first
- ✅ **Validation** after migration
- ✅ **Idempotent** (safe to run multiple times)

## If Something Goes Wrong

The backup file is in `backups/` directory. Keep it safe for at least a week.

To restore manually:

1. Open MongoDB Compass or your MongoDB client
2. Drop the affected collections
3. Import from the JSON backup file

## Need Help?

See [MIGRATION_README.md](./MIGRATION_README.md) for detailed documentation.

## Post-Migration

After migration:

- ✅ Test your application thoroughly
- ✅ Check user logins work
- ✅ Test budget features
- ✅ Keep backup file for 7+ days
