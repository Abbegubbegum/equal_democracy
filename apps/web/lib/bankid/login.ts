/**
 * BankID login: starting an identification order, and settling it into an
 * account.
 *
 * The signing twin of this is ./settle.ts, and the shape is deliberately
 * parallel — a row holds the intent while GrandID works, and exactly one
 * function turns a completed transaction into a durable fact. What differs is
 * the fact produced: a vote there, an account here.
 *
 * Three rules this module exists to hold:
 *
 * 1. **It must be an Identification, never a Signing.** Logging in is not
 *    agreeing to anything, and the service key rather than the request decides
 *    which one BankID ran (see EXPECTED_ORDER_TYPE in ./session.ts). Both
 *    outcomes look equally healthy in the API response.
 * 2. **Eligibility is decided here and cached on the User**, so the app can say
 *    what someone may do before they pay for a signature. It is never
 *    authoritative at vote time — settleVerification re-checks against the SPAR
 *    block that arrives with the signature.
 * 3. **A settled row is a credential until it is spent.** `consumeVerification`
 *    is the only thing that issues from one, and it is one-way.
 *
 * See docs/bankid-login-plan.md §7.
 */

import crypto from "crypto";
import { LoginVerification, User } from "../models";
import { createLogger } from "../logger";
import { mergeAccounts } from "../account-merge";
import { allowAnyKommun, runtimeEnv } from "./config";
import { checkEligibilityFromAttributes } from "./eligibility";
import { loginSubject } from "./subject";
import {
  EXPECTED_ORDER_TYPE,
  MIN_POLL_INTERVAL_MS,
  cancelBankIdSession,
  getBankIdSession,
  startBankIdSession,
  type BankIdSession,
} from "./session";

const log = createLogger("BankIdLogin");

export type LoginPurpose = "login" | "link" | "reverify";

/** A BankID order lives about 3 minutes; inside that, resume rather than restart. */
export const IN_FLIGHT_WINDOW_MS = 3 * 60 * 1000;

const SYSTEM_MESSAGE =
  "Något gick fel med inloggningen. Försök igen om en stund.";

/** Shown in the BankID app. Nothing is signed — this only names who is asking. */
const VISIBLE_TEXT: Record<LoginPurpose, string> = {
  login: "Logga in på Vallentuna Framåt.",
  link: "Koppla ditt BankID till ditt konto på Vallentuna Framåt.",
  reverify: "Bekräfta din identitet för Vallentuna Framåt.",
};

export interface StartLoginParams {
  purpose: LoginPurpose;
  /** Required for link/reverify, absent for login — there is no session yet. */
  userId?: string | null;
  /** Already validated against an allowlist by the caller. Blank is fine. */
  returnUrl?: string;
}

export interface StartedLogin {
  pollToken: string;
  redirectUrl: string;
  resumed: boolean;
}

/**
 * Starts an identification order.
 *
 * Throws on a configuration or transport failure — those are ours, not the
 * user's. User outcomes only exist once the order does.
 */
export async function startLogin(
  params: StartLoginParams,
): Promise<StartedLogin> {
  const { purpose, userId = null, returnUrl = "" } = params;

  if (purpose !== "login" && !userId) {
    throw new Error(`A "${purpose}" verification needs a userId.`);
  }

  // Every accepted order is billable, so a user who backs out and comes straight
  // back gets the one already running rather than a second one. Scoped by userId
  // — including the `null` of an anonymous login, which cannot be narrowed
  // further without an identity we do not have yet. That is why the start
  // endpoint rate-limits by IP.
  if (userId) {
    const inFlight: any = await LoginVerification.findOne({
      userId,
      purpose,
      status: "PENDING",
      createdAt: { $gt: new Date(Date.now() - IN_FLIGHT_WINDOW_MS) },
    })
      .sort({ createdAt: -1 })
      .lean();
    if (inFlight) {
      log.info("Reusing in-flight login verification", {
        verificationId: inFlight._id.toString(),
        purpose,
      });
      return {
        pollToken: inFlight.pollToken,
        redirectUrl: inFlight.redirectUrl,
        resumed: true,
      };
    }
  }

  const started = await startBankIdSession({
    service: "auth",
    visibleText: VISIBLE_TEXT[purpose],
    callbackUrl: returnUrl,
    // Same destination, different journey — see the parameter's own comment.
    // On iOS the BankID app returns to Safari rather than the browser instance
    // that started the flow, and only this gets the user home.
    appRedirect: returnUrl || undefined,
  });

  const verification = await LoginVerification.create({
    purpose,
    userId,
    grandIdSession: started.sessionId,
    redirectUrl: started.redirectUrl,
    pollToken: crypto.randomBytes(32).toString("hex"),
    status: "PENDING",
    runtime: runtimeEnv(),
  });

  log.info("Login verification started", {
    verificationId: verification._id.toString(),
    purpose,
    runtime: runtimeEnv(),
  });

  return {
    pollToken: verification.pollToken,
    redirectUrl: started.redirectUrl,
    resumed: false,
  };
}

