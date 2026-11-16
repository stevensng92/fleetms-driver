# Spec: one Job actions module, with live updates everywhere

Status: ready-for-agent

## Problem Statement

A driver can have a job open on their phone that is no longer true. When the
dispatcher changes a job, the app only notices some of the time, and never on
the screen the driver is looking at:

- The app listens only for changes to the driver's assignments. A cancel, a new
  pickup time or a new address changes the job itself, so none of these reach
  the app live, not even the Jobs list.
- When an assignment change does arrive, the app refreshes the Jobs list and
  Earnings, but not an open job screen or Trip screen. The driver keeps seeing
  the old job until they leave the screen and come back.
- The listener starts only when the Jobs tab is shown. A driver who opens the
  app from a push, straight onto a job screen, gets no live updates at all
  until they visit the Jobs tab.
- Live updates only arrive while the app is open. A change made while the
  phone slept is never caught up on when the driver looks again.

Behind this, each of the four job actions carries its own copy of the list of
things to refresh, and the live listener carries a different, shorter one.
That second list is where the open job screen was missed.

## Solution

One Job actions module owns the four job actions (Accept, Reject, Start,
Complete) and the single list of what refreshes after any job change. The
actions and the live listener both use that one list.

The app listens for live updates to both the driver's assignments and their
jobs, whenever a driver is signed in, from the app's root. Every live update
refreshes the Jobs list, Earnings, and any open job or Trip screen. When the
app comes back to the front, it runs the same refresh, so anything missed while
the phone slept is caught up.

When the job a driver has open is cancelled, the screen quietly updates to
"Cancelled" with "Back to jobs". There is no pop-up.

## User Stories

1. As a driver, I want an open job screen to update when the dispatcher changes the job, so that I never act on stale details.
2. As a driver, I want a job the dispatcher cancels to show as Cancelled on the screen I'm looking at, so that I don't drive to a pickup that no longer exists.
3. As a driver, I want a new pickup time to appear on my open job screen without leaving it, so that I'm on time.
4. As a driver, I want a new pickup address to appear on my open job screen without leaving it, so that I go to the right place.
5. As a driver, I want the Jobs list to drop or change a job when the dispatcher cancels or edits it, so that the list matches what dispatch sees.
6. As a driver on the Trip screen, I want it to show the job's real status if dispatch cancels it mid-trip, so that I know to stop.
7. As a driver, I want a job reassigned away from me to show that it is no longer on my list, wherever I am looking at it.
8. As a driver, I want a newly assigned job to appear on my Jobs list without refreshing, so that I see new work at once.
9. As a driver who opens the app from a push on a closed phone, I want live updates to work straight away, so that the job screen I land on stays true.
10. As a driver who leaves the app and comes back, I want what I see to be caught up straight away, so that a change made while my phone slept is not hidden.
11. As a driver, I want Earnings to update when a job changes, so that my pay view stays right.
12. As a driver, I want my own Accept, Reject, Start and Complete to refresh every screen that shows the job, so that the app agrees with itself after I act.
13. As a driver, I want no pop-up when a job changes under me, so that I'm not distracted while driving.
14. As a signed-out phone, I want no live listener running, so that nothing is fetched for a driver who has left.
15. As a developer, I want one list of what refreshes after a job change, so that adding a screen means editing one place.
16. As a developer, I want the live listener and the job actions to share that list, so that they can never drift apart again.

## Implementation Decisions

- **Job actions module.** The four job actions move into one module that also
  owns the job refresh. Its interface: the four action hooks with the same call
  shapes the screens use today, plus one refresh function that marks every
  query showing a job as stale (the Jobs list, every open job or Trip screen,
  and every Earnings period and its history start).
- **One refresh, every caller.** After any job action succeeds, after any live
  update, and when the app comes back to the front, the same refresh runs.
  There is no second list anywhere.
- **Live updates listen to two tables.** The driver's assignments (filtered by
  driver, as today) and their jobs. The server only sends a driver the jobs
  assigned to them: drivers do not count as organisation members, so no other
  driver's job changes arrive. The notifications listener is unchanged and
  stays on the same channel.
- **The listener moves to the app's root.** It runs whenever a driver is
  signed in, keyed on the same signed-in state PR #30 added for push setup, and
  stops on sign-out. The Jobs tab no longer starts it. The existing defensive
  teardown of a stale channel with the same topic stays.
- **Foreground catch-up.** When the app returns to the front while a driver is
  signed in, the job refresh runs once.
- **No new UI.** A cancelled open job shows through the existing Job status
  module: the Cancelled word and the Back to jobs action. A job no longer
  assigned shows the existing "This job is no longer on your list" screen.

## Testing Decisions

- A good test checks what a caller can observe: which queries are marked
  stale, whether a listener is subscribed. It does not check how the module is
  built inside.
- **Seam 1, the job refresh.** After each of the four actions succeeds, after
  a live update, and on a direct call, the Jobs list, open job screens and
  Earnings are all marked stale. A real query client with seeded keys is used,
  and only the server call is mocked.
- **Seam 2, the live listener.** An assignment event and a job event each run
  the refresh; a notification event refreshes Notifications only; nothing
  subscribes while signed out; the channel is removed on sign-out.
- Prior art: the query-module tests that mock the Supabase client at the top
  of the file, and the push tests that wire a listener and fire it.

## Out of Scope

- **Stop-only edits.** When a dispatcher changes only a job's stops, the
  server writes them without touching the job, and stop changes are not sent
  live. That needs a server change in the dispatcher repo (send stop changes,
  or mark the job changed when its stops change), as a separate follow-up.
- A pop-up or banner when a job changes.
- Optimistic updates for job actions.
- Making the root layout itself testable.

## Further Notes

- Agreed in the grilling of 2026-11-16 (Q1 to Q8, all as recommended).
- New terms in GLOSSARY.md: Job action, Live update.
