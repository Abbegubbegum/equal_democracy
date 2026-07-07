import { CitizenProposal, CitizenProposalRating, User } from "./models";
import { getRankedActiveProposals } from "./forslag-ranking";
import { sendEmail } from "./email";
import { createLogger } from "./logger";

const log = createLogger("ForslagMaintenance");

function baseUrl(): string {
  return process.env.NEXTAUTH_URL || "https://www.vallentuna.app";
}

/**
 * Archive every active proposal that is past its 10-day grace window and sits
 * outside the top 20. Returns the culled entries (for the cron response).
 */
export async function cullExpiredProposals(now: Date = new Date()) {
  const ranked = await getRankedActiveProposals(
    CitizenProposal,
    CitizenProposalRating,
    now,
  );
  const toCull = ranked.filter((p) => p.shouldCull);
  if (toCull.length === 0) return [];

  await CitizenProposal.updateMany(
    { _id: { $in: toCull.map((p) => p._id) } },
    { $set: { status: "archived" } },
  );

  log.info("Culled proposals past grace and outside top 20", {
    count: toCull.length,
  });

  return toCull.map((p: any) => ({
    id: p._id,
    title: p.title,
    rank: p.rank,
  }));
}

/**
 * Once per calendar month, lift the current #1 off the stack as a motion and
 * email the admins which proposal it was (so the manual fullmäktige handoff
 * isn't missed). No-ops if a motion was already recorded this month — including
 * a manual admin override, so we never double-send in the same month.
 */
export async function runMonthlyMotion(now: Date = new Date()) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const already = await CitizenProposal.exists({
    status: "motion",
    motionAt: { $gte: startOfMonth },
  });
  if (already) return null;

  const ranked = await getRankedActiveProposals(
    CitizenProposal,
    CitizenProposalRating,
    now,
  );
  const top: any = ranked[0];
  if (!top) return null;

  await CitizenProposal.findByIdAndUpdate(top._id, {
    $set: { status: "motion", motionAt: now },
  });

  log.info("Monthly motion taken from stack", {
    id: top._id.toString(),
    title: top.title,
    score: Math.round(top.score),
  });

  await notifyAdminsOfMotion(top).catch((e) =>
    log.error("Failed to email admins about monthly motion", {
      error: e?.message,
    }),
  );

  return { id: top._id, title: top.title, score: Math.round(top.score) };
}

async function notifyAdminsOfMotion(top: any) {
  const admins = await User.find({
    $or: [{ isAdmin: true }, { isSuperAdmin: true }],
  })
    .select("email")
    .lean<{ email?: string }[]>();

  const recipients = admins.map((a) => a.email).filter(Boolean) as string[];
  if (recipients.length === 0) return;

  const subject = "Månadens motion har tagits från Förslag-stacken";
  const manageUrl = `${baseUrl()}/manage-proposals`;
  const votes = top.ratingCount || 0;
  const avg = (top.averageRating || 0).toFixed(1);

  const text =
    `Månadens högst rankade förslag har lyfts av stacken som motion till fullmäktige:\n\n` +
    `"${top.title}"\n` +
    `Poäng ${Math.round(top.score)} · ${votes} röster · snitt ${avg}\n\n` +
    `Nästa steg: omformulera förslaget så det passar fullmäktiges formalia och lägg in det som en punkt på nästa kommunmöte.\n\n` +
    `Se stacken: ${manageUrl}`;

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1f2937">
      <h2 style="color:#002d75">Månadens motion</h2>
      <p>Månadens högst rankade förslag har lyfts av stacken som motion till fullmäktige:</p>
      <div style="margin:16px 0;padding:16px;background:#f7f8fb;border-left:4px solid #f5a623;border-radius:8px">
        <div style="font-weight:800;font-size:16px">${escapeHtml(top.title)}</div>
        <div style="color:#6b7280;font-size:14px;margin-top:4px">Poäng ${Math.round(
          top.score,
        )} · ${votes} röster · snitt ${avg}</div>
      </div>
      <p><b>Nästa steg:</b> omformulera förslaget så det passar fullmäktiges formalia och lägg in det som en punkt på nästa kommunmöte.</p>
      <p><a href="${manageUrl}" style="color:#002d75">Se hela stacken →</a></p>
    </div>`;

  for (const to of recipients) {
    await sendEmail(to, subject, text, html, "sv").catch((e) =>
      log.error("Motion email failed for a recipient", { error: e?.message }),
    );
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
