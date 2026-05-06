# Equal Democracy (Jämlik Demokrati) — Project Reference

## Maintenance

This file should be kept up to date as the project evolves. When making significant changes — new models, API routes, pages, packages, or architectural decisions — update the relevant section of this file before completing the task.

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
pnpm lint             # Lint all
pnpm check-types      # Type check all

# From apps/web specifically
pnpm dev --filter=web
npm run migrate:dry-run   # Test DB migration
npm run migrate           # Migrate + backup
npm run backup            # Backup to MongoDB
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
│   ├── (auth)/
│   │   ├── _layout.tsx      # Redirects to (app)/ if already logged in
│   │   └── login.tsx        # Two-step email → OTP login screen
│   └── (app)/
│       ├── _layout.tsx      # Bottom tab navigator (5 tabs) + auth guard + PanResponder horizontal swipe
│       ├── index.tsx        # Hem — fixed blue hero with background image + scrollable party info cards
│       ├── sessions.tsx     # Sessioner — TikTok-style full-screen vertical carousel of active sessions
│       ├── vote.tsx         # Rösta — "voting"-type sessions: single question with Ja/Nej/Avstår + result bars
│       ├── proposals.tsx    # Förslag — full-screen paginated citizen proposals with image backgrounds
│       ├── archive.tsx      # Arkiv — closed sessions with yes/no vote bars
│       └── membership.tsx   # Bli medlem — dummy membership/payment page (BankID + Swish integration pending)
├── lib/
│   ├── api.ts               # apiClient() — Bearer token injection + silent 401 refresh
│   ├── auth-context.tsx     # AuthProvider + useAuth() hook
│   ├── storage.ts           # Cross-platform storage: SecureStore (native) / localStorage (web)
│   ├── stars.ts             # Local star counter (SecureStore) + one-time celebration flags
│   ├── XAIModal.tsx         # XAI chat sheet — sparkles button opens Claude-backed assistant
│   ├── CelebrationModal.tsx # Spring-animated star reward overlay (reused across all 4 trigger screens)
│   └── ChevronsRight.tsx    # Custom >> logo icon built from pure View/rotated rectangles (no SVG dep)
├── metro.config.js          # Monorepo-aware Metro config — required for pnpm workspace resolution
└── .env                     # EXPO_PUBLIC_API_URL — must be LAN IP for physical devices
```

### Key Patterns

**Auth:** Uses JWT tokens (not NextAuth cookies). Tokens stored via `lib/storage.ts` (SecureStore on native, localStorage on web). `useAuth()` exposes `user`, `isLoading`, `requestCode(email)`, `login(email, code)`, `logout()`.

**API calls:** Use `apiClient<T>(path, options)` from `lib/api.ts`. It reads the access token from storage, attaches `Authorization: Bearer`, and silently refreshes on 401 before retrying once.

**Storage:** Always use `lib/storage.ts` (`getItem`/`setItem`/`deleteItem`) instead of `expo-secure-store` directly — it handles the web fallback to localStorage automatically.

**Navigation:** `(app)/_layout.tsx` uses Expo Router `<Tabs>` with five bottom tabs: Hem, Sessioner, Rösta, Förslag, Arkiv. Headers are hidden (`headerShown: false`); each screen manages its own safe-area top padding via `useSafeAreaInsets()`.

**Horizontal swipe between tabs:** Implemented via `PanResponder` in `(app)/_layout.tsx` using `onMoveShouldSetPanResponderCapture` (capture phase, top-down) so it intercepts horizontal gestures before child scroll views. Drag right → previous tab, drag left → next tab. Wraps around. Uses `pathnameRef` / `routerRef` to avoid stale closures, and `router.navigate` (not `push`) to avoid stacking history.

**Navigation guards:** `(auth)/_layout.tsx` redirects logged-in users to the app. `(app)/_layout.tsx` redirects unauthenticated users to login. Both check `useAuth()`.

**Sessions screen background transitions:** `sessions.tsx` uses a double-buffer approach — two `Animated.Image` layers are always mounted (never unmounted). One is "current" (translateY=0), the other is "standby" (parked off-screen). On transition: standby's source is updated while off-screen, `onLoad` fires after decode, standby slides in to 0, then the old current snaps off-screen while hidden behind the new front. If the standby already holds the needed URI (e.g. on loop-back), `onLayerLoad` is called directly without waiting for `onLoad` (which won't re-fire for an unchanged source). `Image.prefetch()` warms the cache for all session images on load. Never use the old single-base + conditional-incoming pattern — it caused a source-reload flash on the base layer.

**Rösta screen (vote.tsx):** TikTok-style full-screen vertical carousel of voting sessions with infinite loop (triple-array pattern, same as `sessions.tsx` and `proposals.tsx`). Each page owns its background image (plain `<Image>` as `absoluteFill` inside the page View — NOT a shared double-buffer). Sessions without an image show a solid dark blue (`#002d75`) base. Uses `containerH` from `onLayout` (not `Dimensions`) so `pagingEnabled` snaps correctly after the tab bar. Active session ("Dagens fråga") shows a compact semi-transparent card; results are hidden before voting to prevent bandwagon effect and appear immediately after voting. Past sessions always show read-only results. Three radio alternatives (Ja/Nej/Avstår). Share button uses React Native `Share.share()`. Yellow "Föreslå en fråga" button pinned to bottom opens a bottom-sheet modal that POSTs to `/api/mobile/suggest-question`. Fetches from `/api/mobile/sessions/voting` (active first, then closed/archived newest-first).

