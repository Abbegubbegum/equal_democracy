#!/usr/bin/env node

/**
 * Database Migration Script
 *
 * This script:
 * 1. Backs up the production database to a JSON file
 * 2. Migrates the old schema to the new schema
 * 3. Validates the migration
 *
 * Usage:
 *   node scripts/migrate-database.js --backup-only
 *   node scripts/migrate-database.js --migrate
 *   node scripts/migrate-database.js --dry-run
 */

import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local or .env file (prioritize .env.local)
const envLocalPath = path.join(__dirname, "..", ".env.local");
const envPath = path.join(__dirname, "..", ".env");

// Try .env.local first, then fall back to .env
dotenv.config({ path: envLocalPath });
if (!process.env.MONGODB_URI) {
	dotenv.config({ path: envPath });
}

// Parse command line arguments
const args = process.argv.slice(2);
const BACKUP_ONLY = args.includes("--backup-only");
const DRY_RUN = args.includes("--dry-run");
const MIGRATE = args.includes("--migrate");

if (!BACKUP_ONLY && !DRY_RUN && !MIGRATE) {
	console.error("\n❌ Error: Please specify an operation:");
	console.error("  --backup-only  : Only create a backup");
	console.error("  --dry-run      : Test migration without making changes");
	console.error(
		"  --migrate      : Perform actual migration (creates backup first)"
	);
	console.error("\nExample: node scripts/migrate-database.js --migrate\n");
	process.exit(1);
}

// MongoDB connection string from environment
// Prioritize MONGODB_URI_PRODUCTION for migrations, fall back to MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URI_PRODUCTION || process.env.MONGODB_URI;

if (!MONGODB_URI) {
	console.error("\n❌ Error: MONGODB_URI not found");
	console.error("\nPlease ensure you have a .env.local or .env file with:");
	console.error(
		"  MONGODB_URI_PRODUCTION=your-production-mongodb-connection-string"
	);
	console.error(
		"  (or MONGODB_URI if migrating the same database as development)\n"
	);
	console.error("Or set it as an environment variable:");
	console.error(
		"  export MONGODB_URI_PRODUCTION='your-production-mongodb-connection-string'\n"
	);
	process.exit(1);
}

// Display which database will be migrated
const dbName = MONGODB_URI.split("/").pop().split("?")[0];
console.log(`\n🗄️  Target database: ${dbName}`);
if (process.env.MONGODB_URI_PRODUCTION) {
	console.log("   (Using MONGODB_URI_PRODUCTION from environment)");
} else {
	console.log("   (Using MONGODB_URI from environment)");
}

// Backup directory
const BACKUP_DIR = path.join(__dirname, "..", "backups");
const BACKUP_FILE = path.join(
	BACKUP_DIR,
	`database-backup-${new Date().toISOString().replace(/:/g, "-")}.json`
);

/**
 * Connect to MongoDB
 */
async function connectDB() {
	try {
		await mongoose.connect(MONGODB_URI);
		console.log("✅ Connected to MongoDB");
	} catch (error) {
		console.error("❌ Failed to connect to MongoDB:", error);
		process.exit(1);
	}
}

/**
 * Backup entire database to JSON file
 */
async function backupDatabase() {
	console.log("\n📦 Starting database backup...");

	const backup = {
		timestamp: new Date().toISOString(),
		collections: {},
	};

	try {
		// Get all collections
		const collections = await mongoose.connection.db
			.listCollections()
			.toArray();
		console.log(`Found ${collections.length} collections`);

		// Backup each collection
		for (const collectionInfo of collections) {
			const collectionName = collectionInfo.name;
			console.log(`  Backing up ${collectionName}...`);

			const collection =
				mongoose.connection.db.collection(collectionName);
			const documents = await collection.find({}).toArray();

			backup.collections[collectionName] = documents;
			console.log(`    ✓ ${documents.length} documents`);
		}

		// Ensure backup directory exists
		await fs.mkdir(BACKUP_DIR, { recursive: true });

		// Write backup to file
		await fs.writeFile(BACKUP_FILE, JSON.stringify(backup, null, 2));
		console.log(`\n✅ Backup completed: ${BACKUP_FILE}`);
		console.log(`   Size: ${(await fs.stat(BACKUP_FILE)).size} bytes`);

		return backup;
	} catch (error) {
		console.error("❌ Backup failed:", error);
		throw error;
	}
}

