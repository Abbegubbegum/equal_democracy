// Cuts a new mobile release. It bumps the user-facing version everywhere it is
// recorded, rolls the CHANGELOG's [Unreleased] section into that version, commits
// and tags the result, clears the generated android/ folder, then kicks off an EAS
// production build for BOTH platforms that auto-submits each to its store (Google
// Play + App Store Connect). Pass --platform android|ios for just one.
//
// `expo.version` in app.json is the canonical version — it is what the stores show
// and what apps/web/lib/app-version.ts compares an installed build against. The
// root, apps/web and apps/mobile package.json versions are kept in step with it
// here so there is one true number; before 2026-08 they drifted badly (root 1.2.0,
// apps/mobile/package.json still 1.0.0, app.json 1.2.3).
//
// Build numbers are NOT touched here — eas.json has appVersionSource: "remote" +
// production.autoIncrement, so EAS bumps versionCode (android) and buildNumber
// (ios) itself. iOS auto-submit relies on submit.production.ios.ascAppId in
// eas.json (already set).
//
// Store release notes are still written by hand after submit — EAS Submit has no
// changelog support (verified against the docs): Play Console → "Vad är nytt"
// (sv-SE), App Store Connect → "What's New in This Version". Drafts live in
// docs/release-notes.md. That is the user-facing copy; the CHANGELOG this script
// rolls is the developer-facing history. They are deliberately different things.
//
// Usage (from apps/mobile):
//   node scripts/release.mjs            # patch bump, build + submit android + ios
//   node scripts/release.mjs patch      # same
//   node scripts/release.mjs minor      # 1.0.0 -> 1.1.0
//   node scripts/release.mjs major      # 1.0.0 -> 2.0.0
//   node scripts/release.mjs 1.4.2      # set an exact version
//   node scripts/release.mjs patch --platform android   # one store only
//   node scripts/release.mjs patch --no-submit   # build only, submit later
//   node scripts/release.mjs patch --dry-run     # write the version/changelog
//                                                # edits, then stop (no commit,
//                                                # no tag, no build)
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, "..");
const repoRoot = join(mobileRoot, "..", "..");
const appJsonPath = join(mobileRoot, "app.json");
const changelogPath = join(repoRoot, "CHANGELOG.md");
const androidDir = join(mobileRoot, "android");

// Every file carrying the human-facing version. app.json is canonical; the rest
// follow so nothing reports a stale number.
const versionFiles = [
  join(repoRoot, "package.json"),
  join(repoRoot, "apps", "web", "package.json"),
  join(mobileRoot, "package.json"),
];

const args = process.argv.slice(2);
const noSubmit = args.includes("--no-submit");
const dryRun = args.includes("--dry-run");

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

