/**
 * AI Municipal Agenda Extractor
 * Uses Claude AI to extract meeting items from Swedish municipal agendas (kallelser)
 */

import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "../logger";

const log = createLogger("AgendaExtractor");

/**
 * Extract meeting items from municipal agenda PDF
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} meetingType - e.g. "Kommunfullmäktige", "Kommunstyrelsen"
 * @returns {Promise<Object>} - Extracted agenda items
 */
export async function extractAgendaFromPDF(pdfBuffer, meetingType = "Kommunfullmäktige") {
	// Initialize Anthropic client
	const anthropic = new Anthropic({
		apiKey: process.env.ANTHROPIC_API_KEY,
	});

	// Convert buffer to base64 for Claude API
	const pdfBase64 = pdfBuffer.toString("base64");

	const prompt = `Du är en expert på svenska kommunala handlingar. Analysera denna kallelse för ${meetingType} och extrahera ENDAST de beslutspunkter som medborgare bör kunna rösta om.

EXTRAHERA MÖTETS STARTTID: Leta efter mötets starttid på första sidan (t.ex. "kl. 18:30" eller "19:00"). Om du inte hittar den, använd "18:00" som default.

INKLUDERA:
- Ärenden där fullmäktige ska fatta beslut om policy, budget, planer, etc.
- Vanligtvis ärenden med nummer 9 och uppåt (§9, §10, etc.)
- Exempel på inkluderade ärenden:
  * Antagande av policyer och riktlinjer
  * Budget och ekonomirapporter
  * Detaljplaner och markanvändning
  * Strategiska beslut om kommunal verksamhet
  * Motioner och medborgarförslag

EXKLUDERA formalia:
- Val av justerare (§1-2)
- Fastställande av dagordning (§3)
- Anmälan av protokoll (§4-5)
- Information och rapporter utan beslut (§6-7)
- Eventuellt övriga frågor (§8)

FÖR VARJE ÄRENDE:
1. **Rubrik**: Formulera som en aktiv fråga om vad kommunen ska göra
   - BRA: "Anta den nya Arbetsmiljöpolicyn"
   - DÅLIGT: "Arbetsmiljöpolicy - antagande"

2. **Beskrivning**: Sammanfatta ärendets bakgrund och syfte (max 500 tecken)
   - Om det finns argument i sammanfattningen (t.ex. "Policyn har förenklats språkligt"),
     lägg dem i initialArguments istället

3. **Kategorisering**: Tilldela 1-3 kategorier:
   1. Bygga, bo och miljö
   2. Fritid och kultur
   3. Förskola och skola
   4. Ändring av styrdokument
   5. Näringsliv och arbete
   6. Omsorg och hjälp
   7. Övrigt kommun och politik

4. **Argument**: Om sammanfattningen innehåller för-argument, extrahera dem

RETURNERA ENDAST JSON (ingen annan text):
{
  "meetingName": "Kommunfullmäktige 2026-01-19",
  "meetingDate": "2026-01-19",
  "meetingTime": "18:30",
  "items": [
    {
      "originalNumber": "§9",
      "title": "Anta den nya Arbetsmiljöpolicyn",
      "description": "Kommunstyrelsen föreslår att fullmäktige antar den nya arbetsmiljöpolicyn som ersätter den tidigare från 2018.",
      "categories": [4, 7],
      "initialArguments": [
        {
          "text": "Policyn har förenklats språkligt för att bli lättare att läsa och förstå",
          "type": "for"
        },
        {
          "text": "Den uppdaterade policyn följer nya arbetsmiljöföreskrifter från Arbetsmiljöverket",
          "type": "for"
        }
      ]
    },
    {
      "originalNumber": "§10",
      "title": "Godkänna detaljplan för Vibyområdet",
      "description": "Detaljplanen möjliggör byggande av 120 nya bostäder i centrala Vallentuna.",
      "categories": [1],
      "initialArguments": []
    }
  ]
}

VALIDERING:
- meetingTime måste vara i formatet "HH:MM" (t.ex. "18:30")
- items ska innehålla MINST 1 ärende
- Varje item måste ha title, description, categories (1-3 kategorier)
- originalNumber behålls för spårbarhet men visas inte för användare
- Kategorier är nummer 1-7
- initialArguments kan vara tom array om inga argument finns`;

	try {
		const message = await anthropic.messages.create({
			model: "claude-sonnet-4-5",
			max_tokens: 8192,
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

		log.debug("Claude response preview", { preview: responseText.substring(0, 300) });

		// Try to find JSON in the response
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
		if (!extractedData.items || extractedData.items.length < 1) {
			throw new Error(`No items extracted. Expected at least 1 decision item.`);
		}

		// Validate each item
		for (const item of extractedData.items) {
			if (!item.title || !item.description) {
				throw new Error(`Missing title or description in item: ${JSON.stringify(item)}`);
			}
			if (!item.categories || item.categories.length < 1 || item.categories.length > 3) {
				throw new Error(`Invalid categories in item "${item.title}". Must have 1-3 categories.`);
			}
			// Ensure categories are numbers 1-7
			for (const cat of item.categories) {
				if (cat < 1 || cat > 7) {
					throw new Error(`Invalid category ${cat} in item "${item.title}". Must be 1-7.`);
				}
			}
			// Ensure initialArguments exists
			if (!item.initialArguments) {
				item.initialArguments = [];
			}
		}

		log.info("Agenda data extracted", {
			meetingName: extractedData.meetingName,
			meetingDate: extractedData.meetingDate,
			itemCount: extractedData.items.length,
		});

		return extractedData;
	} catch (error) {
		log.error("Failed to extract agenda data using AI", { error: error.message });
		throw new Error(`Failed to extract agenda data: ${error.message}`);
	}
}

/**
 * Extract agenda from URL (fetches PDF from URL)
 * @param {string} url - URL to PDF agenda
 * @param {string} meetingType - e.g. "Kommunfullmäktige"
 * @returns {Promise<Object>} - Extracted agenda items
 */
export async function extractAgendaFromURL(url, meetingType = "Kommunfullmäktige") {
	try {
		log.debug("Fetching PDF from URL", { url });

		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		const pdfBuffer = Buffer.from(arrayBuffer);

		log.debug("PDF downloaded", { size: pdfBuffer.length });

		return await extractAgendaFromPDF(pdfBuffer, meetingType);
	} catch (error) {
		log.error("Failed to extract agenda from URL", { url, error: error.message });
		throw new Error(`Failed to extract agenda from URL: ${error.message}`);
	}
}

/**
 * Category names in Swedish
 */
export const CATEGORY_NAMES = {
	1: "Bygga, bo och miljö",
	2: "Fritid och kultur",
	3: "Förskola och skola",
	4: "Ändring av styrdokument",
	5: "Näringsliv och arbete",
	6: "Omsorg och hjälp",
	7: "Övrigt kommun och politik",
};

/**
 * Get category name by number
 * @param {number} categoryNum - Category number (1-7)
 * @returns {string} - Category name in Swedish
 */
export function getCategoryName(categoryNum) {
	return CATEGORY_NAMES[categoryNum] || "Okänd kategori";
}
