// Starts Expo Go pointed at the LIVE production backend, so you can browse real
// data on a device/emulator without running the local Next.js server.
//
// EXPO_PUBLIC_* vars are inlined at bundle time, so this sets the var in the
// process environment (which takes precedence over apps/mobile/.env) and starts
// Expo with a cleared Metro cache (-c) so the new value is picked up.
//
// Note: your locally stored login is a JWT issued by the *dev* backend and will
// not validate against production — you'll be bounced to the login screen and
// must sign in with the real OTP flow against the live site.
import { spawn } from "node:child_process";

const LIVE_API_URL = "https://www.vallentuna.app";

console.log(`\n▶ Starting Expo Go against LIVE backend: ${LIVE_API_URL}\n`);

// `shell: true` is required on Windows: since Node's CVE-2024-27980 patch,
// spawning a `.cmd` (npx.cmd) without a shell throws EINVAL.
const child = spawn("npx", ["expo", "start", "--go", "-c"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_API_URL: LIVE_API_URL },
});

child.on("exit", (code) => process.exit(code ?? 0));
