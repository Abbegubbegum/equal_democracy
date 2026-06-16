# Equal Democracy (Jämlik Demokrati) — Project Reference

## Working Principles (read first)

These override the default Claude Code defaults for this project:

1. **Production-ready by default.** Every change must work on the deploy target (Vercel serverless), not just on a dev machine. No filesystem writes to `public/`, no assumptions of persistent in-process state across requests, no reliance on a long-running Node process. If a feature needs a cron/queue/blob store in production, wire it up — don't leave a dev-only shim. See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for the running list of patterns to avoid.

2. **Runtime matters.** Consider what happens after deploy: function cold starts, 60s/300s timeouts, read-only filesystem outside `/tmp`, ephemeral `/tmp`, multiple lambda instances, MongoDB connection pooling, CDN caching of `public/`. A solution that works at 5 users but fails at 500 is not finished.

3. **No legacy.** This codebase has no backwards-compatibility burden. If a name is misleading, rename it. If code is dead or unused, delete it. If a pattern is outdated, rewrite it. Don't add deprecation shims, don't preserve old export names, don't keep "removed for X" comments.

4. **Fix what you find.** If you encounter broken, stale, or low-quality code while working on a different task, fix it in the same change. Don't tip-toe around it or file a follow-up note. The exception is large refactors that would obscure the primary diff — flag those before starting.

5. **Keep this file accurate.** When you add a model, route, page, package, or architectural decision, update the relevant section before completing the task. When you delete something, remove its entry. Stale docs are worse than no docs.

6. **Always Read before Edit.** Before any batch of Edits, Read every target file in the same parallel batch — even just `limit: 1` is enough to satisfy the tool. Don't rely on having read the file earlier in the session, and never assume a renamed/moved path is cached. Firing Edit on an unread path errors out and forces a re-read round-trip, which wastes a turn.

## Maintenance

**Before deploying to Vercel**, read [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) — it tracks patterns in the codebase that work locally but break on serverless (filesystem writes to `public/`, missing cron, etc.) and lists the env vars + checklist for first deploy.

## Project Overview

A democratic participation platform for Swedish municipalities. Citizens can vote in sessions, participate in budget allocation, submit citizen proposals (medborgarförslag), and engage with municipal council meetings. Built as a Turborepo monorepo.

**Live stack:** Next.js 15 · MongoDB/Mongoose · NextAuth (email OTP) · Pusher (real-time) · Resend (email) · Twilio (SMS) · Anthropic Claude API (PDF extraction) · Tailwind CSS v4 · D3.js · Expo React Native

---

## Monorepo Structure

```
equal_democracy/
├── apps/
│   ├── web/          # Main Next.js application (primary app)
│   └── mobile/       # Expo React Native app (Expo Router, JWT auth)
├── packages/
│   ├── types/        # Shared TypeScript types (used by both apps)
│   ├── ui/           # Shared component library (budget components)
│   ├── eslint-config/
│   └── typescript-config/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

**Package manager:** pnpm 10.33.0 · **Node:** >=18 · **TypeScript:** 5.9.2 (strict mode OFF — noImplicitAny: false)

---

## Dev Commands

```bash
# From repo root
pnpm install          # Install all dependencies
pnpm dev              # Start web + mobile together
pnpm dev:web          # Start web only (no mobile)
pnpm dev:mobile       # Start mobile only (no web)
pnpm build            # Build all apps
pnpm lint             # Lint all (web + mobile + packages)
pnpm check-types      # Type check all (web + mobile + packages)
pnpm format           # Prettier-format all .ts/.tsx/.md files

# From apps/web specifically
pnpm dev --filter=web
npm run backup            # Mirror prod DB to backup DB
```

Web runs on `http://localhost:3000` (Next.js with Turbopack)

---

## apps/mobile — React Native App

Built with Expo 54 + Expo Router v6 (file-based routing, same mental model as Next.js Pages Router).

### Directory Layout

```
apps/mobile/
├── app/
│   ├── _layout.tsx          # Root layout: GestureHandler + SafeAreaProvider + AuthProvider
│   ├── legal.tsx            # Integritetspolicy & Användarvillkor — native screen, linked from login and Info tab
│   ├── (auth)/
│   │   ├── _layout.tsx      # Redirects to (app)/ if already logged in
│   │   └── login.tsx        # Two-step email → OTP login screen; link to legal.tsx at bottom
│   └── (app)/
│       ├── _layout.tsx      # MaterialTopTabs (6 tabs, native horizontal swipe via react-native-pager-view) + custom BottomBar + auth guard + Expo-Go-guarded push registration
│       ├── index.tsx        # Hem — fixed blue hero with inline logo (clipped-rotated-square >> symbol) + scrollable party info cards
│       ├── sessions.tsx     # Sessioner — TikTok-style full-screen vertical carousel of active sessions
│       ├── vote.tsx         # Rösta — "voting"-type sessions: single question with Ja/Nej/Avstår + result bars
│       ├── proposals.tsx    # Förslag — full-screen paginated citizen proposals with image backgrounds
│       ├── archive.tsx      # Arkiv — closed sessions with yes/no vote bars
│       └── membership.tsx   # Info (tab) / Bli medlem (in-page) — membership/payment page (BankID + Swish pending); link to legal.tsx at bottom
├── lib/
│   ├── api.ts               # apiClient() — Bearer token injection + silent 401 refresh
│   ├── auth-context.tsx     # AuthProvider + useAuth() hook
│   ├── storage.ts           # Key-value storage backed by expo-secure-store (encrypted, native-only)
│   ├── stars.ts             # Local star counter (SecureStore) + one-time celebration flags
│   ├── onboarding.ts        # Login counter + onboarding state (SecureStore): incrementLoginCount, getOnboardingState, markPromptShown, markProfileCompleted
│   ├── XAIModal.tsx         # XAI chat sheet — sparkles button opens Claude-backed assistant
│   ├── CelebrationModal.tsx # Spring-animated star reward overlay (reused across all 4 trigger screens)
│   ├── InterestsModal.tsx   # Progressive-onboarding prompt to pick interest areas (shown after 2nd/3rd login if profile not completed)
│   └── SettingsModal.tsx    # Interest-area settings sheet — self-contained (reads/writes SecureStore internally); used on Hem and Info tabs
├── metro.config.js          # Monorepo-aware Metro config — required for pnpm workspace resolution
└── .env                     # EXPO_PUBLIC_API_URL — must be LAN IP for physical devices
```

