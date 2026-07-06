# Changelog

All notable changes to the FleetMS Driver app. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.5.0] - 2026-07-06

### Added

- **Force-update gate.** The app now checks a server-controlled version bar
  on every cold start, and again whenever it's foregrounded from the
  background, and reacts one of three ways:
  - Below the **minimum** version — a full-screen "Update required" block
    replaces the entire app, including the sign-in screen, with no way to
    dismiss it.
  - Below the **recommended** version (but at or above minimum) — a
    dismissible banner appears on the Jobs tab (it reappears every cold
    start until you actually update), and a persistent red dot stays on the
    Profile tab until you do.
  - Otherwise, or if the check itself fails (no signal, server hiccup) — the
    app fails open. It never blocks on a network problem alone.

  Both thresholds are set from the dispatcher-side super-admin console.
- **Update push notifications.** When ops raises either version bar,
  already-installed drivers who are now below it get a push notification
  (distinct wording for "recommended" vs. "required") prompting them to
  update, instead of only reaching drivers who happen to reopen the app on
  their own.

### Fixed

- **Overdue jobs no longer look identical to jobs scheduled for today.** The
  Overdue section's pickup chip is now red-tinted and shows the actual
  missed date ("Fri, 3 Jul") instead of just a bare time, and a one-line
  explainer under the section header spells out what "Overdue" means.
  Previously an overdue job (pickup already passed on a prior day, but still
  open) rendered exactly like a same-day job except for the section label,
  which a driver could easily misread as "due today."

## [0.4.0] - 2026-07-02

### Added

- **Expense review states.** Expenses you log now go to your dispatcher for review before they count as final. New rows start as **PENDING** (amber tag; still included in your "Logged this month" total) and become approved, or **REJECTED** (struck through, excluded from your total — distinct from VOIDED, which means the record was cancelled rather than declined). The receipt detail screen shows a matching banner for each state. Requires the `expense_approval` backend migration, which was applied to production before this build shipped.
- **App version reporting.** The app now sends its own version (from `expo-constants`) to the backend alongside push-token registration, so the dispatcher's driver registry can show which build each driver is running. This is how ops will spot phones still on old builds during rollouts — including this one.

### Changed

