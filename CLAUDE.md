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
│   ├── archive.tsx          # Arkiv — standalone pushed screen (not a tab), closed sessions with yes/no vote bars; reachable via a button on the Info tab
│   ├── sessions.tsx         # Sessioner — standalone pushed screen (not a tab, kept for future brainstorming use, not currently linked from any UI). TikTok-style full-screen vertical carousel of active sessions. Has its own auth guard (outside the (app) layout's built-in one)
│   ├── (auth)/
│   │   ├── _layout.tsx      # Redirects to (app)/ if already logged in
│   │   └── login.tsx        # Two-step email → OTP login screen. Blue (#002d75) background, "VALLENTUNA Framåt" title in white, amber SVG icon (AppIcon component via react-native-svg, same paths as app-icon-transparent.svg), semi-transparent card, amber "Skicka kod"/"Logga in" button, all UI text in Swedish; link to legal.tsx at bottom
│   └── (app)/
│       ├── _layout.tsx      # MaterialTopTabs (4 tabs, native horizontal swipe via react-native-pager-view) + custom BottomBar + auth guard + Expo-Go-guarded push registration
│       ├── index.tsx        # Hem — Instagram-like vertical feed of unvoted active "voting"-type questions; dark (#111) background; each card is full-bleed image + dark overlay + question text + amber "Välj"-button; tapping "Välj" saves the session ID to SecureStore (STORAGE_SELECTED_QUESTION) and navigates to the Rösta tab; already-voted questions are filtered out; empty state if all active questions are voted
│       ├── vote.tsx         # Rösta — single-question view for the question selected on Hem; on focus reads STORAGE_SELECTED_QUESTION + fetches sessions; if nothing selected shows a blue "Välj en fråga på Hem-fliken" empty state; if selected shows VotingQuestionCard (vote card, with an "Ångra val"/"Välj en annan fråga" button in place of where a debate-launcher used to be) followed inline by VotingDebateSection (för/emot debate, always visible below the vote), both scrolled together with generous top padding so the background image's top edge peeks out above the card
│       ├── proposals.tsx    # Förslag — full-screen paginated citizen proposals with image backgrounds
│       └── membership.tsx   # Info (tab) / Bli medlem (in-page) — membership/payment page (BankID + Swish pending); link to legal.tsx at bottom
├── lib/
│   ├── api.ts               # apiClient() — Bearer token injection + silent 401 refresh
│   ├── auth-context.tsx     # AuthProvider + useAuth() hook
│   ├── storage.ts           # Key-value storage backed by expo-secure-store (encrypted, native-only); exports STORAGE_SELECTED_QUESTION (selected voting session ID, written by Hem, read by Rösta)
│   ├── stars.ts             # Local star counter (SecureStore) + one-time celebration flags
│   ├── onboarding.ts        # Login counter + onboarding state (SecureStore): incrementLoginCount, getOnboardingState, markPromptShown, markProfileCompleted
│   ├── XAIModal.tsx         # "MAJ" chat sheet (rebranded from "XAI" — file/route/internal role-id names unchanged) — sparkles button opens Claude-backed assistant
│   ├── CelebrationModal.tsx # Spring-animated star reward overlay (reused across all 4 trigger screens)
│   ├── InterestsModal.tsx   # Progressive-onboarding prompt to pick interest areas (shown after 2nd/3rd login if profile not completed)
│   ├── VotingDebateSection.tsx # För/emot debate for "voting"-type questions, rendered inline (not a modal) below VotingQuestionCard on Rösta — self-contained, always visible while a question is selected
│   └── SettingsModal.tsx    # Interest-area settings sheet — self-contained (reads/writes SecureStore internally); used on Hem and Info tabs
├── metro.config.js          # Monorepo-aware Metro config — required for pnpm workspace resolution
└── .env                     # EXPO_PUBLIC_API_URL — must be LAN IP for physical devices
```

### Key Patterns

**Auth:** Uses JWT tokens (not NextAuth cookies). Tokens stored via `lib/storage.ts` (expo-secure-store). `useAuth()` exposes `user`, `isLoading`, `requestCode(email)`, `login(email, code)`, `logout()`.

**API calls:** Use `apiClient<T>(path, options)` from `lib/api.ts`. It reads the access token from storage, attaches `Authorization: Bearer`, and silently refreshes on 401 before retrying once.

**Storage:** Use `lib/storage.ts` (`getItem`/`setItem`/`deleteItem`) — a thin async wrapper over `expo-secure-store`. The app is native-only (no Expo web target).

**Navigation:** `(app)/_layout.tsx` composes `@react-navigation/material-top-tabs` via `withLayoutContext` from expo-router, configured with `tabBarPosition="bottom"` and a custom `<BottomBar />` (`tabBar` prop) that renders all four registered tabs (Hem, Rösta, Förslag, Info) with the existing icon/label/active-tint design — there's no hidden/filtered tab in this navigator (`archive` and `sessions` are standalone pushed routes at `app/archive.tsx` and `app/sessions.tsx`, outside the `(app)` tab group entirely, reachable via `router.push` rather than the tab bar). The underlying `react-native-pager-view` gives native, content-tracking horizontal swipe between tabs — drag with finger and the screen content slides under you, snap is velocity-aware. Tabs do NOT wrap around (stops at Hem and Info, matching standard mobile app behavior). Don't switch back to expo-router's `<Tabs>` — under SDK 54 + Expo Go new architecture, that variant's bottom-tab bar fails to render at all on Android emulators.

**Why custom `<BottomBar />` instead of the default top-tabs bar:** The default material-top-tabs bar is a horizontal scrollable strip with an animated indicator under the active label — wrong shape for a bottom nav. The custom component renders state-driven `<TouchableOpacity>` tabs reading `state.routes` / `state.index` / `descriptors[].options.title` from props, plus an icon mapping in `TAB_ICONS`. Tap handler emits a `tabPress` event (so pager-view can react), then calls `navigation.navigate(route.name)` only if not focused. To hide a tab from the bar without removing the screen, filter it by `route.name` in the `BottomBar` render — do NOT use `tabBarButton: () => null` (that's a bottom-tabs option that doesn't exist on `MaterialTopTabNavigationOptions` and will cause a type error).

**Navigation guards:** `(auth)/_layout.tsx` redirects logged-in users to the app. `(app)/_layout.tsx` redirects unauthenticated users to login. Both check `useAuth()`.

**Sessioner screen (app/sessions.tsx) — preserved, not a tab:** Originally the "Sessioner" tab, built for live/real-time brainstorming use (e.g. naming the party). Replaced in the bottom tab bar by the personalized question-selection view (now part of the **Hem** tab — see below) but the screen and its code are kept intact — per explicit decision, it may be needed again for a future brainstorming round — moved to `app/sessions.tsx` (standalone pushed route, same pattern as `archive.tsx`) with its own auth guard, not currently linked from any UI. Vertical pager: uses `react-native-pager-view` with `orientation="vertical"`. Each session is its own page; the page owns its own background `<Image>` (`StyleSheet.absoluteFill`) so there's no shared double-buffer crossfade and no scroll-driven sync to go out of alignment. Inside each page, a `ScrollView` with `nestedScrollEnabled` holds the compact title block + inline proposals list — the user can fine-scroll comments/proposals freely, and pager-view takes over the gesture only when the inner ScrollView is at its top/bottom edge, snapping to the previous/next session. Velocity is handled by pager-view's native gesture recognizer (a flick at the edge commits to next; a slow nudge stays put). The hero block is compact (`paddingTop: insets.top + 64` to clear the MAJ button) and the proposals overlay starts immediately below the title. A subtle chevron-down icon (`scrollAffordance`) fades in at the bottom of the page when `contentHeight > viewportHeight` and disappears once the user starts scrolling. `Image.prefetch()` still warms the cache for all session images on load.

**Sessioner infinite loop (PagerView variant):** Triple-array `[...sessions, ...sessions, ...sessions]` with `initialPage = sessions.length` (first item of middle copy). On `onPageSelected`, if `position < n` or `position >= n * 2` (outer thirds), silently `pagerRef.current?.setPageWithoutAnimation()` to the matching slot in the middle copy. An `isJumpingRef` guards against the silent jump re-triggering `onPageSelected`. This is the pager-view adaptation of the ScrollView-based triple-array pattern still used in `proposals.tsx` — `vote.tsx` no longer uses a carousel (it's a single-question view now).

**Hem screen (index.tsx):** Instagram-like vertical feed of all unvoted active `"voting"`-type questions. Dark (`#111`) background. On focus, fetches `/api/mobile/sessions/voting` and filters to `s.isActive && !s.userVote` — already-voted questions are hidden. Each card is a fixed-height (`CARD_HEIGHT = screenWidth × 0.78`) full-bleed image (or solid blue if no image) with a dark tint overlay + bottom dark panel showing the question text and an amber "Välj"-button. Tapping "Välj" writes the session ID to SecureStore (`STORAGE_SELECTED_QUESTION`) and navigates to the Rösta tab via `navigation.navigate("vote")`. Empty state when all active questions are voted: "Du är à jour!" with remaining quota count. No category pills, no gear icon, no star badge — the screen is intentionally clean so horizontal swipe is exclusively the tab bar's gesture.

