/**
 * BankID via GrandID's hosted UI — signing for votes, identification for login.
 *
 * `gui=true` is the whole integration, established by live testing on
 * 2026-08-24/25 (see docs/bankid-integration-plan.md §2). It is the only mode
 * that returns the SPAR folkbokföring block, so the alternatives — `gui=false`,
 * QR, same-device app-switch — are deliberately not exposed. They were explored,
 * they lost, and carrying them as parameters would only invite a caller to pick
 * a broken one.
 *
 * What *is* exposed is `service`, because there are two legitimate
 * configurations and they are not interchangeable:
 *
 *   `sign` (`…69dc`) → `funcId: Signing`        — a vote
 *   `auth` (`…7c8c`) → `funcId: Identification` — a login
 *
 * Both were measured returning SPAR in GUI mode. The failure this shape guards
 * against is that the service key, not the request, decides which one you get
 * (§2a) — so asking for one and receiving the other raises no error anywhere.
 * `EXPECTED_ORDER_TYPE` is how every consumer catches that, and it must be
 * checked before a transaction is treated as meaning anything.
 *
 * What this module exists to absorb: `GetSession` has four response shapes and
 * none of them carries a field saying which one you got. A completed
 * transaction is identified by the *absence* of `grandidObject` and
 * `errorObject` plus the presence of `userAttributes.personalNumber`. Every
 * caller would otherwise re-derive that and get it subtly wrong, so
 * `getBankIdSession()` returns a discriminated union instead.
 *
 * Kept to erasable-syntax-only TypeScript so the connection diagnostic can
 * import it under Node's native type stripping.
 */

import {
  getGrandIdConfig,
  type GrandIdConfig,
  type GrandIdService,
} from "./config";
import {
  GrandIdApiError,
  grandIdRequest,
  throwOnErrorObject,
  type GrandIdErrorEnvelope,
} from "./client";

/**
 * The docs mandate no more than one GetSession poll every 2 seconds.
 * Exported so both the diagnostic and the API route enforce the same floor.
 */
export const MIN_POLL_INTERVAL_MS = 2000;

/** What BankID actually ran, as recorded in the signed XML's `funcId`. */
export type BankIdOrderType = "Signing" | "Identification";

/**
 * What each service must produce for the transaction to mean what we asked for.
 *
 * Not advisory. A `sign` order that comes back `Identification` bound nobody to
 * the ballot they were shown; an `auth` order that comes back `Signing` means we
 * made someone sign a document to log in, which is not what they consented to.
 * Both look like complete, healthy transactions in every other respect.
 */
export const EXPECTED_ORDER_TYPE: Record<GrandIdService, BankIdOrderType> = {
  sign: "Signing",
  auth: "Identification",
};

/**
 * Reads the order type out of a BankID signature.
 *
 * **The service key decides whether BankID signs or identifies — not the
 * request.** The docs say `userVisibleData` is what turns a call into a
 * signature; that is not true here. Measured across five completed
 * transactions, `funcId` tracked the key and ignored the payload entirely:
 *
 *   …7c8c + authMessage        → Identification
 *   …7c8c + userVisibleData    → Identification
 *   …7c8c + no text at all     → Identification
 *   …69dc + userVisibleData    → Signing
 *
 * (`…69dc` without `userVisibleData` is refused outright with
 * BANKID_AUTH_NOT_ALLOWED — a signing service cannot do anything else.)
 *
 * So this function verifies **which service we are actually talking to**. Point
 * `GRANDID_SIGN_SERVICE_KEY` at the authentication service and every vote would come
 * back a successful `Identification`, binding nobody to any ballot, with no
 * error anywhere in the API response. That is the failure this guards against,
 * and the user-visible symptom is the BankID app saying "verifiering" instead
 * of "signering".
 *
 * Anything that treats a transaction as a signed vote MUST check this first.
 */
export function readOrderType(
  signatureBase64: string | null,
): BankIdOrderType | null {
  if (!signatureBase64) return null;
  let xml: string;
  try {
    xml = Buffer.from(signatureBase64, "base64").toString("utf8");
  } catch {
    return null;
  }
  const match = xml.match(/<funcId>\s*([^<\s]+)\s*<\/funcId>/);
  if (!match) return null;
  return match[1] === "Signing" || match[1] === "Identification"
    ? match[1]
    : null;
}

