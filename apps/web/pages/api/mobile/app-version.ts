import type { NextApiRequest, NextApiResponse } from "next";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  compareVersions,
  getVersionPolicy,
} from "../../../lib/app-version";

/**
 * GET /api/mobile/app-version?version=1.2.2&platform=ios|android
 *
 * Tells an installed build whether it is current, merely behind, or too old to
 * keep running. Deliberately **unauthenticated**: the check has to work before
 * sign-in and, more importantly, has to still work for a build so old that its
 * auth calls have stopped working — that is exactly the build we most need to
 * reach. Nothing here is user-specific, so there is nothing to protect.
 *
 * The server decides the verdict *and* writes the Swedish copy, so both can be
 * changed by a web deploy. The app only renders what it is handed.
 */

type Status = "ok" | "update-available" | "update-required";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  const version = String(req.query.version ?? "").trim();
  const platform = req.query.platform === "ios" ? "ios" : "android";
  const { latest, minSupported } = getVersionPolicy();

  const storeUrl = platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
  const storeName = platform === "ios" ? "App Store" : "Google Play";

  // An unparsable or missing version is "don't know", never "out of date" — a
  // future build with a different version format must not be walled off by
  // today's server.
  const belowMin = compareVersions(version, minSupported);
  const belowLatest = compareVersions(version, latest);

  let status: Status = "ok";
  if (belowMin !== null && belowMin < 0) status = "update-required";
  else if (belowLatest !== null && belowLatest < 0) status = "update-available";

  const copy =
    status === "update-required"
      ? {
          title: "Du måste uppdatera appen",
          message: `Den här versionen av appen (${version}) stöds inte längre och kan sluta fungera. Hämta den senaste versionen i ${storeName} för att fortsätta.`,
          actionLabel: "Uppdatera nu",
        }
      : status === "update-available"
        ? {
            title: "Ny version tillgänglig",
            message: `Version ${latest} finns nu i ${storeName}. Uppdatera för de senaste förbättringarna.`,
            actionLabel: "Uppdatera",
          }
        : { title: null, message: null, actionLabel: null };

  // Same answer for everyone on a given version+platform, and it is hit on every
  // app foreground — let the CDN carry it instead of a lambda per launch.
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=3600",
  );

  return res.status(200).json({
    status,
    current: version || null,
    latest,
    minSupported,
    storeUrl,
    ...copy,
  });
}
