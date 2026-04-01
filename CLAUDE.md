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
│       ├── _layout.tsx      # Redirects to (auth)/login if not logged in
│       └── index.tsx        # Home screen placeholder
├── lib/
│   ├── api.ts               # apiClient() — Bearer token injection + silent 401 refresh
│   ├── auth-context.tsx     # AuthProvider + useAuth() hook
│   └── storage.ts           # Cross-platform storage: SecureStore (native) / localStorage (web)
├── metro.config.js          # Monorepo-aware Metro config — required for pnpm workspace resolution
└── .env                     # EXPO_PUBLIC_API_URL (default: http://localhost:3000)
```

### Key Patterns

**Auth:** Uses JWT tokens (not NextAuth cookies). Tokens stored via `lib/storage.ts` (SecureStore on native, localStorage on web). `useAuth()` exposes `user`, `isLoading`, `requestCode(email)`, `login(email, code)`, `logout()`.

**API calls:** Use `apiClient<T>(path, options)` from `lib/api.ts`. It reads the access token from storage, attaches `Authorization: Bearer`, and silently refreshes on 401 before retrying once.

**Storage:** Always use `lib/storage.ts` (`getItem`/`setItem`/`deleteItem`) instead of `expo-secure-store` directly — it handles the web fallback to localStorage automatically.

**Navigation guards:** `(auth)/_layout.tsx` redirects logged-in users to the app. `(app)/_layout.tsx` redirects unauthenticated users to login. Both check `useAuth()`.

**Monorepo + Metro:** `metro.config.js` is required — without it, pnpm's symlinked `node_modules` causes Metro module resolution failures. Always keep it in sync if the monorepo structure changes.

**CORS (web emulator only):** `apps/web/middleware.ts` adds CORS headers for `localhost:8081` and `localhost:19006`. Native builds are unaffected. Add production origins via `ALLOWED_ORIGINS` env var (comma-separated) in `apps/web/.env.local`.

**Environment:** Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`. Use `http://10.0.2.2:3000` for Android emulator, your LAN IP for physical devices.

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
├── public/                     # Static assets
├── styles/                     # Global CSS (Tailwind v4)
├── types/                      # Local TypeScript types
└── scripts/                    # DB migration + utility scripts
```

### Key Library Files (`apps/web/lib/`)

| File | Purpose |
|------|---------|
| `models.ts` (1294 lines) | All Mongoose schema definitions — single source of truth for DB models |
| `mongodb.ts` | `connectDB()` — connection pooling with caching |
| `config.ts` | `THEMES`, `AVAILABLE_LANGUAGES`, theme color helpers |
| `admin.ts` | `requireAdmin()` — admin auth middleware |
| `admin-helper.ts` | Admin utility functions |
| `session-helper.ts` | `getActiveSession()`, `getAllActiveSessions()`, `registerActiveUser()` |
| `csrf.ts` | `generateCsrfToken()`, `validateCsrfToken()`, `csrfProtection()` — dual-cookie CSRF |
| `email.ts` | `sendEmail()`, `sendLoginCode()` via Resend |
| `sms.ts` | SMS sending via Twilio |
| `logger.ts` | `createLogger()` |
| `fetch-with-csrf.ts` | `fetchWithCsrf()` — CSRF-aware HTTP client for frontend |
| `validation.ts` | Form validation helpers |
| `sse-broadcaster.ts` | Server-sent events broadcasting |
| `session-close.ts` | Session termination logic |
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
| `User` | App users | email, isAdmin, isSuperAdmin, adminStatus, sessionLimit, userType, bankIdVerified |
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
| `CitizenProposal` | Medborgarförslag | title, description, categories, status, totalStars, averageRating |
| `CitizenProposalRating` | Ratings on citizen proposals | proposalId, userId, rating — unique per (proposal, user) |
| `MunicipalSession` | Council meeting sessions | municipality, meetingDate, meetingType, items[], status |
| `SessionRequest` | Admin session quota requests | userId, requestedSessions, status |
| `Settings` | Global app settings | language, theme, sessionLimitHours |
| `Survey` | Simple polls | question, choices[], status |
| `SurveyVote` | Anonymous survey votes | surveyId, visitorId, choiceId — unique per (survey, visitor) |

### Session Phases
Sessions go through: `phase1` (proposal submission + thumbs up) → `phase2` (final yes/no votes) → `closed` → `archived`

Session types: `"standard"` · `"survey"` · `"municipal"`

---

## API Routes (70+)

### Auth
- `POST /api/auth/request-code` — Send OTP
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

### Mobile Auth (JWT)
Mobile apps cannot use NextAuth cookies. These endpoints implement the same OTP flow but return JWT tokens instead.
- `POST /api/auth/request-code` — Request OTP (shared with web, no changes)
- `POST /api/mobile/auth/verify-code` — Submit OTP, returns `{ accessToken, refreshToken, user }`
- `POST /api/mobile/auth/refresh` — Exchange refresh token for new token pair

Access tokens: 7-day expiry · Refresh tokens: 30-day expiry · Signed with `NEXTAUTH_SECRET`

Mobile API calls pass `Authorization: Bearer <accessToken>`. Use `verifyBearerToken()` from `lib/mobile-jwt.ts` to protect mobile-specific routes.

### Other
- `GET /api/settings` — App settings
- `POST /api/settings` — Update settings (admin)
- `GET /api/user/activity`
- `POST /api/apply-admin`
- `GET /api/recent`
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
| Mobile | Expo 54 + React Native 0.81.5 |
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