export interface StartedBankIdSession {
  sessionId: string;
  /**
   * Where to send the end-user's browser. In GUI mode this is all GrandID
   * returns — there is no autoStartToken to app-switch with, because the hosted
   * page drives BankID itself.
   */
  redirectUrl: string;
}

export interface StartBankIdSessionParams {
  /**
   * Which configured service to run — and therefore whether this transaction is
   * a signature or an identification. See `GrandIdService` in ./config.ts.
   */
  service: GrandIdService;
  /**
   * The text BankID displays.
   *
   * For `sign` it is also what BankID signs, so it must be the whole of what the
   * user is agreeing to — it is what binds them to the ballot, and the signing
   * service refuses a request without it.
   *
   * For `auth` nothing is being agreed to, so it is optional and purely a
   * courtesy: it is what the BankID app shows the user about where they are
   * logging in.
   */
  visibleText?: string;
  /**
   * Signed but never shown — the place to bind machine-readable context (which
   * ballot, which verification row) into the signature, so the evidence can
   * later be tied to one specific vote rather than merely being contemporaneous
   * with it.
   */
  hiddenData?: string;
  /**
   * Where GrandID sends the browser once the signature is done, with
   * `?grandidsession=…` appended. Blank means "nowhere" — the voter is left on
   * GrandID's completion page and has to close it themselves.
   *
   * Must be `scheme://host/path`. A `scheme:///path` form (three slashes, which
   * is what some deep-link builders emit) is rejected with
   * INCORRECT_CALLBACK_URL_DATA — verified against the live API 2026-08-25.
   */
  callbackUrl?: string;
  /**
   * Where the **BankID app** sends the user after signing, as opposed to
   * `callbackUrl`, which is where the *browser* goes.
   *
   * On iOS these are not the same journey, and assuming they were is a bug we
   * shipped once. BankID returns to Safari — a different browser instance from
   * the in-app auth session that started the flow — so the voter lands on a
   * blank `login.grandid.com` page with none of the session's state, and no
   * redirect ever fires. Pointing this at the app's own deep link skips the
   * browser entirely on the way back.
   *
   * Unlike `callbackUrl`, GrandID does not validate this: every form tried was
   * accepted, so a wrong value fails silently at the worst possible moment.
   */
  appRedirect?: string;
  /** Overrides the env-derived config. Only the connection diagnostic uses this. */
  config?: GrandIdConfig;
}

interface FederatedLoginResponse extends GrandIdErrorEnvelope {
  sessionId?: string;
  redirectUrl?: string;
}

function base64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

/**
 * Starts a BankID signing order and returns the URL to send the user to.
 *
 * Throws rather than returning a result object: every failure here is a
 * configuration or programming error, not a user outcome. User outcomes only
 * become visible once the order exists, via `getBankIdSession`.
 */
export async function startBankIdSession(
  params: StartBankIdSessionParams,
): Promise<StartedBankIdSession> {
  // The signing service refuses a request without userVisibleData outright
  // (BANKID_AUTH_NOT_ALLOWED), so this only saves a round trip and gives a
  // clearer message than GrandID's. It is not what makes the call a signature —
  // the service key is (see readOrderType). The authentication service has no
  // such requirement: there is nothing to agree to.
  if (params.service === "sign" && !params.visibleText) {
    throw new Error(
      "visibleText is required for a signing order — it is the text BankID signs, and the signing service rejects a request without it.",
    );
  }

  const config = params.config || getGrandIdConfig(params.service);

  const body = await grandIdRequest<FederatedLoginResponse>(
    "FederatedLogin",
    {
      gui: true,
      // Blank rather than omitted when absent: the two are different to this
      // API. The outcome always reaches us by polling GetSession — the redirect
      // only decides whether the voter lands back in the app or is left staring
      // at GrandID's completion page.
      callbackUrl: params.callbackUrl || "",
      appRedirect: params.appRedirect,
      mobileBankId: true,
      desktopBankId: false,
      userVisibleData: params.visibleText
        ? base64(params.visibleText)
        : undefined,
      userNonVisibleData: params.hiddenData
        ? base64(params.hiddenData)
        : undefined,
    },
    { config },
  );

  throwOnErrorObject(body);

  if (!body.sessionId) {
    throw new GrandIdApiError(
      "NO_SESSION_ID",
      "GrandID accepted the FederatedLogin request but returned no sessionId.",
    );
  }
  if (!body.redirectUrl) {
    throw new GrandIdApiError(
      "NO_REDIRECT_URL",
      "GrandID returned no redirectUrl. The service key is probably no longer configured for the hosted UI, which is also the configuration SPAR depends on.",
    );
  }

  return { sessionId: body.sessionId, redirectUrl: body.redirectUrl };
}

