# Changelog

All notable changes to the FleetMS Driver app. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] - 2026-05-21

First external-cohort release. The version-tag jump marks the line between "scaffold + Steven dogfooding" and "real drivers installing this off a download link." No new features over 0.2.3 — this is purely about cutting a build that goes on Continental drivers' phones.

### Operational

- Tagged for distribution via EAS `preview` profile (signed APK, internal distribution). Bundle id `my.fleetms.driver` is the keystore identity going forward — preserving the EAS-managed keystore is what lets future builds install over this one without uninstall.

## [0.2.3] - 2026-05-21

### Changed

- **Sign-in + set-PIN footer.** Removed the hardcoded "Continental Limo Services" tag — drivers from any tenant see this screen before signing in, so we couldn't truthfully name a specific operator. The version now comes from `expo-constants` (pulled from `app.json`) instead of being hardcoded, so it'll stay accurate across releases.
- **Job time formatting.** `timeOf` in the Jobs query now formats as `9:00 AM` / `2:00 PM` instead of `09:00` / `14:00`. Same data, friendlier glance for drivers who don't want to do 24h math.

## [0.2.2] - 2026-05-21

### Fixed

- **Sign-in spinner stuck after wrong PIN.** The lockout RPC call introduced in 0.2.1 was hanging indefinitely after a failed `signInWithPassword` — supabase-js gets into an auth-resolution holding state where subsequent RPC calls can stall. Wrapped the call in a 2-second Promise.race timeout so the UI clears even if the response never comes back. Server-side counter still bumps; we just stop waiting on the response.

## [0.2.1] - 2026-05-21

### Security

- **PIN lockout enforcement.** On `invalid_credentials`, the client now calls the new `note_failed_signin` RPC which bumps the server-side failure counter and sets a 15-minute lockout at 5 failures. Sign-in surfaces a `'locked'` reason with a countdown message so the user knows when to retry instead of guessing again. Pairs with the dispatcher repo's lockout migration (v0.11.0.0).

## [0.2.0] - 2026-05-21

The first meaningful release after the scaffold. Drivers can now sign in for real, manage their schedule, see real jobs + earnings, and the dispatcher's changes show up live.

### Added
- **PIN sign-in** (replaces WhatsApp OTP plan). Drivers sign in with phone + 6-digit PIN over Supabase Auth. Dispatcher provisions a temporary PIN that expires in 7 days; driver sets their own PIN on first use. No SMS provider needed.
- **Profile screen** wired to real data: name, phone, license class, organisation, assigned vehicle, availability badge driven by `drivers.availability`. Sign Out actually clears the Supabase session.
- **Time Off** request flow: inline calendar (`react-native-calendars`), reason picker (Leave / MC / Off duty), notes, day-count. Requests go in as `pending`, dispatcher approves/rejects. Driver can withdraw pending requests.
- **Notifications inbox**: bell button on Jobs tab opens `/notifications`. Lists recent push events from `push_log`; unread items get a red dot. Opening the inbox marks visible items read. Deep-links route into the relevant job.
- **Earnings** wired to real data, commission-led. Headline = sum of `commission_amount`; fare total shown as secondary context. Period filter (This Week / This Month / All Time). Rows tappable into the job detail.
- **Realtime updates** via Supabase Realtime: subscriptions to `assignments` + `push_log` (driver-scoped) invalidate the Jobs and Notifications queries automatically when dispatcher changes something. No pull-to-refresh needed.
- **Upcoming section** on Jobs tab: today / tomorrow / per-day groups for the next 14 days.
- **Passenger card** on job detail + active screens: shows passenger name + tap-to-call phone (for corporate / platform-client jobs where booker isn't rider). Falls back to client name otherwise.
- **Waze and Maps deep-links** on each route stop — open the respective app at the stop's coords (or by text search when no coords).
- **Special instructions card** — amber callout below the client card, 2-line truncation with tap-to-expand when text overflows.
- **Sentry** crash + error tracking. Native + JS errors land at sentry.io with full stack traces, breadcrumbs, and the user's release tag.
- **EAS Build** config (`eas.json`) with an internal-distribution APK preview profile.

### Changed
- **Job card redesign**: prominent PICKUP time block on the left, client name as the headline, secondary line shows pax · vehicle plate · job number. In-progress cards get a subtle breathing animation (pulsing dot + accent stripe) so they stand out.
- **Logo** updated to the canonical fleetms.my mark (dark slate background, purple accent chevron) — matches the dispatcher's brand exactly.
- **Vehicle line** on job cards shows the actual assigned plate (`WXY 1234`), not the requested vehicle type.
- **Jobs greeting** uses driver's real first name and adapts to time of day (Good morning / afternoon / evening).
- **Session gate** distinguishes transient query errors from genuine "no driver row" — transient errors show a retry screen instead of booting the user out.
- **Unknown `job_status` enum values** now render as neutral "Voided" pills and log to Sentry instead of silently masquerading as Confirmed.
- **Notification deep-links** validated against an allowlist before pushing.
- **`tel:` deep-link** strictly sanitises the phone (digits + `+` only, regex shape-check) before opening the dialer.
- **Driver synthetic email** strips multiple leading zeros (defensive against `00...` inputs).

### Fixed
- Recovered from the React Native Fabric "child already has parent" crash on `/sign-in → /set-pin` and `/set-pin → /(tabs)` transitions. Routes now go through the session gate (`/`) with `animation: 'none'` on the auth stack screens.
- PostgREST PGRST201 ambiguity on the `jobs ↔ job_stops`, `jobs ↔ assignments`, `assignments ↔ vehicles`, `drivers ↔ vehicles`, and `expenses ↔ vehicles` composite-FK joins — every embed now names the specific constraint.
- `expo-file-system` v54 `readAsStringAsync` deprecation broke expense save — switched to the `expo-file-system/legacy` submodule.
- `SectionLabel` right slot (e.g. "+ Request Time Off") no longer misaligns with the section label — alignment changed from `baseline` to `center` since the right slot contains non-text icons.
- Bell button on Jobs tab no longer renders as a clashing tile against the page background — icon-only treatment.

### Removed
- `data/mock.ts` driver constant references in screens. All driver identity now comes from `useDriverProfile()`.

### Known follow-ups (not blocking)
- No tests in the driver app. Pure helpers (synthetic email, PIN validation, date math, status mappers) are the priority surface to cover.
- Per-account PIN lockout (`failed_pin_attempts` + `pin_locked_until` on `drivers`) — currently relying on Supabase's IP-based rate limit.
- Force-sign-out on driver revoke — fired drivers retain ~1h of session validity until the access token expires. Belongs on the dispatcher side.
- GPS tracking (background, in-progress jobs only) is planned and deferred — see `fleetms/docs/driver-gps.md`.