### Key Patterns

**Auth:** Uses JWT tokens (not NextAuth cookies). Tokens stored via `lib/storage.ts` (expo-secure-store). `useAuth()` exposes `user`, `isLoading`, `requestCode(email)`, `login(email, code)`, `logout()`.

**API calls:** Use `apiClient<T>(path, options)` from `lib/api.ts`. It reads the access token from storage, attaches `Authorization: Bearer`, and silently refreshes on 401 before retrying once.

**Storage:** Use `lib/storage.ts` (`getItem`/`setItem`/`deleteItem`) — a thin async wrapper over `expo-secure-store`. The app is native-only (no Expo web target).

**Navigation:** `(app)/_layout.tsx` composes `@react-navigation/material-top-tabs` via `withLayoutContext` from expo-router, configured with `tabBarPosition="bottom"` and a custom `<BottomBar />` (`tabBar` prop) that renders five visible tabs (Hem, Sessioner, Rösta, Förslag, Info) with the existing icon/label/active-tint design. The `archive` screen still exists in the navigator (so deep links and notification routing work) but is filtered out of the `BottomBar` render via `state.routes.filter((r) => r.name !== "archive")`. The underlying `react-native-pager-view` gives native, content-tracking horizontal swipe between tabs — drag with finger and the screen content slides under you, snap is velocity-aware. Tabs do NOT wrap around (stops at Hem and Info, matching standard mobile app behavior). Don't switch back to expo-router's `<Tabs>` — under SDK 54 + Expo Go new architecture, that variant's bottom-tab bar fails to render at all on Android emulators.

**Why custom `<BottomBar />` instead of the default top-tabs bar:** The default material-top-tabs bar is a horizontal scrollable strip with an animated indicator under the active label — wrong shape for a bottom nav. The custom component renders state-driven `<TouchableOpacity>` tabs reading `state.routes` / `state.index` / `descriptors[].options.title` from props, plus an icon mapping in `TAB_ICONS`. Tap handler emits a `tabPress` event (so pager-view can react), then calls `navigation.navigate(route.name)` only if not focused. To hide a tab from the bar without removing the screen, filter it by `route.name` in the `BottomBar` render — do NOT use `tabBarButton: () => null` (that's a bottom-tabs option that doesn't exist on `MaterialTopTabNavigationOptions` and will cause a type error).

**Navigation guards:** `(auth)/_layout.tsx` redirects logged-in users to the app. `(app)/_layout.tsx` redirects unauthenticated users to login. Both check `useAuth()`.

**Sessioner screen (sessions.tsx) — vertical pager:** Uses `react-native-pager-view` with `orientation="vertical"`. Each session is its own page; the page owns its own background `<Image>` (`StyleSheet.absoluteFill`) so there's no shared double-buffer crossfade and no scroll-driven sync to go out of alignment. Inside each page, a `ScrollView` with `nestedScrollEnabled` holds the compact title block + inline proposals list — the user can fine-scroll comments/proposals freely, and pager-view takes over the gesture only when the inner ScrollView is at its top/bottom edge, snapping to the previous/next session. Velocity is handled by pager-view's native gesture recognizer (a flick at the edge commits to next; a slow nudge stays put). The hero block is compact (`paddingTop: insets.top + 64` to clear the XAI button) and the proposals overlay starts immediately below the title. A subtle chevron-down icon (`scrollAffordance`) fades in at the bottom of the page when `contentHeight > viewportHeight` and disappears once the user starts scrolling. `Image.prefetch()` still warms the cache for all session images on load.

**Sessioner infinite loop (PagerView variant):** Triple-array `[...sessions, ...sessions, ...sessions]` with `initialPage = sessions.length` (first item of middle copy). On `onPageSelected`, if `position < n` or `position >= n * 2` (outer thirds), silently `pagerRef.current?.setPageWithoutAnimation()` to the matching slot in the middle copy. An `isJumpingRef` guards against the silent jump re-triggering `onPageSelected`. This is the pager-view adaptation of the older ScrollView-based triple-array pattern still used in `vote.tsx` and `proposals.tsx`.

**Rösta screen (vote.tsx):** TikTok-style full-screen vertical carousel of voting sessions with infinite loop (triple-array pattern, same as `sessions.tsx` and `proposals.tsx`). Each page owns its background image (plain `<Image>` as `absoluteFill` inside the page View — NOT a shared double-buffer). Sessions without an image show a solid dark blue (`#002d75`) base. Uses `containerH` from `onLayout` (not `Dimensions`) so `pagingEnabled` snaps correctly after the tab bar. Active session ("Dagens fråga") shows a compact semi-transparent card; results are hidden before voting to prevent bandwagon effect and appear immediately after voting. Past sessions always show read-only results. Three radio alternatives (Ja/Nej/Avstår). Share button uses React Native `Share.share()`. Yellow "Föreslå en fråga" button pinned to bottom opens a bottom-sheet modal that POSTs to `/api/mobile/suggest-question`. Fetches from `/api/mobile/sessions/voting` (active first, then closed/archived newest-first).

**XAI assistant (XAIModal.tsx):** A dark-blue circle with a sparkles icon floats at the top-left corner of every tab except Hem (rendered in `(app)/_layout.tsx` as an absolute overlay, z-index 100). Tapping it opens a bottom-sheet chat with the Claude API via `/api/mobile/xai`. Shows context-aware quick-action chips based on the current tab (different prompts for Hem, Sessioner, Rösta, Förslag, Arkiv) plus two common actions (write a comment, submit a proposal). Has a "Anmäl XAI" flag button (top-right of the sheet) that users can tap to report bad AI output. Uses `claude-haiku-4-5-20251001` with a 300-token limit for quick, concise replies. The floating button hides itself while the modal is open to avoid double-tap confusion.

