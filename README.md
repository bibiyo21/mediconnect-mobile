# mediconnect-mobile

Expo / React Native app for MediConnect patients (iOS, Android, and a web build). The doctor experience joins it in later phases.

Specification and architecture: [mediconnect-docs](https://github.com/bibiyo21/mediconnect-docs) (`CLAUDE.md`, `docs/architecture.md` §5 and §7, `docs/development-roadmap.md`, `docs/app-store-readiness.md`).

**Status:** Phase 1 patient shell. It has sign-in, registration with a one-time code, home, account and signed-in devices. Every screen calls only endpoints that exist in the backend contract. Features from later phases show as "Coming soon" cards.

## Stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK 58, React Native 0.88, React 19, TypeScript (strict) |
| Navigation | Expo Router (`src/app`), with `Stack.Protected` guards for signed-in and signed-out routes |
| Server state | TanStack Query (offline-aware through `expo-network` and `onlineManager`) |
| Forms | React Hook Form + Zod (the rules mirror the backend's Form Requests) |
| API | `@mediconnect/api-client` from `mediconnect-shared` (generated from the backend OpenAPI contract) |
| Secure storage | `expo-secure-store` (Keychain / Keystore) |
| Tests | Jest (`jest-expo`) + React Native Testing Library |
| Build | EAS Build / Submit (`eas.json`) |

## Getting started

Prerequisites: Node 22+, pnpm 12, and the sibling checkouts `../shared` and `../backend` (the local API runs from `mediconnect-infrastructure`).

```bash
cd ../shared && pnpm install && pnpm build    # the app links @mediconnect/api-client (link: dependency) and uses its dist/
cd ../mobile && pnpm install
pnpm web                                      # web build on http://localhost:8081
pnpm start                                    # Metro for a development build or Expo Go
```

The web build signs in with Sanctum cookie sessions and CSRF (D-04). The backend allows `localhost:8081` in `CORS_ALLOWED_ORIGINS` and `SANCTUM_STATEFUL_DOMAINS` by default.

In local development, one-time codes are queued. Run a worker, or drain the queue once with `docker compose exec -T api php artisan queue:work --stop-when-empty`, then read the code in Mailpit (http://localhost:8025).

### Scripts

| Script | What it does |
|---|---|
| `pnpm start` / `ios` / `android` / `web` | Expo dev server |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | `expo lint` (ESLint 9 flat config) |
| `pnpm test` | Jest |
| `pnpm export:ios` / `export:android` | Production JavaScript bundles in `dist/` (this checks that Metro can bundle the app; it does not build a native binary) |
| `pnpm e2e` | Playwright + axe on the web build, three viewports, API mocked (`e2e/helpers.ts`); `pnpm e2e:shots` captures screenshots |

CI (`.github/workflows/ci.yml`) runs all of the above on every push and pull request, with `mediconnect-shared` checked out next to this repo.

### Environment

Only public values go in `EXPO_PUBLIC_*`. They are compiled into the bundle and anyone can read them. No secrets belong in this app.

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | API base URL; set per EAS profile |
| `EXPO_PUBLIC_PRIVACY_NOTICE_VERSION` | `draft-2026-11` | Privacy Notice version shown and accepted at registration |
| `EXPO_PUBLIC_TERMS_VERSION` | `draft-2026-11` | Terms of Use version shown and accepted at registration |
| `APP_VARIANT` | `development` | `development` / `preview` / `production`; sets the bundle ID suffix and app name (`app.config.ts`) |

## Session design (D-04)

- **Native (iOS/Android):**
  - The refresh token (30-day, rotating) is stored in SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, so it stays out of backups and device transfers.
  - The 15-minute access token lives only in memory.
  - On a cold start, the stored refresh token restores the session behind the splash screen. The first request then refreshes the access token.
- **Refresh is single-flight.** Every refresh token works once, and the server treats reuse as theft. So when several requests get a 401 at the same time, they all wait for one refresh, then each retries once (`src/lib/session.ts`).
- **Refresh failure:**
  - Only a rejection ends the session: a 401 (expired, revoked or reused token) or a 422 (a stored token the server can't accept). The token is cleared and the user is signed out with the reason `expired`. The welcome screen then shows "Your session ended".
  - A rate limit (429), a server error (5xx), a response that isn't the API's JSON, or no connection keeps the session and the stored token. The next request tries again.
  - A refresh that finishes after the user signed out (or in again) is discarded and never written back to SecureStore.
- **Auth endpoints never retry:** a 401 from login, register, refresh or MFA verify does not trigger refresh-and-retry.
- **Web build:** the Sanctum session cookie (HttpOnly) plus `X-XSRF-TOKEN`. Nothing is written to `localStorage` or `sessionStorage`.
- **Sign-out** (by the user or on expiry) clears the React Query cache, so no account data outlives the session.
- **In-memory only:** registration drafts, verification tokens and MFA challenge ids are held in memory (`RegistrationDraft` context). They are never put in route params, which would show in web URLs, and never persisted.
- **MFA:** an account that must still set up MFA (a privileged role) is not signed in. The patient app has no MFA setup flow.

## Routes

```
src/app/
  _layout.tsx                 providers, splash, Stack.Protected guards
  (auth)/index.tsx            welcome
  (auth)/sign-in.tsx          sign in (email or PH mobile + password)
  (auth)/mfa.tsx              second factor (authenticator code), when the account has MFA
  (auth)/register/contact.tsx step 1: email or mobile → POST /auth/otp (REGISTER)
  (auth)/register/verify.tsx  step 2: 6-digit code → POST /auth/otp/verify
  (auth)/register/details.tsx step 3: name, birth date, password, consent → POST /auth/register
  (auth)/reset-password/index.tsx  reset step 1: email or mobile → POST /auth/forgot-password
  (auth)/reset-password/new.tsx    reset step 2: code + new password → POST /auth/otp/verify, POST /auth/reset-password
  (app)/(tabs)/index.tsx      home shell (emergency notice, upcoming features)
  (app)/(tabs)/account.tsx    account summary (GET /auth/me), sign out (POST /auth/logout)
  (app)/devices.tsx           signed-in devices (GET /auth/devices, DELETE /auth/devices/{id})
```

Shared UI (`src/components/ui`) covers Screen, Button, LinkButton, TextField (with Show/Hide for passwords), Checkbox, Card, Notice, StateView (loading, empty, error), ResendCodeButton (60 s countdown between requests; the server allows 5 codes per address every 15 minutes) and OfflineBanner. Tokens come from `@mediconnect/design-system` (`docs/design-system.md`), light and dark. Fields carry labels, errors are announced, and buttons expose disabled and busy states.

## Backend dependencies and deferred items

| Item | Status |
|---|---|
| Profile editing, dependents (`/patients/me`, `/patients/me/dependents`) | Phase 2. The account screen shows the summary from `/auth/me`. |
| Password reset | Built in increment 10 (two screens). A reset signs out every device. |
| Account deletion (App Store guideline 5.1.1(v)) | No endpoint yet; Phase 2. Required before any store submission. |
| Legal document versions | Read from config (`EXPO_PUBLIC_*`); there is no public endpoint for current versions. The final documents await legal review. |
| Verify a secondary email or mobile | Needs a profile-update endpoint to add one (Phase 2). The primary contact is verified at registration. |

## EAS profiles (`eas.json`)

| Profile | Use | API URL |
|---|---|---|
| `development` | Development client, internal distribution | local |
| `preview` | Internal testers (ad hoc / TestFlight) | placeholder `*.example.invalid`, to be set when the environment exists |
| `production` | Store build, remote build numbers with `autoIncrement` | placeholder, to be set when the environment exists |

The bundle identifier `ph.mediconnect.app` is a proposal (**D-34**, pending). Apple and EAS credentials live in EAS and CI secrets, never in this repo. Nothing has been submitted to Apple. See `docs/app-store-readiness.md`.

## Known limitations

- **Simulator and device testing:** not done. The development machine has no Xcode or Android SDK. What was verified: typecheck, lint, unit and component tests, Playwright + axe, `expo export` and `expo prebuild` for iOS and Android, and the web build end to end against the local API (registration, sign-in, password reset).
- **pnpm build scripts:** `@parcel/watcher` is explicitly denied in `pnpm-workspace.yaml` (`allowBuilds`). It ships prebuilt binaries; without that entry a fresh install fails on pnpm 12.
- **Android permissions:** template permissions the app does not use (overlay, external storage) are blocked in `app.config.ts`. Verified with `expo prebuild` in a scratch copy.
- **Dependency audit:** two advisories in build-time tooling only (`picomatch` via Metro and codegen, no patch yet; `minimatch` via `@expo/fingerprint`). Not shipped in the app; see `docs/security.md`.
- **expo-doctor:** reports five Expo packages a patch or minor version behind. Newer versions are held back by the 7-day release-age policy; update with `npx expo install --check` once they qualify.
- **ESLint:** pinned to 9, because `eslint-plugin-react` (from `eslint-config-expo`) breaks on ESLint 10.
- **Error reporting:** no mobile Sentry SDK yet (planned, with the same scrubbing rules as the backend).
- **Icons and splash:** tab icons are text glyphs, and the icon and splash are Expo placeholders until final artwork exists.
