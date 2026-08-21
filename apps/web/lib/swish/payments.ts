import crypto from "crypto";
import { swishRequest } from "./client";
import { getSwishConfig } from "./config";

/** A Payment Request object as Swish returns it. */
export interface SwishPaymentObject {
  id: string;
  payeePaymentReference?: string;
  paymentReference?: string;
  callbackUrl: string;
  payerAlias?: string;
  payeeAlias: string;
  amount: number;
  currency: string;
  message?: string;
  status: "CREATED" | "PAID" | "DECLINED" | "ERROR" | "CANCELLED";
  dateCreated: string;
  datePaid?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  additionalInformation?: string | null;
}

/** One entry of the array Swish returns on a 422. */
export interface SwishValidationError {
  errorCode: string;
  errorMessage: string;
  additionalInformation?: string | null;
}

/**
 * Swedish, user-facing explanations for the error codes a payer can actually
 * cause. Anything not listed here is a bug or an outage on our side, and the
 * caller should fall back to a generic message rather than leaking a code.
 */
const PAYER_FACING_MESSAGES: Record<string, string> = {
  ACMT03: "Numret är inte anslutet till Swish.",
  ACMT07: "Mottagaren är inte ansluten till Swish.",
  RF07: "Betalningen nekades av din bank. Kontrollera din Swish-gräns.",
  BANKIDCL: "Du avbröt signeringen med BankID.",
  BANKIDONGOING:
    "BankID används redan. Avsluta den pågående signeringen först.",
  BANKIDUNKN: "BankID kunde inte godkänna betalningen.",
  AM21: "Beloppet överskrider din Swish-gräns. Kontakta din bank.",
  RP06: "Du har redan en påbörjad Swish-betalning. Slutför eller avbryt den först.",
  TM01: "Betalningen tog för lång tid och avbröts.",
  DS24: "Swish hann inte få svar från banken. Kontrollera med din bank om betalningen gick igenom.",
  VR01: "Du uppfyller inte åldersgränsen för den här betalningen.",
};

/**
 * Turns a Swish error code into something we can show a user.
 * Returns null for codes that mean "we misconfigured something".
 */
export function payerFacingMessage(
  code: string | null | undefined,
): string | null {
  return code ? (PAYER_FACING_MESSAGES[code] ?? null) : null;
}

/** 32 uppercase hex chars, no dashes — the format Swish requires. */
export function newInstructionId(): string {
  return crypto.randomUUID().replace(/-/g, "").toUpperCase();
}

/** 36 chars matching Swish's ^[0-9a-zA-Z-]{32,36}$ for callbackIdentifier. */
export function newCallbackIdentifier(): string {
  return crypto.randomUUID();
}

export interface CreatePaymentInput {
  instructionId: string;
  callbackIdentifier: string;
  amount: number;
  message: string;
  /** Our own reference — the Payment document's _id. */
  payeePaymentReference: string;
  /**
   * Omit for m-commerce (Swish returns a token and we app-switch).
   * Supplying it makes this an e-commerce request pushed to that phone number.
   */
  payerAlias?: string;
}

/**
 * Deliberately a flat shape rather than a discriminated union on `ok`: this
 * project compiles with `strict` off, and without strictNullChecks TypeScript
 * will not narrow a boolean-literal discriminant, so a union here produces
 * "property does not exist" errors at every call site. Every field is always
 * populated, so callers never need optional chaining.
 */
export interface CreatePaymentResult {
  ok: boolean;
  /** PaymentRequestToken — present for successful m-commerce requests only. */
  token: string | null;
  location: string | null;
  httpStatus: number;
  errors: SwishValidationError[];
  /** First error code, for storing on the Payment row. Null when ok. */
  code: string | null;
  /** Swedish message safe to show the user. Empty when ok. */
  message: string;
}

/**
 * Create a payment request. PUT /api/v2/paymentrequests/{instructionUUID}
 *
 * HTTP failures are returned, not thrown — Swish encodes real outcomes in
 * 403/422 and the caller needs to record them on the Payment row.
 */
export async function createPaymentRequest(
  input: CreatePaymentInput,
): Promise<CreatePaymentResult> {
  const { payeeAlias, callbackUrl } = getSwishConfig();

  const body: Record<string, unknown> = {
    payeeAlias,
    callbackUrl,
    callbackIdentifier: input.callbackIdentifier,
    payeePaymentReference: input.payeePaymentReference,
    amount: input.amount.toFixed(2),
    currency: "SEK",
    message: input.message,
  };
  if (input.payerAlias) body.payerAlias = input.payerAlias;

  const res = await swishRequest<SwishValidationError[]>(
    "PUT",
    `/api/v2/paymentrequests/${input.instructionId}`,
    body,
  );

  if (res.status === 201) {
    return {
      ok: true,
      token: res.headers["paymentrequesttoken"] ?? null,
      location: res.headers["location"] ?? null,
      httpStatus: res.status,
      errors: [],
      code: null,
      message: "",
    };
  }

  const errors = Array.isArray(res.body) ? res.body : [];
  const code = errors[0]?.errorCode ?? null;

  return {
    ok: false,
    token: null,
    location: null,
    httpStatus: res.status,
    errors,
    code,
    message:
      payerFacingMessage(code) ??
      "Betalningen kunde inte startas just nu. Försök igen om en stund.",
  };
}

/**
 * Retrieve the current state of a payment request.
 * GET /api/v1/paymentrequests/{id} — v1 is correct here; there is no v2 GET.
 * Returns null when Swish does not know the id (404).
 */
export async function getPaymentRequest(
  instructionId: string,
): Promise<SwishPaymentObject | null> {
  const res = await swishRequest<SwishPaymentObject>(
    "GET",
    `/api/v1/paymentrequests/${instructionId}`,
  );

  if (res.status === 200 && res.body && !Array.isArray(res.body)) {
    return res.body;
  }
  return null;
}

/**
 * Cancel a payment request that the payer has not yet signed.
 * PATCH /api/v1/paymentrequests/{id} with a JSON-Patch body.
 * Returns true when Swish accepted the cancellation.
 */
export async function cancelPaymentRequest(
  instructionId: string,
): Promise<boolean> {
  const res = await swishRequest(
    "PATCH",
    `/api/v1/paymentrequests/${instructionId}`,
    [{ op: "replace", path: "/status", value: "cancelled" }],
    { "Content-Type": "application/json-patch+json" },
  );
  return res.status === 200;
}
