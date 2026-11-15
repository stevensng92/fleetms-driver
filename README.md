# FleetMS Driver

Mobile companion app for drivers in the FleetMS fleet management system. Built
with Expo + Expo Router; ships to both iOS and Android from one codebase.

Pairs with the dispatcher web app at [`C:/github/fleetms`](../fleetms) — same
Postgres/Supabase backend, scoped to a driver's own data via the existing
`private.is_driver_self()` RLS helper.

## Status

All screens are wired to real Supabase data, scoped to the signed-in driver
via the `private.is_driver_self()` RLS helper. Sign-in is **phone + 6-digit
PIN** (live since dispatcher-side v0.11.0 — see
`../fleetms/docs/driver-pin-auth.md`), not a mock or a dev bypass; a driver
sets their own PIN on first sign-in after the dispatcher provisions them.
`lib/devSession.ts` still exists as a local-dev convenience (silent
sign-in via `.env` credentials, used only when no session exists yet) but
is not the primary auth path anymore. Since v0.5.0 the app also enforces a
server-controlled minimum/recommended version gate on every cold start
(`useAppVersionGate`, `lib/semver.ts`) — set from the dispatcher-side
super-admin console.

Since v0.6.0 the app also reports its own build on every cold start
independently of push registration (`lib/version.ts` →
`report_driver_app_version`), so a driver who declined the notification
permission still shows their version in the dispatcher's Drivers panel. It also
surfaces dispatcher-attached surcharges as **Included services**, and labels a
job whose commission rate differs from the org default
(`lib/commissionRate.ts` — a value comparison, so an override pinned to the
default rate is correctly treated as standard). Both read through RLS the
dispatcher side already grants; no driver-specific backend exists for them
beyond the `job_surcharges` assigned-driver policy.

Since v0.7.0 those two pay surfaces are consistent everywhere they appear.
Included services and the commission rate now also render on **Active Job**
(previously the one screen that showed neither, despite being where a driver
sits mid-trip), and the commission rate reaches **Earnings** rows. The rate
renders through one shared `CommissionPill` — cyan-tinted, labelled
`20% comm` — so the same fact reads the same way on every screen;
`CommissionRateCard`, `JobAmountCard` and `SurchargesCard` hold the
detail-screen treatment shared by Job Detail and Active Job.

Since v0.8.0 the app understands the dispatcher's second pricing mode. A job
can be priced as a **flat fee** agreed at booking (`jobs.commission_fixed_amount`,
dispatcher v0.31.0.0) instead of a percentage, and the two are mutually
exclusive by DB constraint — so a fixed-fee job carries no rate override at
all. The app previously read that as "pays the standard org rate" and rendered
no badge, which meant a RM 80 flat fee on a RM 500 job looked like the org's
~20% (~RM 100). `resolveSpecialCommission` now returns a discriminated
`{kind:'rate'} | {kind:'fixed'}` rather than a bare percentage, so a fee cannot
be rendered — or multiplied — as a rate; the pill reads `RM 80 flat`, and the
detail card swaps its caption to say the fare is not what the fee comes out of.

Since v0.9.0 the app resolves **all five rungs** of the dispatcher's commission
ladder, including the per-driver defaults (`drivers.commission_fixed_amount`,
`drivers.commission_rate`) it had been blind to. The consequence is what the
badge is measured *against*: a job is compared to the **driver's** normal pay,
not the org's. A freelancer on a 75% split no longer sees "different from your
usual rate" on every job pinned to their own 75%, and one whose personal default
is a flat fee now sees `RM 120 flat` on jobs that carry no job-level pricing —
previously the app read "no override" as "pays the org rate" and showed nothing.
Both baselines are read in one round-trip by `fetchCommissionBaseline()`
(`lib/queries/driverProfile.ts`), shared by all three read paths so a rate can't
be the driver's on one screen and the org's on another. The asymmetry to keep in
mind when editing `lib/commissionRate.ts`: a **fee always surfaces** (the mode
is what's being disclosed, and it's unusual against the fare every time), while
a **rate surfaces only when it differs** from the baseline — or when the
baseline is a fee, since a percentage job for a driver paid per run is genuinely
different.

