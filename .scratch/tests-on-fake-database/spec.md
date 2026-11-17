# Spec: run the data-loading tests on the demo's fake database

Status: ready-for-agent

## Problem Statement

Thirteen test files build their own hand-written stand-in for the database
client. Each stand-in is a small chain of fake calls (`from`, `select`, `eq`,
`order` and so on) returning a few hand-picked rows. That has two costs:

- A lot of repeated setup code that has to change whenever a query changes
  shape, even when nothing the driver sees has changed.
- The rows are minimal and invented per test, so a mismatch between what the
  database really sends and what the app expects is easy to miss.

The repo already has a fuller fake database for the web demo
(`demo/fakeSupabase.ts` with the shared story in `demo/fixtures.ts`). It
answers the same calls with realistic rows, but only the demo's own test uses
it.

## Solution

- The data-loading tests and the two screen tests that fake the database move
  onto the demo's fake for their normal-case checks, through one shared test
  helper, so each file switches with one line.
- The fake gains one small option to make a table read or a server command
  fail, including "fail once, then succeed", so error and Retry paths can be
  tested on it.
- Tests that check what the app *sends* (the job actions, live updates,
  sign-out, push registration and the signed-in check) keep their hand-made
  stand-ins, because the fake cannot record calls.
- The docs say plainly that the fake ignores which columns a query asks for,
  so it cannot catch a missing column. The check against the production
  database before a build stays the guard for that.

## User Stories

1. As a developer, I want a test to switch to the fake database with one line, so that I don't write a chain of fake calls for every query.
2. As a developer, I want tests to read realistic rows from the shared demo story, so that a mismatch between database rows and app types shows up in tests.
3. As a developer, I want to change one row of the shared story inside a single test, so that I can set up an edge case without building a whole dataset.
4. As a developer, I want each test to start from a fresh copy of the story, so that one test's edits never leak into another.
5. As a developer, I want to pin "today" to a fixed date in a test, so that day-boundary checks are repeatable.
6. As a developer, I want to make a table read fail, so that I can test the error screen on the fake.
7. As a developer, I want to make a server command fail, so that I can test what happens when it errors.
8. As a developer, I want a failure that happens once and then succeeds, so that I can test Retry.
9. As a developer, I want the web demo to behave exactly as before, so that the preview never shows an injected failure.
10. As a developer, I want the tests that check what the app sends to keep their stand-ins, so that those checks stay precise.
11. As a developer, I want the docs to say the fake ignores column names, so that nobody trusts it to catch a missing column.
12. As a developer, I want the demo's README to say tests depend on the fake, so that a change to the story is made with care.
13. As a developer, I want every moved test to still check the same behaviour it checked before, so that coverage does not drop.

## Implementation Decisions

- **Fake location.** The fake and the story stay in `demo/`. Production code
  still never imports them; only tests and the web-only Metro swap do.
- **Failure option.** The fake's factory takes an optional failure rule: a
  function given the table or server-command name (and which kind it is)
  that returns an error to send back, or nothing to succeed. A test can keep
  a counter in that function to fail once and then succeed. The web demo never
  passes it, so its behaviour is unchanged. A failing read returns
  `{ data: null, error }` in the same shape the real client uses; `single`
  and `maybeSingle` behave the same way.
- **Shared helper.** A small module in `test/` wires the fake into a test file:
  it mocks the app's database module with a fake built per test from a fresh
  copy of the story, lets the test choose "today" (real today or a fixed date),
  gives the test the plain story data to edit before the code under test runs,
  and lets the test set the failure rule. A file switches with one line plus
  the imports it uses.
- **Files that move** (normal-case checks onto the fake, error and edge checks
  via the failure rule or story edits):
  - the jobs download test,
  - the notifications download test,
  - the job-details client-phone test,
  - the job-details not-found test,
  - the time-format (clock style) test,
  - the receipt screen test,
  - the jobs screen time-format test.
- **Files that stay on hand-made stand-ins:** job actions, live updates,
  sign-out, push, the signed-in check, and the demo's own test.
- **No column checking.** The fake keeps ignoring the select string. This is
  documented in the demo README and TESTING.md.
- **Story edits only where needed.** If a moved test needs a row the story
  lacks, add it to the test via the story-edit hook, not to the shared story,
  unless it also makes the demo better and stays invented data.

## Testing Decisions

- Good tests check what a module returns or what the driver sees through the
  public interface, never how the query is built.
- **Failure option** (demo fake test, written first): a table read fails with
  the given error; a server command fails; a fail-once rule fails the first call
  and succeeds the second; without the option, nothing fails.
- **Helper** (exercised by the moved files): each test starts from a fresh
  story; a story edit in one test does not show in the next; a fixed "today"
  moves the story's dates.
- **Moved files**: every behaviour each file checked before is still checked,
  either on the fake or, where a check is really about what the query sends,
  on a hand-made stand-in kept in that file. Removing a check needs a reason in
  the PR.
- Prior art: demo/__tests__/fakeSupabase.test.ts (already runs real queries on
  the fake), lib/queries/__tests__/jobDetail.clientPhone.test.ts.

## Out of Scope

- Teaching the fake to check column names or select strings.
- Moving the six call-checking test files.
- Moving the ten screen tests that mock the query hooks.
- Any change to app code or to what the web demo shows.

## Further Notes

- Settled in a grilling on 2026-11-17 (six questions, all accepted as
  recommended). No glossary terms.
- The demo data is public: everything added stays invented.
