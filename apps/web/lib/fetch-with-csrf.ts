/**
 * Fetch wrapper that automatically includes CSRF token
 * Usage: Same as normal fetch, but automatically adds CSRF token to requests
 * Automatically retries once with a fresh token on CSRF validation failure
 */

let csrfToken = null;

/**
 * Fetches CSRF token from server
 * @param {boolean} forceRefresh - If true, fetches a new token even if one is cached
 * @returns {Promise<string>} - CSRF token
 */
async function getCsrfToken(forceRefresh = false) {
	if (csrfToken && !forceRefresh) {
		return csrfToken;
	}

	// Clear cached token before fetching
	csrfToken = null;

	try {
		const response = await fetch("/api/csrf-token");
		const data = await response.json();
		csrfToken = data.csrfToken;
		return csrfToken;
	} catch {
		return null;
	}
}

/**
 * Fetch with automatic CSRF token inclusion
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
export async function fetchWithCsrf(url, options = {}) {
	const method = options.method || "GET";

	// Skip CSRF for GET, HEAD, OPTIONS
	if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
		return fetch(url, options);
	}

	// Get CSRF token
	const token = await getCsrfToken();

	if (!token) {
		return fetch(url, options);
	}

	// Add CSRF token to headers
	const headers = {
		...options.headers,
		"X-CSRF-Token": token,
	};

	const res = await fetch(url, { ...options, headers });

	// Auto-retry once with fresh token on CSRF failure
	if (res.status === 403) {
		const freshToken = await getCsrfToken(true);
		if (freshToken) {
			const retryHeaders = {
				...options.headers,
				"X-CSRF-Token": freshToken,
			};
			return fetch(url, { ...options, headers: retryHeaders });
		}
	}

	return res;
}

/**
 * Reset CSRF token (call after logout or token expiry)
 */
export function resetCsrfToken() {
	csrfToken = null;
}