**XAI assistant (XAIModal.tsx):** A dark-blue circle with a sparkles icon floats at the top-left corner of every tab (rendered in `(app)/_layout.tsx` as an absolute overlay, z-index 100). Tapping it opens a bottom-sheet chat with the Claude API via `/api/mobile/xai`. Shows context-aware quick-action chips based on the current tab (different prompts for Hem, Sessioner, Rösta, Förslag, Arkiv) plus two common actions (write a comment, submit a proposal). Has a "Anmäl XAI" flag button (top-right of the sheet) that users can tap to report bad AI output. Uses `claude-haiku-4-5-20251001` with a 300-token limit for quick, concise replies. The button hides itself while the modal is open to avoid double-tap confusion.

**Membership screen (membership.tsx):** Pushed from the Hem tab ("Klicka här" button). Shows member fee (250 kr/år) and four benefits. Swish pay button is disabled. Pending: BankID verification (must confirm user is folkbokförd in Vallentuna, postal code 186xx via Signicat) + actual payment integration. BankID will be optional/voluntary — soft prompt earning bonus stars, hard-required one month before election.

**Content moderation (web):** `POST /api/moderate` checks comment text via Claude Haiku before posting in `apps/web/pages/session/[id].tsx`. Returns `{ status: "ok"|"warn"|"flag", message }`. If warn/flag, shows an inline confirmation dialog with the AI's message; "flag" also shows legal notice. Fails open on error so Claude outages never block posting.

**Star/gamification system (mobile):** Local-only star counter stored via `lib/stars.ts` (SecureStore key `"user_stars"`). Awards: first app open +1, set interests +2, rate a session proposal +3, vote on Rösta question +1, submit citizen proposal +5. One-time actions guarded by storage flags (`celebrated_first_visit`, `celebrated_interests_set`). Star count shown as a badge in the Hem hero (top-left). `lib/CelebrationModal.tsx` is a reusable spring-animated overlay used by all four trigger screens.

**Admin button (mobile):** In the settings modal (gear icon on Hem), an "Admin" button is shown only when `user.isAdmin`. Opens `BASE_URL/admin` (super admin) or `BASE_URL/manage-sessions` (regular admin) in the device browser via `Linking.openURL`.

**Infinite vertical loop (Sessioner, Rösta, Förslag):** All three screens use the triple-array pattern: `loopedItems = [...items, ...items, ...items]`, start scrolled to the middle copy (`items.length * pageH`), and silently jump back to the middle copy when `onMomentumScrollEnd` detects the user has reached the outer thirds. Uses `containerH` from `onLayout` (never `Dimensions.get("window").height`) for the page size so `pagingEnabled` snaps correctly. Key refs: `scrollRef`, `currentIdxRef`, `initialScrollDone`. Never use `SCREEN_H` for page heights in these screens.

