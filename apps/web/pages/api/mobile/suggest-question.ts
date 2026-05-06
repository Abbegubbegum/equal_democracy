import type { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";
import { verifyBearerToken } from "../../../lib/mobile-jwt";
import { createLogger } from "../../../lib/logger";

const log = createLogger("MobileSuggestQuestion");
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  let user;
  try {
    user = verifyBearerToken(req.headers.authorization);
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { question } = req.body;
  if (!question?.trim()) return res.status(400).json({ message: "Fråga krävs" });
  if (question.trim().length > 200) return res.status(400).json({ message: "Frågan är för lång (max 200 tecken)" });

  try {
    await resend.emails.send({
      from: "Vallentuna Framåt <no-reply@demokrati.vallentuna.app>",
      to: "peer.norback@gmail.com",
      subject: "Ny fråga föreslagen i appen",
      html: `
        <h2>En medborgare har föreslagit en fråga</h2>
        <p><strong>Fråga:</strong></p>
        <blockquote style="border-left:4px solid #002d75;padding-left:12px;color:#333">${question.trim()}</blockquote>
        <p style="color:#666;font-size:13px">Från: ${user.email}</p>
      `,
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    log.error("Failed to send question suggestion", { error: error.message });
    return res.status(500).json({ message: "Kunde inte skicka förslaget, försök igen" });
  }
}
