import https from "https";
import { URL } from "url";
import { createLogger } from "../logger";
import { getSwishAgent, getSwishConfig } from "./config";

const logger = createLogger("Swish");

/**
 * Node attaches a `code` to socket/TLS errors, but the ambient `NodeJS`
 * namespace is not in scope under this project's lint config, so declare the
 * shape we actually use rather than reaching for NodeJS.ErrnoException.
 */
interface SocketError extends Error {
  code?: string;
}

/** Swish responds in well under a second; this only catches a hung connection. */
const REQUEST_TIMEOUT_MS = 15000;

export interface SwishResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  /** Parsed JSON body, or null when the response had no body (201, 401, 415…). */
  body: T | null;
  /** Raw response text — kept for logging when a body fails to parse. */
  raw: string;
}

/**
 * Thrown for transport-level failures only (TLS, DNS, timeout).
 * HTTP error statuses come back as a normal SwishResponse for the caller to interpret,
 * because Swish encodes meaningful business outcomes in 401/403/422.
 */
export class SwishTransportError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "SwishTransportError";
    this.code = code;
  }
}

function explainTlsFailure(err: SocketError): string {
  switch (err.code) {
    case "ERR_TLS_CERT_ALTNAME_INVALID":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "SELF_SIGNED_CERT_IN_CHAIN":
      return "Could not verify the Swish server certificate. If SWISH_CA_BASE64 is set, unset it — it replaces Node's trust store instead of extending it.";
    case "ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE":
    case "EPROTO":
      return "TLS handshake rejected by Swish. The client certificate is likely wrong, expired, or missing its intermediate CA certificates — SWISH_CERT_BASE64 must contain the full chain, not just the leaf.";
    case "ETIMEDOUT":
    case "ECONNRESET":
      return "Connection to Swish timed out or was reset.";
    default:
      return `Request to Swish failed: ${err.message}`;
  }
}

/**
 * Low-level mTLS call against the Swish Commerce API.
 * Knows nothing about payments — see ./payments.ts for the typed operations.
 */
export function swishRequest<T = unknown>(
  method: "GET" | "PUT" | "POST" | "PATCH",
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<SwishResponse<T>> {
  const { baseUrl } = getSwishConfig();
  const url = new URL(`${baseUrl}${path}`);
  const payload = body === undefined ? null : JSON.stringify(body);
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        agent: getSwishAgent(),
        headers: {
          Accept: "application/json",
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
          ...extraHeaders,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed: T | null = null;
          if (raw.trim()) {
            try {
              parsed = JSON.parse(raw) as T;
            } catch {
              logger.warn("Non-JSON response from Swish", {
                method,
                path,
                status: res.statusCode,
                raw: raw.slice(0, 500),
              });
            }
          }

          const headers: Record<string, string> = {};
          for (const [name, value] of Object.entries(res.headers)) {
            if (typeof value === "string") headers[name.toLowerCase()] = value;
            else if (Array.isArray(value))
              headers[name.toLowerCase()] = value.join(", ");
          }

          logger.info("Swish request", {
            method,
            path,
            status: res.statusCode,
            ms: Date.now() - startedAt,
          });

          resolve({ status: res.statusCode ?? 0, headers, body: parsed, raw });
        });
      },
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(
        new SwishTransportError(
          `Swish request timed out after ${REQUEST_TIMEOUT_MS}ms`,
          "ETIMEDOUT",
        ),
      );
    });

    req.on("error", (err: SocketError) => {
      if (err instanceof SwishTransportError) {
        logger.error("Swish request failed", { method, path, code: err.code });
        reject(err);
        return;
      }
      const message = explainTlsFailure(err);
      logger.error("Swish request failed", {
        method,
        path,
        code: err.code,
        error: err.message,
      });
      reject(new SwishTransportError(message, err.code));
    });

    if (payload) req.write(payload);
    req.end();
  });
}
