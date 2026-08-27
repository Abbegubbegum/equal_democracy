import type { NextApiRequest, NextApiResponse } from "next";
import connectDB from "../../../../lib/mongodb";
import { User } from "../../../../lib/models";
import { requireAccount } from "../../../../lib/viewer";
import { EMAIL_RE, addressOwner } from "../../../../lib/email-claim";

/**
 * POST /api/mobile/user/email
 * Body: { email: string }  — an empty string clears it.
 *
 * The account's contact address, treated exactly like `phoneNumber`: the user
 * types it, we store it, they can remove it again. **Not verified**, and not a
 * credential — once an account has BankID, nothing sent to this address can
 * open a session (C1 in docs/bankid-login-plan.md).
 *
 * Because it is unverified, setting it does **nothing** except store a string.
 * In particular it never merges accounts here: absorbing whatever account
 * already held an address, on nothing more than someone typing it, would be an
 * account takeover with extra steps.
 *
 * A taken address therefore gets one of two distinct 409s, and the difference is
 * the point:
 *
 *   TAKEN            another BankID account holds it. Nothing to offer.
 *   MERGE_AVAILABLE  a legacy account holds it — very likely the caller's own,
 *                    from before BankID. The client offers to merge, which goes
 *                    through the verified flow at ./email/claim.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();

  const viewer = await requireAccount(req, res);
  if (!viewer) return;

  const { email } = req.body as { email?: unknown };
  if (typeof email !== "string")
    return res.status(400).json({ error: "email must be a string" });

  await connectDB();

  const trimmed = email.trim().toLowerCase();
  if (trimmed === "") {
    await User.findByIdAndUpdate(viewer.userId, { email: null });
    return res.status(200).json({ ok: true, email: null });
  }

  if (!EMAIL_RE.test(trimmed)) {
    return res.status(400).json({ error: "Ogiltig e-postadress" });
  }

  const owner = await addressOwner(trimmed, viewer.userId);

  if (owner === "taken") {
    return res.status(409).json({
      code: "TAKEN",
      error:
        "Den e-postadressen används redan av ett annat konto som loggar in med BankID.",
    });
  }

  if (owner === "mergeable") {
    // Not an error so much as a discovery: the address belongs to an account
    // that predates BankID, which is almost always the caller's own. Offer the
    // merge rather than refusing, and make them prove the mailbox to take it.
    return res.status(409).json({
      code: "MERGE_AVAILABLE",
      email: trimmed,
      error:
        "Den e-postadressen tillhör ett äldre konto. Vill du slå ihop det med ditt konto?",
    });
  }

  try {
    await User.findByIdAndUpdate(viewer.userId, { email: trimmed });
  } catch (error) {
    // The index is the real guard; addressOwner above only decides what to say.
    if ((error as { code?: number }).code === 11000) {
      return res.status(409).json({
        code: "TAKEN",
        error: "Den e-postadressen används redan av ett annat konto.",
      });
    }
    throw error;
  }

  return res.status(200).json({ ok: true, email: trimmed });
}