- **Release builds now auto-increment the Android versionCode** (`autoIncrement: true` in eas.json's preview profile; remote version source). Every build through v0.3.5 shipped as versionCode 1, which made in-place upgrades ambiguous. This build is versionCode 2; updating over v0.3.5 installs in place (same EAS keystore, higher versionCode). Drivers still on pre-v0.3.5 debug-keystore builds must uninstall first, as before.
- Synced `package.json` version (stuck at 0.3.3) back to the app version.

## [0.3.4] - 2026-06-05

### Added

- **Android push notifications (FCM) are now enabled.** The app was wired for push in code but could never mint a token: no Firebase/FCM config was compiled into the build, so `getExpoPushTokenAsync()` threw on every Android launch and no driver ever registered a token. This build bakes `google-services.json` in (via the `expo-notifications` plugin + `android.googleServicesFile`), and the FCM V1 service-account key is registered with Expo's push service, so tokens mint on launch and dispatch changes can be delivered as real push notifications. **Drivers must uninstall the previous build and reinstall** — the signing identity changes from the local debug keystore to the EAS keystore, and they will re-enter their PIN.

### Fixed

- **Overdue jobs no longer disappear from the Jobs tab.** The list only fetched jobs with a pickup time from today's local midnight onward, so any job a driver hadn't completed by midnight silently dropped off and could never be marked done. The query now also returns still-open jobs (pending / confirmed / in-progress) whose pickup is in the past, within the last 30 days, and shows them in a new **"Overdue"** section at the top of the tab.

### Changed

- **Build config now uses a dynamic `app.config.js` layer** so EAS Build can inject the gitignored `google-services.json` through the `GOOGLE_SERVICES_JSON` file environment variable (a static `app.json` can't read env vars). `app.json` stays the source of truth; the dynamic layer only overrides the google-services file path, falling back to the local file for on-device builds.

## [0.3.3] - 2026-05-22

### Fixed

- **Blank screen on the Today/Jobs tab after sign-in.** On v0.3.2+1 the originally-reported Mark-as-Done crash was confirmed fixed (no more `IllegalStateException` at `SurfaceMountingManager.addViewAt` in logcat) — but a *different* failure surfaced: the JobsToday screen rendered blank, with a JS-level error caught by the React error boundary. Root cause in `lib/realtime/jobsRealtime.ts`: `supabase.channel('driver-jobs-${driverId}')` returns the existing cached channel when one with the same topic is still subscribed, and a fast mount → unmount → remount sequence under RN Fabric + concurrent rendering left the prior channel in place. The next `.on('postgres_changes', ...)` call then hit Supabase's hard rule "cannot add callbacks after `subscribe()`" and threw. Added a defensive sweep of `supabase.getChannels()` before re-subscribing; idempotent, ~5 lines.

### Changed

- **Sentry cold-start heartbeat + manual background flush.** Despite v0.3.2's release-tag fix, no sessions or events from v0.3.2+1 ever reached the cloud — the native SDK initialized cleanly (verified via `RNSentry: Starting with DSN ...` in logcat with all integrations registered) but neither the `AppLifecycleIntegration`'s auto-flush on background nor an actual JS error reaching `Sentry.TouchEventBoundary` produced a single event in the dashboard. Two mitigations added:
  - **One-shot `Sentry.captureMessage('app_started vX')` on cold start** — gives every cold start a definitive "SDK → cloud is reachable" event. Negligible quota cost (one event per cold start; <1k/month at full driver rollout). Doubles as the session anchor since some Sentry SDK builds drop sessions that never see an in-flight event.
  - **Explicit `Sentry.flush(2000)` on `AppState change → background/inactive`** — belt-and-suspenders for the broken AppLifecycleIntegration flush path. Cheap, no-op when the envelope queue is empty.
- Suspect root cause for the broken auto-flush: Sentry RN SDK 7.2 + Expo SDK 54 + React Native New Architecture + React Compiler experimental flag — at least one of those is interfering with the native side's session lifecycle hooks. Tracked as a follow-up rather than rolled back, since the workarounds above restore visibility and the symptoms haven't been root-caused.

## [0.3.2] - 2026-05-22

### Fixed

- **Sentry was reporting no sessions and tagging all events as `release=NONE`.** Investigated after the v0.3.1 Mark-as-Done fix appeared to land but the user reported the app "still crashes." Sentry showed zero runtime sessions in the last 14 days across all three registered releases (v0.1.0+1, v0.3.0+1, v0.3.1+1), and both captured crash events had `release=NONE` even though the EAS build-time source-map upload had registered the releases correctly. Sentry aggregates sessions by release; with no release tag, every session was silently dropped. Net effect: we've been flying blind on the driver app since launch — the only reason FLEETMS-DRIVER-1 surfaced at all was the native Android Sentry SDK catching the unhandled Java exception. The `@sentry/react-native/expo` plugin is supposed to inject release into native build artifacts and have the runtime SDK auto-fill it, but that path isn't working under Sentry RN v7.2 + New Architecture + React Compiler. Set `release`, `dist`, `environment`, and explicit `enableAutoSessionTracking: true` in the `Sentry.init` call in `_layout.tsx`, reading the app version from `expo-constants` (already installed) so it stays in sync with `app.json`. Build number hardcoded to `1` until EAS auto-increment moves past it. Source maps still upload via the plugin; this just stops the runtime SDK from depending on the broken native-injection path.

### Changed

- **Synced `package.json` version to `app.json`.** `package.json` had been stuck at `0.2.3` since before the v0.3.0 cut — harmless drift but noise when grepping for the current version. Both files now read `0.3.2`.

## [0.3.1] - 2026-05-21

### Fixed

- **Mark-as-Done app crash (FLEETMS-DRIVER-1).** Tapping Mark as Done on an active job crashed the app on Android with `IllegalStateException: The specified child already has a parent` at `SurfaceMountingManager.addViewAt`. Same Fabric view-tree race that hit the sign-in + set-PIN flows last week — `router.replace('/(tabs)')` was firing on the same frame as the mutation's tree updates. Wrapped the navigation in `setTimeout(_, 0)` to defer it one frame, matching the workaround already in place at `sign-in.tsx` and `set-pin.tsx`.

### Security

- **Single-active-device policy.** After a successful PIN sign-in the client now calls `supabase.auth.signOut({ scope: 'others' })`, revoking every refresh token for the driver except the one just created. A driver can only be signed in on one phone at a time — signing in on a new phone kicks the previous one off within ~1h (access-token lifetime; refresh fails immediately). Prevents account sharing (driver A using driver B's phone) and limits the blast radius when a phone is lost. Mirrors the same change shipped on the dispatcher side as v0.11.5.0. Same enforcement also applied to the dev silent auto-sign-in so developer testing across phones stays consistent.

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
