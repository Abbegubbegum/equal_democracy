/**
 * Test script for municipal agenda extraction
 * Tests AI extraction with multiple agendas from different committees
 */

// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { extractAgendaFromURL, getCategoryName } from "../lib/municipal/agenda-extractor.js";

const TEST_AGENDAS = [
	{
		name: "Kommunfullmäktige 2026-01-19",
		url: "https://dok.vallentuna.se/file/demokrati/sammantr%C3%A4deshandlingar/2026/kommunfullm%C3%A4ktige/2026-01-19/00.%20F%C3%B6redragningslista.pdf",
		meetingType: "Kommunfullmäktige",
	},
	{
		name: "Kommunstyrelsen 2026-02-02",
		url: "https://dok.vallentuna.se/file/demokrati/sammantr%C3%A4deshandlingar/2026/kommunstyrelsen/ks/2026-02-02/00.%20F%C3%B6redragningslista.pdf",
		meetingType: "Kommunstyrelsen",
	},
	{
		name: "Bygg- och miljötillsynsnämnden 2026-01-22",
		url: "https://dok.vallentuna.se/file/demokrati/sammantr%C3%A4deshandlingar/2026/bygg-%20och%20milj%C3%B6tillsynsn%C3%A4mnden/2026-01-22/00.%20F%C3%B6redragningslista%20pdf.pdf",
		meetingType: "Bygg- och miljötillsynsnämnden",
	},
];

async function testAgenda(agenda) {
	console.log(`\n${"=".repeat(80)}`);
	console.log(`📄 Testing: ${agenda.name}`);
	console.log(`🔗 URL: ${agenda.url}`);
	console.log(`${"=".repeat(80)}\n`);

	try {
		const startTime = Date.now();
		const result = await extractAgendaFromURL(agenda.url, agenda.meetingType);
		const duration = ((Date.now() - startTime) / 1000).toFixed(2);

		console.log(`✅ Extraction successful! (${duration}s)\n`);

		console.log(`📊 Meeting: ${result.meetingName}`);
		console.log(`📅 Date: ${result.meetingDate}`);
		console.log(`📝 Items extracted: ${result.items.length}\n`);

		if (result.items.length === 0) {
			console.log("⚠️  WARNING: No items extracted!\n");
			return { success: false, error: "No items extracted" };
		}

		console.log("📋 Extracted Items:\n");

		result.items.forEach((item, index) => {
			console.log(`${index + 1}. [${item.originalNumber}] ${item.title}`);
			console.log(`   📖 ${item.description.substring(0, 100)}${item.description.length > 100 ? "..." : ""}`);
			console.log(
				`   🏷️  Categories: ${item.categories.map((c) => `${c}. ${getCategoryName(c)}`).join(", ")}`
			);
			if (item.initialArguments && item.initialArguments.length > 0) {
				console.log(`   💬 Initial arguments: ${item.initialArguments.length}`);
				item.initialArguments.forEach((arg) => {
					console.log(
						`      ${arg.type === "for" ? "✓" : "✗"} ${arg.text.substring(0, 80)}${arg.text.length > 80 ? "..." : ""}`
					);
				});
			}
			console.log("");
		});

		// Analyze category distribution
		const categoryStats = {};
		result.items.forEach((item) => {
			item.categories.forEach((cat) => {
				categoryStats[cat] = (categoryStats[cat] || 0) + 1;
			});
		});

		console.log("📊 Category Distribution:");
		Object.entries(categoryStats)
			.sort((a, b) => b[1] - a[1])
			.forEach(([cat, count]) => {
				console.log(`   ${cat}. ${getCategoryName(parseInt(cat))}: ${count} items`);
			});

		console.log("");

		return { success: true, itemCount: result.items.length, duration };
	} catch (error) {
		console.error(`❌ Extraction failed!`);
		console.error(`Error: ${error.message}\n`);
		return { success: false, error: error.message };
	}
}

async function runTests() {
	console.log("\n🧪 Municipal Agenda Extraction Test Suite");
	console.log(`Testing ${TEST_AGENDAS.length} agendas\n`);

	const results = [];

	for (const agenda of TEST_AGENDAS) {
		const result = await testAgenda(agenda);
		results.push({
			name: agenda.name,
			...result,
		});

		// Add delay between tests to avoid rate limiting
		if (TEST_AGENDAS.indexOf(agenda) < TEST_AGENDAS.length - 1) {
			console.log("⏳ Waiting 3 seconds before next test...\n");
			await new Promise((res) => setTimeout(res, 3000));
		}
	}

	// Summary
	console.log(`\n${"=".repeat(80)}`);
	console.log("📊 TEST SUMMARY");
	console.log(`${"=".repeat(80)}\n`);

	const successful = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success).length;

	console.log(`✅ Successful: ${successful}/${results.length}`);
	console.log(`❌ Failed: ${failed}/${results.length}\n`);

	results.forEach((result) => {
		const status = result.success ? "✅" : "❌";
		const details = result.success
			? `${result.itemCount} items in ${result.duration}s`
			: `Error: ${result.error}`;
		console.log(`${status} ${result.name}: ${details}`);
	});

	console.log("");

	if (successful === results.length) {
		console.log("🎉 All tests passed!\n");
		process.exit(0);
	} else {
		console.log("⚠️  Some tests failed. Check errors above.\n");
		process.exit(1);
	}
}

// Run tests
runTests().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
