/**
 * Custom hook for accessing translations
 * Provides a convenient way to use translations in components
 */

import { useConfig } from "../contexts/ConfigContext";

export function useTranslation() {
	const { t, config, translations } = useConfig();

	return {
		t,
		language: config.language,
		translations,
	};
}
