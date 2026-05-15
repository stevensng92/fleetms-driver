# FleetMS Driver

Mobile companion app for drivers in the FleetMS fleet management system. Built
with Expo + Expo Router; ships to both iOS and Android from one codebase.

Pairs with the dispatcher web app at [`C:/github/fleetms`](../fleetms) — same
Postgres/Supabase backend, scoped to a driver's own data via the existing
`private.is_driver_self()` RLS helper.

## Status

Scaffold + first real slice. 12 screens implemented against the approved
design system (navy primary, cyan accent, cream/dark surfaces, Inter, 6px
radius). **Today's Jobs reads real Supabase data** scoped to a logged-in
driver via the existing `is_driver_self()` RLS helper. Auth is bypassed
on boot via a hidden dev-session sign-in (see `.env`); the on-screen sign-in
flow is still UI-only.

| Screen                | Route                       | Source           | Wired? |
|-----------------------|-----------------------------|------------------|--------|
| 01 Sign In            | `/sign-in`                  | mock             | UI     |
| 02 Today's Jobs       | `/(tabs)`                   | **Supabase**     | **real** |
| 02b Today (empty)     | `/(tabs)` (flip `EMPTY`)    | n/a              | UI     |
| 03 Job Detail         | `/jobs/[id]`                | `data/mock.ts`   | UI     |
| 04 Active Job         | `/jobs/active`              | `data/mock.ts`   | UI     |
| 05 Expenses           | `/(tabs)/expenses`          | `data/mock.ts`   | UI     |
| 05b Expenses (empty)  | flip `EMPTY` in file        | n/a              | UI     |
| 06 Log Expense        | `/expenses/log` (modal)     | mock             | UI     |
| 07 Earnings           | `/(tabs)/earnings`          | `data/mock.ts`   | UI     |
| 08 Profile            | `/(tabs)/profile`           | `data/mock.ts`   | UI     |
| 08b Request Time Off  | `/profile/time-off` (modal) | mock             | UI     |
| 09 Receipt Viewer     | `/expenses/[id]`            | mock             | UI     |

## Run

```bash
cd C:/github/fleetms-driver
npm install
cp .env.example .env   # then fill in the values — see "Configure" below
npx expo start
```

### Configure

`.env` needs four values:

- `EXPO_PUBLIC_SUPABASE_URL` — your FleetMS Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — anon key for that project (safe to bundle;
  RLS gates access).
- `EXPO_PUBLIC_DEV_DRIVER_EMAIL` / `EXPO_PUBLIC_DEV_DRIVER_PASSWORD` —
  credentials for a driver `auth.users` row that's already linked to a
  `drivers.user_id`. The app silently signs in as this user on cold start.

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
  _layout.tsx              root stack, ThemeProvider, gesture/safe-area
  index.tsx                redirect to /(tabs) (skips sign-in for scaffold)
  sign-in.tsx              S1
  (tabs)/                  bottom-tab group
    _layout.tsx            tab bar (Jobs / Expenses / Earnings / Profile)
    index.tsx              S2 / S2b — Today's Jobs
    expenses.tsx           S5 / S5b — Expenses
    earnings.tsx           S7
    profile.tsx            S8 + theme/accent controls
  jobs/
    [id].tsx               S3 — Job Detail
    active.tsx             S4 — Active Job (in progress)
  expenses/
    [id].tsx               S9 — Receipt Viewer
    log.tsx                S6 — Log Expense (modal sheet)
  profile/
    time-off.tsx           S8b — Request Time Off (modal sheet)

components/                shared UI building blocks (ported from design handoff)
theme/                     design tokens + ThemeProvider
data/                      static fixtures shaped like real Supabase queries
lib/                       Supabase client scaffold (not yet installed)
```

## Theming

`ThemeProvider` exposes `useTokens()` for colour values and `useThemeControls()`
for the user-facing toggles. The Profile screen lets you flip:

- **Theme** — `system` (default), `light`, `dark`. Persisted to AsyncStorage.
- **Primary accent** — `navy`, `cyan`, `amber`, `violet`. Also persisted.

Cyan accent (for the in-progress timeline state) and the functional status
colours are fixed regardless of accent.

## Wiring real data

This scaffold is intentionally backendless. To plug into the live FleetMS
Supabase project:

1. `npm install @supabase/supabase-js`
2. Create `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon>
   ```
3. Flesh out `lib/supabase.ts` with `createClient(...)`.
4. Replace the fixtures in `data/mock.ts` with real DAL calls. The header
   comment in that file lists the Postgres query for each screen.
5. Add OTP login on `/sign-in` (`supabase.auth.signInWithOtp({ phone })` plus
   a verify screen). The dispatcher repo's
   `supabase/migrations/20260502083020_link_drivers_to_users.sql` already
   links a `drivers` row to `auth.uid()` and exposes `is_driver_self()` for
   RLS — your queries should just work once authenticated.

## Design provenance

Ported from the Claude Design handoff bundle (`fleetms` artifact id
`80nBFT1dkHx71Nyl7OkeCQ`). The original prototype lives in
`../fleetms/.design-handoff/`. Tokens, screen structure, and copy come from
that bundle; the implementation is React Native, not raw HTML.