v0.8.0 also lets drivers open **any previous month** on Earnings, and in doing
so fixes the basis those totals are computed on. Periods now bucket by MY-local
**pickup date**, matching `create_driver_payout`; they previously bucketed by
`assignments.completed_at`, which disagreed on any job closed on a different day
than it ran. On prod that was 37 of 671 completed jobs landing in a different
month — one driver's July would have read RM 3,346.90 against a RM 2,353.00
payslip. The period model and its boundary arithmetic live in
`lib/earningsPeriod.ts`, deliberately outside the query module so they are
testable without a Supabase client.

v0.10.0 reshaped how that history is reached, after the v0.8.0 version failed
its first contact with a real driver. That version put a chip per past month in
a horizontally-scrolling strip with `showsHorizontalScrollIndicator={false}`, so
the older months sat off-screen with no cue — and the first person to use it
concluded the app only went back one month. The axes are now separate: the
segmented control picks the **mode** (`Week | Month | All Time`) and the summary
card itself **pages backwards**, with chevrons and dots making the gesture
discoverable at rest. Periods are bounded by real history and capped at
`MAX_PERIODS` (3), so there are never dots promising data that doesn't exist.

Two consequences worth knowing. Weeks became **calendar weeks, Monday-start** —
a rolling last-7-days window cannot be paged, because adjacent pages overlap and
would double-count a job. And the literal `'week'`/`'month'` period values are
gone: every period is now named absolutely (`m:2026-07`, `w:2026-08-03`) so an
app left open across midnight cannot silently re-point a query at a different
range than the one on the label.

The contact number on Job Detail and Active Job resolves through a chain rather
than a single column. It had read `jobs.passenger_phone` alone, which dispatchers
fill in rarely, so most jobs offered no way to reach anyone while a number sat
on the billing client all along. Drivers cannot read
`clients` at all (`private.is_member_of()` excludes the driver role, silently —
zero rows, no error), so the fallback comes through the SECURITY DEFINER RPC
`driver_job_client_phone`, which returns that one column to a caller who is all
three of: holder of the job's current assignment, an **active** driver, and in
the job's own org. All three are enforced server-side; none of them is a
client-side check this app could be modified to skip.
`lib/jobContact.ts` picks passenger-then-client and
reports which it used, so the card can name the client when the number does not
belong to the passenger printed above it. The RPC failing degrades to the
passenger number alone rather than failing the screen. Dispatcher-side
counterpart: `../fleetms/app/lib/job-contact.ts`, documented in
`../fleetms/docs/clients.md`.

Clock times render as 24-hour digits with the am/pm marker kept behind them
(`09:00 am`, `14:30 pm`) via `lib/timeFormat.ts`. The marker is redundant
after noon by strict notation; it is retained deliberately, so don't
"simplify" it away.

| Screen           | Route                        | Wired? |
|-------------------|-------------------------------|--------|
| Sign In           | `/sign-in`                    | real (PIN) |
| Set PIN           | `/set-pin`                    | real |
| Today's Jobs      | `/(tabs)`                     | real |
| Job Detail        | `/jobs/[id]`                  | real |
| Active Job        | `/jobs/active`                | real |
| Expenses          | `/(tabs)/expenses`            | real |
| Log Expense       | `/expenses/log` (modal)       | real |
| Receipt Viewer    | `/expenses/[id]`              | real |
| Earnings          | `/(tabs)/earnings`            | real |
| Profile           | `/(tabs)/profile`             | real |
| Request Time Off  | `/profile/time-off` (modal)   | real |
| Notifications     | `/notifications`              | real |

`data/mock.ts` still exists in the repo but nothing under `app/` reads from
it anymore — safe to treat as legacy fixtures, not current wiring.

## Run

```bash
cd C:/github/fleetms-driver
npm install
cp .env.example .env   # then fill in the values — see "Configure" below
npx expo start
```

Tests (jest + `jest-expo` + React Native Testing Library):

```bash
npm test
```

`TESTING.md` has the full guide, including the sharp edges — `render()` is async
in RNTL v14, and screen tests must live in `__tests__/screens/` rather than under
`app/`, where expo-router would register them as routes. CI runs typecheck plus
the suite on every push and PR (`.github/workflows/test.yml`).

### Configure

`.env` needs four values:

- `EXPO_PUBLIC_SUPABASE_URL` — your FleetMS Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — anon key for that project (safe to bundle;
  RLS gates access).
- `EXPO_PUBLIC_DEV_DRIVER_EMAIL` / `EXPO_PUBLIC_DEV_DRIVER_PASSWORD` —
  **optional** dev shortcut: credentials for a driver `auth.users` row
  that's already linked to a `drivers.user_id`. If set, the app silently
  signs in as this user on cold start when no session exists, skipping
  `/sign-in`. Leave unset to exercise the real phone + PIN flow like a
  driver would.