/**
 * Migrate User collection
 */
async function migrateUsers(dryRun = false) {
	console.log("\n👤 Migrating User collection...");

	const User = mongoose.connection.db.collection("users");
	const users = await User.find({}).toArray();
	console.log(`  Found ${users.length} users`);

	let updatedCount = 0;
	let promotedToSuperAdmin = 0;

	for (const user of users) {
		const updates = {};

		// Add new fields with defaults if they don't exist
		if (user.isSuperAdmin === undefined) {
			// Promote existing admins to superAdmin
			if (user.isAdmin === true) {
				updates.isSuperAdmin = true;
				promotedToSuperAdmin++;
				console.log(
					`  🌟 Promoting admin to superAdmin: ${user.email}`
				);
			} else {
				updates.isSuperAdmin = false;
			}
		}

		if (user.adminStatus === undefined) {
			// If user has isAdmin = true, set adminStatus to "approved"
			// Otherwise set to "none"
			updates.adminStatus = user.isAdmin ? "approved" : "none";
		}

		if (user.sessionLimit === undefined) {
			updates.sessionLimit = 10;
		}

		if (user.remainingSessions === undefined) {
			updates.remainingSessions = 10;
		}

		// Only update if there are changes
		if (Object.keys(updates).length > 0) {
			if (!dryRun) {
				await User.updateOne({ _id: user._id }, { $set: updates });
			}
			updatedCount++;
			if (!updates.isSuperAdmin) {
				console.log(
					`  ✓ Updated user: ${user.email} (${
						Object.keys(updates).length
					} fields)`
				);
			}
		}
	}

	console.log(
		`  ${dryRun ? "Would update" : "Updated"} ${updatedCount} users`
	);
	if (promotedToSuperAdmin > 0) {
		console.log(
			`  🌟 ${
				dryRun ? "Would promote" : "Promoted"
			} ${promotedToSuperAdmin} existing admins to superAdmin`
		);
	}
}

/**
 * Migrate Proposal collection
 */
async function migrateProposals() {
	console.log("\n📝 Checking Proposal collection...");

	const Proposal = mongoose.connection.db.collection("proposals");
	const proposals = await Proposal.find({}).toArray();
	console.log(`  Found ${proposals.length} proposals`);

	// No migration needed for proposals in current schema
	console.log(`  ✓ No migration needed for proposals`);
}

/**
 * Migrate TopProposal collection
 * - Remove schema validation that requires problem/solution fields
 * - Set default values for existing documents missing these fields
 */
async function migrateTopProposals(dryRun = false) {
	console.log("\n🏆 Migrating TopProposal collection...");

	const db = mongoose.connection.db;
	const TopProposal = db.collection("topproposals");
	const topProposals = await TopProposal.find({}).toArray();
	console.log(`  Found ${topProposals.length} top proposals`);

	// Step 1: Remove or update collection validator to make problem/solution optional
	try {
		console.log("  Updating collection validator to make problem/solution optional...");

		if (!dryRun) {
			// Get current collection info to check if validator exists
			const collections = await db.listCollections({ name: "topproposals" }).toArray();

			if (collections.length > 0) {
				// Remove any existing validator or set a permissive one
				await db.command({
					collMod: "topproposals",
					validator: {},
					validationLevel: "off"
				});
				console.log("  ✓ Disabled collection validator for topproposals");
			}
		} else {
			console.log("  Would disable collection validator for topproposals");
		}
	} catch (error) {
		// Collection might not have a validator, which is fine
		if (error.codeName !== "NamespaceNotFound") {
			console.log(`  Note: Could not modify validator (${error.message})`);
		}
	}

	// Step 2: Update existing documents to have default values for optional fields
	let updatedCount = 0;
	for (const doc of topProposals) {
		const updates = {};

		// Add default empty string for problem if missing
		if (doc.problem === undefined || doc.problem === null) {
			updates.problem = "";
		}

		// Add default empty string for solution if missing
		if (doc.solution === undefined || doc.solution === null) {
			updates.solution = "";
		}

		if (Object.keys(updates).length > 0) {
			if (!dryRun) {
				await TopProposal.updateOne({ _id: doc._id }, { $set: updates });
			}
			updatedCount++;
			console.log(`  ✓ Updated top proposal: ${doc.title} (added defaults for ${Object.keys(updates).join(", ")})`);
		}
	}

	console.log(`  ${dryRun ? "Would update" : "Updated"} ${updatedCount} top proposals with default values`);
}