/**
 * Nobiliary and toponymic particles that belong to the surname rather than
 * standing between the names.
 *
 * Without these, "Anna von Sydow" would be shortened to "Anna Sydow" — which is
 * not her name.
 */
const SURNAME_PARTICLES = new Set([
  "von",
  "af",
  "de",
  "del",
  "della",
  "di",
  "du",
  "la",
  "le",
  "van",
  "der",
  "den",
  "ten",
  "ter",
]);

function pick(attributes: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * A display name: first name and surname, nothing else.
 *
 * BankID returns the full registered name — every given name a person has —
 * so "Albin Erik Nöjback" is what arrives for someone everybody calls Albin
 * Nöjback. That is more than this app ever shows and more than it needs.
 *
 * Structured attributes are used when GrandID sends them, because splitting a
 * name is guesswork and reading two fields is not. The fallback only runs when
 * they are absent: first token, plus the last token and any particle attached
 * to it.
 */
export function displayNameFrom(
  session: Extract<BankIdSession, { state: "complete" }>,
): string {
  const attributes = session.userAttributes || {};

  const given = pick(attributes, "givenName", "givenname", "firstName");
  const family = pick(attributes, "surname", "sn", "lastName", "familyName");
  if (given && family) {
    return `${given.split(/\s+/)[0]} ${family}`.slice(0, 60);
  }

  const parts = String(session.name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "Medborgare";
  if (parts.length === 1) return parts[0].slice(0, 60);

  let surnameStart = parts.length - 1;
  while (
    surnameStart > 1 &&
    SURNAME_PARTICLES.has(parts[surnameStart - 1].toLowerCase())
  ) {
    surnameStart -= 1;
  }

  return `${parts[0]} ${parts.slice(surnameStart).join(" ")}`.slice(0, 60);
}

export interface SettleLoginResult {
  changed: boolean;
  status: string;
  reasonCode: string | null;
  /** Swedish, safe to show. Empty when there is nothing to explain. */
  message: string;
  userId: string | null;
  /** True when this login created the account rather than finding one. */
  createdAccount: boolean;
  /** True when an existing second account was folded into this one. */
  merged: boolean;
}

/**
 * Applies a completed identification to a verification row.
 *
 * `session` must be the `complete` variant — callers check that first, because
 * pending and failed sessions are not settlement events.
 */
export async function settleLogin(
  verification: any,
  session: Extract<BankIdSession, { state: "complete" }>,
): Promise<SettleLoginResult> {
  const verificationId = verification._id.toString();

  if (verification.status !== "PENDING") {
    return {
      changed: false,
      status: verification.status,
      reasonCode: verification.reasonCode ?? null,
      message: "",
      userId: verification.resultUserId
        ? verification.resultUserId.toString()
        : null,
      createdAccount: !!verification.createdAccount,
      merged: false,
    };
  }

  const reject = async (
    status: string,
    reasonCode: string,
    message: string,
  ): Promise<SettleLoginResult> => {
    verification.status = status;
    verification.reasonCode = reasonCode;
    await verification.save();
    log.info("Login verification settled without a session", {
      verificationId,
      status,
      reasonCode,
    });
    return {
      changed: true,
      status,
      reasonCode,
      message,
      userId: null,
      createdAccount: false,
      merged: false,
    };
  };

  // A verification started by a development server must never mint a session on
  // the deployment. Both share the production GrandID host, and `pnpm
  // dev:web:live` shares the production database too, so this label is the only
  // thing separating them.
  if (verification.runtime !== runtimeEnv()) {
    log.error("Login verification was created by a different runtime", {
      verificationId,
      verificationRuntime: verification.runtime,
      currentRuntime: runtimeEnv(),
    });
    return reject("FAILED", "RUNTIME_MISMATCH", SYSTEM_MESSAGE);
  }

  // The service key decides this, not our request — so it is read, never
  // assumed. A Signing here means GRANDID_AUTH_SERVICE_KEY points at the
  // signing service, and we just made someone sign a document to log in.
  if (session.evidence.orderType !== EXPECTED_ORDER_TYPE.auth) {
    log.error("BankID signed instead of identifying — refusing the login", {
      verificationId,
      orderType: session.evidence.orderType,
      hint: "GRANDID_AUTH_SERVICE_KEY is probably the signing service, not the authentication one",
    });
    return reject("FAILED", "NOT_IDENTIFIED", SYSTEM_MESSAGE);
  }

  let subject: string;
  try {
    subject = loginSubject(session.personalNumber);
  } catch (error) {
    // Missing pepper, or a personal number in an unexpected shape. Continuing
    // would either duplicate an existing account or, worse, collapse two people
    // onto one. Neither is recoverable.
    log.error("Could not derive the account subject", {
      verificationId,
      error: (error as Error).message,
    });
    return reject("FAILED", "SUBJECT_FAILED", SYSTEM_MESSAGE);
  }

  const bypassKommun = allowAnyKommun();
  if (bypassKommun) {
    log.warn("Residency check bypassed by BANKID_ALLOW_ANY_KOMMUN", {
      verificationId,
    });
  }
  const eligibility = checkEligibilityFromAttributes(session.userAttributes, {
    allowAnyKommun: bypassKommun,
  });

  // Not a verdict about the person — the SPAR add-on stopped arriving, which is
  // our configuration failing. Creating an account off it would cache a
  // permanent "we do not know" against a real user.
  if (eligibility.code === "SPAR_MISSING") {
    log.error("No SPAR data in a completed BankID login", {
      verificationId,
      attributeKeys: Object.keys(session.userAttributes || {}).join(","),
    });
    return reject("FAILED", "SPAR_MISSING", eligibility.message);
  }

  const eligibilityState = {
    eligible: eligibility.eligible,
    code: eligibility.code,
    checkedAt: new Date(),
  };
  // First name and surname only — see displayNameFrom. Not overwritten on every
  // login: a user who has edited their display name should keep it.
  const bankIdName = displayNameFrom(session);

  let resultUserId: string;
  let createdAccount = false;
  let merged = false;

  const existing: any = await User.findOne({ bankidSubject: subject });

  if (verification.purpose === "login") {
    if (existing) {
      existing.eligibility = eligibilityState;
      await existing.save();
      resultUserId = existing._id.toString();
    } else {
      const created = await User.create({
        name: bankIdName,
        // No email. It is a contact channel now, and a BankID account starts
        // without one until the user chooses to add it.
        email: null,
        authMethod: "bankid",
        bankidSubject: subject,
        bankidLinkedAt: new Date(),
        eligibility: eligibilityState,
      });
      resultUserId = created._id.toString();
      createdAccount = true;
      log.info("Account created from BankID login", {
        verificationId,
        userId: resultUserId,
        eligible: eligibility.eligible,
      });
    }
  } else {
    // link / reverify — the caller was already signed in.
    let current: any = await User.findById(verification.userId);
    if (!current) {
      return reject("FAILED", "USER_GONE", SYSTEM_MESSAGE);
    }

    if (current.bankidSubject && current.bankidSubject !== subject) {
      // This account already belongs to a different person's BankID. Refusing is
      // the only safe answer: linking would hand one person another's history.
      log.warn("Refusing to relink an account to a different BankID", {
        verificationId,
        userId: current._id.toString(),
      });
      return reject(
        "REJECTED",
        "SUBJECT_MISMATCH",
        "Det här kontot är redan kopplat till ett annat BankID.",
      );
    }

    if (existing && existing._id.toString() !== current._id.toString()) {
      // They already had a BankID account. Fold it into the one they are signed
      // in as — see the direction rule in lib/account-merge.ts — which also
      // frees the unique subject so `current` can take it.
      try {
        await mergeAccounts(existing._id.toString(), current._id.toString());
        merged = true;
      } catch (error) {
        log.error("Account merge failed during link", {
          verificationId,
          from: existing._id.toString(),
          into: current._id.toString(),
          error: (error as Error).message,
        });
        return reject("FAILED", "MERGE_FAILED", SYSTEM_MESSAGE);
      }

      // Re-read before writing. `current` was loaded *before* the merge, and
      // mergeAccounts writes to the surviving account directly — membership,
      // admin flags, a contact email, interests. Saving the stale document
      // below would quietly revert every one of them, which is the opposite of
      // what a merge is for.
      current = await User.findById(verification.userId);
      if (!current) return reject("FAILED", "USER_GONE", SYSTEM_MESSAGE);
    }

    current.bankidSubject = subject;
    current.authMethod = "bankid";
    if (!current.bankidLinkedAt) current.bankidLinkedAt = new Date();
    current.eligibility = eligibilityState;
    if (!current.name) current.name = bankIdName;
    await current.save();
    resultUserId = current._id.toString();
  }

  verification.status = "VERIFIED";
  verification.reasonCode = null;
  verification.resultUserId = resultUserId;
  verification.createdAccount = createdAccount;
  await verification.save();

  log.info("Login verification settled", {
    verificationId,
    purpose: verification.purpose,
    userId: resultUserId,
    createdAccount,
    merged,
    eligible: eligibility.eligible,
  });

  return {
    changed: true,
    status: "VERIFIED",
    reasonCode: null,
    // Deliberately empty on success. The eligibility verdict reaches the client
    // as a capability, not as a sentence bolted onto a login result.
    message: "",
    userId: resultUserId,
    createdAccount,
    merged,
  };
}

/**
 * Spends a settled verification, returning the account it resolved to.
 *
 * The one place a session may be issued from a login. One-way and atomic: the
 * `consumedAt: null` predicate is part of the update, so two racing polls cannot
 * both come away with a session.
 */
export async function consumeVerification(
  pollToken: string,
): Promise<{ userId: string } | null> {
  const row: any = await LoginVerification.findOneAndUpdate(
    { pollToken, status: "VERIFIED", consumedAt: null },
    { $set: { consumedAt: new Date() } },
    { new: true },
  );
  if (!row?.resultUserId) return null;
  return { userId: row.resultUserId.toString() };
}

/** BankID hintCodes, in words a person can act on. */
const HINT_MESSAGES: Record<string, string> = {
  userCancel: "Du avbröt inloggningen i BankID.",
  cancelled: "Inloggningen avbröts.",
  expiredTransaction: "Inloggningen tog för lång tid och avbröts.",
  startFailed: "BankID hann inte startas. Försök igen.",
  certificateErr: "Ditt BankID kunde inte användas. Kontakta din bank.",
};

export interface PollResult {
  found: boolean;
  status: string;
  reasonCode: string | null;
  message: string;
  userId: string | null;
  createdAccount: boolean;
}

/**
 * One poll of a login order: advance it if GrandID has news, then report.
 *
 * Shared by both surfaces so the state machine exists once. What differs
 * between them is only what they do with a VERIFIED result — the web hands it
 * to NextAuth, the app mints its own tokens — and neither happens here.
 */
export async function pollLogin(pollToken: string): Promise<PollResult> {
  const verification: any = await LoginVerification.findOne({ pollToken });
  if (!verification) {
    return {
      found: false,
      status: "UNKNOWN",
      reasonCode: null,
      message: "",
      userId: null,
      createdAccount: false,
    };
  }

  let message = "";

  if (verification.status === "PENDING") {
    // GrandID's own floor is one GetSession every 2 seconds. Enforced here
    // rather than trusted to the client, which may be several app instances.
    const stale =
      !verification.lastPolledAt ||
      Date.now() - verification.lastPolledAt.getTime() >= MIN_POLL_INTERVAL_MS;

    if (stale) {
      verification.lastPolledAt = new Date();
      await verification.save();

      const session = await getBankIdSession(verification.grandIdSession, {
        service: "auth",
      });

      if (session.state === "complete") {
        const result = await settleLogin(verification, session);
        message = result.message;
      } else if (session.state === "failed") {
        verification.status = "FAILED";
        verification.reasonCode = session.hintCode;
        await verification.save();
        message =
          HINT_MESSAGES[session.hintCode] ??
          "Inloggningen kunde inte slutföras. Försök igen.";
      }
      // "pending" and "unknown" both mean keep waiting: while the user is on
      // GrandID's hosted page, GetSession answers NOTLOGGEDIN, which is the
      // normal state of an order nobody has finished yet.
    }
  }

  return {
    found: true,
    status: verification.status,
    reasonCode: verification.reasonCode ?? null,
    message,
    userId: verification.resultUserId
      ? verification.resultUserId.toString()
      : null,
    createdAccount: !!verification.createdAccount,
  };
}

/**
 * Best-effort cancel, so an abandoned order does not block the next attempt for
 * the three minutes it would otherwise take to expire.
 */
export async function cancelLogin(pollToken: string): Promise<boolean> {
  const verification: any = await LoginVerification.findOne({
    pollToken,
    status: "PENDING",
  });
  if (!verification) return false;

  await cancelBankIdSession(verification.grandIdSession, { service: "auth" });
  verification.status = "CANCELLED";
  verification.reasonCode = "userCancel";
  await verification.save();
  return true;
}
