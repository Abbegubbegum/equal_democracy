/**
 * Configuration system for Equal Democracy
 * Supports multiple languages and color themes
 */

// Available languages
export const AVAILABLE_LANGUAGES = {
	sv: "Svenska",
	en: "English",
	sr: "Српски (Serbian)",
	es: "Español",
	de: "Deutsch",
};

// Default configuration
export const DEFAULT_CONFIG = {
	language: "sv",
	theme: "default",
	municipalityName: "Vallentuna",
};

// Color themes
export const THEMES = {
	default: {
		name: "Jämlik Demokrati (Blå/Gul)",
		colors: {
			// Primary colors (base: #00236a)
			primary: {
				50: "#e6eaf2",
				100: "#b3c0d9",
				400: "#1a4a8f",
				500: "#0d3a80",
				600: "#002d75",
				700: "#00236a",
				800: "#001c55",
				900: "#001440",
			},
			// Secondary/Accent colors (base: #f8b60e)
			accent: {
				50: "#fef6e0",
				100: "#fde9b3",
				400: "#f8b60e",
				500: "#e0a30d",
				600: "#c8910b",
			},
			// Success (green)
			success: {
				50: "#f0fdf4",
				100: "#dcfce7",
				400: "#4ade80",
				500: "#22c55e",
				600: "#16a34a",
				700: "#15803d",
			},
			// Error (red)
			error: {
				50: "#fef2f2",
				100: "#fee2e2",
				400: "#f87171",
				500: "#ef4444",
				600: "#dc2626",
				700: "#b91c1c",
			},
			// Neutral colors
			neutral: {
				50: "#f9fafb",
				100: "#f3f4f6",
				200: "#e5e7eb",
				400: "#9ca3af",
				500: "#6b7280",
				600: "#4b5563",
				700: "#374151",
				800: "#1f2937",
			},
		},
	},
	green: {
		name: "Green Democracy / Activism",
		colors: {
			primary: {
				50: "#f0fdf4",
				100: "#dcfce7",
				200: "#bbf7d0",
				300: "#86efac",
				400: "#4ade80",
				500: "#22c55e",
				600: "#16a34a",
				700: "#15803d",
				800: "#166534",
				900: "#14532d",
			},
			accent: {
				50: "#fefce8",
				100: "#fef9c3",
				200: "#fef08a",
				300: "#fde047",
				400: "#facc15",
				500: "#eab308",
				600: "#ca8a04",
				700: "#a16207",
				800: "#854d0e",
			},
			success: {
				50: "#f0fdf4",
				100: "#dcfce7",
				400: "#4ade80",
				500: "#22c55e",
				600: "#16a34a",
				700: "#15803d",
			},
			error: {
				50: "#fef2f2",
				100: "#fee2e2",
				400: "#f87171",
				500: "#ef4444",
				600: "#dc2626",
				700: "#b91c1c",
			},
			neutral: {
				50: "#f9fafb",
				100: "#f3f4f6",
				200: "#e5e7eb",
				400: "#9ca3af",
				500: "#6b7280",
				600: "#4b5563",
				700: "#374151",
				800: "#1f2937",
			},
		},
	},
	red: {
		name: "Red Democracy (Spain/Serbia)",
		colors: {
			primary: {
				50: "#fef2f2",
				100: "#fee2e2",
				200: "#fecaca",
				300: "#fca5a5",
				400: "#f87171",
				500: "#dc2626",
				600: "#b91c1c",
				700: "#991b1b",
				800: "#7f1d1d",
				900: "#6b1515",
			},
			accent: {
				50: "#fffbeb",
				100: "#fef3c7",
				200: "#fde68a",
				300: "#fcd34d",
				400: "#fbbf24",
				500: "#f59e0b",
				600: "#d97706",
				700: "#b45309",
				800: "#92400e",
			},
			success: {
				50: "#f0fdf4",
				100: "#dcfce7",
				400: "#4ade80",
				500: "#22c55e",
				600: "#16a34a",
				700: "#15803d",
			},
			error: {
				50: "#fef2f2",
				100: "#fee2e2",
				400: "#f87171",
				500: "#ef4444",
				600: "#dc2626",
				700: "#b91c1c",
			},
			neutral: {
				50: "#f9fafb",
				100: "#f3f4f6",
				200: "#e5e7eb",
				400: "#9ca3af",
				500: "#6b7280",
				600: "#4b5563",
				700: "#374151",
				800: "#1f2937",
			},
		},
	},
};

/**
 * Convert hex color to RGB values
 * @param {string} hex - Hex color (e.g., '#3b82f6')
 * @returns {string} - RGB values (e.g., '59 130 246')
 */
export function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) return "0 0 0";
	return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(
		result[3],
		16
	)}`;
}

/**
 * Get color value from theme
 * @param {string} theme - Theme name
 * @param {string} colorPath - Path to color (e.g., 'primary.600')
 * @returns {string} - Color hex value
 */
export function getThemeColor(theme, colorPath) {
	const themeConfig = THEMES[theme] || THEMES.default;
	const [colorGroup, shade] = colorPath.split(".");
	return themeConfig.colors[colorGroup]?.[shade] || "#000000";
}

/**
 * Get recommended theme for a language
 * Provides culturally appropriate color schemes
 */
export function getRecommendedTheme(language) {
	const themeMap = {
		sv: "default", // Sweden: Blue/Yellow (national colors)
		en: "default", // English: Blue/Yellow (trust, democracy)
		de: "green", // Germany: Green (environmental consciousness)
		sr: "red", // Serbia: Red (national color)
		es: "red", // Spain: Red (national color)
	};
	return themeMap[language] || "default";
}

/**
 * Get current configuration from settings
 * This will be extended to fetch from database
 */
export async function getConfig() {
	// For now, return default config
	// Later: fetch from Settings model in database
	return DEFAULT_CONFIG;
}