**"Förslag:" label:** In `proposals.tsx`, a small uppercase label "FÖRSLAG:" appears above each proposal title so the card context is clear at a glance.

**Citizen proposals image upload:** `proposals.tsx` picks images via `expo-image-picker`, compresses to max 1200 px / 75% JPEG quality via `expo-image-manipulator`, then uploads with raw `fetch` + `FormData` (NOT `apiClient`) so React Native can set the correct `multipart/form-data; boundary=…` header automatically. `apiClient` would override Content-Type with `application/json` and break the upload.

**Monorepo + Metro:** `metro.config.js` is required — without it, pnpm's symlinked `node_modules` causes Metro module resolution failures. Always keep it in sync if the monorepo structure changes.

**CORS (web emulator only):** `apps/web/middleware.ts` adds CORS headers for `localhost:8081` and `localhost:19006`. Native builds are unaffected. Add production origins via `ALLOWED_ORIGINS` env var (comma-separated) in `apps/web/.env.local`.

**Environment:** Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`. Use `http://10.0.2.2:3000` for Android emulator, your LAN IP for physical devices. `localhost` does NOT work on physical devices.

**Push notifications (pending EAS build):** The server-side infrastructure is complete — `apps/web/lib/push-notifications.ts` sends to the Expo Push API, `POST /api/mobile/push-token` stores tokens, `User.expoPushToken` field exists, and `POST /api/admin/sessions` fires a push when a voting session is created. The mobile side (`expo-notifications`) is **not wired up in Expo Go** — `expo-notifications` cannot be installed reliably under OneDrive due to EPERM errors, and push tokens require a real EAS build anyway. Re-add the import and registration code in `(app)/_layout.tsx` and the badge-clear in `vote.tsx` when doing the first production build.

**OneDrive + pnpm symlinks:** Installing new packages under `apps/mobile/` can fail with `EPERM rename` because OneDrive locks files during sync. Pause OneDrive sync before running `pnpm add`. If a package still fails to resolve after install, run `pnpm install` from the repo root to repair the lockfile. Avoid packages requiring heavy native linking — `expo-image-picker` and `expo-image-manipulator` are fine (bundled in Expo Go).

