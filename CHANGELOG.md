# Changelog

All notable changes to Equal Democracy (Jämlik Demokrati) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Conventions**

- The canonical product version lives in the root [`package.json`](package.json); `apps/web`
  and `apps/mobile` (`package.json` + `app.json`) are kept in sync with it.
- Each release is tagged `vX.Y.Z` (e.g. `git tag -a v1.0.0`). Mobile store **build numbers**
  (`versionCode` / `buildNumber`) are auto-incremented by EAS and tracked separately from this
  human-facing version.
- Add changes under `[Unreleased]` as you go; on release, rename it to the new version + date
  and start a fresh `[Unreleased]`.

## [Unreleased]

## [1.0.0] - 2026-05-31

Initial release — the platform as deployed for Vallentuna kommun.

### Added

- **Voting sessions** — phase-based proposal submission, 1–5 star ratings, for/against/neutral
  debate, and final yes/no votes; archive of winning proposals.
- **Participatory budget** — citizens allocate the municipal budget; results computed by median,
  with a per-category debate. AI extracts budget data from uploaded PDFs.
- **Citizen proposals (medborgarförslag)** — submit, rate, and track proposals, with image upload
  to Vercel Blob.
- **Municipal council meetings** — agenda items parsed from PDFs via AI; targeted notifications.
- **Mobile app (Expo / React Native)** — Hem, Sessioner, Rösta, Förslag, Arkiv, and Info tabs;
  JWT auth; the Claude-backed XAI assistant; a local star/gamification system; and **push
  notifications** (FCM V1 on Android via an EAS dev/production build).
- **Platform** — NextAuth email-OTP auth, Pusher real-time, Resend email, Twilio SMS, Claude
  content moderation, 5-language i18n, and 4 theme color schemes.

### Infrastructure

- EAS build profiles (development dev-client + production) with `EXPO_PUBLIC_API_URL` baked per
  profile and auto-incremented mobile build numbers.
- Serverless-ready on Vercel: image uploads on Vercel Blob, a daily session-timeout cron, and a
  documented production deploy checklist ([PRODUCTION_READINESS.md](PRODUCTION_READINESS.md)).

[Unreleased]: https://github.com/Abbegubbegum/equal_democracy/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Abbegubbegum/equal_democracy/releases/tag/v1.0.0
