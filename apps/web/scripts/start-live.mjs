// Starts the web dev server pointed at the PRODUCTION database, so you can
// browse real data locally without deploying to Vercel.
//
// Next.js won't override env vars already in process.env, so setting
// MONGODB_URI here (to the production URI) takes precedence over .env.local.
// All other vars (NEXTAUTH_SECRET, API keys, etc.) are still loaded from
// .env.local by Next.js as usual.
//
// Caveat: NEXTAUTH_URL is still http://localhost:3000, so OTP emails will
// contain localhost links. For a demo where you're already logged in this
// doesn't matter, but you can't complete a fresh OTP sign-in from email.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = fileURLToPath(new URL("..", import.meta.url));

function readEnvLocal() {
  try {
    return Object.fromEntries(
      readFileSync(resolve(webDir, ".env.local"), "utf8")
        .split("\n")
        .flatMap((line) => {
          const m = line.match(/^\s*([^#\s=][^=]*?)\s*=\s*(.*?)\s*$/);
          if (!m) return [];
          return [[m[1].trim(), m[2].trim().replace(/^["'](.*)["']$/, "$1")]];
        }),
    );
  } catch {
    return {};
  }
}

const prodUri = readEnvLocal().MONGODB_URI_PRODUCTION;

if (!prodUri) {
  console.error(
    "\nMONGODB_URI_PRODUCTION is not set in apps/web/.env.local\n\n" +
      "To fix:\n" +
      "  1. Go to Vercel project → Settings → Environment Variables\n" +
      "  2. Copy the value of MONGODB_URI (Production scope)\n" +
      "  3. Add this line to apps/web/.env.local:\n\n" +
      "     MONGODB_URI_PRODUCTION=<paste value here>\n",
  );
  process.exit(1);
}

console.log("\n> Starting web dev server against PRODUCTION database");
console.log("> Live mode — actions here write to real data!\n");

const child = spawn("npx", ["next", "dev", "--turbopack", "--port", "3000"], {
  stdio: "inherit",
  shell: true,
  cwd: webDir,
  env: { ...process.env, MONGODB_URI: prodUri },
});

child.on("exit", (code) => process.exit(code ?? 0));
