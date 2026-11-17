# Spec: plain words for every error a driver sees

Status: ready-for-agent

## Problem Statement

When a download or a button press fails, the driver sees the raw technical
message: database wording such as "Cannot start a pending job (must be
confirmed)", "TypeError: Network request failed", "JWT expired", or a row-level
security code. Drivers can't act on these, they look like the app is broken,
and they leak internals onto the screen.

## Solution

One module turns any error into one of five plain sentences. Every "Couldn't
load" box and every pop-up after a button press shows that sentence under its
existing title. The raw text never reaches the screen. It goes to Sentry
instead, once per kind of error.

| Kind | What the driver sees |
|---|---|
| No signal | No signal. Check your connection and try again. |
| Signed out | You've been signed out. Please sign in again. |
| Dispatch changed the job | Dispatch has changed this job. It's been updated on your screen. |
| Not allowed | This isn't available to you. Call dispatch if you think it should be. |
| Anything else | Something went wrong. Try again, or call dispatch if it keeps happening. |

When a job action fails because dispatch changed the job, the app also
refreshes that job and the Jobs list straight away, so the sentence is true.

When the driver's session ends (sign-out from anywhere, including an expired
session the app could not renew), the app returns to the sign-in screen.

## User Stories

1. As a driver, I want a failed download to tell me in plain words what happened, so that I know whether to retry or call dispatch.
2. As a driver with no signal, I want to be told it is my connection, so that I move to better signal instead of calling dispatch.
3. As a driver with no signal, I want Retry to stay on the load box, so that I can try again once signal is back.
4. As a driver with no signal, I want a failed button press to leave me on the same screen, so that I can press it again.
5. As a driver whose session has ended, I want to be told I've been signed out, so that I know to sign in again.
6. As a driver whose session has ended, I want the app to take me to the sign-in screen, so that I am not stuck on a screen that can't load.
7. As a driver, when I press Accept, Start or Mark as done on a job dispatch has just changed, I want to be told dispatch changed it, so that I don't think the app is broken.
8. As a driver in that case, I want the job and my Jobs list to update straight away, so that I see the job as it really is now.
9. As a driver, when I'm refused something I'm not allowed to do, I want to be told to call dispatch, so that I know who can fix it.
10. As a driver, for any other failure, I want one calm sentence that tells me to retry or call dispatch, so that I always have a next step.
11. As a driver, I want the box and pop-up titles to keep saying what failed ("Couldn't load jobs", "Could not accept"), so that I know which action the message is about.
12. As a driver, I want never to see database wording, error codes or English technical jargon, so that the app feels finished.
13. As a developer, I want every raw error in Sentry, so that I can still diagnose what went wrong.
14. As a developer, I want each kind reported once per app run, not once per retry, so that Sentry isn't flooded by a driver tapping Retry in a dead spot.
15. As a developer, I want server wording the app doesn't recognise to reach Sentry, so that I notice when the server adds a new rule worth its own sentence.
16. As a developer, I want one place that holds all the words, so that a Malay version later is one file.
17. As a developer, I want a written rule that screens never show an error's own text, so that new screens follow it.

## Implementation Decisions

- **One new pure module** (beside `lib/jobStatus.ts` and `lib/notification.ts`,
  same shape: no database client or React at import time, Sentry required
  lazily). Its interface:
  - a function that sorts any thrown value into one of five kinds:
    `offline`, `signedOut`, `notAllowed`, `jobChanged`, `other`;
  - a function that returns the driver sentence for any thrown value, and
    reports the raw error to Sentry on the way (once per kind per app run;
    the `other` and `jobChanged` kinds also report each new raw wording once,
    so an unrecognised server rule still surfaces).
  - All five sentences live in this module and nowhere else.
