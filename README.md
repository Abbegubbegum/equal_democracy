# Equal Democracy — Jämlik Demokrati

A democratic participation platform for Swedish municipalities. Citizens vote in sessions, allocate the municipal budget, submit citizen proposals (medborgarförslag), and follow council meetings — on the web and in a native mobile app.

🌐 **Production:** [www.vallentuna.app](https://www.vallentuna.app) (Vallentuna kommun)

Built as a [Turborepo](https://turborepo.dev) monorepo with a Next.js backend/web app and an Expo React Native mobile app sharing a TypeScript types package.

---

## Monorepo structure

```
equal_democracy/
├── apps/
│   ├── web/          # Next.js 15 app — pages, 70+ API routes, admin (primary app)
│   └── mobile/       # Expo 54 + Expo Router app (JWT auth, push notifications)
├── packages/
│   ├── types/        # Shared TypeScript types (used by web + mobile)
│   ├── ui/           # Shared budget-visualization components
│   ├── eslint-config/
│   └── typescript-config/
├── turbo.json
└── pnpm-workspace.yaml
```

## Tech stack

| Layer       | Technology                                                               |
| ----------- | ------------------------------------------------------------------------ |
| Web         | Next.js 15 (Pages Router) · React 19 · Tailwind CSS v4 · D3.js           |
| Mobile      | Expo 54 · React Native 0.81 · Expo Router 6                              |
| Database    | MongoDB Atlas via Mongoose                                               |
| Auth        | NextAuth (email OTP, no passwords) · JWT for mobile                      |
| Real-time   | Pusher                                                                   |
| Email / SMS | Resend · Twilio                                                          |
| AI          | Anthropic Claude (content moderation, PDF budget/agenda extraction, XAI) |
| Storage     | Vercel Blob (user-uploaded images)                                       |
| Hosting     | Vercel (web) · EAS (mobile builds)                                       |

## Getting started

**Prerequisites:** Node ≥ 18, [pnpm](https://pnpm.io) 10.33.0

```bash
pnpm install            # install all workspaces
```

Create `apps/web/.env.local` (MongoDB, NextAuth, Resend, Pusher, Anthropic, Vercel Blob …) and
`apps/mobile/.env` (`EXPO_PUBLIC_API_URL`). See the **Environment Variables** section of
[CLAUDE.md](CLAUDE.md) for the full list.

```bash
pnpm dev                # web + mobile together
pnpm dev:web            # web only        → http://localhost:3000
pnpm dev:mobile         # mobile only     → scan the Expo QR code

pnpm build              # build everything
pnpm lint               # lint everything
pnpm check-types        # type-check everything
pnpm format             # Prettier-format
```

### Mobile notes

The Expo app runs in **Expo Go** for JS/UI iteration. Native-module features (push
notifications) need a custom **EAS dev client** — build with
`eas build --profile development --platform android`. Local native builds aren't
supported on this setup; see [CLAUDE.md](CLAUDE.md) for why.

## Documentation

- **[CLAUDE.md](CLAUDE.md)** — the authoritative reference: architecture, data model,
  every route/page/package, and the project's working principles.
- **[PRODUCTION_READINESS.md](PRODUCTION_READINESS.md)** — serverless/Vercel deploy
  checklist and the patterns to avoid before shipping.