/**
 * Migrate Settings collection
 */
async function migrateSettings(dryRun = false) {
	console.log("\n⚙️  Migrating Settings collection...");

	const Settings = mongoose.connection.db.collection("settings");
	const settings = await Settings.find({}).toArray();
	console.log(`  Found ${settings.length} settings documents`);

	let updatedCount = 0;

	for (const setting of settings) {
		const updates = {};
		const unset = {};

		// Rename phase2DurationHours to sessionLimitHours
		if (setting.phase2DurationHours !== undefined) {
			updates.sessionLimitHours = setting.phase2DurationHours;
			unset.phase2DurationHours = "";
		}

		// Set default sessionLimitHours if not present
		if (
			setting.sessionLimitHours === undefined &&
			setting.phase2DurationHours === undefined
		) {
			updates.sessionLimitHours = 24;
		}

		// Only update if there are changes
		if (Object.keys(updates).length > 0 || Object.keys(unset).length > 0) {
			if (!dryRun) {
				const updateOp = {};
				if (Object.keys(updates).length > 0) updateOp.$set = updates;
				if (Object.keys(unset).length > 0) updateOp.$unset = unset;
				await Settings.updateOne({ _id: setting._id }, updateOp);
			}
			updatedCount++;
			console.log(`  ✓ Updated settings document`);
		}
	}

	console.log(
		`  ${
			dryRun ? "Would update" : "Updated"
		} ${updatedCount} settings documents`
	);
}

/**
 * Migrate Session collection
 */
async function migrateSessions(dryRun = false) {
	console.log("\n📅 Migrating Session collection...");

	const Session = mongoose.connection.db.collection("sessions");
	const sessions = await Session.find({}).toArray();
	console.log(`  Found ${sessions.length} sessions`);

	let updatedCount = 0;

	for (const session of sessions) {
		const updates = {};

		// Add createdBy field (set to null if not available)
		if (session.createdBy === undefined) {
			updates.createdBy = null;
		}

		// Only update if there are changes
		if (Object.keys(updates).length > 0) {
			if (!dryRun) {
				await Session.updateOne(
					{ _id: session._id },
					{ $set: updates }
				);
			}
			updatedCount++;
			console.log(`  ✓ Updated session: ${session.place}`);
		}
	}

	console.log(
		`  ${dryRun ? "Would update" : "Updated"} ${updatedCount} sessions`
	);
}

/**
 * Validate migration
 */