- **How each kind is recognised** (from the error's own fields, never from a
  screen):
  - `offline`: the request never reached the server. A thrown fetch failure
    (TypeError "Network request failed" / "Failed to fetch"), a timeout or
    abort, or a response with `status: 0`.
  - `signedOut`: HTTP 401, or the session-expired wording (`JWT expired`,
    PostgREST code `PGRST301`/`PGRST303`, or Supabase auth's
    "refresh token" not found / invalid).
  - `notAllowed`: HTTP 403, Postgres code `42501` (permission / row-level
    security refusal), or server wording beginning "Not authorized" or
    "Not an active driver".
  - `jobChanged`: the job-action server wording family. "Cannot <action> a
    <status> job" and "Cannot <action> a <status> assignment" for confirm,
    reject, start and complete; "Assignment not found or no longer current";
    "No current assignment for job" (with or without a trailing reason).
    Matched by pattern on the message, so a new status word still matches.
  - `other`: everything else, including other server rules such as
    "amount_rm must be positive" (they get their own sentence only once
    Sentry shows drivers hitting them).
  - Order of checks: offline, signedOut, notAllowed, jobChanged, other.
- **Where it is used.** Only the message changes. Titles stay.
  - The shared load box takes the error itself instead of a message string,
    so no screen can pass raw text. The one-record screen state and every tab
    and screen that shows a load box pass their query's error.
  - Every pop-up after a failed button press shows the sentence: Accept and
    Reject on the Jobs tab; Confirm, Start and Reject on the job screen;
    Mark as done on the Trip screen; Save on Log expense; Request on time off;
    Withdraw on Profile.
  - Left alone: sign-in and set-PIN (already worded), the developer-only
    session line on the Jobs load box, the dialer and maps "could not open"
    pop-ups (already worded, not errors from a request).
- **Dispatch changed the job.** When a job action fails with the `jobChanged`
  kind, the shared job-action hook refreshes every job screen with the same
  `refreshJobs` it uses after success, then rethrows so the screen shows the
  pop-up. Other failures do not refresh.
- **Return to sign-in.** The root layout sends the driver to the sign-in
  screen when the auth listener reports a sign-out event (not on first launch
  with no session, which the existing start-up gate already handles).
- **The rule.** AGENTS.md gains a rule beside the job-status and notification
  ones: an error is shown ONLY through the new module; never put an error's
  own text on screen.

## Testing Decisions

- Good tests check what the module returns and what the driver sees, never
  how the sorting is written.
- **The new module** (written first, one kind per cycle): each kind from
  realistic error shapes (a Supabase PostgREST error object, a thrown
  TypeError, a plain Error, a string, `null`/`undefined`); every server
  wording in the job-action family maps to `jobChanged`; an unknown server
  rule maps to `other`; Sentry is called with the raw error, once per kind,
  and again for a new raw wording of `other`/`jobChanged`; the sentence text
  is pinned word for word so a rewording is a deliberate test change.
- **The load box**: shows the sentence for the error it is given, never the
  raw message; Retry still works.
- **Screens**: the existing screen tests that assert a raw message on a load
  box or a pop-up change to assert the sentence. At least one screen test per
  pop-up family proves the raw message is absent.
- **Job actions**: a `jobChanged` failure refreshes the job queries and still
  rejects; an `offline` failure does not refresh. Extends the existing
  job-actions test with its hand-made stand-in.
- **Return to sign-in**: a sign-out event sends the driver to sign-in; the
  first-launch no-session event does not.
- Prior art: `lib/__tests__/jobStatus.test.ts` and
  `lib/__tests__/notification.test.ts` (pure module plus lazy Sentry),
  `lib/mutations/__tests__/jobActions.test.tsx`,
  `components/__tests__/LoadError.test.tsx`, `__tests__/screens/`.

## Out of Scope

- Sign-in and set-PIN error wording.
- Malay or any second language.
- Separate sentences for individual server rules (expense amount, time-off dates).
- Changing box or pop-up titles.
- Any server or migration change.

## Further Notes

- Settled in a grilling on 2026-11-17 (eleven questions, all accepted as
  recommended). No glossary terms and no ADR.
- "No current assignment for job" was added to the `jobChanged` family while
  writing this spec: it is the same situation (dispatch moved the job), and
  the server raises it from the same four actions.
- The app had no return-to-sign-in on sign-out before this change; the
  grilling asked to add it if missing.