To create a test driver against your existing project, run something like
this in the dispatcher repo's Supabase Studio (or via psql):

```sql
-- 1. Create the auth user (Supabase Auth UI is easier here).
-- 2. Link the auth user to an existing drivers row:
UPDATE public.drivers
SET user_id = '<auth-uid>'
WHERE id = '<existing-driver-uuid>';
```

Once `.env` is filled in and `npx expo start` is running, the Jobs tab will
hit the real Supabase project and you'll see your actual Continental jobs
for today/tomorrow.

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR with
the Expo Go app on a real device.

Expo SDK 54 · React Native 0.81 · React 19 · Expo Router 6 · New Architecture
enabled.

## Project layout

```
app/                       file-based routes (expo-router)
  _layout.tsx              root stack, ThemeProvider, gesture/safe-area, force-update gate
  index.tsx                session gate — routes to /sign-in, /set-pin, or /(tabs)
  sign-in.tsx              phone + PIN sign-in
  set-pin.tsx              first-time PIN setup
  notifications.tsx        notification inbox (bell icon on Jobs tab)
  (tabs)/                  bottom-tab group
    _layout.tsx            tab bar (Jobs / Expenses / Earnings / Profile)
    index.tsx               Today's Jobs
    expenses.tsx             Expenses
    earnings.tsx             Earnings
    profile.tsx              Profile + theme/accent controls
  jobs/
    [id].tsx               Job Detail
    active.tsx             Active Job (in progress)
  expenses/
    [id].tsx               Receipt Viewer
    log.tsx                Log Expense (modal sheet)
  profile/
    time-off.tsx           Request Time Off (modal sheet)

components/                shared UI building blocks (ported from design handoff)
test/                      jest setup — globalSetup.js (TZ pin) + setup.ts (mocks)
__tests__/screens/         screen tests (kept OUT of app/ — see TESTING.md)
theme/                     design tokens + ThemeProvider
data/mock.ts               legacy fixtures — unused by app/ now, kept for reference
lib/
  supabase.ts              Supabase client
  auth.ts                  PIN sign-in / sign-out / profile fetch
  devSession.ts            local-dev-only silent sign-in fallback
  semver.ts                force-update version comparator
  commissionRate.ts        the dispatcher's 5-rung commission ladder — what a
                           job pays, whether that differs from the driver's own
                           normal pay, + "20%" / "RM 80" formatting
  earningsPeriod.ts        Earnings period model + the instant range each covers
  timeFormat.ts            clock formatting (24h digits + am/pm marker)
  push.ts                  push-token registration
  queryClient.ts           React Query client
  queries/, mutations/     per-screen data-access layer (React Query hooks).
                           queries/driverProfile.ts also exports
                           fetchCommissionBaseline() — the driver's normal pay
                           (ladder rungs 3-5), shared by the three pay surfaces
  realtime/                Supabase Realtime subscriptions (Jobs tab)
```

## Theming

`ThemeProvider` exposes `useTokens()` for colour values and `useThemeControls()`
for the user-facing toggles. The Profile screen lets you flip:

- **Theme** — `system` (default), `light`, `dark`. Persisted to AsyncStorage.
- **Primary accent** — `navy`, `cyan`, `amber`, `violet`. Also persisted.

Cyan accent (for the in-progress timeline state) and the functional status
colours are fixed regardless of accent.

## Data layer

Every screen reads/writes through a React Query hook in `lib/queries/` or
`lib/mutations/`, one file per screen concern (jobs, expenses, earnings,
timeOff, notifications, driverProfile, vehicles, appVersionConfig). Each
hook calls Supabase directly — RLS via `private.is_driver_self()` does the
per-driver scoping, so there's no separate authorization layer in the app.
`lib/realtime/jobsRealtime.ts` subscribes the Jobs tab to live updates.

Auth is phone + PIN against `supabase.auth.signInWithPassword` using a
synthetic email derived from the phone — see
`../fleetms/docs/driver-pin-auth.md` for the full design (schema, RPCs,
lockout policy).

## Design provenance

Ported from the Claude Design handoff bundle (`fleetms` artifact id
`80nBFT1dkHx71Nyl7OkeCQ`). The original prototype lives in
`../fleetms/.design-handoff/`. Tokens, screen structure, and copy come from
that bundle; the implementation is React Native, not raw HTML.
