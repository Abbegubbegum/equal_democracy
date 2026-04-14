/**
 * Fetch wrapper that automatically includes CSRF token
 * Usage: Same as normal fetch, but automatically adds CSRF token to requests
 * Automatically retries once with a fresh token on CSRF validation failure
 */

let csrfToken: string | null = null;

async function getCsrfToken(forceRefresh = false): Promise<string | null> {
	if (csrfToken && !forceRefresh) {
		return csrfToken;
	}

	csrfToken = null;

	try {
		const response = await fetch("/api/csrf-token");
		const data = await response.json() as { csrfToken: string };
		csrfToken = data.csrfToken;
		return csrfToken;
	} catch {
		return null;
	}
}

// eslint-disable-next-line no-undef
export async function fetchWithCsrf(url: string, options: RequestInit = {}): Promise<Response> {
	const method = options.method ?? "GET";

	if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
		return fetch(url, options);
	}

	const token = await getCsrfToken();

	if (!token) {
		return fetch(url, options);
	}

	const headers = {
		...options.headers,
		"X-CSRF-Token": token,
	};

	const res = await fetch(url, { ...options, headers });

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

export function resetCsrfToken(): void {
	csrfToken = null;
}
