# TODOS

Open work for the FleetMS Driver app, grouped by area then priority
(P0 highest). Completed items move to the bottom.

## Release

### Verify v0.7.0 on a real device before cutting an APK
**Priority:** P0
Nothing in v0.7.0 was exercised in the running app — sign-in is phone + PIN
against production and `EXPO_PUBLIC_DEV_DRIVER_PASSWORD` is blank, so the only
visual checks were token-accurate HTML mocks. Highest-risk surface is **Active
Job**, whose pay section (included services + commission rate) is brand new.
Also confirm the last card isn't clipped by the sticky CTA: `AppFrame` uses
`bottomInset={120}` while the CTA measures roughly 127px.

### Bump `APP_BUILD` when cutting the next release
**Priority:** P1
`APP_BUILD` in `app/_layout.tsx` is hand-synced and must match the EAS
versionCode, which `autoIncrement` bumps on every build. It reads `'2'` while
v0.6.0 shipped as versionCode 4, so the Sentry `dist` tag is already wrong.
Superseded by the `expo-application` item below.

### Replace hardcoded `APP_BUILD` with `expo-application`
**Priority:** P2
Use `nativeBuildVersion` instead of hand-syncing a string constant. Removes the
whole class of drift above.

## Testing

### Cover the React Query data hooks
**Priority:** P1
`lib/queries/` and `lib/mutations/` have no tests — needs a Supabase mock and a
QueryClient wrapper. Highest value: `earnings.ts` (org-rate fetch plus its
failure degradation) and `jobDetail.ts` (the `job_number` lookup whose
`.single()` threw PGRST116 in the bug fixed in v0.7.0).

### Cover the remaining screens
**Priority:** P2
Only `app/(tabs)/earnings.tsx` has screen tests. Job Detail and Active Job
compose the pay section but nothing asserts they render it. See `TESTING.md`
for the mocks already wired (AsyncStorage, safe-area, expo-haptics, Sentry).

### Add a visual/design review pass
**Priority:** P3
v0.7.0 changed the commission badge's colour and every clock in the app without
a real visual audit. Worth a `/design-review` run once it's on a device.

## Push notifications

### Finish the push rollout
**Priority:** P1
Code has been correct since v0.3.5; the blocker is operational — drivers must
install a current build before `drivers.expo_push_token` goes non-NULL.

### Surface push-registration failures to Sentry
**Priority:** P2
`ensurePushNotifications` swallows `{kind:'error'|'denied'}` into
`globalThis.__FLEETMS_PUSH__`. This is why FCM being unconfigured went unnoticed
for about two weeks.

## Housekeeping

### Fix the pre-existing lint errors
**Priority:** P3
`npx expo lint` reports 15 problems (8 errors, 7 warnings), all predating
v0.7.0: unescaped apostrophes in JSX across five files, an unused `Linking`
import in `app/jobs/[id].tsx`, an unused `View` in `components/Card.tsx`. CI
currently runs typecheck and tests but not lint — worth adding once these are
clean, otherwise the workflow goes red on arrival.

### Clean up the stale v0.3.4 GitHub release notes
**Priority:** P4
They claim push works and no uninstall is needed. Both were untrue at the time.

## Completed

### Fix Earnings row navigation (uuid vs job_number)
**Completed:** v0.7.0 (2026-07-31)

### Remove the by-uuid job hook that recreated the navigation trap
**Completed:** v0.7.0 (2026-08-01) — `useJobDetail(jobUuid)` had zero callers and
sat beside a by-job_number hook; the dead `['job']` invalidation went with it.

### Invalidate Earnings after a job changes
**Completed:** v0.7.0 (2026-08-01) — added `['driver-earnings']` to all four job
mutations and the realtime assignments handler.

### Fix the expenses date/month boundary bugs
**Completed:** v0.7.0 (2026-08-01) — expense_date was stored from the UTC day, and
the monthly range started a day early. Both now go through `myDateKey` /
`myMonthStartKey`.

### Pin clock formatting to Malaysian time
**Completed:** v0.7.0 (2026-08-01) — was reading the device zone, which no other
FleetMS surface did.

### Make pay surfaces consistent across Job Detail, Active Job, and Earnings
**Completed:** v0.7.0 (2026-07-31)

### Bootstrap a test framework
**Completed:** v0.7.0 (2026-07-31) — jest + jest-expo + RNTL, 47 tests, CI workflow.
