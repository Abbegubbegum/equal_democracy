/**
 * Generate user-friendly session ID from name
 * Example: "Vallentuna Budget 2025" -> "vallentuna-2025"
 */
export function generateSessionId(name, municipality) {
	// Extract year from name if present
	const yearMatch = name.match(/\b(20\d{2})\b/);
	const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

	// Clean municipality name
	const cleanMunicipality = municipality
		.toLowerCase()
		.replace(/å/g, "a")
		.replace(/ä/g, "a")
		.replace(/ö/g, "o")
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

	// Create base ID
	const baseId = `${cleanMunicipality}-${year}`;

	return baseId;
}

/**
 * Ensure session ID is unique by adding counter if needed
 */
export async function ensureUniqueSessionId(baseId, BudgetSession) {
	let sessionId = baseId;
	let counter = 1;

	// Check if base ID exists
	while (await BudgetSession.findOne({ sessionId })) {
		sessionId = `${baseId}-${counter}`;
		counter++;
	}

	return sessionId;
}
