# Spec: one Job status module

Status: ready-for-agent

## Problem Statement

A driver sees different words for the same job depending on the screen. A job the dispatcher called off reads "Cancelled" on its card in the Jobs list, but "Voided" on its job screen. A job the driver turned down reads "Rejected" on the card and "Voided" elsewhere. On the trip screen, a job that is no longer In progress shows a button reading "Job is voided" or "Job is progress", which is not a sentence a driver should ever see.

This happens because the app translates the job status in three separate places, and each screen decides for itself which buttons a status allows. When the dispatcher adds a new status, every one of those places has to be found and changed, and today an unknown status is shown as "Voided".

## Solution

The app has one Job status module that every screen asks. Given the job status the dispatcher sends, it answers: the words to show, the look of the pill, whether the job is an open job or a finished job, which actions the driver may take, and which screen the job opens on.

For the driver, this means:

- Every screen shows the real job status: Pending, Confirmed, In progress, Done, Rejected or Cancelled. "Voided" is gone.
- Rejected looks like Cancelled (grey, crossed out, the "no" icon) but keeps its own word.
- The buttons follow one rule on every screen.
- The trip screen, for a job that is no longer In progress, shows the status pill and a "Back to jobs" button.
- A status the app does not know yet shows the dispatcher's own word, counts as an open job, offers no actions, and is reported to Sentry.

## User Stories

1. As a driver, I want a cancelled job to say "Cancelled" on its card, so that I know dispatch called it off.
2. As a driver, I want a cancelled job to say "Cancelled" on its job screen too, so that the app does not contradict itself.
3. As a driver, I want a job I turned down to say "Rejected" on every screen, so that I can tell my own decision apart from a dispatcher's cancellation.
4. As a driver, I want Rejected and Cancelled jobs to look alike (grey, crossed out), so that I can see at a glance they need nothing from me.
5. As a driver, I want Rejected and Cancelled to keep different words, so that I know whose decision ended the job.
6. As a driver, I never want to see the word "Voided", so that I am not left guessing what it means.
7. As a driver, I want a Pending job to offer Accept and Reject on its card, so that I can answer quickly from the Jobs list.
8. As a driver, I want a Pending job to offer Accept and Reject on its job screen, so that I can answer after reading the details.
9. As a driver, I want a Confirmed job's screen to offer "On my way", so that I can start the trip when I leave.
10. As a driver, I want an In progress job to open the trip screen from the Jobs list, so that I land where I need to be mid-trip.
11. As a driver, I want an In progress job's screen to offer "Open active job", so that I can get back to the trip screen.
12. As a driver, I want a Done job's screen to offer only "Back to jobs", so that I cannot act on a finished job.
13. As a driver, I want Rejected and Cancelled job screens to offer only "Back to jobs", so that I cannot act on a job that is no longer mine.
14. As a driver on the trip screen, when dispatch cancels the job, I want to see a "Cancelled" pill and a "Back to jobs" button, so that I understand what happened and can leave.
15. As a driver on the trip screen, when a job is already Done, I want a "Done" pill and a "Back to jobs" button instead of "Mark as done", so that I cannot mark it twice.
16. As a driver on the trip screen, I never want a button that reads "Job is ..." with an internal word in it, so that the app reads like plain language.
17. As a driver, I want open jobs (Pending, Confirmed, In progress) to stay in the main list, so that the work still ahead of me is what I see first.
18. As a driver, I want finished jobs (Done, Rejected, Cancelled) from today to sit in the "Finished today" fold, so that they stay out of my way but I can still check them.
19. As a driver, I want only open jobs to be shown as overdue, so that a finished job from yesterday never nags me.
20. As a driver, when dispatch uses a status my app does not know yet, I want to see dispatch's own word for it, so that what I see is true.
21. As a driver, I want a job with an unknown status to stay in my main list, so that I do not lose sight of it.
22. As a driver, I want a job with an unknown status to offer no Accept, Reject, On my way or Mark as done, so that I cannot tap a button that might be wrong for it.
23. As a driver, I want a job with an unknown status to offer "Back to jobs" on its screen, so that I am never stuck.
24. As Steven, I want an unknown status reported to Sentry, so that I hear when the dispatcher adds a status the app needs to learn.
25. As Steven, I want adding a new status to the app to mean changing one module, so that the screens cannot drift apart again.
26. As Steven, I want the status words to match the dispatcher's words, so that drivers and dispatchers talk about jobs the same way.

