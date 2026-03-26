/**
 * Internationalization (i18n) system for Equal Democracy
 */

import { sv } from "./sv";
import { en } from "./en";
import { sr } from "./sr";
import { es } from "./es";
import { de } from "./de";

// Available translations
const translations = {
	sv,
	en,
	sr,
	es,
	de,
};

/**
 * Get translation for a key
 * @param {string} language - Language code (e.g., 'sv', 'en')
 * @param {string} key - Translation key (e.g., 'common.loading' or 'phases.phase1')
 * @param {object} params - Optional parameters for string interpolation
 * @returns {string} - Translated string
 */
export function t(language, key, params = {}) {
	const keys = key.split(".");
	let value = translations[language] || translations.sv;

	// Navigate through nested object
	for (const k of keys) {
		value = value?.[k];
		if (value === undefined) {
			return key; // Return key if translation missing
		}
	}

	// Handle string interpolation
	if (typeof value === "string" && Object.keys(params).length > 0) {
		return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
			return params[paramKey] !== undefined ? params[paramKey] : match;
		});
	}

	return value;
}

/**
 * Get all translations for a language
 * @param {string} language - Language code
 * @returns {object} - Translation object
 */
export function getTranslations(language) {
	return translations[language] || translations.sv;
}

/**
 * Check if a language is available
 * @param {string} language - Language code
 * @returns {boolean}
 */
export function isLanguageAvailable(language) {
	return translations[language] !== undefined;
}