**Testing with Expo Go:** Scan the QR code shown in the Metro terminal after running `pnpm dev:mobile`. Shake the device to get the reload menu. Press `r` in the Metro terminal to force reload.

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
├── public/
│   ├── session-images/         # Session background images (admin upload via /api/admin/session-image)
│   └── citizen-proposal-images/ # Citizen proposal images (mobile upload via /api/mobile/citizen-proposals)
├── styles/                     # Global CSS (Tailwind v4)
├── types/                      # Local TypeScript types
└── scripts/                    # DB migration + utility scripts
```

### Key Library Files (`apps/web/lib/`)

| File | Purpose |
|------|---------|
| `models.ts` | All Mongoose schema definitions — single source of truth for DB models |
| `mongodb.ts` | `connectDB()` — connection pooling with caching |
| `config.ts` | `THEMES`, `AVAILABLE_LANGUAGES`, theme color helpers |
| `admin.ts` | `requireAdmin()` — admin auth middleware |
| `admin-helper.ts` | Admin utility functions |
| `session-helper.ts` | `getActiveSession()`, `getAllActiveSessions()`, `registerActiveUser()` — all exclude `sessionType: "voting"` |
| `csrf.ts` | `generateCsrfToken()`, `validateCsrfToken()`, `csrfProtection()` — dual-cookie CSRF |
| `email.ts` | `sendEmail()`, `sendLoginCode()` via Resend |
| `sms.ts` | SMS sending via Twilio |
| `logger.ts` | `createLogger()` |
| `fetch-with-csrf.ts` | `fetchWithCsrf()` — CSRF-aware HTTP client for frontend |
| `validation.ts` | Form validation helpers |
| `sse-broadcaster.ts` | Server-sent events broadcasting |
| `session-close.ts` | Session termination logic |
| `push-notifications.ts` | `sendPushNotifications()` + `notifyNewVotingQuestion()` — sends to Expo Push API in batches of 100 |
| `budget/ai-extractor.ts` | `extractBudgetFromPDF()` — Claude API extracts budget data from PDFs |
| `budget/median-calculator.ts` | Median calculation for budget votes |
| `municipal/agenda-extractor.ts` | `extractAgendaFromPDF()` — Claude API parses meeting agendas |
| `municipal/notifications.ts` | Municipal notification logic |
| `contexts/ConfigContext.tsx` | Theme + language context provider |
| `hooks/useTranslation.ts` | i18n hook |
| `hooks/useSSE.ts` | SSE connection hook |
| `hooks/useLazySound.ts` | Audio playback hook |
| `locales/[sv,en,sr,es,de].ts` | Translation strings (5 languages) |

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

| Collection | Purpose | Key Fields |
|-----------|---------|-----------|
| `User` | App users | email, isAdmin, isSuperAdmin, adminStatus, sessionLimit, userType, bankIdVerified, expoPushToken |
| `Session` | Voting sessions | place, sessionType, status, phase, activeUsers, phase1/2 schedules |
| `Proposal` | Session proposals | sessionId, title, problem, solution, authorId, thumbsUpCount, averageRating |
| `ThumbsUp` | 1-5 star ratings on proposals | sessionId, proposalId, userId, rating — unique per (proposal, user) |
| `Comment` | For/against/neutral debate | sessionId, proposalId, userId, type, text, averageRating |
| `CommentRating` | Ratings on comments | commentId, userId, rating — unique per (comment, user) |
| `FinalVote` | Yes/No final votes | sessionId, proposalId, userId, choice — unique per (proposal, user) |
| `TopProposal` | Winning proposals archive | sessionId, proposalId, yesVotes, noVotes |
| `LoginCode` | OTP codes (TTL 10min) | email, codeHash, attempts, expiresAt |
| `BudgetSession` | Budget voting sessions | sessionId, municipality, totalBudget, categories, incomeCategories, taxBase |
| `BudgetVote` | Individual budget allocations | sessionId, userId, allocations, incomeAllocations — unique per (session, user) |
| `BudgetResult` | Computed median budget | sessionId, medianAllocations, totalMedianExpenses, voterCount |
| `BudgetArgument` | Budget category debate | sessionId, userId, categoryId, direction (up/down), text, helpfulVotes |
| `CitizenProposal` | Medborgarförslag | title, description, categories, status, imageUrl, totalStars, averageRating |
| `CitizenProposalRating` | Ratings on citizen proposals | proposalId, userId, rating — unique per (proposal, user) |
| `QuickVote` | Ja/Nej/Avstår votes on "voting"-type sessions | sessionId, userId, choice — unique per (session, user) |
| `MunicipalSession` | Council meeting sessions | municipality, meetingDate, meetingType, items[], status |
| `SessionRequest` | Admin session quota requests | userId, requestedSessions, status |
| `Settings` | Global app settings | language, theme, sessionLimitHours |
| `Survey` | Simple polls | question, choices[], status |
| `SurveyVote` | Anonymous survey votes | surveyId, visitorId, choiceId — unique per (survey, visitor) |

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
- `GET/POST /api/mobile/citizen-proposals` — List active citizen proposals / create new one (multipart, supports image upload; `bodyParser: false` + formidable; 600 KB server-side limit; saves to `public/citizen-proposal-images/`)
- `POST /api/mobile/citizen-proposals/rate` — Upsert star rating (1-5), recalculates averageRating
- `POST /api/mobile/votes` — Cast or update yes/no vote on a phase2 proposal
- `POST /api/mobile/quick-vote` — Cast or update Ja/Nej/Avstår vote on a "voting"-type session; returns updated vote counts
- `POST /api/mobile/push-token` — Store Expo push token on the user record (`ExponentPushToken[…]` prefix validated)
- `POST /api/mobile/suggest-question` — Send a question suggestion as email to admin via Resend
- `POST /api/mobile/xai` — XAI chat: `{ message, context }` → `{ reply }`. Calls `claude-haiku-4-5-20251001` with a democratic-assistant system prompt. Max 300 tokens. Context is the current tab label (passed for relevance).

### Other
- `GET /api/settings` — App settings
- `POST /api/settings` — Update settings (admin)
- `GET /api/user/activity`
- `POST /api/apply-admin`
- `GET /api/recent` — includes "voting"-type sessions with icon 📱 and subtitle "Röstning · svara i appen"; link is `"#"` (no dedicated web page yet)
- `GET /api/events` — SSE stream
- `POST /api/csrf-token`
- `POST /api/check-session-timeout`
- `POST /api/pusher/auth`
- `POST /api/unsubscribe`

---

## Pages

| Route | Page |
|-------|------|
| `/login` | Email OTP login |
| `/about` | About page |
| `/session/[id]` | Voting session (phase1/phase2) |
| `/session/survey/[id]` | Survey voting |
| `/[municipality]/[board]/` | Municipality sessions |
| `/[municipality]/[board]/archive` | Municipality archive |
| `/archive` | Global archive |
| `/archive/[id]` | Specific archived session |
| `/budget/` | Budget landing → redirects to active |
| `/budget/debate/[sessionId]` | Budget debate |
| `/budget/results/[sessionId]` | Budget results |
| `/budget/admin/` | Budget admin |
| `/medborgarforslag` | Citizen proposals listing |
| `/admin/` | Super admin dashboard (sessions/users/proposals/results tabs) |
| `/admin/municipal` | Municipal session management |
| `/admin/survey` | Survey management |
| `/manage-sessions` | Session admin (non-super admins) |

---

## Shared Types Package (`packages/types/src/`)

| File | Exports |
|------|---------|
| `base.ts` | `BaseDocument` |
| `user.ts` | `User`, `AuthUser` |
| `session.ts` | `Session`, `TopProposal`, `SessionRequest` |
| `proposal.ts` | `Proposal`, `ThumbsUp`, `Comment`, `FinalVote` |
| `budget.ts` | `BudgetSession`, `BudgetVote`, `BudgetResult`, `BudgetArgument` |
| `municipal.ts` | `MunicipalSession`, `CitizenProposal` |
| `survey.ts` | `Survey`, `SurveyVote` |

---

## Environment Variables

Required in `apps/web/.env.local`:

```env
# Auth
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
- **Pusher:** Client-to-client broadcast (votes, phase transitions)
- **SSE:** Server-to-client streaming (`/api/events`) — used for admin live panel