**XAI modal layout (load-bearing details):** The sheet uses `height: "82%"` (NOT `maxHeight`) and its KeyboardAvoidingView parent uses `flex: 1` — both are required so the inner messages `<ScrollView style={{ flex: 1 }}>` actually gets a non-zero height. With `maxHeight` alone the ScrollView collapses to 0 and the chat appears blank even though `messages` state is correct. The backdrop uses a `<Pressable style={StyleSheet.absoluteFill}>` underneath the sheet plus `pointerEvents="box-none"` on the KAV — replaces the previous nested `<TouchableWithoutFeedback>` pattern, which on Android new-architecture swallowed touches before they reached the send button. Reply text is run through a small `parseInline()` tokenizer + `<MarkdownText />` component that renders `**bold**`, `*italic*`, and `` `code` `` inline; user messages render as plain `<Text>`. The server route at `apps/web/pages/api/mobile/xai.ts` logs `XAI request` / `XAI reply` / `XAI call failed` with timings and a `hasKey` flag (true if `ANTHROPIC_API_KEY` is set) for quick diagnosis.

**Membership screen (membership.tsx):** Reachable via the **Info** bottom tab and from the Hem tab's "Klicka här" button. Header is a single centered "Bli medlem" title — no back arrow, since this is a tab destination, not a pushed route. Shows member fee (250 kr/år covering both 2026 and 2027 — founding-member benefit) with a highlighted founding-member banner explaining the two-year deal. Lists four member benefits. Swish pay button is disabled. Pending: BankID verification (must confirm user is folkbokförd in Vallentuna, postal code 186xx via Signicat) + actual payment integration. BankID will be optional/voluntary — soft prompt earning bonus stars, hard-required one month before election.

**Content moderation (web):** `POST /api/moderate` checks comment text via Claude Haiku before posting in `apps/web/pages/session/[id].tsx`. Returns `{ status: "ok"|"warn"|"flag", message }`. If warn/flag, shows an inline confirmation dialog with the AI's message; "flag" also shows legal notice. Fails open on error so Claude outages never block posting.

**Star/gamification system (mobile):** Local-only star counter stored via `lib/stars.ts` (SecureStore key `"user_stars"`). Awards: first app open +1, set interests +2, rate a session proposal +3, vote on Rösta question +1, submit citizen proposal +5. One-time actions guarded by storage flags (`celebrated_first_visit`, `celebrated_interests_set`). Star count shown as a badge in the Hem hero (top-left). `lib/CelebrationModal.tsx` is a reusable spring-animated overlay used by all four trigger screens.

**Settings modal (mobile):** `lib/SettingsModal.tsx` is a self-contained bottom-sheet that reads and writes interest preferences to SecureStore internally. Props: `visible`, `onClose`, `onSaved?`. The gear icon appears in the top-right of the blue hero on the **Hem** tab (`index.tsx`) and as a floating button on the **Info** tab (rendered in `(app)/_layout.tsx` when `normPath === "/membership"`). Exports `STORAGE_INTERESTS`, `STORAGE_INTERESTS_ONLY`, and `INTEREST_AREAS` for use elsewhere (e.g. filtering feeds by interests).

**Admin button (mobile):** Inside `SettingsModal`, an "Admin" button is shown only when `user.isAdmin`. Opens `BASE_URL/admin` (super admin) or `BASE_URL/manage-sessions` (regular admin) in the device browser via `Linking.openURL`.

**Infinite vertical loop (Rösta, Förslag):** Both screens use a `ScrollView` with the triple-array pattern: `loopedItems = [...items, ...items, ...items]`, start scrolled to the middle copy (`items.length * pageH`), and silently jump back to the middle copy when `onMomentumScrollEnd` detects the user has reached the outer thirds. Uses `containerH` from `onLayout` (never `Dimensions.get("window").height`) for the page size so `pagingEnabled` snaps correctly. Key refs: `scrollRef`, `currentIdxRef`, `initialScrollDone`. Never use `SCREEN_H` for page heights in these screens. The Sessioner screen has migrated off this pattern to `PagerView` (see its dedicated entry above) — don't propagate the new pager-based pattern to Rösta/Förslag without explicit reason, since each tab's content layout differs.

**"Förslag:" label:** In `proposals.tsx`, a small uppercase label "FÖRSLAG:" appears above each proposal title so the card context is clear at a glance.

**Citizen proposals image upload:** `proposals.tsx` picks images via `expo-image-picker`, compresses to max 1200 px / 75% JPEG quality via `expo-image-manipulator`, then uploads with raw `fetch` + `FormData` (NOT `apiClient`) so React Native can set the correct `multipart/form-data; boundary=…` header automatically. `apiClient` would override Content-Type with `application/json` and break the upload.

**Monorepo + Metro:** `metro.config.js` is required — without it, pnpm's symlinked `node_modules` causes Metro module resolution failures. Always keep it in sync if the monorepo structure changes.

**Environment:** Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`. Use `http://10.0.2.2:3000` for Android emulator, your LAN IP for physical devices. `localhost` does NOT work on physical devices.

**Run Expo Go against the live backend:** `pnpm dev:mobile:live` (root) or `pnpm dev:live` (from `apps/mobile`) starts Expo Go pointed at production (`https://www.vallentuna.app`) so you can browse real data without the local Next.js server. Implemented as `apps/mobile/scripts/start-live.mjs`, a dep-free Node launcher that sets `EXPO_PUBLIC_API_URL` in the process env (which takes precedence over `.env`) and runs `expo start --go -c` (`-c` clears Metro cache so the inlined `EXPO_PUBLIC_*` value refreshes). Caveat: your stored login JWT was issued by the dev backend (different `NEXTAUTH_SECRET`) and won't validate against prod, so you'll be bounced to the login screen and must sign in via the real OTP flow.

