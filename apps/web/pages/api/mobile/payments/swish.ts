import type { NextApiRequest, NextApiResponse } from "next";
import { MEMBERSHIP_PAYMENT_MESSAGE, MEMBERSHIP_YEARS } from "@repo/types";
import connectDB from "../../../../lib/mongodb";
import { Payment, User } from "../../../../lib/models";
import { requireAccount } from "../../../../lib/viewer";
import { createLogger } from "../../../../lib/logger";
import { getMembershipFee } from "../../../../lib/membership";
import { getSwishConfig } from "../../../../lib/swish/config";
import {
  createPaymentRequest,
  newCallbackIdentifier,
  newInstructionId,
} from "../../../../lib/swish/payments";

const log = createLogger("MobileSwishPayment");

/**
 * Swish gives the payer 3 minutes to sign and its backend gives up at 5.5.
 * Inside that window a tap on "Betala" is the user returning to a payment that
 * is still live, so we hand back the same token instead of creating a second
 * request — Swish would answer RP06 anyway.
 */
const IN_FLIGHT_WINDOW_MS = 6 * 60 * 1000;

/**
 * POST /api/mobile/payments/swish
 *
 * Creates an m-commerce Swish payment request for the membership fee and
 * returns the token the app switches to Swish with.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const viewer = await requireAccount(req, res);
  if (!viewer) return;

  try {
    await connectDB();

    const dbUser: any = await User.findById(viewer.userId)
      .select("membershipStatus email phoneNumber")
      .lean();
    if (!dbUser) return res.status(401).json({ message: "Unauthorized" });

    if (dbUser.membershipStatus === "active") {
      return res.status(409).json({ message: "Du är redan medlem." });
    }

    // Membership needs a verified identity and a way to reach the member — a
    // party member roll is not something to keep against an account we cannot
    // contact. Enforced here as well as in the UI because this is the gate that
    // actually holds: the client check only exists so nobody reaches it.
    //
    // The order matters. BankID first, because it is the one requirement the
    // user cannot satisfy from this screen.
    if (viewer.capability !== "participant") {
      return res.status(403).json({
        code: "MEMBERSHIP_REQUIREMENTS",
        missing: ["bankid"],
        message:
          viewer.message ||
          "Du behöver logga in med BankID innan du kan bli medlem.",
      });
    }

    const missing = [
      dbUser.email ? null : "email",
      dbUser.phoneNumber ? null : "phone",
    ].filter(Boolean);

    if (missing.length) {
      return res.status(403).json({
        code: "MEMBERSHIP_REQUIREMENTS",
        missing,
        message:
          "Lägg till e-postadress och mobilnummer på ditt konto innan du blir medlem.",
      });
    }

    // Resume an in-flight request rather than starting a competing one.
    const inFlight: any = await Payment.findOne({
      userId: viewer.userId,
      status: "CREATED",
      createdAt: { $gt: new Date(Date.now() - IN_FLIGHT_WINDOW_MS) },
      token: { $ne: null },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (inFlight) {
      log.info("Reusing in-flight payment", {
        paymentId: inFlight._id.toString(),
        userId: viewer.userId,
      });
      return res.status(200).json({
        paymentId: inFlight._id.toString(),
        token: inFlight.token,
        amount: inFlight.amount,
        resumed: true,
      });
    }

    const { env } = getSwishConfig();

    // Created before the Swish call on purpose: its _id is what we send as
    // payeePaymentReference, which is how a callback finds its way back here.
    const payment = await Payment.create({
      userId: viewer.userId,
      instructionId: newInstructionId(),
      callbackIdentifier: newCallbackIdentifier(),
      amount: getMembershipFee(),
      message: MEMBERSHIP_PAYMENT_MESSAGE,
      membershipYears: MEMBERSHIP_YEARS,
      env,
      status: "CREATED",
    });

    const result = await createPaymentRequest({
      instructionId: payment.instructionId,
      callbackIdentifier: payment.callbackIdentifier,
      amount: payment.amount,
      message: payment.message,
      payeePaymentReference: payment._id.toString(),
    });

    if (result.ok) {
      if (!result.token) {
        // Only happens if a payerAlias leaked into the request, making it
        // e-commerce — there would be nothing for the app to switch to.
        log.error("Swish returned no PaymentRequestToken", {
          paymentId: payment._id.toString(),
        });
        payment.status = "ERROR";
        payment.errorMessage = "No PaymentRequestToken returned";
        await payment.save();

        return res.status(502).json({
          message: "Betalningen kunde inte startas just nu. Försök igen.",
        });
      }

      payment.token = result.token;
      await payment.save();

      log.info("Payment request created", {
        paymentId: payment._id.toString(),
        instructionId: payment.instructionId,
        env,
      });

      return res.status(201).json({
        paymentId: payment._id.toString(),
        token: result.token,
        amount: payment.amount,
        resumed: false,
      });
    }

    log.error("Swish rejected payment request", {
      paymentId: payment._id.toString(),
      httpStatus: result.httpStatus,
      code: result.code,
      errors: result.errors,
    });
    payment.status = "ERROR";
    payment.errorCode = result.code;
    payment.errorMessage = result.errors[0]?.errorMessage ?? null;
    await payment.save();

    return res.status(502).json({ message: result.message });
  } catch (err: any) {
    log.error("Failed to create Swish payment", {
      userId: viewer.userId,
      error: err?.message,
    });
    return res.status(500).json({
      message: "Betalningen kunde inte startas just nu. Försök igen.",
    });
  }
}
