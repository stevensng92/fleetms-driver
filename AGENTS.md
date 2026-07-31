# FleetMS Driver — agent rules

This repo is **PUBLIC on purpose** — GitHub Releases APK downloads require
anonymous access, and drivers install from those links. Treat everything here
as world-readable: never commit `google-services.json`, `.env*`, keystores
(`*.jks` / `*.key` / `*.p8` / `*.p12`), or the FCM service-account JSON (all
gitignored — keep it that way). Do not flip the repo private.

## Testing

Run with `npm test`. Full guide, including the sharp edges that will bite you
(async `render`, the AsyncStorage mock, the pinned timezone), is in
[TESTING.md](TESTING.md).

100% coverage is the goal — tests are what make fast, loose iteration safe here.

- New function → write a test for it.
- Bug fix → write a regression test that fails without the fix.
- New conditional (`if`/`else`, `switch`) → cover BOTH paths.
- New error path → write a test that triggers the error.
- Never commit code that makes existing tests fail.

Currently covered: pure helpers (`lib/timeFormat.ts`, `lib/commissionRate.ts`,
`lib/semver.ts`) and shared components. NOT covered: screens, the React Query
data hooks, realtime, auth. Adding coverage there needs Supabase mocking — worth
doing, not yet done.

## Docs upkeep

Docs drift the moment code ships without a matching doc edit, so fix it in the
SAME PR as the change — never "later". After shipping or verifying a milestone
(release, prod fix, rollout step), update both surfaces in the same session:

1. **Wiki narrative** — `C:\github\obsidian-vault\llm wiki\wiki\projects\fleetms-driver.md`
   (current state, open follow-ups, `last_updated` frontmatter). The Mission
   Control morning brief flags this stale whenever the repo has commits newer
   than the wiki file, so skipping it surfaces as a daily nag.
2. **README.md** — its Status section carries a per-screen wired/mock table and
   describes the auth flow and force-update gate. Update it whenever a screen
   moves from mock to real, auth changes, or the version-gate behaviour changes.
   The driver-facing feature docs live in the dispatcher repo
   (`../fleetms/docs/driver-pin-auth.md`, `driver-gps.md`); update those there
   when this app's side of the feature changes.