**VotingQuestionCard (lib/VotingQuestionCard.tsx):** Shared component extracted from `vote.tsx` so the interactive Ja/Nej card (date line, question, two radio alternatives with result bars once voted, vote button / "voted" badge) renders identically on both **Rösta** and **Hem**. Takes `session`, `selected`, `onSelect`, `onVote`, `submitting`, `onUnselect` as props — callers own the vote-submission logic (POST to `/api/mobile/quick-vote`) and local `selected` state. The card's last row is an "Ångra val" (icon `close-circle-outline`) / "Välj en annan fråga" (icon `refresh-outline`, once voted) button that calls `onUnselect` — this replaced the old debate-launcher button now that the debate lives inline on the page instead of behind a button (see `VotingDebateSection` below).

**VotingDebateSection (lib/VotingDebateSection.tsx):** För/emot debate for `voting`-type questions, rendered as an ordinary inline card directly on the Rösta page (not a modal) — the mobile equivalent of the web's standard-session debate UI in `apps/web/pages/session/[id].tsx`, but keyed by `sessionId` instead of `proposalId` (voting questions have no `Proposal`; `Comment.proposalId` is optional for this reason — see the Database Schema section). Self-contained: fetches `GET /api/mobile/voting-comments?sessionId=` on mount (re-fetches if `sessionId` changes, since the component stays mounted across question switches) and renders comments directly into the page's own scroll rather than a nested scrollable list. Header reads "Debatt", and the composer (type pills + "Argumentera här" input + send button) is rendered directly under it, _above_ the comment list — otherwise the keyboard covers the input while typing, since the section can sit low on the page. Comments are sorted by rating descending (highest average first) — the server already returns them `{ averageRating: -1, createdAt: -1 }` sorted, and the client re-applies the same sort after optimistic inserts/rating updates so a brand-new (unrated) comment or a freshly-rated one doesn't visibly disagree with that order. Each comment shows a type-colored dot (för=green, emot=red, neutral=gray), text, and a 1-5 star rating (same visual pattern as the `ProposalCard`'s `starsRow` used elsewhere in the app, e.g. the preserved Sessioner screen's `app/sessions.tsx` — and, like all rating UI in this app, a positive-only scale with no downvote) posted to `POST /api/mobile/voting-comments/rate`. Posting a new comment first calls `POST /api/mobile/moderate` (a thin Bearer-auth wrapper around the same `moderateContent()` used by the web's `/api/moderate` — see the Content moderation note below for the nonsense-detection addition) — on `"ok"` it posts immediately; on `"warn"`/`"flag"` it shows an inline MAJ-branded confirm card (yellow/red, "Publicera ändå"/"Avbryt", flag adds a legal-responsibility line) mirroring the web dialog at `session/[id].tsx:1596-1652`. Fails open (posts directly) if the moderation call itself errors. Posting awards `addStars(1)`. When `canPost` is `false` (session not `status: "active"`) the composer and rating taps are hidden/disabled — comments remain visible read-only.

