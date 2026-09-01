/**
 * Low-level transport for the GrandID eID API.
 *
 * Knows nothing about BankID or SPAR — see ./session.ts for the typed
 * operations. Deliberately thin: GrandID is plain HTTPS with multipart form
 * fields, so global `fetch` is enough (contrast lib/swish/client.ts, which is
 * built on node:https only because fetch cannot attach a client certificate).
 *
 * The one rule worth stating: an HTTP status is *not* how GrandID reports
 * business outcomes. A rejected login, an unknown session and a cancelled
 * BankID order all arrive as a 200 with an `errorObject` or `grandidObject` in
 * the body. So any parseable JSON is handed back to the caller to interpret,
 * and only genuinely unusable responses throw.
 */

import { createLogger } from "../logger";
import { serviceFingerprint, type GrandIdConfig } from "./config";

const log = createLogger("GrandID");

/** GrandID answers in well under a second; this only catches a hung connection. */
const DEFAULT_TIMEOUT_MS = 15000;

/** Transport-level failure: DNS, TLS, timeout, or a response that is not JSON. */
export class GrandIdTransportError extends Error {
  code: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "GrandIdTransportError";
    this.code = code;
  }
}

/** GrandID returned a structured `errorObject`. */
export class GrandIdApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message || code);
    this.name = "GrandIdApiError";
    this.code = code;
  }
}

/** The `errorObject` envelope, present on any failed call. */
export interface GrandIdErrorEnvelope {
  errorObject?: {
    code: string;
    message: string;
  };
}

export type GrandIdFields = Record<
  string,
  string | number | boolean | undefined | null
>;

export interface GrandIdRequestOptions {
  /** GetSession and FederatedLogin are POST; Logout is GET. */
  method?: "POST" | "GET";
  /**
   * Which service to call as. Required, and deliberately not defaulted: we hold
   * a signing key and an authentication key, and picking the wrong one produces
   * a transaction that succeeds while meaning something else entirely (see
   * `GrandIdService` in ./config.ts). A default here would be a silent choice.
   *
   * ./session.ts resolves it from `GrandIdService`; the connection diagnostic
   * passes a hand-built config to try a key that is not either configured one.
   */
  config: GrandIdConfig;
  timeoutMs?: number;
}

/**
 * Calls one `/json1.1/*` endpoint with `apiKey` + `authenticateServiceKey`
 * injected. `undefined` and `null` fields are dropped rather than sent as the
 * strings "undefined"/"null", which GrandID would take at face value.
 */
export async function grandIdRequest<T>(
  endpoint: string,
  fields: GrandIdFields,
  options: GrandIdRequestOptions,
): Promise<T> {
  const config = options.config;
  const method = options.method || "POST";
  const url = new URL(`${config.baseUrl}/json1.1/${endpoint}`);

  const params: Record<string, string> = {
    apiKey: config.apiKey,
    authenticateServiceKey: config.serviceKey,
  };
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    params[name] = String(value);
  }

  let body: FormData | undefined;
  if (method === "GET") {
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }
  } else {
    // The docs say parameters SHOULD be posted as multipart/form-data. Passing
    // a FormData instance lets fetch generate the boundary header itself.
    body = new FormData();
    for (const [name, value] of Object.entries(params)) {
      body.append(name, value);
    }
  }

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      body,
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs || DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    const code = error.name === "TimeoutError" ? "ETIMEDOUT" : error.code;
    log.error("GrandID request failed", {
      endpoint,
      service: serviceFingerprint(config),
      code,
      error: error.message,
    });
    throw new GrandIdTransportError(
      code === "ETIMEDOUT"
        ? `GrandID request to ${endpoint} timed out.`
        : `Request to GrandID (${endpoint}) failed: ${error.message}`,
      code,
    );
  }

  const raw = await response.text();
  const ms = Date.now() - startedAt;

  let parsed: T;
  try {
    parsed = JSON.parse(raw) as T;
  } catch {
    // Almost always the wrong base URL or a captive proxy answering with HTML.
    log.error("Non-JSON response from GrandID", {
      endpoint,
      service: serviceFingerprint(config),
      status: response.status,
      ms,
      raw: raw.slice(0, 300),
    });
    throw new GrandIdTransportError(
      `GrandID returned ${response.status} with a non-JSON body for ${endpoint}. ` +
        `Check that ${config.baseUrl} is the right host for GRANDID_ENV=${config.env}.`,
      "ENOTJSON",
    );
  }

  // Logged at warn rather than thrown: GrandID's own error shape is what the
  // caller needs to read, and it may well be carried on a non-2xx response.
  //
  // `errorCode` is the load-bearing half. An HTTP 200 says nothing here — a
  // rejected login, an unknown session and an order the user has not finished
  // yet all arrive as a healthy-looking 200, distinguished only by this code.
  // NOTLOGGEDIN in particular is both "still waiting" and "stranded forever",
  // so seeing it in the transport log is what makes the timeline readable.
  const errorCode = (parsed as GrandIdErrorEnvelope)?.errorObject?.code;
  const level = response.ok ? "info" : "warn";
  log[level]("GrandID request", {
    endpoint,
    service: serviceFingerprint(config),
    status: response.status,
    ms,
    errorCode: errorCode || null,
  });

  return parsed;
}

/** Throws if the body carries an `errorObject`; otherwise returns it unchanged. */
export function throwOnErrorObject<T extends GrandIdErrorEnvelope>(body: T): T {
  if (body && body.errorObject) {
    throw new GrandIdApiError(body.errorObject.code, body.errorObject.message);
  }
  return body;
}