**Push notifications:** Server-side: `apps/web/lib/push-notifications.ts` sends to the Expo Push API, `POST /api/mobile/push-token` stores tokens, `User.expoPushToken` field exists, and `POST /api/admin/sessions` fires a push when a voting session is created. Mobile side: `expo-notifications` is installed and the registration code lives in `(app)/_layout.tsx`, gated by `const IS_EXPO_GO = Constants.executionEnvironment === "storeClient"` — both the notification-tap listener and `getExpoPushTokenAsync()` are wrapped in `if (!IS_EXPO_GO)` blocks so Expo Go silently skips them (remote pushes were removed from Expo Go in SDK 53). In real EAS builds the guards flip off and pushes register automatically. `vote.tsx` calls `setBadgeCountAsync(0)` on focus to clear the badge (a local-only API that works in both Expo Go and EAS builds). The FCM V1 service-account JSON for Android is uploaded to EAS project Credentials (Android → FCM V1), so push **delivery** to Android works; the APNs `.p8` for iOS is still pending. `google-services.json` lives at `apps/mobile/google-services.json` and is referenced via `android.googleServicesFile` in `app.json`; its embedded `AIzaSy…` value is the Firebase Android **client** API key (ships inside the APK, safe to commit — GitHub secret-scanning flags the pattern but it's low-severity; restrict it in GCP Console → APIs & Services → Credentials by package `se.vallentunaframat.app` + SHA-1). The real secret is the separate `…firebase-adminsdk….json` service-account key used for FCM V1 — never commit it; it lives only in EAS.

**EAS production builds:** Package name `se.vallentunaframat.app`, owner `vallentuna-framat`. Production AAB (versionCode 4) is uploaded to Google Play Console under internal testing. iOS TestFlight build is pending (requires Apple Developer account). Build command: `npx eas-cli build --profile production --platform android` from `apps/mobile`.

**EAS dev-client builds (push + native testing):** Push notifications and any other native-module feature can't be exercised in Expo Go — build a custom dev client via EAS. `eas.json` has a `development` profile (`developmentClient: true`, `distribution: internal`, APK) and `expo-dev-client` is a dependency. Build from `apps/mobile`: `npx eas-cli build --profile development --platform android`; install with `npx eas-cli build:run --platform android --latest`; then run Metro with `npx expo start --dev-client`. **Local Android native builds (`expo run:android` / `gradlew`) are NOT viable on this machine** — the repo's long OneDrive path + pnpm's deep `.pnpm/<hash>` nesting + New-Arch Fabric codegen (CMake mirrors the absolute source path into each object path) push generated paths past Windows' 260-char `MAX_PATH`, and the JBR JVM / NDK ninja don't honor long paths. Always use EAS for native builds. Caveat: `android/` is gitignored but EAS **still bundles the local `apps/mobile/android/` folder** and prebuilds non-destructively, so stray edits in the generated `android/` (e.g. a `buildDir` relocation) leak into the cloud build and cause baffling Kotlin `Unresolved reference` failures — delete `apps/mobile/android` before an EAS build so prebuild regenerates it pristine.

**OneDrive + pnpm symlinks:** Installing new packages under `apps/mobile/` can fail with `EPERM rename` because OneDrive locks files during sync. Pause OneDrive sync before running `pnpm add`. If a package still fails to resolve after install, run `pnpm install` from the repo root to repair the lockfile. Avoid packages requiring heavy native linking — `expo-image-picker`, `expo-image-manipulator`, and `react-native-pager-view` are fine (bundled in Expo Go).

**Metro cache after adding native modules:** When you add a native module (e.g. `react-native-pager-view`), Metro's transformer cache and module map don't always pick it up on a normal reload — you'll see `unable to resolve module …` even though the symlink exists in `apps/mobile/node_modules`. Restart with `pnpm expo start -c` (the `-c` clears the cache). Same fix applies whenever Metro's file watcher misses changes inside route groups like `(app)` on Windows + OneDrive.

**Package version drift (SDK 54):** If you see `expo-notifications@55.x` or any other wildly-wrong version in `apps/mobile/package.json`, run `pnpm expo install --check` from `apps/mobile` and accept all suggested fixes. SDK 54 expects `expo-notifications@~0.32.x`, `expo-image-picker@~17.x`, `expo-image-manipulator@~14.x`, etc. A mismatched `expo-notifications` will crash `(app)/_layout.tsx` at module-import time (the file calls `Notifications.setNotificationHandler` at the top), which manifests as the entire tab layout silently failing to render — the symptom looks like "tab bar disappeared" but is actually a JS exception you may not see in Metro unless you look closely.

**Testing with Expo Go:** Scan the QR code shown in the Metro terminal after running `pnpm dev:mobile`. Shake the device to get the reload menu. Press `r` in the Metro terminal to force reload. Expo Go is fine for JS/UI iteration, but push notifications and other native-module features require the EAS dev client (see **EAS dev-client builds** above). The mobile `dev` script is `expo start --go` (forces Expo Go) — because `expo-dev-client` is installed, plain `expo start` would default to dev-client mode and refuse to launch without a custom build. To deliberately run a dev client instead, use `expo start --dev-client` (the `start` script keeps the unflagged `expo start`).

---

## apps/web — Main Application

### Directory Layout

```
apps/web/
├── pages/
│   ├── api/                    # 70+ API route handlers
│   │   ├── auth/               # NextAuth + OTP request
│   │   ├── sessions/           # Voting session management
│   │   ├── proposals/          # Proposal CRUD + voting
│   │   ├── comments/           # For/against/neutral comments
│   │   ├── budget/             # Budget voting + results + debate
│   │   ├── citizen-proposals/  # Medborgarförslag
│   │   ├── municipal/          # Municipal session management
│   │   └── admin/              # Admin-only endpoints
│   ├── [municipality]/[board]/ # Dynamic municipality pages
│   ├── admin/                  # Super admin dashboard
│   ├── budget/                 # Budget pages
│   ├── session/                # Session voting pages
│   ├── archive/                # Archived results
│   └── medborgarforslag/       # Citizen proposals listing
├── components/
│   └── budget/                 # Budget visualization components
├── lib/                        # All utility/helper code
├── public/                     # Static assets only — user uploads go to Vercel Blob (session-images/, citizen-proposal-images/ prefixes)
├── styles/                     # Global CSS (Tailwind v4)
├── types/                      # Local TypeScript types
└── scripts/                    # DB migration + utility scripts
```

### Key Library Files (`apps/web/lib/`)

| File                            | Purpose                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `models.ts`                     | All Mongoose schema definitions — single source of truth for DB models                                       |
| `mongodb.ts`                    | `connectDB()` — connection pooling with caching                                                              |
| `config.ts`                     | `THEMES`, `AVAILABLE_LANGUAGES`, theme color helpers                                                         |
| `admin.ts`                      | `requireAdmin()` — admin auth middleware                                                                     |
| `admin-helper.ts`               | Admin utility functions                                                                                      |
| `session-helper.ts`             | `getActiveSession()`, `getAllActiveSessions()`, `registerActiveUser()` — all exclude `sessionType: "voting"` |
| `csrf.ts`                       | `generateCsrfToken()`, `validateCsrfToken()`, `csrfProtection()` — dual-cookie CSRF                          |
| `email.ts`                      | `sendEmail()`, `sendLoginCode()` via Resend                                                                  |
| `sms.ts`                        | SMS sending via Twilio                                                                                       |
| `logger.ts`                     | `createLogger()`                                                                                             |
| `fetch-with-csrf.ts`            | `fetchWithCsrf()` — CSRF-aware HTTP client for frontend                                                      |
| `validation.ts`                 | Form validation helpers                                                                                      |
| `pusher-broadcaster.ts`         | Server-side Pusher publisher — `broadcaster.broadcast()` + `broadcastToSession()`                            |
| `mobile-jwt.ts`                 | `signTokenPair()`, `verifyBearerToken()` — JWT auth for mobile API routes                                    |
| `ai.ts`                         | `moderateContent()`, `classifyCategories()` — Claude API wrappers for moderation + category suggestions      |
| `session-close.ts`              | Session termination logic                                                                                    |
| `push-notifications.ts`         | `sendPushNotifications()` + `notifyNewVotingQuestion()` — sends to Expo Push API in batches of 100           |
| `budget/ai-extractor.ts`        | `extractBudgetFromPDF()` — Claude API extracts budget data from PDFs                                         |
| `budget/median-calculator.ts`   | Median calculation for budget votes                                                                          |
| `municipal/agenda-extractor.ts` | `extractAgendaFromPDF()` — Claude API parses meeting agendas                                                 |
| `municipal/notifications.ts`    | Municipal notification logic                                                                                 |
| `contexts/ConfigContext.tsx`    | Theme + language context provider                                                                            |
| `hooks/useTranslation.ts`       | i18n hook                                                                                                    |
| `hooks/usePusher.ts`            | Client Pusher subscriber + presence channel (`activeUserCount`)                                              |
| `hooks/useLazySound.ts`         | Audio playback hook                                                                                          |
| `locales/[sv,en,sr,es,de].ts`   | Translation strings (5 languages)                                                                            |

**Municipality whitelist:** `pages/[municipality]/index.tsx`, `pages/[municipality]/[board]/index.tsx`, and `pages/[municipality]/[board]/archive.tsx` all export a `getServerSideProps` that returns `{ notFound: true }` for any municipality not in `VALID_MUNICIPALITIES = ["vallentuna"]`. This prevents the dynamic catch-all from matching arbitrary slugs like `/legal` or `/api`. When adding a new municipality, add its lowercase slug to this constant in all three files.

### Components (`apps/web/components/budget/`)

- `TreemapViz.tsx` — D3 treemap for budget visualization
- `SimpleTreemap.tsx` — Simplified treemap
- `LayeredTreemaps.tsx` — Multi-level budget view
- `CategoryInput.tsx` — Budget category allocation input
- `IncomeCategoryInput.tsx` — Income category input

---

## Database Schema (MongoDB/Mongoose)

All models defined in `apps/web/lib/models.ts`.

### Collections Summary

| Collection              | Purpose                                       | Key Fields                                                                                       |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `User`                  | App users                                     | email, isAdmin, isSuperAdmin, adminStatus, sessionLimit, userType, bankIdVerified, expoPushToken |
| `Session`               | Voting sessions                               | place, sessionType, status, phase, activeUsers, phase1/2 schedules                               |
| `Proposal`              | Session proposals                             | sessionId, title, problem, solution, authorId, thumbsUpCount, averageRating                      |
| `ThumbsUp`              | 1-5 star ratings on proposals                 | sessionId, proposalId, userId, rating — unique per (proposal, user)                              |
| `Comment`               | For/against/neutral debate                    | sessionId, proposalId, userId, type, text, averageRating                                         |
| `CommentRating`         | Ratings on comments                           | commentId, userId, rating — unique per (comment, user)                                           |
| `FinalVote`             | Yes/No final votes                            | sessionId, proposalId, userId, choice — unique per (proposal, user)                              |
| `TopProposal`           | Winning proposals archive                     | sessionId, proposalId, yesVotes, noVotes                                                         |
| `LoginCode`             | OTP codes (TTL 10min)                         | email, codeHash, attempts, expiresAt                                                             |
| `BudgetSession`         | Budget voting sessions                        | sessionId, municipality, totalBudget, categories, incomeCategories, taxBase                      |
| `BudgetVote`            | Individual budget allocations                 | sessionId, userId, allocations, incomeAllocations — unique per (session, user)                   |
| `BudgetResult`          | Computed median budget                        | sessionId, medianAllocations, totalMedianExpenses, voterCount                                    |
| `BudgetArgument`        | Budget category debate                        | sessionId, userId, categoryId, direction (up/down), text, helpfulVotes                           |
| `CitizenProposal`       | Medborgarförslag                              | title, description, categories, status, imageUrl, totalStars, averageRating                      |
| `CitizenProposalRating` | Ratings on citizen proposals                  | proposalId, userId, rating — unique per (proposal, user)                                         |
| `QuickVote`             | Ja/Nej/Avstår votes on "voting"-type sessions | sessionId, userId, choice — unique per (session, user)                                           |
| `MunicipalSession`      | Council meeting sessions                      | municipality, meetingDate, meetingType, items[], status                                          |
| `SessionRequest`        | Admin session quota requests                  | userId, requestedSessions, status                                                                |
| `Settings`              | Global app settings                           | language, theme, sessionLimitHours                                                               |
| `Survey`                | Simple polls                                  | question, choices[], status                                                                      |
| `SurveyVote`            | Anonymous survey votes                        | surveyId, visitorId, choiceId — unique per (survey, visitor)                                     |

### Session Phases

Sessions go through: `phase1` (proposal submission + thumbs up) → `phase2` (final yes/no votes) → `closed` → `archived`

Session types: `"standard"` · `"survey"` · `"municipal"` · `"voting"`

**`"voting"` type:** Single yes/no/abstain question for the mobile Rösta tab. Created via manage-sessions "Voting (Yes/No/Abstain)" option. Starts directly in `phase2`. The `place` field stores the question text (max 200 chars). Votes stored in `QuickVote` (not `FinalVote`). Excluded from all ordinary session queries (`getActiveSession`, `/api/sessions/active`, all mobile tabs except Rösta) — only surfaces via `/api/mobile/sessions/voting`.

---

## API Routes (70+)

### Auth

- `POST /api/auth/request-code` — Request OTP; if a valid code already exists for the email, returns `{ ok: true, alreadySent: true }` without resending (lets user proceed to code input). Creates and sends a new code only if none is active.
- `POST /api/auth/resend-code` — Invalidates the existing code and sends a fresh one. Enforces a 60-second server-side cooldown (returns `429` with `retryAfter` if called too soon).
- `/api/auth/[...nextauth]` — NextAuth handlers

### Sessions

- `GET /api/sessions/current` — Get active session + register user
- `GET /api/sessions/active` — Session info
- `GET /api/sessions/archived` — Archived list
- `POST /api/sessions/advance-phase` — Admin: go to phase2
- `POST /api/sessions/execute-scheduled-transition` — Auto-transitions
- `POST /api/sessions/check-phase-transition`
- `POST /api/sessions/check-archive`

### Proposals & Voting

- `GET/POST /api/proposals` — List / create proposals
- `GET/POST /api/votes` — Get / submit final yes/no votes
- `POST /api/thumbsup` — Rate proposal (1-5)
- `GET /api/top-proposals` — Get top 3
- `POST /api/top-proposals` — Admin: mark top3
- `GET/POST /api/comments` — List / create comments
- `POST /api/comments/rate` — Rate comment

### Budget

- `GET/POST /api/budget/sessions` — Budget sessions
- `GET/POST /api/budget/vote` — Get / submit budget allocation
- `GET/POST /api/budget/results` — Results / calculate median
- `GET/POST /api/budget/debate` — Budget arguments
- `POST /api/budget/debate/helpful` — Mark argument helpful
- `POST /api/budget/upload-pdf` — Upload & parse PDF (admin)

### Citizen Proposals

- `GET/POST /api/citizen-proposals` — List / create
- `POST /api/citizen-proposals/rate` — Rate proposal

### Municipal

- `GET/POST /api/municipal/sessions`
- `GET /api/municipal/board-sessions`
- `POST /api/municipal/extract-agenda` — AI PDF extraction (admin)
- `POST /api/municipal/close-item` — Close agenda item (admin)

### Admin (all require isAdmin/isSuperAdmin)

- `GET/POST /api/admin/users`
- `GET/POST /api/admin/sessions`
- `POST /api/admin/close-session`
- `POST /api/admin/archive-session`
- `GET/POST /api/admin/proposals`
- `GET /api/admin/finalvotes`
- `GET/POST /api/admin/comments`
- `POST /api/admin/thumbs`
- `POST /api/admin/top-proposals`
- `GET /api/admin/admin-applications`
- `POST /api/admin/request-more-sessions`
- `POST /api/admin/send-broadcast-email`
- `POST /api/admin/send-results-email`
- `POST /api/admin/schedule-transition`
- `POST /api/admin/schedule-termination`
- `POST /api/admin/execute-scheduled-termination`
- `GET /api/admin/live-panel`
- `GET/POST /api/admin/survey`
- `GET/POST /api/admin/session-limit`
- `POST /api/admin/clean-content` — Super-admin only: scans all comments, proposals, AND citizen proposals with Claude Haiku, deletes flagged items, returns `{ checked, removed, items }`
- `GET/PATCH /api/admin/citizen-proposals` — List all citizen proposals / update status (active/archived/selected/submitted_as_motion/rejected)
- `POST /api/admin/suggest-categories` — Suggest category tags for a proposal title/description via Claude (admin-only)
- `GET/PATCH /api/admin/session-requests` — List session-quota requests / approve or deny
- `POST /api/admin/session-image` — Multipart image upload for session backgrounds; stores via `@vercel/blob` under prefix `session-images/`, returns the public CDN URL, deletes the previous blob if `Session.imageUrl` already pointed to one

### Mobile Auth (JWT)

Mobile apps cannot use NextAuth cookies. These endpoints implement the same OTP flow but return JWT tokens instead.

- `POST /api/auth/request-code` — Request OTP (shared with web, no changes)
- `POST /api/mobile/auth/verify-code` — Submit OTP, returns `{ accessToken, refreshToken, user }`
- `POST /api/mobile/auth/refresh` — Exchange refresh token for new token pair

Access tokens: 7-day expiry · Refresh tokens: 30-day expiry · Signed with `NEXTAUTH_SECRET`

Mobile API calls pass `Authorization: Bearer <accessToken>`. Use `verifyBearerToken()` from `lib/mobile-jwt.ts` to protect mobile-specific routes.

### Mobile Data (all require Bearer token)

- `GET /api/mobile/sessions/active` — Active sessions list with proposals per session (excludes "voting" type)
- `GET /api/mobile/sessions/phase2` — Sessions in voting phase, proposals with yes/no counts + user's vote (excludes "voting" type)
- `GET /api/mobile/sessions/archived` — Closed/archived sessions with TopProposals and vote counts (excludes "voting" type)
- `GET /api/mobile/sessions/[id]/proposals` — Proposals for a specific session
- `GET /api/mobile/sessions/voting` — All voting-type sessions as an array: active first (isActive: true), then closed/archived newest-first (isActive: false). Each entry has `{ id, question, imageUrl, isActive, startDate, voteCounts, userVote }`. Returns `[]` if none exist.
- `GET/POST /api/mobile/citizen-proposals` — List active citizen proposals / create new one (multipart, supports image upload; `bodyParser: false` + formidable; 600 KB server-side limit; stores via `@vercel/blob` under prefix `citizen-proposal-images/`, rolls back with `del()` if the DB insert fails)
- `POST /api/mobile/citizen-proposals/rate` — Upsert star rating (1-5), recalculates averageRating
- `POST /api/mobile/votes` — Cast or update yes/no vote on a phase2 proposal
- `POST /api/mobile/quick-vote` — Cast or update Ja/Nej/Avstår vote on a "voting"-type session; returns updated vote counts
- `POST /api/mobile/push-token` — Store Expo push token on the user record (`ExponentPushToken[…]` prefix validated)
- `POST /api/mobile/suggest-question` — Send a question suggestion as email to admin via Resend
- `POST /api/mobile/xai` — XAI chat: `{ message, context }` → `{ reply }`. Calls `claude-haiku-4-5-20251001` with a democratic-assistant system prompt. Max 300 tokens. Context is the current tab label (passed for relevance).
- `POST /api/mobile/user/interests` — Update the user's interest-area filter list (validated against `ALL_CATEGORIES`)
- `POST /api/mobile/suggest-categories` — Claude-backed category suggestion for a draft citizen proposal
- `POST /api/mobile/proposals/rate` — Star rating on a session proposal (mobile equivalent of `/api/thumbsup`)

### Other

- `GET /api/settings` — App settings
- `POST /api/settings` — Update settings (admin)
- `GET /api/user/activity`
- `POST /api/apply-admin`
- `GET /api/recent` — includes "voting"-type sessions with icon 📱 and subtitle "Röstning · svara i appen"; link is `"#"` (no dedicated web page yet)
- `POST /api/moderate` — Content moderation via Claude Haiku (uses `lib/ai.ts`)
- `POST /api/csrf-token`
- `POST /api/check-session-timeout`
- `POST /api/pusher/auth`
- `POST /api/unsubscribe`
- `DELETE /api/account/delete` — GDPR right-to-erasure: deletes all user data (proposals, comments, votes, ratings, citizen proposals + blob images, budget votes/arguments, login codes) then deletes the User record. Requires active NextAuth session.

---

## Pages

| Route                             | Page                                                                                                                                                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                          | Email OTP login (link to /legal at bottom)                                                                                                                                                                                             |
| `/about`                          | About page — dark blue gradient matching login; amber accents                                                                                                                                                                          |
| `/app`                            | App download redirect (target of the in-app "Dela appen med en vän" QR). UA-redirects Android → Play; renders a landing with store buttons for iOS/desktop. Store URLs are constants at the top of the file — update as tracks go live |
| `/legal`                          | Integritetspolicy & Användarvillkor (GDPR, org.nr 802555-8852)                                                                                                                                                                         |
| `/radera`                         | GDPR account deletion — 3-step flow (info → confirm email → done), calls `DELETE /api/account/delete`                                                                                                                                  |
| `/support`                        | Public support page (required by Apple App Store) — contact email, FAQ accordion, link to /legal                                                                                                                                       |
| `/session/[id]`                   | Voting session (phase1/phase2)                                                                                                                                                                                                         |
| `/session/survey/[id]`            | Survey voting                                                                                                                                                                                                                          |
| `/[municipality]/[board]/`        | Municipality sessions                                                                                                                                                                                                                  |
| `/[municipality]/[board]/archive` | Municipality archive                                                                                                                                                                                                                   |
| `/archive`                        | Global archive                                                                                                                                                                                                                         |
| `/archive/[id]`                   | Specific archived session                                                                                                                                                                                                              |
| `/budget/`                        | Budget landing → redirects to active                                                                                                                                                                                                   |
| `/budget/debate/[sessionId]`      | Budget debate                                                                                                                                                                                                                          |
| `/budget/results/[sessionId]`     | Budget results                                                                                                                                                                                                                         |
| `/budget/admin/`                  | Budget admin                                                                                                                                                                                                                           |
| `/medborgarforslag`               | Citizen proposals listing                                                                                                                                                                                                              |
| `/admin/`                         | Super admin dashboard (sessions/users/proposals/results tabs)                                                                                                                                                                          |
| `/admin/municipal`                | Municipal session management                                                                                                                                                                                                           |
| `/admin/survey`                   | Survey management                                                                                                                                                                                                                      |
| `/manage-sessions`                | Session admin (non-super admins)                                                                                                                                                                                                       |

---

## Shared Types Package (`packages/types/src/`)

| File           | Exports                                                         |
| -------------- | --------------------------------------------------------------- |
| `base.ts`      | `BaseDocument`                                                  |
| `user.ts`      | `User`, `AuthUser`                                              |
| `session.ts`   | `Session`, `TopProposal`, `SessionRequest`                      |
| `proposal.ts`  | `Proposal`, `ThumbsUp`, `Comment`, `FinalVote`                  |
| `budget.ts`    | `BudgetSession`, `BudgetVote`, `BudgetResult`, `BudgetArgument` |
| `municipal.ts` | `MunicipalSession`, `CitizenProposal`                           |
| `survey.ts`    | `Survey`, `SurveyVote`                                          |

---

## Environment Variables

Required in `apps/web/.env.local`:

```env
# Auth
# NEXTAUTH_URL is per-environment and must match the URL the browser hits — it's
# the base for NextAuth callbacks AND for the links built into OTP/notification
# emails (lib/email.ts getBaseUrl, fallback https://www.vallentuna.app). Local
# dev: http://localhost:3000 (here in .env.local). Vercel Production scope:
# https://www.vallentuna.app (www is canonical — apex 308-redirects). Don't set
# one unscoped value for all Vercel environments. Mobile auth doesn't use it
# (JWT signed with NEXTAUTH_SECRET).
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random>

# Database (MongoDB Atlas)
MONGODB_URI=                    # Development DB
MONGODB_URI_PRODUCTION=         # Production DB
MONGODB_URI_BACKUP=             # Backup DB

# Email (Resend)
RESEND_API_KEY=

# AI (Claude API)
ANTHROPIC_API_KEY=

# Real-time (Pusher)
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=eu
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=eu

# SMS (Twilio — optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_PHONE=

# Blob storage (Vercel Blob — required in production; for local dev only if you want uploads to work)
BLOB_READ_WRITE_TOKEN=

# Google Play review bypass (optional — set only while an app review is pending)
# A single whitelisted email logs in with a fixed code instead of a real OTP,
# so Google Play reviewers can get past the email/OTP login wall. Honored by
# /api/auth/request-code (skips the email) and /api/mobile/auth/verify-code
# (accepts the fixed code). The test account is an ordinary member, no admin
# rights. Unset either var to disable instantly.
REVIEW_TEST_EMAIL=
REVIEW_TEST_CODE=
```

---

## Key Architecture Patterns

### Authentication Flow

Email → OTP code (bcrypt-hashed, 10min TTL) → NextAuth session → httpOnly cookie

### CSRF Protection

Dual-cookie pattern: readable cookie + httpOnly cookie. Hash-validated on all POST/PUT/DELETE. Frontend uses `fetchWithCsrf()` from `lib/fetch-with-csrf.ts`. Header: `x-csrf-token`.

### Database Connection

`connectDB()` in `lib/mongodb.ts` uses module-level caching to reuse connections across hot reloads and serverless invocations.

### Mongoose Model Cache (dev HMR gotcha)

`safeModel(name, schema)` returns the already-registered model if one exists — it never replaces it. This means schema changes are silently ignored during hot-module reloading, and Mongoose's strict mode will drop any new fields from documents. Models whose schemas change frequently must use the force-refresh pattern instead:

```ts
if (mongoose.models["ModelName"]) delete mongoose.models["ModelName"];
export const ModelName: AnyModel = mongoose.model("ModelName", ModelNameSchema);
```

`Settings`, `Session`, and `CitizenProposal` already use this pattern. Apply it to any model when adding or removing fields.

### Budget Median Algorithm

Collects all user allocations per category → computes median → balances total to match target budget. Nested support for subcategories.

### AI PDF Extraction

Claude API receives base64-encoded PDF. Budget extraction (`lib/budget/ai-extractor.ts`) produces categories + income sources + tax rates. Agenda extraction (`lib/municipal/agenda-extractor.ts`) produces meeting items.

### Real-time

- **Pusher:** All real-time fan-out (votes, phase transitions, ratings, new proposals, presence). Server publishes via `lib/pusher-broadcaster.ts`; clients subscribe via the `usePusher` hook. Presence channel `presence-active-users` powers the live "active users" count (authed through `POST /api/pusher/auth`).
- **Admin live panel:** uses `GET /api/admin/live-panel` polling for proposal/vote progress metrics (Pusher pushes the events that trigger refetches).

### Internationalization

5 languages: `sv` (default), `en`, `sr`, `es`, `de`. Translation files in `lib/locales/`. `useTranslation()` hook reads from `ConfigContext`.

### Theming

4 color schemes: `default` (blue/yellow), `green`, `red`, `blue`. CSS variables set dynamically. Managed via `ConfigContext`.

---

## Configuration Files

- **`turbo.json`** — Task pipeline: build depends on `^build`, dev is persistent + no cache; build task declares all Vercel env vars in `env[]` so they're available during CI builds
- **`next.config.mjs`** — standalone output, transpiles all 36 D3 subpackages (ESM), optimizes lucide-react
- **`apps/web/tsconfig.json`** — target ES2018, lib es2018, path alias `@/*` → `./*`, strict OFF. Lib intentionally matches target so `tsc --noEmit` catches syntax newer than the target before build.
- **`postcss.config.mjs`** — Tailwind CSS v4 processing
- **`pnpm-workspace.yaml`** — `apps/*` + `packages/*`
- **`package.json`** (root) — `pnpm.onlyBuiltDependencies` allowlist for `sharp` and `unrs-resolver` (suppresses build-script warnings)
- **`apps/mobile/.eslintrc.js`** — extends `expo`; required so `eslint .` works without `expo lint` auto-installing packages

---

## Tech Stack Summary

| Layer              | Technology                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend framework | Next.js 15.5.7 (Pages Router)                                                                                                                                                                     |
| React              | 19.1.0                                                                                                                                                                                            |
| Database           | MongoDB Atlas via Mongoose 8.19.1                                                                                                                                                                 |
| Auth               | NextAuth 4.24.11 (email OTP, no passwords)                                                                                                                                                        |
| Real-time          | Pusher 5.2.0 + SSE                                                                                                                                                                                |
| Email              | Resend 6.2.2                                                                                                                                                                                      |
| SMS                | Twilio 5.12.0                                                                                                                                                                                     |
| AI                 | Anthropic Claude API (@anthropic-ai/sdk 0.69.0)                                                                                                                                                   |
| Styling            | Tailwind CSS v4                                                                                                                                                                                   |
| Icons              | Lucide React                                                                                                                                                                                      |
| Charts             | D3.js v7 (treemaps, visualizations)                                                                                                                                                               |
| Audio              | Howler.js + use-sound                                                                                                                                                                             |
| File upload        | Formidable                                                                                                                                                                                        |
| PDF parsing        | Claude API (reads PDF base64 directly; `pdf-parse` is in package.json but unused)                                                                                                                 |
| Analytics          | Vercel Analytics                                                                                                                                                                                  |
| Mobile             | Expo 54 + React Native 0.81.5 + expo-router 6 + @react-navigation/material-top-tabs 7 + react-native-pager-view 6 + expo-image-picker ~17 + expo-image-manipulator ~14 + expo-notifications ~0.32 |
| Monorepo           | Turborepo 2.8.20                                                                                                                                                                                  |
| Package manager    | pnpm 10.33.0                                                                                                                                                                                      |

---

## Scripts (`apps/web/scripts/`)

```bash
node scripts/backup-to-mongodb.js              # Mirror prod DB → MONGODB_URI_BACKUP
node scripts/force-close-session.js            # Emergency close of a stuck phase-2 session
node scripts/test-agenda-extraction.js         # Dev test for municipal/agenda-extractor.ts
node scripts/test-auto-close.js                # Read-only diagnostic for phase-2 auto-close
node scripts/migrate-images-to-blob.js         # One-shot: move public/*-images/ to Vercel Blob
```
