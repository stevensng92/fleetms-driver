# FleetMS Driver — agent rules

This repo is **PUBLIC on purpose** — GitHub Releases APK downloads require
anonymous access, and drivers install from those links. Treat everything here
as world-readable: never commit `google-services.json`, `.env*`, keystores
(`*.jks` / `*.key` / `*.p8` / `*.p12`), or the FCM service-account JSON (all
gitignored — keep it that way). Do not flip the repo private.

## How a change moves through this repo

Matt Pocock's skills cover the front half (agree, specify, build test first).
gstack's `/ship` covers the back half (check, review, PR). Use them in this
order. A one-line fix can skip steps 1 and 2.

1. **Agree.** `/grill-with-docs` before any change bigger than a quick fix.
   It interviews Steven until the plan has no open branches, and records new
   terms in `GLOSSARY.md` and hard-to-reverse decisions in `docs/adr/`.
2. **Specify.** `/to-spec` writes the spec to `.scratch/<feature>/spec.md`.
   For work that needs more than one PR, `/to-tickets` splits it into tickets.
3. **Build.** `/implement` (or `/tdd` directly): the failing test first, at the
   seams the spec names, then the code. Bugs go through `/diagnosing-bugs`, with
   the regression test written before the fix. `/implement` ends with
   `/code-review` against the spec and the rules in this file.
4. **Ship.** `/ship` on the feature branch. It runs typecheck and tests,
   reviews the diff, writes the CHANGELOG entry under `## [Unreleased]`, checks
   the docs (see Docs upkeep), pushes the branch and opens the PR.
   It never merges.
5. **Merge.** Squash-merge once CI is green. Never `gh pr merge --auto` or
   `--admin`.

Every few days, or after a run of features, `/improve-codebase-architecture`
looks for modules worth deepening.

**Releasing is separate, and only when Steven asks.** Releasing means bumping
the version, building an APK, or publishing an over-the-air update. `/ship`
never bumps the version: `.gstack/ship-policy.json` sets `"bump": "never"`. A
version bump changes which installed apps can receive over-the-air updates
(the runtime version follows `appVersion`), so it belongs to the release, not
to each PR.

## Agent skills

### Issue tracker

Specs and tickets are markdown files under `.scratch/`, committed with the
code, so they are public. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, written as a `Status:` line in each ticket file. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` at the root and ADRs in `docs/adr/`, both
created when the first term or decision is settled. See `docs/agents/domain.md`.

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
`lib/semver.ts`, `lib/earningsPeriod.ts`, `lib/jobContact.ts`) and shared
components, plus the Earnings screen and `fetchClientPhone` in
`lib/queries/jobDetail.ts`. NOT covered: the other screens, the remaining React
Query data hooks, realtime, auth.

Note the shape that makes the pure helpers coverable: anything importing
`lib/supabase.ts` builds a live client at import time, so pure decisions belong
in their own module beside the query rather than inside it. `lib/earningsPeriod.ts`
was split out of `lib/queries/earnings.ts` for exactly this reason, and
`lib/jobContact.ts` out of `lib/queries/jobDetail.ts`.

**Query modules CAN be tested.** Put
`jest.mock('../../supabase', () => ({ supabase: { rpc: … } }))` at the top of the
file and importing the query never constructs a client, so the import-time
problem above disappears. Reach for this whenever a query carries real logic —
a degrade path, a retry, a mapping — rather than assuming queries are
untestable. Export the inner function for the test and say so in a comment;
going through the hook drags in a React Query provider for no gain.
Worked example: `lib/queries/__tests__/jobDetail.clientPhone.test.ts`. Note the
arrow-wrapper indirection around the mock fn — `jest.mock` hoists above `const`
initialisation, so referencing the mock directly hits the TDZ.

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
