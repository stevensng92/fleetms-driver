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
`lib/semver.ts`, `lib/earningsPeriod.ts`, `lib/jobContact.ts`, `lib/jobStatus.ts`, `lib/notification.ts`,
`lib/errorWords.ts`, `lib/jobGroups.ts`) and shared
components (including `RouteCard`, `LoadError` and `RecordState`), plus every
screen in the README's screen table (`__tests__/screens/`), `fetchClientPhone` in
`lib/queries/jobDetail.ts`, `fetchJobs` (`lib/queries/jobs.ts`), `fetchNotifications` and the push tap handler
(`handlePushTap` in `lib/push.ts`), sign-out (`signOut` in `lib/auth.ts`), clearing
and resetting the push address (`clearPushNotifications`, `resetPushRegistration`
in `lib/push.ts`), the `useSignedIn` hook (`lib/useSignedIn.ts`), the return to
sign-in on sign-out (`lib/useReturnToSignInOnSignOut.ts`), the four job
actions and `refreshJobs` (`lib/mutations/jobActions.ts`) and live updates
(`useLiveUpdates` in `lib/realtime/jobsRealtime.ts`). NOT covered: the session
gate (`app/index.tsx`), the remaining React Query data hooks, the rest of auth
(PIN sign-in).

A job status is read ONLY through `lib/jobStatus.ts` (words, pill, open or
finished, the allowed action, which screen opens). Never compare status
strings in a screen; add a row there instead.

A notification is read ONLY through `lib/notification.ts` (its words, and the
allowed link a row or push tap opens). Never open a notification's link
without it; add a shape to its allowed list instead. The download keeps raw
details (`readNotification`); the screen words them as it draws
(`notificationWords`).

An error is shown ONLY through `lib/errorWords.ts`: it sorts any thrown value
into one of five kinds (no signal, signed out, not allowed, dispatch changed
the job, anything else) and returns one plain sentence, reporting the raw error
to Sentry once per kind. Never put an error's own text (`e.message`, a database
error, a status code) on screen. A load box takes the error itself
(`<LoadError error={error}/>`), and a pop-up after a failed button press uses
`Alert.alert('Could not …', errorWords(e))`. New wording for a new kind of
failure goes in that module, not in a screen. Sign-in and set-PIN word their
own errors in `lib/auth.ts`.

Times are formatted on screen, never inside a download. Queries return raw
timestamps, and the screen or card formats them in the driver's Time format,
so the Time format is never part of a query key and switching it only redraws.

Note the shape that makes the pure helpers coverable: anything importing
`lib/supabase.ts` builds a live client at import time, so pure decisions belong
in their own module beside the query rather than inside it. `lib/earningsPeriod.ts`
was split out of `lib/queries/earnings.ts` for exactly this reason, and
`lib/jobContact.ts` out of `lib/queries/jobDetail.ts`. The jobs day split
moved the same way, from `lib/queries/jobs.ts` into `lib/jobGroups.ts`.

**Query modules CAN be tested, and the default is the demo's fake database.**
Put `jest.mock('../../supabase', () => require('../../../test/fakeDatabase').supabaseModule)`
and `const fake = installFakeDatabase()` at the top of the file. The query then runs
on the shared story in `demo/fixtures.ts`, so you edit a row (`fake.db`) or make a
call fail (`fake.failWith`) instead of building a chain of fake calls. Only a
test about what the app SENDS (the job actions, live updates, sign-out, push, the
signed-in check) keeps a hand-made stand-in. The fake ignores select strings, so
it cannot catch a missing column; the production column check before a build is
the guard. Worked example: `lib/queries/__tests__/jobDetail.clientPhone.test.ts`;
full guide in [TESTING.md](TESTING.md). Export the inner function for the test
and say so in a comment; going through the hook drags in a React Query provider
for no gain.

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