/**
 * Evidence of the transaction. `signature` covers the text the user was shown,
 * which is what makes a vote non-repudiable; `orderType` reports whether BankID
 * signed or merely identified, which follows from the service key rather than
 * from anything we sent — so read it, never infer it.
 */
export interface BankIdEvidence {
  notBefore: string | null;
  notAfter: string | null;
  bankIdIssueDate: string | null;
  ipAddress: string | null;
  ocspResponse: string | null;
  signature: string | null;
  orderType: BankIdOrderType | null;
}

export type BankIdSession =
  /** The order exists and BankID is waiting. `hintCode` says what for. */
  | { state: "pending"; hintCode: string }
  /** Terminal. hintCode is userCancel, startFailed, expiredTransaction, … */
  | { state: "failed"; hintCode: string }
  /** Terminal and successful. `userAttributes` carries the SPARv2 block. */
  | {
      state: "complete";
      personalNumber: string;
      name: string | null;
      userAttributes: Record<string, unknown>;
      evidence: BankIdEvidence;
    }
  /**
   * GrandID returned an `errorObject`. In this flow `NOTLOGGEDIN` is the normal
   * waiting state — the user is still on the hosted page — so a poller should
   * treat it as "keep waiting" until the deadline rather than as an error.
   */
  | { state: "unknown"; code: string; message: string };

interface GetSessionResponse extends GrandIdErrorEnvelope {
  sessionId?: string;
  username?: string;
  userAttributes?: Record<string, unknown>;
  grandidObject?: {
    code?: string;
    message?: { status?: string; hintCode?: string };
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * Reads the current state of a BankID order.
 *
 * Never throws for a user outcome — a cancelled or expired order is a normal
 * `failed` result. It throws only when the transport fails.
 */
export async function getBankIdSession(
  sessionId: string,
  options: { service: GrandIdService; config?: GrandIdConfig },
): Promise<BankIdSession> {
  // Must be the same service that created the session — GrandID scopes a
  // sessionId to the service key it was issued under.
  const body = await grandIdRequest<GetSessionResponse>(
    "GetSession",
    { sessionId },
    { config: options.config || getGrandIdConfig(options.service) },
  );

  if (body.errorObject) {
    return {
      state: "unknown",
      code: body.errorObject.code,
      message: body.errorObject.message,
    };
  }

  const progress = body.grandidObject;
  if (progress && progress.message) {
    const hintCode = progress.message.hintCode || "unknown";
    return progress.message.status === "failed"
      ? { state: "failed", hintCode }
      : { state: "pending", hintCode };
  }

  // No envelope at all: this is the completed shape. There is no status field
  // to key off, so the personal number is the discriminator.
  const attributes = body.userAttributes || {};
  const personalNumber = text(attributes.personalNumber) || text(body.username);
  if (!personalNumber) {
    return {
      state: "unknown",
      code: "UNRECOGNISED_RESPONSE",
      message:
        "GetSession returned neither a progress object, an error object, nor a personal number.",
    };
  }

  return {
    state: "complete",
    personalNumber,
    name: text(attributes.name),
    userAttributes: attributes,
    evidence: {
      notBefore: text(attributes.notBefore),
      notAfter: text(attributes.notAfter),
      bankIdIssueDate: text(attributes.bankIdIssueDate),
      ipAddress: text(attributes.ipAddress),
      ocspResponse: text(attributes.ocspResponse),
      signature: text(attributes.signature),
      orderType: readOrderType(text(attributes.signature)),
    },
  };
}

/**
 * Cancels an in-flight BankID order.
 *
 * Best-effort by design: it is called when a user backs out, and a failure to
 * cancel must never surface as an error in that path — the order expires on its
 * own soon after. Returns whether GrandID accepted the cancellation.
 */
export async function cancelBankIdSession(
  sessionId: string,
  options: { service: GrandIdService; config?: GrandIdConfig },
): Promise<boolean> {
  try {
    await grandIdRequest(
      "Logout",
      { sessionId, cancelBankID: true },
      {
        method: "GET",
        config: options.config || getGrandIdConfig(options.service),
      },
    );
    return true;
  } catch {
    return false;
  }
}
