/**
 * Claiming a legacy account by proving its email address.
 *
 * This exists alongside the plain contact-email setter
 * (`/api/mobile/user/email`), and the split is the whole design:
 *
 *   setting an address   → unverified. It stores a string and nothing else.
 *   absorbing an account → verified. A code is sent to the address first.
 *
 * The asymmetry is not fussiness. An unverified merge would let anyone take
 * over any legacy account by typing its owner's address, so anything that moves
 * votes, proposals and a paid membership between accounts has to prove the
 * mailbox. Anything that merely records where to reach someone does not.
 *
 * **Nothing here issues a session, and no code path leads from a `MergeCode` to
 * one.** That is what keeps this on the right side of ID-växling: the caller is
 * *already* authenticated by BankID, and what a code proves is control of a
 * communications channel, not the identity of a person. Three properties carry
 * that argument, and they are requirements rather than description:
 *
 *   1. `MergeCode` is its own collection, never `LoginCode`.
 *   2. It carries the `userId` it was issued to, and is only valid inside that
 *      session.
 *   3. Redeeming one merges and returns. It never mints a token, and no caller
 *      may make it do so.
 *
 * Do not add a "convenience" sign-in here.
 */

import bcrypt from "bcryptjs";
import { MergeCode, User } from "./models";
import { sendEmail } from "./email";
import { createLogger } from "./logger";
import { mergeAccounts } from "./account-merge";

const log = createLogger("EmailClaim");

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export const EMAIL_RE = /^\S+@\S+\.\S+$/;

export interface ClaimOutcome {
  ok: boolean;
  /** HTTP status the route should use. */
  status: number;
  /** Swedish, safe to show. */
  message: string;
  /** True when redeeming the code folded another account into this one. */
  merged?: boolean;
}

function random6(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Who holds an address, and what that means for the caller.
 *
 * Shared with the plain setter so both agree on the three cases: free, held by
 * a legacy account (mergeable), or held by a BankID account (never).
 */
export async function addressOwner(
  email: string,
  callerId: string,
): Promise<"free" | "self" | "mergeable" | "taken"> {
  const owner: any = await User.findOne({ email })
    .select("_id bankidSubject")
    .lean();
  if (!owner) return "free";
  if (owner._id.toString() === String(callerId)) return "self";
  return owner.bankidSubject ? "taken" : "mergeable";
}

/**
 * Sends a six-digit code to an address the caller wants to claim.
 *
 * Refuses only the one case that can never work — an address held by another
 * BankID account. A free address is allowed through: the post-signup prompt
 * cannot know in advance whether the user actually had an old account, and
 * "there was nothing to merge, but the address is yours now" is a perfectly good
 * outcome.
 */
export async function requestEmailClaim(
  userId: string,
  rawEmail: unknown,
): Promise<ClaimOutcome> {
  const email = String(rawEmail || "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, status: 400, message: "Ogiltig e-postadress." };
  }

  if ((await addressOwner(email, userId)) === "taken") {
    return {
      ok: false,
      status: 409,
      message:
        "Den e-postadressen används redan av ett annat konto som loggar in med BankID.",
    };
  }

  const code = random6();
  await MergeCode.deleteMany({ userId });
  await MergeCode.create({
    userId,
    email,
    codeHash: await bcrypt.hash(code, 10),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  await sendEmail(
    email,
    "Bekräfta din e-postadress — Vallentuna Framåt",
    `Din kod är ${code}. Den gäller i 10 minuter.\n\n` +
      "Koden bekräftar att adressen är din. Den loggar inte in någon — " +
      "ditt konto öppnas alltid med BankID.",
    `<p>Din kod är <strong style="font-size:20px">${code}</strong>. Den gäller i 10 minuter.</p>` +
      "<p>Koden bekräftar att adressen är din. Den loggar inte in någon — " +
      "ditt konto öppnas alltid med BankID.</p>",
  );

  log.info("Email claim code sent", { userId });
  return {
    ok: true,
    status: 200,
    message: "Vi har skickat en kod till din e-post.",
  };
}

/**
 * Redeems a code: folds in the legacy account that held the address, if there
 * was one, and attaches the address either way.
 *
 * The merge direction is always *into the caller's account* — they are signed
 * in with BankID, so theirs is the account that carries the identity. See
 * lib/account-merge.ts.
 */
export async function confirmEmailClaim(
  userId: string,
  rawCode: unknown,
): Promise<ClaimOutcome> {
  const code = String(rawCode || "").trim();
  if (!code) return { ok: false, status: 400, message: "Ange koden." };

  const record: any = await MergeCode.findOne({
    userId,
    expiresAt: { $gt: new Date() },
  });
  if (!record) {
    return {
      ok: false,
      status: 400,
      message: "Koden har gått ut. Begär en ny.",
    };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await MergeCode.deleteMany({ userId });
    return {
      ok: false,
      status: 429,
      message: "För många försök. Begär en ny kod.",
    };
  }

  if (!(await bcrypt.compare(code, record.codeHash))) {
    record.attempts += 1;
    await record.save();
    return { ok: false, status: 400, message: "Fel kod." };
  }

  await MergeCode.deleteMany({ userId });

  const email = record.email;
  const owner = await addressOwner(email, userId);

  // Re-checked rather than trusted from the request: minutes pass while someone
  // reads their inbox, and the address could have changed hands in between.
  if (owner === "taken") {
    return {
      ok: false,
      status: 409,
      message:
        "Den e-postadressen används redan av ett annat konto som loggar in med BankID.",
    };
  }

  let merged = false;
  if (owner === "mergeable") {
    const legacy: any = await User.findOne({ email }).select("_id").lean();
    try {
      await mergeAccounts(legacy._id.toString(), String(userId));
      merged = true;
    } catch (error) {
      log.error("Merge failed while claiming an email", {
        userId,
        error: (error as Error).message,
      });
      return {
        ok: false,
        status: 500,
        message:
          "Kontona kunde inte slås ihop just nu. Försök igen om en stund.",
      };
    }
  }

  // After a merge the address has already moved across, but setting it again is
  // both harmless and correct for the plain attach case.
  await User.updateOne({ _id: userId }, { $set: { email } });

  log.info("Email claim confirmed", { userId, merged });
  return {
    ok: true,
    status: 200,
    merged,
    message: merged
      ? "Klart — ditt gamla konto är nu ihopslaget med det här."
      : "Din e-postadress är sparad.",
  };
}