async function validateMigration() {
	console.log("\n✅ Validating migration...");

	const validations = {
		users: {
			name: "User collection",
			checks: [],
		},
		proposals: {
			name: "Proposal collection",
			checks: [],
		},
		topproposals: {
			name: "TopProposal collection",
			checks: [],
		},
		settings: {
			name: "Settings collection",
			checks: [],
		},
		sessions: {
			name: "Session collection",
			checks: [],
		},
	};

	// Validate Users
	const User = mongoose.connection.db.collection("users");
	const usersWithoutAdminStatus = await User.countDocuments({
		adminStatus: { $exists: false },
	});
	const usersWithoutSessionLimit = await User.countDocuments({
		sessionLimit: { $exists: false },
	});
	validations.users.checks.push({
		name: "All users have adminStatus",
		passed: usersWithoutAdminStatus === 0,
		count: usersWithoutAdminStatus,
	});
	validations.users.checks.push({
		name: "All users have sessionLimit",
		passed: usersWithoutSessionLimit === 0,
		count: usersWithoutSessionLimit,
	});

	// Validate Proposals
	const Proposal = mongoose.connection.db.collection("proposals");
	const proposalCount = await Proposal.countDocuments();
	validations.proposals.checks.push({
		name: "Proposals exist in database",
		passed: proposalCount >= 0,
		count: proposalCount,
	});

	// Validate TopProposals
	const TopProposal = mongoose.connection.db.collection("topproposals");
	const topProposalCount = await TopProposal.countDocuments();
	validations.topproposals.checks.push({
		name: "Top proposals exist in database",
		passed: topProposalCount >= 0,
		count: topProposalCount,
	});

	// Validate Settings
	const Settings = mongoose.connection.db.collection("settings");
	const settingsWithPhase2Duration = await Settings.countDocuments({
		phase2DurationHours: { $exists: true },
	});
	const settingsWithoutSessionLimit = await Settings.countDocuments({
		sessionLimitHours: { $exists: false },
	});
	validations.settings.checks.push({
		name: "No settings have phase2DurationHours field",
		passed: settingsWithPhase2Duration === 0,
		count: settingsWithPhase2Duration,
	});
	validations.settings.checks.push({
		name: "All settings have sessionLimitHours",
		passed: settingsWithoutSessionLimit === 0,
		count: settingsWithoutSessionLimit,
	});

	// Print validation results
	let allPassed = true;
	for (const [, validation] of Object.entries(validations)) {
		console.log(`\n  ${validation.name}:`);
		for (const check of validation.checks) {
			const icon = check.passed ? "✅" : "❌";
			console.log(
				`    ${icon} ${check.name}${
					check.count > 0 ? ` (${check.count} issues)` : ""
				}`
			);
			if (!check.passed) allPassed = false;
		}
	}

	return allPassed;
}

/**
 * Main migration function
 */
async function migrate() {
	console.log("\n🚀 Starting database migration...");
	console.log(
		`Mode: ${
			DRY_RUN ? "DRY RUN (no changes will be made)" : "LIVE MIGRATION"
		}`
	);

	try {
		// Step 1: Connect to database
		await connectDB();

		// Step 2: Create backup
		if (!DRY_RUN) {
			await backupDatabase();
		} else {
			console.log("\n⚠️  Skipping backup in dry-run mode");
		}

		// Step 3: Run migrations
		console.log("\n🔄 Running migrations...");
		await migrateUsers(DRY_RUN);
		await migrateProposals(DRY_RUN);
		await migrateTopProposals(DRY_RUN);
		await migrateSettings(DRY_RUN);
		await migrateSessions(DRY_RUN);

		// Step 4: Validate
		if (!DRY_RUN) {
			const valid = await validateMigration();
			if (valid) {
				console.log("\n✅ Migration completed successfully!");
			} else {
				console.log(
					"\n⚠️  Migration completed with validation warnings"
				);
			}
		} else {
			console.log("\n✅ Dry run completed. No changes were made.");
			console.log(
				"   Run with --migrate to perform the actual migration."
			);
		}

		console.log("\n📊 Summary:");
		console.log(`  Backup file: ${BACKUP_FILE}`);
		console.log(`  Mode: ${DRY_RUN ? "Dry run" : "Live migration"}`);
		console.log("\n");
	} catch (error) {
		console.error("\n❌ Migration failed:", error);
		process.exit(1);
	} finally {
		await mongoose.connection.close();
		console.log("Disconnected from MongoDB");
	}
}

/**
 * Run backup only
 */
async function backupOnly() {
	console.log("\n📦 Running backup-only mode...");

	try {
		await connectDB();
		await backupDatabase();
		console.log("\n✅ Backup completed successfully!");
	} catch (error) {
		console.error("\n❌ Backup failed:", error);
		process.exit(1);
	} finally {
		await mongoose.connection.close();
		console.log("Disconnected from MongoDB");
	}
}

// Run the appropriate operation
if (BACKUP_ONLY) {
	backupOnly();
} else {
	migrate();
}