## Implementation Decisions

- **A new Job status module.** One pure module, with no database or React imports, that takes the job status as the dispatcher sends it and returns everything a screen needs:
  - the words to show and the pill's look (tone, icon, crossed out or ticked);
  - whether it is an open job, a finished job, or an unknown status (which counts as open);
  - the actions allowed: Accept and Reject for Pending; On my way for Confirmed; open the trip screen for In progress; Back to jobs for finished jobs and unknown statuses;
  - which screen the job opens on: the trip screen for In progress, the job screen otherwise.
- **The status table moves inside it.** The existing job half of the status-tone table becomes part of the Job status module, with a new Rejected row that looks like Cancelled. The payment half of that table stays where it is and is not changed.
- **Queries keep the dispatcher's status as sent.** The jobs list query and the job detail query stop translating the status into the app's own kinds. Both copies of that translation are deleted, and so is the separate "raw status" field that worked around it. Each job carries one status: the dispatcher's.
- **The Sentry report for an unknown status moves into the Job status module**, so it is sent from one place, whichever screen first meets the status.
- **StatusPill reads the Job status module for jobs.** The older "kind" input it still accepts for jobs (including "voided" and "progress") is removed once no screen uses it. Payment pills keep working unchanged.
- **Every screen asks the Job status module** instead of comparing status strings itself: the job card, the job screen, the trip screen and the Jobs list grouping (open versus finished, and which screen a card opens).
- **The trip screen's bottom button**, when the job is not In progress, reads "Back to jobs" and goes back. The status pill in its header shows the real status.
- **The demo fake database** already sends the dispatcher's status words, so it needs no change unless a test shows otherwise.
- The words, look and actions above are the whole rule. Nothing else about the screens changes.

## Testing Decisions

- **Test behaviour through the interface, not the inside.** A good test feeds a status in and checks what a driver would see or be able to do. It does not check which helper was called.
- **Write the failing test first** for each slice, as the repo's AGENTS.md requires.
- **The Job status module is the main seam.** One table-driven test covers all six statuses plus an unknown one ("on_hold"), checking words, look, open or finished, actions and screen. It also checks that an unknown status is reported to Sentry, and that input like "In Progress" or "IN_PROGRESS" is read the same as "in_progress". Prior art: the status-tone and job-groups tests.
- **Screen tests prove each screen uses the module.** A few cases each, using the existing screen tests with mocked queries as prior art (the job screen, trip screen and Jobs list tests, and the job card test):
  - a cancelled job reads "Cancelled" on its job screen, never "Voided";
  - a rejected job reads "Rejected" on its card and its job screen;
  - the trip screen for a Done or Cancelled job shows that pill and a "Back to jobs" button, and no "Mark as done";
  - a job with an unknown status shows the dispatcher's word, sits among open jobs, and offers no Accept or Reject;
  - a Pending job still offers Accept and Reject, and a Confirmed job still offers "On my way".
- **Query tests** only change to check that the dispatcher's status comes through as sent. Prior art: the existing jobs query test with its mocked database.
- Every existing test must stay green. Tests that expect "Voided" or the old kinds are updated to the new words, not deleted.

## Out of Scope

- Payment status on Earnings (Paid, Unpaid, Waived, Refunded). It already shows its real words.
- Live refresh when the dispatcher changes a job while its job screen or trip screen is open. That is a separate piece of work (architecture review candidate 2).
- Changing any button's words, including "Open active job".
- The route and stops on the job and trip screens, and the shared job-screen shell (architecture review candidate 3).
- Any change on the dispatcher's side or to the database.
- Releasing: no version bump, build or over-the-air update.

## Further Notes

- The terms used here (Job status, Open job, Finished job, Unknown status, Trip screen) are defined in GLOSSARY.md.
- This came out of the architecture review of 15 Nov 2026 (candidate 1) and the grilling session that followed. No ADR was needed.
- The dispatcher's status list also has "unassigned". A driver's jobs should never carry it. If one does, it is handled as an unknown status.
