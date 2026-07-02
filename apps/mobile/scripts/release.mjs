// Cuts a new mobile release. By default it bumps the user-facing `version` in
// app.json, clears the generated android/ folder, then kicks off an EAS
// production build for BOTH platforms that auto-submits each to its store
// (Google Play + App Store Connect). Pass --platform android|ios for just one.
//
// Build numbers are NOT touched here — eas.json has appVersionSource: "remote" +
// production.autoIncrement, so EAS bumps versionCode (android) and buildNumber
// (ios) itself. This script only owns the shared, visible `version` string
// (e.g. 1.0.0 -> 1.0.1). iOS auto-submit relies on submit.production.ios.ascAppId
// in eas.json (already set).
//
// Release notes are still written by hand after submit — EAS Submit has no
// changelog support (verified against the docs): Play Console → "Vad är nytt"
// (sv-SE), App Store Connect → "What's New in This Version".
//
// Usage (from apps/mobile):
//   node scripts/release.mjs            # patch bump, build + submit android + ios
//   node scripts/release.mjs patch      # same
//   node scripts/release.mjs minor      # 1.0.0 -> 1.1.0
//   node scripts/release.mjs major      # 1.0.0 -> 2.0.0
//   node scripts/release.mjs 1.4.2      # set an exact version
//   node scripts/release.mjs patch --platform android   # one store only
//   node scripts/release.mjs patch --platform ios       # one store only
//   node scripts/release.mjs patch --no-submit   # build only, submit later
//   node scripts/release.mjs patch --dry-run     # bump version only, no build
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, "..");
const appJsonPath = join(mobileRoot, "app.json");
const androidDir = join(mobileRoot, "android");

const args = process.argv.slice(2);
const noSubmit = args.includes("--no-submit");
const dryRun = args.includes("--dry-run");

// --platform <android|ios|all> — default all: build & submit both stores at once.
let platform = "all";
const platIdx = args.indexOf("--platform");
if (platIdx !== -1) {
  platform = args[platIdx + 1];
  if (!["android", "ios", "all"].includes(platform)) {
    fail(
      `--platform must be android, ios, or all (got: ${platform ?? "nothing"}).`,
    );
  }
}

// The positional bump arg is the first non-flag token, skipping the --platform value.
const skipIdx = platIdx === -1 ? -1 : platIdx + 1;
const bumpArg =
  args.find((a, i) => !a.startsWith("--") && i !== skipIdx) ?? "patch";

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// --- 1. Compute the next version -------------------------------------------
const appJson = JSON.parse(readFileSync(appJsonPath, "utf8"));
const current = appJson.expo?.version;
if (!current || !/^\d+\.\d+\.\d+$/.test(current)) {
  fail(`app.json expo.version is missing or not semver (found: ${current}).`);
}

let next;
if (/^\d+\.\d+\.\d+$/.test(bumpArg)) {
  next = bumpArg;
} else if (["patch", "minor", "major"].includes(bumpArg)) {
  const [maj, min, pat] = current.split(".").map(Number);
  next =
    bumpArg === "major"
      ? `${maj + 1}.0.0`
      : bumpArg === "minor"
        ? `${maj}.${min + 1}.0`
        : `${maj}.${min}.${pat + 1}`;
} else {
  fail(
    `Unknown version argument "${bumpArg}". Use patch|minor|major or an explicit X.Y.Z.`,
  );
}

console.log(`\n▶ Version: ${current} → ${next}`);
appJson.expo.version = next;
writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");
console.log(`  updated app.json (versionCode is auto-managed by EAS).`);

if (dryRun) {
  console.log(`\n✔ --dry-run: version bumped, no build started.`);
  console.log(`  Remember to commit the app.json change.\n`);
  process.exit(0);
}

// --- 2. Clear the generated android/ folder --------------------------------
// EAS bundles the local apps/mobile/android/ folder and prebuilds on top of it;
// stale generated files leak into the cloud build and cause Kotlin "Unresolved
// reference" failures. Deleting it forces a pristine prebuild.
if (existsSync(androidDir)) {
  console.log(`\n▶ Removing generated android/ so EAS prebuilds it fresh…`);
  rmSync(androidDir, { recursive: true, force: true });
}

// --- 3. Build (+ auto-submit) via EAS --------------------------------------
const easArgs = [
  "eas-cli",
  "build",
  "--profile",
  "production",
  "--platform",
  platform,
];
if (!noSubmit) easArgs.push("--auto-submit");

const platformLabel = platform === "all" ? "android + ios" : platform;
console.log(
  `\n▶ Building ${platformLabel}: npx ${easArgs.join(" ")}` +
    (noSubmit
      ? `  (build only — submit later with: npx eas-cli submit --profile production --platform ${platform})`
      : "") +
    `\n`,
);

// `shell: true` is required on Windows (Node CVE-2024-27980 patch makes spawning
// npx.cmd without a shell throw EINVAL) — matches start-live.mjs.
const child = spawn("npx", easArgs, {
  stdio: "inherit",
  shell: true,
  cwd: mobileRoot,
  env: process.env,
});

child.on("exit", (code) => {
  if (code === 0 && !noSubmit) {
    console.log(
      `\n✔ Build(s) submitted (${platform === "all" ? "Google Play + App Store Connect" : platform}).` +
        `\n  Next: write release notes by hand (EAS has no changelog support):` +
        `\n    • Google Play Console → "Vad är nytt" (sv-SE)` +
        `\n    • App Store Connect → "What's New in This Version"\n`,
    );
  }
  process.exit(code ?? 0);
});