**Rösta screen (vote.tsx):** Single-question view for the question the user chose on Hem. On focus reads `STORAGE_SELECTED_QUESTION` + fetches `/api/mobile/sessions/voting` in parallel. If nothing is stored (or the ID isn't in the fetched list) shows a blue empty state with a "Välj en fråga på Hem-fliken" button (`navigation.navigate("index")`). If a session is found, renders its image (or solid blue) as a full-screen background + a single `ScrollView` containing `VotingQuestionCard` (vote) followed by `VotingDebateSection` (debate) — the debate deliberately comes after the vote, always visible, no button needed to reveal it. The scroll's `paddingTop` is generous (`insets.top + 260`) so the background image's top edge is visible above the card instead of the card sitting flush under the fixed header. `handleUnselect` (passed to the card as `onUnselect`) calls `deleteItem(STORAGE_SELECTED_QUESTION)` and navigates back to Hem. After a vote, shows `CelebrationModal` (+1 star via `addStars(1)`). There is no "suggest a question" entry point on this screen — that lightweight flow was removed; see the Förslag screen note below for the one remaining "submit your own idea" button.

**MAJ assistant (XAIModal.tsx):** Branded as "MAJ" in all user-facing text (rebranded from "XAI"; the file name, the `/api/mobile/xai` route, and the internal `role: "xai"` message-type identifier are unchanged — only display strings and the system prompt changed). A dark-blue circle with a sparkles icon floats at the top-left corner of every tab except Hem (rendered in `(app)/_layout.tsx` as an absolute overlay, z-index 100). Tapping it opens a bottom-sheet chat with the Claude API via `/api/mobile/xai`. Shows context-aware quick-action chips based on the current tab (different prompts for Hem, Rösta, Förslag, Arkiv) plus two common actions (write a comment, submit a proposal). Has a "Anmäl MAJ" flag button (top-right of the sheet) that users can tap to report bad AI output. Uses `claude-haiku-4-5-20251001` with a 300-token limit for quick, concise replies. The floating button hides itself while the modal is open to avoid double-tap confusion.

**MAJ modal layout (load-bearing details):** The sheet uses `height: "82%"` (NOT `maxHeight`) and its KeyboardAvoidingView parent uses `flex: 1` — both are required so the inner messages `<ScrollView style={{ flex: 1 }}>` actually gets a non-zero height. With `maxHeight` alone the ScrollView collapses to 0 and the chat appears blank even though `messages` state is correct. The backdrop uses a `<Pressable style={StyleSheet.absoluteFill}>` underneath the sheet plus `pointerEvents="box-none"` on the KAV — replaces the previous nested `<TouchableWithoutFeedback>` pattern, which on Android new-architecture swallowed touches before they reached the send button. Reply text is run through a small `parseInline()` tokenizer + `<MarkdownText />` component that renders `**bold**`, `*italic*`, and `` `code` `` inline; user messages render as plain `<Text>`. The server route at `apps/web/pages/api/mobile/xai.ts` logs `XAI request` / `XAI reply` / `XAI call failed` with timings and a `hasKey` flag (true if `ANTHROPIC_API_KEY` is set) for quick diagnosis — log labels still say "XAI" (internal/dev-only, not user-facing).

**Membership screen (membership.tsx):** Reachable via the **Info** bottom tab. Header is a single centered "Info" title — no back arrow, since this is a tab destination, not a pushed route. Now also carries the party-info content that used to live on the old Hem hero (the `VALUES` cards — Inflytande/Utveckling/Policy/MAJ — and the "Om den här appen" box), rendered above the membership-specific content, since Hem no longer has room for branding/values once it became the question-selection tab. Shows member fee (250 kr/år covering both 2026 and 2027 — founding-member benefit) with a highlighted founding-member banner explaining the two-year deal. Lists four member benefits. Swish pay button is disabled. Pending: BankID verification (must confirm user is folkbokförd in Vallentuna, postal code 186xx via Signicat) + actual payment integration. BankID will be optional/voluntary — soft prompt earning bonus stars, hard-required one month before election.

**Content moderation (web):** `POST /api/moderate` checks comment text via Claude Haiku before posting in `apps/web/pages/session/[id].tsx`. Returns `{ status: "ok"|"warn"|"flag", message }`. If warn/flag, shows an inline confirmation dialog with the AI's message; "flag" also shows legal notice. Fails open on error so Claude outages never block posting. The shared `moderateContent()` prompt (`lib/ai.ts`) treats nonsense/gibberish text (keyboard mashing, "test", or anything that isn't an actual argument) as a `"warn"` case too — not just off-topic/uncivil content — with the AI nudged to ask something like "Är det här verkligen ett argument?"; this applies to both the web dialog and the mobile debate composer (`/api/mobile/moderate`, used by `VotingDebateSection.tsx`) since they call the same function.

**Star/gamification system (mobile):** Local-only star counter stored via `lib/stars.ts` (SecureStore key `"user_stars"`). Awards: first app open +1, set interests +2, give mobile number +1 (both at once on the very first save +3), rate a session proposal +3, vote on Rösta question +1, post a debate comment on a voting question +1 (rating someone else's debate comment gives no star, matching budget/municipal-item ratings), submit citizen proposal +5. One-time actions guarded by storage flags (`celebrated_first_visit`, `celebrated_interests_set`, `celebrated_phone_set`). The phone-save flag/celebration is only triggered from the Hem tab's `handleSettingsSaved` (the one screen with a visible star badge) — saving a number from Info's gear icon still posts it to the server, just without the celebration popup. Star count shown as a badge in the Hem header (top-left). `lib/CelebrationModal.tsx` is a reusable spring-animated overlay used by all four trigger screens.

**Settings modal (mobile):** `lib/SettingsModal.tsx` is a self-contained bottom-sheet that reads and writes interest preferences — plus an optional mobile number (`STORAGE_PHONE` key, posted to `/api/mobile/user/phone`) for SMS reminders — to SecureStore internally. Props: `visible`, `onClose`, `onSaved?`. The gear icon appears as a floating button on the **Info** tab only (rendered in `(app)/_layout.tsx` when `normPath === "/membership"`) — Hem no longer shows the gear icon since it's a clean feed. Exports `STORAGE_INTERESTS` and `STORAGE_INTERESTS_ONLY`; `INTEREST_AREAS` and `INTEREST_TO_CATEGORIES` live in `packages/types/src/categories.ts` and are imported directly from `@repo/types` by `SettingsModal.tsx` and `InterestsModal.tsx`.

**Every `THEMATIC_CATEGORIES`/`GEOGRAPHIC_CATEGORIES` value needs an `INTEREST_TO_CATEGORIES` home:** A category value that isn't mapped from at least one `INTEREST_AREAS` key can never surface in the web admin's "Mina frågor" Översikt (`/admin/my-questions`), no matter how an item is tagged — there's no interest-area pill an admin could select that would match it. `INTEREST_TO_CATEGORIES["miljo"] = ["Miljö & klimat", "Bostäder", "Trygghet & säkerhet"]` (interest area "Miljö och klimat") exists specifically to give those three otherwise-orphaned thematic categories a path in; check this mapping covers any new category added to `packages/types/src/categories.ts`. (Mobile's Hem tab no longer does any interest/category filtering — see below — so this mapping only matters for the admin Översikt today.)

**Onboarding and Settings now share one interest-picking flow:** `InterestsModal.tsx` (the automatic post-login onboarding prompt) used to let the user pick raw `GEOGRAPHIC_CATEGORIES`/`THEMATIC_CATEGORIES` values and post them straight to `/api/mobile/user/interests` without ever writing `STORAGE_INTERESTS` — so a user who only completed onboarding (never opened the gear icon) saw empty pill-tabs on **Hem**, which only reads `STORAGE_INTERESTS`. Fixed by switching `InterestsModal.tsx` to the same `INTEREST_AREAS` chips as `SettingsModal.tsx`: same `"budget"`-is-always-on `toggle()` guard, same `setItem(STORAGE_INTERESTS, ...)` + `INTEREST_TO_CATEGORIES`-mapped POST to `/api/mobile/user/interests`. The two thematic/geographic chip groups are now derived from `INTEREST_AREAS` (split at the first entry with a `groupLabel`) instead of hand-listing the two raw category arrays, so both modals stay in sync automatically if `INTEREST_AREAS` changes.