const skipIdx = platIdx === -1 ? -1 : platIdx + 1;
const bumpArg =
  args.find((a, i) => !a.startsWith("--") && i !== skipIdx) ?? "patch";

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function git(...gitArgs) {
  return execFileSync("git", gitArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

// --- 1. Preflight ----------------------------------------------------------
// Everything that can refuse the release runs before the first file is written,
// so a rejected run never leaves a half-bumped tree behind.

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

if (!dryRun) {
  // A dirty tree would sweep unrelated work into the release commit.
  const status = git("status", "--porcelain");
  if (status) {
    fail(
      `Working tree is not clean — commit or stash first, so the release commit\n` +
        `  contains only the version bump and the changelog roll. Currently dirty:\n\n` +
        status
          .split("\n")
          .slice(0, 10)
          .map((l) => `    ${l}`)
          .join("\n"),
    );
  }
  const existingTags = git("tag", "-l").split("\n");
  if (existingTags.includes(`v${next}`)) {
    fail(`Tag v${next} already exists. Pick another version.`);
  }
}

// The CHANGELOG's [Unreleased] section must actually say something. This is the
// check that stops the changelog rotting: it went unmaintained for three months
// and five releases before anyone noticed, because nothing in the release path
// ever looked at it.
const changelog = readFileSync(changelogPath, "utf8");
const unreleasedRe = /^## \[Unreleased\][ 	]*$/m;
const unreleasedMatch = changelog.match(unreleasedRe);
if (!unreleasedMatch) {
  fail(
    `CHANGELOG.md has no "## [Unreleased]" heading — cannot roll a release.`,
  );
}
const afterUnreleased = changelog.slice(
  unreleasedMatch.index + unreleasedMatch[0].length,
);
const nextHeadingIdx = afterUnreleased.search(/^## \[/m);
const unreleasedBody = (
  nextHeadingIdx === -1
    ? afterUnreleased
    : afterUnreleased.slice(0, nextHeadingIdx)
).trim();

if (!unreleasedBody) {
  fail(
    `CHANGELOG.md's [Unreleased] section is empty.\n\n` +
      `  Write what shipped since ${current} before releasing ${next}. Entries go under\n` +
      `  "## [Unreleased]" using Keep a Changelog headings (Added / Changed / Fixed /\n` +
      `  Removed). ${"`git log v" + current + "..HEAD --oneline`"} is a decent starting point.\n\n` +
      `  This is the developer-facing history. The store copy ("Vad är nytt") is a\n` +
      `  separate, user-facing thing that lives in docs/release-notes.md.`,
  );
}

console.log(`\n▶ Version: ${current} → ${next}`);
console.log(
  `  [Unreleased] has ${unreleasedBody.split("\n").filter((l) => l.trim().startsWith("-")).length} entries to roll.`,
);

// --- 2. Write the version everywhere ---------------------------------------
appJson.expo.version = next;
writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");
console.log(`  updated app.json (versionCode is auto-managed by EAS).`);

for (const file of versionFiles) {
  if (!existsSync(file)) continue;
  const raw = readFileSync(file, "utf8");
  const pkg = JSON.parse(raw);
  if (pkg.version === undefined) continue;
  pkg.version = next;
  writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`  updated ${file.slice(repoRoot.length + 1)}`);
}

// --- 3. Roll the CHANGELOG --------------------------------------------------
// [Unreleased] becomes the new version + today's date, a fresh [Unreleased] is
// opened above it, and the compare links at the foot are re-pointed.
const today = new Date().toISOString().slice(0, 10);
let rolled = changelog.replace(
  unreleasedRe,
  `## [Unreleased]\n\n## [${next}] - ${today}`,
);

const compareRe = new RegExp(
  `^\\[Unreleased\\]: (\\S+)/compare/v[\\d.]+\\.\\.\\.HEAD$`,
  "m",
);
const compareMatch = rolled.match(compareRe);
if (compareMatch) {
  const base = compareMatch[1];
  rolled = rolled.replace(
    compareRe,
    `[Unreleased]: ${base}/compare/v${next}...HEAD\n` +
      `[${next}]: ${base}/compare/v${current}...v${next}`,
  );
} else {
  console.warn(
    `  ! Could not find the [Unreleased] compare link — add the ${next} link by hand.`,
  );
}
writeFileSync(changelogPath, rolled);
console.log(`  rolled CHANGELOG.md → [${next}] - ${today}`);

if (dryRun) {
  console.log(
    `\n✔ --dry-run: version and changelog written, nothing committed or built.` +
      `\n  Review with: git diff` +
      `\n  Undo with:   git checkout -- .\n`,
  );
  process.exit(0);
}

// --- 4. Commit and tag ------------------------------------------------------
// Committed before the build because EAS uploads the working directory — the
// build should come from exactly what the tag points at.
console.log(`\n▶ Committing and tagging v${next}…`);
git(
  "add",
  "--",
  changelogPath,
  appJsonPath,
  ...versionFiles.filter(existsSync),
);
git("commit", "-m", `chore(release): ${next}`);
git("tag", "-a", `v${next}`, "-m", `${next}`);
console.log(
  `  committed chore(release): ${next} and tagged v${next} (local — push with: git push --follow-tags)`,
);

// --- 5. Clear the generated android/ folder --------------------------------
// EAS bundles the local apps/mobile/android/ folder and prebuilds on top of it;
// stale generated files leak into the cloud build and cause Kotlin "Unresolved
// reference" failures. Deleting it forces a pristine prebuild.
if (existsSync(androidDir)) {
  console.log(`\n▶ Removing generated android/ so EAS prebuilds it fresh…`);
  rmSync(androidDir, { recursive: true, force: true });
}

// --- 6. Build (+ auto-submit) via EAS --------------------------------------
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
  if (code !== 0) {
    console.error(
      `\n✖ EAS build failed (exit ${code}). The release commit and tag v${next} were` +
        `\n  already made. Either fix and re-run the build directly:` +
        `\n    npx eas-cli build --profile production --platform ${platform}${noSubmit ? "" : " --auto-submit"}` +
        `\n  or undo the release:` +
        `\n    git tag -d v${next} && git reset --hard HEAD~1\n`,
    );
  } else if (!noSubmit) {
    console.log(
      `\n✔ Build(s) submitted (${platform === "all" ? "Google Play + App Store Connect" : platform}).` +
        `\n  Push the release:  git push --follow-tags` +
        `\n\n  Next: write store release notes by hand (EAS has no changelog support):` +
        `\n    • Google Play Console → "Vad är nytt" (sv-SE, max 500 chars)` +
        `\n    • App Store Connect → "What's New in This Version"` +
        `\n    • Drafts: docs/release-notes.md` +
        `\n\n  Then, ONCE ${next} is live in BOTH stores, bump the version` +
        `\n  that older builds are told to update to:` +
        `\n    apps/web/lib/app-version.ts  ->  LATEST_MOBILE_VERSION = "${next}"` +
        `\n  (bumping it before the stores have it nags users with nothing to install)\n`,
    );
  }
  process.exit(code ?? 0);
});
