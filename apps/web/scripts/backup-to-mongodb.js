#!/usr/bin/env node

/**
 * MongoDB to MongoDB Backup Script
 *
 * This script copies all collections from the production database
 * to a backup MongoDB database.
 *
 * Usage:
 *   node scripts/backup-to-mongodb.js
 *
 * Environment variables required:
 *   MONGODB_URI_PRODUCTION - Source database connection string
 *   MONGODB_URI_BACKUP - Target backup database connection string
 */

import { MongoClient } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envLocalPath = path.join(__dirname, "..", ".env.local");
const envPath = path.join(__dirname, "..", ".env");

dotenv.config({ path: envLocalPath });
if (!process.env.MONGODB_URI_PRODUCTION) {
	dotenv.config({ path: envPath });
}

const SOURCE_URI = process.env.MONGODB_URI_PRODUCTION || process.env.MONGODB_URI;
const BACKUP_URI = process.env.MONGODB_URI_BACKUP;

if (!SOURCE_URI) {
	console.error("\n❌ Error: Source database URI not found");
	console.error("Please set MONGODB_URI_PRODUCTION or MONGODB_URI in your .env.local file\n");
	process.exit(1);
}

if (!BACKUP_URI) {
	console.error("\n❌ Error: Backup database URI not found");
	console.error("Please set MONGODB_URI_BACKUP in your .env.local file\n");
	process.exit(1);
}

const getDbName = (uri) => uri.split("/").pop().split("?")[0];

async function backupToMongoDB() {
	const sourceDbName = getDbName(SOURCE_URI);
	const backupDbName = getDbName(BACKUP_URI);

	console.log(`\n📦 MongoDB Backup`);
	console.log(`   Source: ${sourceDbName}`);
	console.log(`   Target: ${backupDbName}`);
	console.log(`   Time: ${new Date().toISOString()}\n`);

	let sourceClient;
	let backupClient;

	try {
		// Connect to both databases
		console.log("Connecting to source database...");
		sourceClient = new MongoClient(SOURCE_URI);
		await sourceClient.connect();
		const sourceDb = sourceClient.db();
		console.log("✅ Connected to source database");

		console.log("Connecting to backup database...");
		backupClient = new MongoClient(BACKUP_URI);
		await backupClient.connect();
		const backupDb = backupClient.db();
		console.log("✅ Connected to backup database");

		// Get all collections from source
		const collections = await sourceDb.listCollections().toArray();
		console.log(`\nFound ${collections.length} collections to backup\n`);

		let totalDocuments = 0;

		for (const collectionInfo of collections) {
			const collectionName = collectionInfo.name;
			console.log(`📄 Backing up ${collectionName}...`);

			const sourceCollection = sourceDb.collection(collectionName);
			const backupCollection = backupDb.collection(collectionName);

			// Get all documents from source
			const documents = await sourceCollection.find({}).toArray();

			if (documents.length === 0) {
				console.log(`   ⏭️  Skipped (empty collection)`);
				continue;
			}

			// Clear existing data in backup collection
			await backupCollection.deleteMany({});

			// Insert all documents into backup
			await backupCollection.insertMany(documents);

			totalDocuments += documents.length;
			console.log(`   ✅ Copied ${documents.length} documents`);
		}

		console.log(`\n✅ Backup completed successfully!`);
		console.log(`   Total documents copied: ${totalDocuments}`);
		console.log(`   Backup database: ${backupDbName}\n`);

	} catch (error) {
		console.error("\n❌ Backup failed:", error.message);
		process.exit(1);
	} finally {
		if (sourceClient) await sourceClient.close();
		if (backupClient) await backupClient.close();
		console.log("Disconnected from databases");
	}
}

backupToMongoDB();
