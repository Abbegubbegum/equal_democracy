/**
 * Configuration Context for language and theme management
 * Provides translations and theme colors to all components
 */

import { createContext, useContext, useState, useEffect } from "react";
import { t as translate, getTranslations } from "../locales";
import { THEMES, DEFAULT_CONFIG } from "../config";

const ConfigContext = createContext<any>(null);

export function ConfigProvider({ children }) {
	const [config, setConfig] = useState(DEFAULT_CONFIG);
	const [isLoading, setIsLoading] = useState(true);

	// Load configuration with stale-while-revalidate caching
	useEffect(() => {
		const CACHE_KEY = "eq-democracy-config";
		const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

		async function loadConfig() {
			// Try cached config first (synchronous, no flash)
			let cacheIsFresh = false;
			try {
				const cached = localStorage.getItem(CACHE_KEY);
				if (cached) {
					const { data, timestamp } = JSON.parse(cached);
					if (data && data.language) {
						setConfig({
							language: data.language || DEFAULT_CONFIG.language,
							theme: data.theme || DEFAULT_CONFIG.theme,
							municipalityName: data.municipalityName || DEFAULT_CONFIG.municipalityName,
						});
						setIsLoading(false);
						if (Date.now() - timestamp < CACHE_TTL) {
							cacheIsFresh = true;
						}
					}
				}
			} catch {
				// localStorage unavailable
			}

			if (cacheIsFresh) return;

			// Fetch from server (initial or background revalidation)
			try {
				const res = await fetch("/api/settings");
				if (res.ok) {
					const data = await res.json();
					if (data.language || data.theme || data.municipalityName) {
						const newConfig = {
							language: data.language || DEFAULT_CONFIG.language,
							theme: data.theme || DEFAULT_CONFIG.theme,
							municipalityName: data.municipalityName || DEFAULT_CONFIG.municipalityName,
						};
						setConfig(newConfig);
						try {
							localStorage.setItem(CACHE_KEY, JSON.stringify({ data: newConfig, timestamp: Date.now() }));
						} catch { /* storage full */ }
					}
				}
			} catch {
				// Network error, cached or default values are fine
			} finally {
				setIsLoading(false);
			}
		}

		loadConfig();
	}, []);

	// Apply theme colors as CSS variables whenever theme changes
	useEffect(() => {
		const theme = THEMES[config.theme] || THEMES.default;
		const root = document.documentElement;

		// Set primary colors
		root.style.setProperty("--theme-primary-50", theme.colors.primary[50]);
		root.style.setProperty(
			"--theme-primary-100",
			theme.colors.primary[100]
		);
		root.style.setProperty(
			"--theme-primary-400",
			theme.colors.primary[400]
		);
		root.style.setProperty(
			"--theme-primary-500",
			theme.colors.primary[500]
		);
		root.style.setProperty(
			"--theme-primary-600",
			theme.colors.primary[600]
		);
		root.style.setProperty(
			"--theme-primary-700",
			theme.colors.primary[700]
		);
		root.style.setProperty(
			"--theme-primary-800",
			theme.colors.primary[800]
		);
		root.style.setProperty(
			"--theme-primary-900",
			theme.colors.primary[900]
		);

		// Set accent colors
		root.style.setProperty("--theme-accent-50", theme.colors.accent[50]);
		root.style.setProperty("--theme-accent-100", theme.colors.accent[100]);
		root.style.setProperty("--theme-accent-400", theme.colors.accent[400]);
		root.style.setProperty("--theme-accent-500", theme.colors.accent[500]);
		root.style.setProperty("--theme-accent-600", theme.colors.accent[600]);
	}, [config.theme]);

	// Translation function with current language
	const t = (key, params) => {
		return translate(config.language, key, params);
	};

	// Get theme color
	const getColor = (colorPath) => {
		const theme = THEMES[config.theme] || THEMES.default;
		const [colorGroup, shade] = colorPath.split(".");
		return theme.colors[colorGroup]?.[shade] || "#000000";
	};

	// Get all translations for current language
	const translations = getTranslations(config.language);

	// Update configuration
	const updateConfig = async (newConfig) => {
		try {
			const res = await fetch("/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(newConfig),
			});

			if (res.ok) {
				const merged = { ...config, ...newConfig };
				setConfig(merged);
				try {
					localStorage.setItem("eq-democracy-config", JSON.stringify({ data: merged, timestamp: Date.now() }));
				} catch { /* ignore */ }
				return true;
			}
			return false;
		} catch {
			return false;
		}
	};

	const value = {
		config,
		t,
		getColor,
		translations,
		updateConfig,
		isLoading,
		theme: THEMES[config.theme] || THEMES.default,
	};

	return (
		<ConfigContext.Provider value={value}>
			{children}
		</ConfigContext.Provider>
	);
}

export function useConfig() {
	const context = useContext(ConfigContext);
	if (!context) {
		throw new Error("useConfig must be used within ConfigProvider");
	}
	return context;
}
