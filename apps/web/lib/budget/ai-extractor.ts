/**
 * AI Budget Extractor
 * Uses Claude AI to extract budget data from PDF documents
 * Claude can read PDFs directly, so we don't need pdf-parse!
 */

import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "../logger";

const log = createLogger("BudgetAIExtractor");

/**
 * Extract budget data from PDF using Claude AI (direct PDF reading)
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} documentType - "expenses" or "income"
 * @returns {Promise<Object>} - Extracted budget data
 */
export async function extractBudgetFromPDF(pdfBuffer, documentType = "expenses") {
	// Initialize Anthropic client
	const anthropic = new Anthropic({
		apiKey: process.env.ANTHROPIC_API_KEY,
	});

	// Convert buffer to base64 for Claude API
	const pdfBase64 = pdfBuffer.toString("base64");

	// Create appropriate prompt based on document type
	let prompt = "";

	if (documentType === "expenses") {
		prompt = `Du är en expert på svenska kommunala budgetar. Analysera denna PDF-fil och extrahera BÅDE utgifter (nämnder) OCH intäkter.

VIKTIGA INSTRUKTIONER FÖR UTGIFTER:
1. Hitta ALLA nämnder i dokumentet (ofta 8-12 stycken)
2. Använd NETTOKOSTNAD-kolumnen (oftast tredje sifferkolumnen i Driftredovisning)
3. Leta efter dessa vanliga nämnder:
   - Kommunstyrelsen
   - Barn- och ungdomsnämnden
   - Skolpeng
   - Utbildningsnämnden
   - Gymnasieskolpeng
   - Socialnämnden
   - Fritidsnämnden
   - Kulturnämnden
   - Bygg- och miljötillsynsnämnden
   - Räddningstjänsten (om finns)

VIKTIGA INSTRUKTIONER FÖR INTÄKTER:
1. Sök i hela dokumentet efter Resultatplan, Resultatbudget eller liknande avsnitt
2. Hitta ALLA intäktskällor (vanligtvis 3-6 poster)
3. Leta efter dessa vanliga intäktskällor:
   - Skatteintäkter (största posten, ofta 1500-2500 mnkr)
   - Generella statsbidrag (ofta 200-500 mnkr)
   - Finansiella intäkter (ofta 20-100 mnkr)
   - Verksamhetens resultat
   - Avgifter och ersättningar
   - Hyror och arrenden
4. Ignorera negativa poster i Resultatplanen (de är kostnader, inte intäkter)
5. Intäkter är alltid positiva tal
6. HITTA KOMMUNALSKATTESATSEN (i kr eller procent):
   - Ofta står "kommunalskatt", "skattesats", eller "utdebitering"
   - Vanligt format: "19,00 kr" eller "21,56%"
   - Om procent, konvertera till kr genom att ta procent/100 * 1000
   - Exempel: 21.56% = 0.2156 * 1000 = 215.6 kr per 1000 kr beskattningsbar inkomst

RETURNERA ENDAST JSON (ingen annan text):
{
  "categories": [
    {
      "name": "Kommunstyrelsen",
      "amount": 148800000,
      "minAmount": 59520000,
      "isFixed": false,
      "subcategories": []
    },
    {
      "name": "Skolpeng",
      "amount": 678500000,
      "minAmount": 678500000,
      "isFixed": true,
      "subcategories": []
    }
  ],
  "totalBudget": 1925600000,
  "incomeCategories": [
    {
      "name": "Skatteintäkter",
      "amount": 2024500000,
      "isTaxRate": true,
      "taxRateKr": 19.00
    },
    {
      "name": "Generella statsbidrag",
      "amount": 293500000,
      "isTaxRate": false
    },
    {
      "name": "Finansiella intäkter",
      "amount": 42300000,
      "isTaxRate": false
    }
  ],
  "totalIncome": 2360100000,
  "taxRateKr": 19.00
}

KONVERTERING:
- Om belopp visas i "mnkr" eller "mkr" → multiplicera med 1000000
- Om belopp visas i "tkr" → multiplicera med 1000
- Exempel: "148,8 mnkr" = 148800000 kr
- Negativa belopp (kostnader) = gör positiva

VALIDERING:
- categories ska innehålla MINST 8 nämnder
- incomeCategories ska innehålla MINST 2 poster
- totalBudget = summan av alla category amounts
- totalIncome = summan av alla incomeCategory amounts
- Alla belopp i heltal (kronor)`;


	} else if (documentType === "income") {
		prompt = `Du är en expert på svenska kommunala budgetar. Analysera denna PDF-fil (intäkter & bidrag) och extrahera ALLA intäktskällor.

VIKTIGA INSTRUKTIONER:
1. Hitta ALLA intäktskällor (vanligtvis 3-6 poster)
2. Vanliga intäktskällor:
   - Skatteintäkter (största posten)
   - Generella statsbidrag
   - Finansiella intäkter
   - Avgifter och ersättningar
   - Hyror och arrenden

3. Hitta kommunalskattesats (procent) om den finns i dokumentet
   - Ofta står det "kommunalskatt" eller "skattesats"
   - Vanligt intervall: 20-23%

RETURNERA ENDAST JSON (ingen annan text):
{
  "incomeCategories": [
    {
      "name": "Skatteintäkter",
      "amount": 2024500000,
      "isTaxRate": true,
      "taxRatePercent": 21.56
    },
    {
      "name": "Generella statsbidrag",
      "amount": 293500000,
      "isTaxRate": false
    },
    {
      "name": "Finansiella intäkter",
      "amount": 42300000,
      "isTaxRate": false
    }
  ],
  "totalIncome": 2360300000
}

KONVERTERING:
- Om belopp visas i "mnkr" eller "mkr" → multiplicera med 1000000
- Om belopp visas i "tkr" → multiplicera med 1000
- Exempel: "2 024,5 mnkr" = 2024500000 kr

VALIDERING:
- incomeCategories ska innehålla MINST 3 poster
- totalIncome = summan av alla amounts
- isTaxRate = true ENDAST för "Skatteintäkter"
- Alla belopp i heltal (kronor)`;
	}

	try {
		const message = await anthropic.messages.create({
			model: "claude-haiku-4-5",
			max_tokens: 4096,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "document",
							source: {
								type: "base64",
								media_type: "application/pdf",
								data: pdfBase64,
							},
						},
						{
							type: "text",
							text: prompt,
						},
					],
				},
			],
		});

		// Extract JSON from response
		const responseText = message.content[0].text;

		log.debug("Claude response preview", { preview: responseText.substring(0, 500) });

		// Try to find JSON in the response (supports both ```json and plain JSON)
		let jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
		if (!jsonMatch) {
			jsonMatch = responseText.match(/\{[\s\S]*\}/);
		}

		if (!jsonMatch) {
			log.error("No JSON found in AI response", { fullResponse: responseText });
			throw new Error("No JSON found in AI response. Check the logs.");
		}

		const jsonString = jsonMatch[1] || jsonMatch[0];
		const extractedData = JSON.parse(jsonString);

		// Validate the extracted data
		if (documentType === "expenses") {
			if (!extractedData.categories || extractedData.categories.length < 3) {
				throw new Error(`Too few categories extracted: ${extractedData.categories?.length || 0}. Expected at least 8 committees.`);
			}
			// Income categories are optional for expenses document type
			log.debug("Income categories found", { count: extractedData.incomeCategories?.length || 0 });
		} else if (documentType === "income") {
			if (!extractedData.incomeCategories || extractedData.incomeCategories.length < 2) {
				throw new Error(`Too few income categories extracted: ${extractedData.incomeCategories?.length || 0}. Expected at least 3.`);
			}
		}

		// Generate IDs and ensure proper structure for categories
		if (extractedData.categories) {
			const totalCategories = extractedData.categories.length;
			extractedData.categories = extractedData.categories.map((cat, idx) => {
				const id = cat.name
					.toLowerCase()
					.replace(/å/g, "a")
					.replace(/ä/g, "a")
					.replace(/ö/g, "o")
					.replace(/\s+/g, "-")
					.replace(/[^a-z0-9-]/g, "");

				const subcategories = (cat.subcategories || []).map((sub, subIdx) => {
					const subId = sub.name
						.toLowerCase()
						.replace(/å/g, "a")
						.replace(/ä/g, "a")
						.replace(/ö/g, "o")
						.replace(/\s+/g, "-")
						.replace(/[^a-z0-9-]/g, "");

					return {
						...sub,
						id: `${id}-${subId}-${subIdx}`,
						defaultAmount: sub.amount || 0,
						minAmount: sub.minAmount || 0,
						isFixed: sub.isFixed || false,
					};
				});

				return {
					...cat,
					id: `${id}-${idx}`,
					defaultAmount: cat.amount,
					minAmount: cat.minAmount || Math.floor(cat.amount * 0.4),
					isFixed: cat.isFixed || false,
					color: generateCategoryColor(idx, totalCategories, "expense"),
					subcategories,
				};
			});
		}

		if (extractedData.incomeCategories && extractedData.incomeCategories.length > 0) {
			const totalIncome = extractedData.incomeCategories.length;
			extractedData.incomeCategories = extractedData.incomeCategories.map((cat, idx) => {
				const id = cat.name
					.toLowerCase()
					.replace(/å/g, "a")
					.replace(/ä/g, "a")
					.replace(/ö/g, "o")
					.replace(/\s+/g, "-")
					.replace(/[^a-z0-9-]/g, "");

				return {
					...cat,
					id: `${id}-${idx}`,
					amount: cat.amount || 0,
					isTaxRate: cat.isTaxRate || false,
					taxRatePercent: cat.taxRatePercent || null,
					color: generateCategoryColor(idx, totalIncome, "income"),
				};
			});
		} else {
			// Ensure incomeCategories is always an array
			extractedData.incomeCategories = [];
		}

		log.info("Budget data extracted", {
			categories: extractedData.categories?.length,
			incomeCategories: extractedData.incomeCategories?.length,
			totalBudget: extractedData.totalBudget,
			totalIncome: extractedData.totalIncome,
		});

		return extractedData;
	} catch (error) {
		log.error("Failed to extract budget data using AI", { error: error.message });
		throw new Error("Failed to extract budget data using AI");
	}
}

/**
 * Generate default colors for categories
 * @param {number} index - Category index
 * @param {number} total - Total number of categories
 * @param {string} type - "expense" or "income"
 * @returns {string} - Hex color code
 */
export function generateCategoryColor(index, total, type = "expense") {
	if (type === "income") {
		// Blue-gray gradient for income
		// Hue: 210 (blue) -> 200 (gray-blue)
		// Saturation: 40% -> 10% (from blue to gray)
		const progress = index / Math.max(total - 1, 1);
		const hue = 210 - progress * 10; // 210 -> 200
		const saturation = 40 - progress * 30; // 40% -> 10%
		const lightness = 50 + progress * 10; // 50% -> 60% (lighter as we go)
		return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
	} else {
		// Green-yellow-red gradient for expenses
		// Hue: 120 (green) -> 60 (yellow) -> 0 (red)
		const hue = 120 - (index / Math.max(total - 1, 1)) * 120;
		const saturation = 70;
		const lightness = 50;
		return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
	}
}