### Internationalization
5 languages: `sv` (default), `en`, `sr`, `es`, `de`. Translation files in `lib/locales/`. `useTranslation()` hook reads from `ConfigContext`.

### Theming
4 color schemes: `default` (blue/yellow), `green`, `red`, `blue`. CSS variables set dynamically. Managed via `ConfigContext`.

---

## Configuration Files

- **`turbo.json`** — Task pipeline: build depends on `^build`, dev is persistent + no cache
- **`next.config.mjs`** — standalone output, transpiles all 36 D3 subpackages (ESM), optimizes lucide-react
- **`tsconfig.json`** — target ES2017, path alias `@/*` → `./*`, strict OFF
- **`postcss.config.mjs`** — Tailwind CSS v4 processing
- **`pnpm-workspace.yaml`** — `apps/*` + `packages/*`

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend framework | Next.js 15.5.7 (Pages Router) |
| React | 19.1.0 |
| Database | MongoDB Atlas via Mongoose 8.19.1 |
| Auth | NextAuth 4.24.11 (email OTP, no passwords) |
| Real-time | Pusher 5.2.0 + SSE |
| Email | Resend 6.2.2 |
| SMS | Twilio 5.12.0 |
| AI | Anthropic Claude API (@anthropic-ai/sdk 0.69.0) |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Charts | D3.js v7 (treemaps, visualizations) |
| Audio | Howler.js + use-sound |
| File upload | Formidable |
| PDF parsing | pdf-parse |
| Analytics | Vercel Analytics |
| Mobile | Expo 54 + React Native 0.81.5 + expo-image-picker ~16 + expo-image-manipulator ~13 |
| Monorepo | Turborepo 2.8.20 |
| Package manager | pnpm 10.33.0 |

---

## Scripts (`apps/web/scripts/`)

```bash
node scripts/migrate-database.js [--dry-run|--backup-only|--migrate]
node scripts/backup-to-mongodb.js
node scripts/force-close-session.js
node scripts/test-agenda-extraction.js
node scripts/test-auto-close.js
node scripts/add-fixed-percentages.js
```