**Admin button (mobile):** Inside `SettingsModal`, an "Admin" button is shown only when `user.isAdmin`. Opens `BASE_URL/admin` (super admin) or `BASE_URL/manage-sessions` (regular admin) in the device browser via `Linking.openURL`.

**Infinite vertical loop (Rösta, Förslag):** Both screens use a `ScrollView` with the triple-array pattern: `loopedItems = [...items, ...items, ...items]`, start scrolled to the middle copy (`items.length * pageH`), and silently jump back to the middle copy when `onMomentumScrollEnd` detects the user has reached the outer thirds. Uses `containerH` from `onLayout` (never `Dimensions.get("window").height`) for the page size so `pagingEnabled` snaps correctly. Key refs: `scrollRef`, `currentIdxRef`, `initialScrollDone`. Never use `SCREEN_H` for page heights in these screens. The Sessioner screen has migrated off this pattern to `PagerView` (see its dedicated entry above) — don't propagate the new pager-based pattern to Rösta/Förslag without explicit reason, since each tab's content layout differs.

**"Förslag:" label:** In `proposals.tsx`, a small uppercase label "FÖRSLAG:" appears above each proposal title so the card context is clear at a glance.

**Förslag submit button (proposals.tsx):** The single entry point for submitting a new citizen proposal is a labeled pill button pinned to the bottom of the screen, reading "Mitt förslag för Vallentuna framåt" (`styles.fab` — name kept from when it was an icon-only round FAB, now a full-width labeled button), which opens the "Nytt medborgarförslag" `SubmitModal`. This replaced both the old icon-only FAB and the separate lightweight "Föreslå en fråga" suggestion box that used to live on Rösta (removed entirely, along with its `/api/mobile/suggest-question` backend route) — there is now one consolidated "submit your idea" flow instead of two different ones. The button (and the empty-state's equivalent "Lämna ett förslag" button) only renders when the `canSubmit` flag from `GET /api/mobile/citizen-proposals` is true — see the Citizen-proposal quota note below. `handleCreated` optimistically flips local `canSubmit` to `false` after a successful submission, but only for non-admins (checked via `useAuth().user?.isAdmin`), so an admin's button stays available after submitting.

**Citizen proposals image upload:** `proposals.tsx` picks images via `expo-image-picker`, compresses to max 1200 px / 75% JPEG quality via `expo-image-manipulator`, then uploads with raw `fetch` + `FormData` (NOT `apiClient`) so React Native can set the correct `multipart/form-data; boundary=…` header automatically. `apiClient` would override Content-Type with `application/json` and break the upload.

**Monorepo + Metro:** `metro.config.js` is required — without it, pnpm's symlinked `node_modules` causes Metro module resolution failures. Always keep it in sync if the monorepo structure changes.

**Environment:** Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`. Use `http://10.0.2.2:3000` for Android emulator, your LAN IP for physical devices. `localhost` does NOT work on physical devices.

**Run Expo Go against the live backend:** `pnpm dev:mobile:live` (root) or `pnpm dev:live` (from `apps/mobile`) starts Expo Go pointed at production (`https://www.vallentuna.app`) so you can browse real data without the local Next.js server. Implemented as `apps/mobile/scripts/start-live.mjs`, a dep-free Node launcher that sets `EXPO_PUBLIC_API_URL` in the process env (which takes precedence over `.env`) and runs `expo start --go -c` (`-c` clears Metro cache so the inlined `EXPO_PUBLIC_*` value refreshes). Caveat: your stored login JWT was issued by the dev backend (different `NEXTAUTH_SECRET`) and won't validate against prod, so you'll be bounced to the login screen and must sign in via the real OTP flow.

**Run the web dev server against the production database:** `pnpm dev:web:live` (root) or `pnpm dev:live` (from `apps/web`) starts the Next.js dev server on `localhost:3000` but connected to `MONGODB_URI_PRODUCTION` instead of the dev DB. Implemented as `apps/web/scripts/start-live.mjs`, which reads `MONGODB_URI_PRODUCTION` out of `.env.local` and passes it as `MONGODB_URI` to a spawned `next dev` process (env vars already in `process.env` take precedence over what Next.js loads from `.env.local`, so this overrides cleanly). Errors out with setup instructions if `MONGODB_URI_PRODUCTION` isn't set. Caveat: `NEXTAUTH_URL` is still `http://localhost:3000`, so a fresh OTP sign-in's email link won't work — fine if you're already logged in, otherwise sign in at the real `https://www.vallentuna.app` instead.

**Push notifications:** Server-side: `apps/web/lib/push-notifications.ts` sends to the Expo Push API, `POST /api/mobile/push-token` stores tokens, `User.expoPushToken` field exists, and `POST /api/admin/sessions` fires a push when a voting session is created. Mobile side: `expo-notifications` is installed and the registration code lives in `(app)/_layout.tsx`, gated by `const IS_EXPO_GO = Constants.executionEnvironment === "storeClient"` — both the notification-tap listener and `getExpoPushTokenAsync()` are wrapped in `if (!IS_EXPO_GO)` blocks so Expo Go silently skips them (remote pushes were removed from Expo Go in SDK 53). In real EAS builds the guards flip off and pushes register automatically. `vote.tsx` calls `setBadgeCountAsync(0)` on focus to clear the badge (a local-only API that works in both Expo Go and EAS builds). The FCM V1 service-account JSON for Android is uploaded to EAS project Credentials (Android → FCM V1), so push **delivery** to Android works; the APNs `.p8` for iOS is still pending. `google-services.json` lives at `apps/mobile/google-services.json` and is referenced via `android.googleServicesFile` in `app.json`; its embedded `AIzaSy…` value is the Firebase Android **client** API key (ships inside the APK, safe to commit — GitHub secret-scanning flags the pattern but it's low-severity; restrict it in GCP Console → APIs & Services → Credentials by package `se.vallentunaframat.app` + SHA-1). The real secret is the separate `…firebase-adminsdk….json` service-account key used for FCM V1 — never commit it; it lives only in EAS.

**EAS production builds:** Package name / bundle id `se.vallentunaframat.app`, owner `vallentuna-framat`. Production AAB is built and released to Google Play Console under internal testing. iOS is live too: the Apple Developer account is active and version 1.0.0 is public in the App Store (App Store Connect App ID `6781031191`). Build numbers bump automatically — `eas.json`'s `production` profile has `appVersionSource: "remote"` + `autoIncrement`, so `versionCode` (android) and `buildNumber` (ios) increment on each build. Manual build command: `npx eas-cli build --profile production --platform android` (or `ios`/`all`) from `apps/mobile`. **Submission is automated for both stores:** Android via a Google Play service-account key (`eas-submit@vallentuna-framat.iam.gserviceaccount.com`) already stored on EAS's servers (not in this repo), releasing straight to the `internal` track — so `submit.production.android` in `eas.json` needs no config; iOS via `submit.production.ios.ascAppId` (`6781031191`). Prefer `pnpm release` (below) over the raw commands — it also handles the version bump, the `android/` cleanup, and auto-submit.

**Cutting a release (`pnpm release`):** `apps/mobile/scripts/release.mjs` (run via `pnpm release [patch|minor|major|X.Y.Z] [--platform android|ios|all] [--no-submit] [--dry-run]` from `apps/mobile`) automates the whole store-push flow: bumps the user-facing `expo.version` in `app.json` (semver, defaults to a patch bump), deletes the generated `android/` folder (so EAS prebuilds pristine — see the EAS caveat above), then runs `eas-cli build --profile production --platform <platform> --auto-submit`. **Default platform is `all`** — it builds and auto-submits both stores (Google Play + App Store Connect) in one command; pass `--platform android`/`ios` to do one. It deliberately does NOT touch `versionCode` (android) or `buildNumber` (ios) — `eas.json` has `appVersionSource: "remote"` + `production.autoIncrement`, so EAS bumps both internal build numbers itself. iOS auto-submit needs `submit.production.ios.ascAppId` in `eas.json` — set to `6781031191` (the App Store Connect App ID / numeric "Apple ID" of the app record, not the bundle id); Android submit needs no `eas.json` config (the stored service-account key handles it — see above). Release notes are still written by hand per language after submit — EAS Submit has no changelog support: Google Play Console → "Vad är nytt" (sv-SE), App Store Connect → "What's New in This Version". Dep-free Node launcher, same `spawn(..., { shell: true })` Windows pattern as `start-live.mjs`. Android submit runs unattended via the stored key; iOS submit may prompt for Apple sign-in on the first run per machine, then EAS caches it.

**EAS dev-client builds (push + native testing):** Push notifications and any other native-module feature can't be exercised in Expo Go — build a custom dev client via EAS. `eas.json` has a `development` profile (`developmentClient: true`, `distribution: internal`, APK) and `expo-dev-client` is a dependency. Build from `apps/mobile`: `npx eas-cli build --profile development --platform android`; install with `npx eas-cli build:run --platform android --latest`; then run Metro with `npx expo start --dev-client`. **Local Android native builds (`expo run:android` / `gradlew`) are NOT viable on this machine** — the repo's long OneDrive path + pnpm's deep `.pnpm/<hash>` nesting + New-Arch Fabric codegen (CMake mirrors the absolute source path into each object path) push generated paths past Windows' 260-char `MAX_PATH`, and the JBR JVM / NDK ninja don't honor long paths. Always use EAS for native builds. Caveat: `android/` is gitignored but EAS **still bundles the local `apps/mobile/android/` folder** and prebuilds non-destructively, so stray edits in the generated `android/` (e.g. a `buildDir` relocation) leak into the cloud build and cause baffling Kotlin `Unresolved reference` failures — delete `apps/mobile/android` before an EAS build so prebuild regenerates it pristine.

**OneDrive + pnpm symlinks:** Installing new packages under `apps/mobile/` can fail with `EPERM rename` because OneDrive locks files during sync. Pause OneDrive sync before running `pnpm add`. If a package still fails to resolve after install, run `pnpm install` from the repo root to repair the lockfile. Avoid packages requiring heavy native linking — `expo-image-picker`, `expo-image-manipulator`, and `react-native-pager-view` are fine (bundled in Expo Go).

**Metro cache after adding native modules:** When you add a native module (e.g. `react-native-pager-view`), Metro's transformer cache and module map don't always pick it up on a normal reload — you'll see `unable to resolve module …` even though the symlink exists in `apps/mobile/node_modules`. Restart with `pnpm expo start -c` (the `-c` clears the cache). Same fix applies whenever Metro's file watcher misses changes inside route groups like `(app)` on Windows + OneDrive.

**Package version drift (SDK 54):** If you see `expo-notifications@55.x` or any other wildly-wrong version in `apps/mobile/package.json`, run `pnpm expo install --check` from `apps/mobile` and accept all suggested fixes. SDK 54 expects `expo-notifications@~0.32.x`, `expo-image-picker@~17.x`, `expo-image-manipulator@~14.x`, etc. A mismatched `expo-notifications` will crash `(app)/_layout.tsx` at module-import time (the file calls `Notifications.setNotificationHandler` at the top), which manifests as the entire tab layout silently failing to render — the symptom looks like "tab bar disappeared" but is actually a JS exception you may not see in Metro unless you look closely.

**Testing with Expo Go:** Scan the QR code shown in the Metro terminal after running `pnpm dev:mobile`. Shake the device to get the reload menu. Press `r` in the Metro terminal to force reload. Expo Go is fine for JS/UI iteration, but push notifications and other native-module features require the EAS dev client (see **EAS dev-client builds** above). The mobile `dev` script is `expo start --go` (forces Expo Go) — because `expo-dev-client` is installed, plain `expo start` would default to dev-client mode and refuse to launch without a custom build. To deliberately run a dev client instead, use `expo start --dev-client` (the `start` script keeps the unflagged `expo start`).

**No web target — don't press `w`:** This Expo app is native-only. `react-native-web`, `react-dom`, and `@expo/metro-runtime` were removed as dependencies (and the `web` script + `app.json` web block were deleted) because `react-native-pager-view` ships no web implementation and never worked here. Pressing `w` in the Metro terminal (or running an old `pnpm web` from muscle memory) triggers a web bundle attempt that fails with `ERROR Importing native-only module "react-native/Libraries/Utilities/codegenNativeCommands"` — this is expected, not a regression. Use Expo Go on a real device/emulator (`a`/`i` in the terminal, or scan the QR code) instead.

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
├── public/                     # Static assets only — user uploads go to Vercel Blob (session-images/, citizen-proposal-images/ prefixes). app-icon-transparent.svg: amber >> arrows on transparent bg, used on login page; app-icon-tight.svg: same artwork, viewBox tightly cropped to the arrows (no padding) — used in the homepage header next to the wordmark; app-icon.png: full icon with blue bg (keep as fallback). favicon.png (not .ico) is the active favicon, wired via an explicit `<link rel="icon">` in `_document.tsx` since modern browsers support PNG favicons directly
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
- `CategoryInput.tsx` — Budget category allocation input; also renders the category's `imageUrl` thumbnail and a 1-5 star `CategoryRating` control (posts to `/api/budget/categories/rate`) when a `sessionId` prop is passed
- `IncomeCategoryInput.tsx` — Income category input

### Components (`apps/web/components/admin/`)

- `MyQuestionsSubNav.tsx` — Shared sub-nav (Översikt / Kallelser / Budget) rendered at the top of all three `/admin/my-questions*` pages

---

## Database Schema (MongoDB/Mongoose)

All models defined in `apps/web/lib/models.ts`.

### Collections Summary

| Collection              | Purpose                                | Key Fields                                                                                                                                                         |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `User`                  | App users                              | email, isAdmin, isSuperAdmin, adminStatus, sessionLimit, userType, bankIdVerified, expoPushToken                                                                   |
| `Session`               | Voting sessions                        | place, sessionType, status, phase, activeUsers, phase1/2 schedules                                                                                                 |
| `Proposal`              | Session proposals                      | sessionId, title, problem, solution, authorId, thumbsUpCount, averageRating, categories, imageUrl                                                                  |
| `ThumbsUp`              | 1-5 star ratings on proposals          | sessionId, proposalId, userId, rating — unique per (proposal, user)                                                                                                |
| `Comment`               | For/against/neutral debate             | sessionId, proposalId (optional — unset for `voting`-type session debates, which have no Proposal), userId, type, text, averageRating                              |
| `CommentRating`         | Ratings on comments                    | commentId, userId, rating — unique per (comment, user)                                                                                                             |
| `FinalVote`             | Yes/No final votes                     | sessionId, proposalId, userId, choice — unique per (proposal, user)                                                                                                |
| `TopProposal`           | Winning proposals archive              | sessionId, proposalId, yesVotes, noVotes                                                                                                                           |
| `LoginCode`             | OTP codes (TTL 10min)                  | email, codeHash, attempts, expiresAt                                                                                                                               |
| `BudgetSession`         | Budget voting sessions                 | sessionId, municipality, totalBudget, categories[] (id, name, amount, tags, imageUrl, totalStars, ratingCount, averageRating), incomeCategories, taxBase           |
| `BudgetVote`            | Individual budget allocations          | sessionId, userId, allocations, incomeAllocations — unique per (session, user)                                                                                     |
| `BudgetResult`          | Computed median budget                 | sessionId, medianAllocations, totalMedianExpenses, voterCount                                                                                                      |
| `BudgetArgument`        | Budget category debate                 | sessionId, userId, categoryId, direction (up/down), text, helpfulVotes                                                                                             |
| `BudgetCategoryRating`  | 1-5 star ratings on budget categories  | sessionId, categoryId, userId, rating — unique per (session, category, user)                                                                                       |
| `CitizenProposal`       | Medborgarförslag                       | title, description, categories, status, imageUrl, totalStars, averageRating                                                                                        |
| `CitizenProposalRating` | Ratings on citizen proposals           | proposalId, userId, rating — unique per (proposal, user)                                                                                                           |
| `QuickVote`             | Ja/Nej votes on "voting"-type sessions | sessionId, userId, choice — unique per (session, user)                                                                                                             |
| `MunicipalSession`      | Council meeting sessions               | municipality, meetingDate, meetingType, items[] (title, description, categories: ALL_CATEGORIES strings, imageUrl, totalStars, ratingCount, averageRating), status |
| `MunicipalItemRating`   | 1-5 star ratings on municipal items    | municipalSessionId, itemId, userId, rating — unique per (item, user)                                                                                               |
| `SessionRequest`        | Admin session quota requests           | userId, requestedSessions, status                                                                                                                                  |
| `Settings`              | Global app settings                    | language, theme, sessionLimitHours                                                                                                                                 |
| `Survey`                | Simple polls                           | question, choices[], status                                                                                                                                        |
| `SurveyVote`            | Anonymous survey votes                 | surveyId, visitorId, choiceId — unique per (survey, visitor)                                                                                                       |

### Session Phases

Sessions go through: `phase1` (proposal submission + thumbs up) → `phase2` (final yes/no votes) → `closed` → `archived`

Session types: `"standard"` · `"survey"` · `"municipal"` · `"voting"`

**`"voting"` type:** Single yes/no question for the mobile Rösta tab. Created via manage-sessions using "📱 Mobilapp — Ja/Nej" (the default session type). Starts directly in `phase2`. The `place` field stores the question text (max 200 chars). Votes stored in `QuickVote` (not `FinalVote`). Excluded from all ordinary session queries (`getActiveSession`, `/api/sessions/active`, all mobile tabs except Rösta and Hem) — only surfaces via `/api/mobile/sessions/voting`. A background image can be set at creation time (file picker shown when sessionType === "voting") — the upload runs immediately after the session is created, before any page reload. **Requires a `deadline` date at creation** (enforced both client-side in `manage-sessions.tsx` and server-side in `POST /api/admin/sessions`, which rejects a missing/past deadline) — the admin UI's date input is stored as the end of that day (`23:59:59.999`). Voting sessions are never subject to `Settings.sessionLimitHours` (see below); they only close when their `deadline` passes or an admin manually closes them via `/api/admin/close-session`.

**Pre-election voting-rights quota (Fas 0):** Ahead of BankID verification, every user may cast at most **5** first-time votes before the election (2026-09-13). The limit is a hardcoded constant `PRE_ELECTION_LIMIT = 5` in both `quick-vote.ts` and `sessions/voting.ts` — no live DB count needed. Enforced server-side in `POST /api/mobile/quick-vote` — only gates a _brand-new_ vote (no existing `QuickVote` row for that `sessionId`+`userId`); changing an existing vote is always free and doesn't consume a slot. `GET /api/mobile/sessions/voting` returns `{ used, limit }` so `vote.tsx` and Hem can show "Du har röstat i X av Y möjliga frågor" and surface the 403 inline (a dedicated `voteError` state — deliberately NOT the screens' full-page `fetchError`, since hitting the quota is an expected, frequent state, not a load failure). Future phases (not yet built): once BankID is connected, a verified Vallentuna resident bypasses the quota entirely; after the election, quota is replaced by the membership-based rules (1 vote/fullmäktige for paying members, 2/calendar year for non-member residents).

**Citizen-proposal quota (Fas 0):** Same pre-election restriction pattern as the voting quota above, but for medborgarförslag: a non-admin user may submit at most **1** citizen proposal before the election. Hardcoded `CITIZEN_PROPOSAL_LIMIT = 1` in `pages/api/mobile/citizen-proposals/index.ts`, counted via `CitizenProposal.countDocuments({ authorId })` (counts every proposal regardless of status, so a rejected/archived proposal still uses up the one slot — resubmission isn't allowed by tweaking status). Admins (`user.isAdmin` from the JWT) are exempt entirely, both for the POST gate and for the `canSubmit` flag. `GET /api/mobile/citizen-proposals` returns `canSubmit` so `proposals.tsx` can hide/relabel the submit button proactively instead of only failing on POST — necessary because a user's own rejected proposal doesn't appear in the (status-filtered) visible list, so the button can't be gated by "do I see one of my own in the list" alone.

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

- `GET/POST/PUT/DELETE /api/budget/sessions` — Budget sessions; PUT merges an incoming `categories` array into the existing categories by `id` (preserves `imageUrl`/`totalStars`/`ratingCount`/`averageRating` set via the rating/image endpoints below — never does a wholesale array overwrite)
- `GET/POST /api/budget/vote` — Get / submit budget allocation
- `GET/POST /api/budget/results` — Results / calculate median
- `GET/POST /api/budget/debate` — Budget arguments
- `POST /api/budget/debate/helpful` — Mark argument helpful
- `POST /api/budget/upload-pdf` — Upload & parse PDF (admin)
- `GET/POST /api/budget/categories/rate` — Logged-in users rate a budget category 1-5 stars; upserts `BudgetCategoryRating` and recomputes the category's aggregate fields

### Citizen Proposals

- `GET/POST /api/citizen-proposals` — List / create
- `POST /api/citizen-proposals/rate` — Rate proposal

### Municipal

- `GET/POST /api/municipal/sessions` — PATCH `action: "update"` merges `updates.items` into existing items by `_id` (preserves `imageUrl`/`totalStars`/`ratingCount`/`averageRating` set via the rating/image endpoints below — never does a wholesale array overwrite)
- `GET /api/municipal/board-sessions` — public; items' `categories` are `ALL_CATEGORIES` strings (not the old numeric 1-7 scheme)
- `POST /api/municipal/extract-agenda` — AI PDF extraction (admin); AI now assigns `ALL_CATEGORIES` string tags directly
- `POST /api/municipal/close-item` — Close agenda item (admin)
- `GET/POST /api/municipal/items/rate` — Logged-in users rate a municipal item 1-5 stars; upserts `MunicipalItemRating` and recomputes the item's aggregate fields

### Admin (all require isAdmin/isSuperAdmin)

- `GET/POST /api/admin/users`
- `GET/POST /api/admin/sessions`
- `POST /api/admin/close-session`
- `POST /api/admin/archive-session`
- `GET/PATCH /api/admin/proposals` — CSRF-protected; GET enriches each proposal with its session's `place` (`sessionPlace`) and includes `categories`/`imageUrl`; PATCH edits title/problem/solution/estimatedCost/status/categories (no longer supports POST/create)
- `GET /api/admin/finalvotes`
- `GET/POST /api/admin/comments` — already tolerates `Comment` rows with no `proposalId` (the mobile voting-debate comments) without changes — `proposalId` lookups use optional chaining and an unfiltered GET returns every comment regardless of type
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
- `GET/PATCH /api/admin/citizen-proposals` — CSRF-protected; list all citizen proposals / update status (active/archived/selected/submitted_as_motion/rejected) and/or edit title/description/categories
- `POST /api/admin/suggest-categories` — Suggest category tags for a proposal title/description via Claude (admin-only)
- `GET/PATCH /api/admin/session-requests` — List session-quota requests / approve or deny
- `POST /api/admin/session-image` — Multipart image upload for session backgrounds; stores via `@vercel/blob` under prefix `session-images/`, returns the public CDN URL, deletes the previous blob if `Session.imageUrl` already pointed to one; errors (formidable parse, blob `put()`, Mongo update) are caught and logged via `createLogger`, returning a descriptive JSON message instead of an opaque 500
- `POST /api/admin/citizen-proposal-image` — Same pattern as `session-image` above, but for adding/replacing a citizen proposal's image after submission; stores under prefix `citizen-proposal-images/`
- `POST /api/admin/session-proposal-image` — Same pattern, for a session `Proposal`'s image; stores under prefix `session-proposal-images/`
- `POST /api/admin/municipal-item-image` — Same pattern, for one `MunicipalSession.items[]` entry (targeted by `municipalSessionId` + `itemId`); stores under prefix `municipal-item-images/`
- `POST /api/admin/budget-category-image` — Same pattern, for one `BudgetSession.categories[]` entry (targeted by `sessionId` + `categoryId`); stores under prefix `budget-category-images/`
- `GET /api/admin/my-questions/overview?interest=<key>` — Flattens municipal items, budget categories, and citizen proposals into one response, optionally filtered to the categories mapped by an `INTEREST_AREAS` key (from `@repo/types`); powers the admin "Mina frågor" Översikt page

### Mobile Auth (JWT)

Mobile apps cannot use NextAuth cookies. These endpoints implement the same OTP flow but return JWT tokens instead.

- `POST /api/auth/request-code` — Request OTP (shared with web, no changes)
- `POST /api/mobile/auth/verify-code` — Submit OTP, returns `{ accessToken, refreshToken, user }`
- `POST /api/mobile/auth/refresh` — Exchange refresh token for new token pair

Access tokens: 7-day expiry · Refresh tokens: 30-day expiry · Signed with `NEXTAUTH_SECRET`

Mobile API calls pass `Authorization: Bearer <accessToken>`. Use `verifyBearerToken()` from `lib/mobile-jwt.ts` to protect mobile-specific routes.

### Mobile Data (all require Bearer token)

- `GET /api/mobile/sessions/active` — Active sessions list with proposals per session (excludes "voting" and "municipal" types); each entry includes `categories`. Consumed by the preserved Sessioner screen (`app/sessions.tsx`) — not used by Hem, which only shows `"voting"`-type questions
- `GET /api/mobile/sessions/phase2` — Sessions in voting phase, proposals with yes/no counts + user's vote (excludes "voting" type)
- `GET /api/mobile/sessions/archived` — Closed/archived sessions with TopProposals and vote counts (excludes "voting" type)
- `GET /api/mobile/sessions/[id]/proposals` — Proposals for a specific session
- `GET /api/mobile/sessions/voting` — Returns `{ sessions, quota }`. `sessions` is active first (isActive: true), then closed/archived newest-first (isActive: false); each entry has `{ id, question, imageUrl, isActive, startDate, voteCounts, userVote, categories }` (`categories` is carried through but currently unused by any mobile screen — Hem shows every unvoted active question with no interest filtering). `quota` is `{ used, limit }` — see the pre-election voting-rights quota note under the `"voting"` session type below.
- `GET/POST /api/mobile/citizen-proposals` — GET returns `{ proposals, canSubmit }` (active proposals list + whether the caller may still submit one); POST creates a new one (multipart, supports image upload; `bodyParser: false` + formidable; 600 KB server-side limit; stores via `@vercel/blob` under prefix `citizen-proposal-images/`, rolls back with `del()` if the DB insert fails). POST is gated by the one-proposal-per-user quota — see below
- `POST /api/mobile/citizen-proposals/rate` — Upsert star rating (1-5), recalculates averageRating
- `POST /api/mobile/votes` — Cast or update yes/no vote on a phase2 proposal
- `POST /api/mobile/quick-vote` — Cast or update Ja/Nej vote on a "voting"-type session; returns updated vote counts. Changing an already-cast vote always succeeds. A brand-new vote is gated: 403 if the target session isn't `status: "active"`, or if the user has already used their pre-election quota (see below)
- `GET/POST /api/mobile/voting-comments` — För/emot debate on a "voting"-type session. GET `?sessionId=` returns anonymized comments (`authorName` stripped, `isOwn` + `userRating` added, no N+1 — ratings batch-fetched). POST `{ sessionId, text, type }` creates a comment with no `proposalId`; 400 if the session isn't `sessionType: "voting"`, 403 if not `status: "active"`
- `POST /api/mobile/voting-comments/rate` — Upsert a 1-5 star rating on a voting-debate comment (`CommentRating`, same unique index as the web flow); recalculates `averageRating`; 403 if the comment's session isn't `status: "active"`
- `POST /api/mobile/moderate` — Bearer-auth wrapper around `moderateContent()` (`lib/ai.ts`) for the mobile debate composer; same `{ status, message }` shape and fail-open behavior as the web's `/api/moderate`
- `POST /api/mobile/push-token` — Store Expo push token on the user record (`ExponentPushToken[…]` prefix validated)
- `POST /api/mobile/xai` — Backs the "MAJ" assistant (route name unchanged from its original "XAI" name): `{ message, context }` → `{ reply }`. Calls `claude-haiku-4-5-20251001` with a democratic-assistant system prompt that introduces the assistant as "MAJ". Max 300 tokens. Context is the current tab label (passed for relevance).
- `POST /api/mobile/user/interests` — Update the user's interest-area filter list (validated against `ALL_CATEGORIES`)
- `POST /api/mobile/user/phone` — Set/clear the user's mobile number for SMS reminders (e.g. the 2026-09-13 election). Validates via `formatPhoneNumber()` from `lib/sms.ts` (Swedish E.164); on a valid number also sets `User.notificationPreference: "both"` (activating the previously-uncollectable SMS branch of `lib/municipal/notifications.ts`); an empty string clears the number and resets the preference to `"email"`
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
- `POST /api/check-session-timeout` — Vercel Cron (daily, `apps/web/vercel.json`), Bearer `CRON_SECRET`. Closes `standard`/`survey`/`municipal` sessions past `Settings.sessionLimitHours` (default 24) — **excludes `sessionType: "voting"` entirely** — and separately closes `voting` sessions whose own `deadline` has passed. Don't reintroduce a blanket `Session.find({ status: "active" })` here without the `sessionType` split, or mobile Ja/Nej questions will get silently auto-closed by the standard-session time limit again (this happened in production: `sessionLimitHours` had been left at a stray test value of `3`, closing every active voting session at the next daily cron tick).
- `POST /api/pusher/auth`
- `POST /api/unsubscribe`
- `DELETE /api/account/delete` — GDPR right-to-erasure: deletes all user data (proposals, comments, votes, ratings, citizen proposals + blob images, budget votes/arguments, login codes) then deletes the User record. Requires active NextAuth session.

---

## Pages

| Route                             | Page                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                          | Email OTP login. Dark blue gradient background, `app-icon-transparent.svg` (amber `>>` arrows, no background) + "VALLENTUNA Framåt" title, semi-transparent card, amber buttons, white inputs. Link to /legal at bottom.                                                                                                                                                                                                                                                                                                                |
| `/about`                          | About page — dark blue gradient matching login; amber accents                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `/app`                            | App download redirect (target of the in-app "Dela appen med en vän" QR). UA-redirects Android → Play; renders a landing with store buttons for iOS/desktop. Store URLs are constants at the top of the file — update as tracks go live                                                                                                                                                                                                                                                                                                  |
| `/legal`                          | Integritetspolicy & Användarvillkor (GDPR, org.nr 802555-8852)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/radera`                         | GDPR account deletion — 3-step flow (info → confirm email → done), calls `DELETE /api/account/delete`                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/support`                        | Public support page (required by Apple App Store) — contact email, FAQ accordion, link to /legal                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/session/[id]`                   | Voting session (phase1/phase2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/session/survey/[id]`            | Survey voting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `/[municipality]/[board]/`        | Municipality sessions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/[municipality]/[board]/archive` | Municipality archive                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/archive`                        | Global archive                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/archive/[id]`                   | Specific archived session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/budget/`                        | Budget landing → redirects to active                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/budget/debate/[sessionId]`      | Budget debate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `/budget/results/[sessionId]`     | Budget results                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/medborgarforslag`               | Citizen proposals listing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/admin/`                         | Super admin dashboard — 3 primary tabs (Mina frågor / Rösta / Förslag, see below) + a "Mer ▾" dropdown for Top Proposals, Admin Applications, Session Requests, Email, Users, Settings, Survey, Clean                                                                                                                                                                                                                                                                                                                                   |
| `/admin/my-questions`             | "Mina frågor" Översikt — municipal items + budget categories + citizen proposals flattened and filterable by `INTEREST_AREAS` pill; image upload everywhere, full inline text/category edit for citizen proposals, links out to the dedicated sub-pages below for municipal/budget text edits (those need the full-array-safe PATCH/PUT, not a single-item overwrite). Admin-only — there is no mobile equivalent tab (mobile's Hem is a flat unfiltered feed of "voting"-type questions; the old mobile "Mina frågor" tab was removed) |
| `/admin/my-questions/municipal`   | Municipal session management (moved from `/admin/municipal`) — categories are now `ALL_CATEGORIES` strings, not numeric 1-7; supports per-item image upload + read-only rating badge                                                                                                                                                                                                                                                                                                                                                    |
| `/admin/my-questions/budget`      | Budget admin (moved from `/budget/admin/`) — adds a "Redigera kategorier" panel per session for editing name/amount/tags + image upload + read-only rating badge per category                                                                                                                                                                                                                                                                                                                                                           |
| `/admin/survey`                   | Survey management                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/manage-sessions`                | Session admin (non-super admins); also the target of the admin dashboard's "Rösta" tab. Default session type is "voting" (📱 Mobilapp — Ja/Nej). Session type buttons: Mobilapp first, then Webapp, then Survey. Supports optional background image upload at creation time (shown when sessionType === "voting").                                                                                                                                                                                                                      |

---

## Shared Types Package (`packages/types/src/`)

| File            | Exports                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base.ts`       | `BaseDocument`                                                                                                                                                                               |
| `categories.ts` | `GEOGRAPHIC_CATEGORIES`, `THEMATIC_CATEGORIES`, `ALL_CATEGORIES`, `INTEREST_AREAS`, `INTEREST_TO_CATEGORIES` — shared by mobile's interest picker and the web admin's "Mina frågor" Översikt |
| `user.ts`       | `User`, `AuthUser`                                                                                                                                                                           |
| `session.ts`    | `Session`, `TopProposal`, `SessionRequest`                                                                                                                                                   |
| `proposal.ts`   | `Proposal`, `ThumbsUp`, `Comment`, `FinalVote`                                                                                                                                               |
| `budget.ts`     | `BudgetSession`, `BudgetVote`, `BudgetResult`, `BudgetArgument`, `BudgetCategoryRating`                                                                                                      |
| `municipal.ts`  | `MunicipalSession`, `CitizenProposal`, `MunicipalItemRating`                                                                                                                                 |
| `survey.ts`     | `Survey`, `SurveyVote`                                                                                                                                                                       |

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
