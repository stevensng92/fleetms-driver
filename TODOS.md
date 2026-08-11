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

Since v0.9.0 this check also needs a **fee-default driver** (one with
`drivers.commission_fixed_amount` set): the pill now renders on *every* one of
their jobs rather than occasionally, which is correct but is a density change
no test can judge. Check the Jobs list doesn't read as noise, and that
`CommissionRateCard`'s "Your fee for this job" caption still reads right when
the fee came from the driver's default rather than from the job.

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

### Stop jest collecting `.claude/worktrees/` as source
**Completed:** 2026-08-10 — every Conductor worktree is a whole duplicate
checkout, and jest was collecting all of them. With two stale worktrees present,
`npm test` reported **591 tests / 26 suites** against a tree that actually has
**225 / 9** — the same suites counted three times. Worse than an inflated
number, it is a *false* green: a worktree pinned to an older commit passes its
own outdated copy of a test the main tree has since changed, and the summary
line cannot tell you which copy answered.

Fixed with `testPathIgnorePatterns` (which also has to restate `/node_modules/`
— setting it REPLACES jest's default rather than extending it) plus
`modulePathIgnorePatterns`, because ignoring the test files still leaves
jest-haste-map crawling each worktree's `package.json` for the module map.
Scoped to `.claude/worktrees/` rather than all of `.claude/`, matching the call
the dispatcher repo made for ESLint in v0.27.3.2 — it hit this exact defect one
tool over (2130 phantom lint errors, all from worktrees) and the reasoning
transfers unchanged.

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

### Bump APP_BUILD for the v0.7.0 release
**Completed:** v0.7.0 (2026-08-01) — remote versionCode read as 4 via
`eas build:version:get`, so `APP_BUILD` set to `'5'` to match what
`autoIncrement` produces at build time. Still hand-synced; see the
`expo-application` item to remove the class.
