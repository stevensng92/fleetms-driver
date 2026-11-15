# Demo data (web preview only)

A fake Supabase client so the app's real screens can be shown on invented data
without signing in to the live database. It exists to put today's screens next
to a redesign mock: the data tells the same story as the mock (driver Azman,
Continental Travel, a Toyota Alphard, jobs JOB-124, JOB-132 and JOB-137 to
JOB-144).

- Off by default. Nothing changes in builds, EAS, or normal `expo start`.
- Web only. `metro.config.js` swaps `lib/supabase.ts` for `demo/fakeSupabase.ts`
  only when `EXPO_PUBLIC_DEMO_DATA=1` and the platform is web. No file under
  `app/`, `lib/` or `components/` knows about it.
- Never set the flag in `eas.json`, `app.json` or `.env`.
- Everything in here is made up. The repo is public: keep it that way.

## Run

From the `P:` path (never `C:/github`, Metro breaks from the junction):

```bash
EXPO_PUBLIC_DEMO_DATA=1 npx expo start --port 8091
```

Then open http://localhost:8091. Add `--clear` the first time you switch the flag
on or off, so Metro drops its cached resolution of `lib/supabase.ts`.

The session gate lands in the tabs (driver signed in, PIN set).

## Dates

The mock's "today" (12 Dec 2026) maps to the real today in Malaysia time, so the
overdue, today, tomorrow and upcoming jobs always fall in the right groups.

## Version gate

Default is "ok". Add a query string to the page URL to see the other states:

- `/?version=required` shows the hard update screen
- `/?version=recommended` shows the soft nag

## Flows that work

Confirm, reject, start and complete a job, log an expense, request and cancel
time off, and mark notifications read all update the in-memory data, so the
screens change. Reload the page to reset everything.

## Tests

`demo/__tests__/fakeSupabase.test.ts`. Run it with `npx jest demo`, from the main
checkout or from inside a worktree. The Jest config only skips worktree copies
under the project's own root, so no flag overrides are needed.
