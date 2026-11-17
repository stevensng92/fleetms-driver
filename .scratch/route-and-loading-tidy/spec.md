# Spec: one route card, one record screen state, one error box

Status: ready-for-agent

## Problem Statement

Drivers see the same things drawn by different copies of the same code, and the
copies have started to drift:

- The job screen and the Trip screen each build the Route card (the heading,
  the "3 stops" count and the stops) line for line. Each also turns every stop
  into a second, nearly identical shape before drawing it.
- The job screen and the Trip screen each carry their own copy of the
  spinner, the "Couldn't load" box and the "no longer on your list" box. The
  copies already differ by one word.
- Five screens draw "Couldn't load …" in five slightly different layouts.
- The receipt screen is worse off than the job screens. Its error has no
  Retry, and an expense that is gone (removed, or no longer the driver's) shows
  a raw database message instead of saying so plainly.
- An unused demo data file keeps two stop fields alive that nothing draws.

## Solution

- **One Route card.** Both job screens place the same card. It takes the
  stops as the job query returns them and names them itself (Pickup, Stop 1,
  Drop-off), formats their times, counts them and draws them.
- **One shape for a stop.** A stop is drawn from the same shape the route
  helpers produce: label, time, place and map position.
- **One record screen state.** A screen that shows one record (the job screen,
  the Trip screen, the receipt screen) shows its header plus a spinner while
  loading, the shared error box with Retry when loading fails, or a plain
  "no longer on your list" card with a way back when the record is gone.
- **One error box.** Every "Couldn't load …" uses the red band with its Retry
  button in the band's own right-hand slot. The technical message stays under
  the title, as today.
- **Dead code goes.** The unused demo data file and the two stop fields only it
  needed are deleted.

## User Stories

1. As a driver, I want the Route card on the job screen and the Trip screen to look and read the same, so that I recognise my route wherever I see it.
2. As a driver, I want stops named Pickup, Stop 1, Stop 2 … Drop-off on both screens, so that I can talk about them with dispatch in the same words.
3. As a driver, I want the stop count to say "1 stop" and "3 stops" correctly on both screens, so that the app reads naturally.
4. As a driver, I want a stop without a time to show no time line at all, on both screens, so that I never see a blank or a dash where a time should be.
5. As a driver, I want the times on my route in my chosen 12-hour or 24-hour clock on both screens, so that the screens agree.
6. As a driver opening a job, I want a spinner while it loads, so that I know the app is working.
7. As a driver, when a job fails to load, I want a clear "Couldn't load job" box with Retry, so that I can try again without leaving the screen.
8. As a driver, when a job has been cancelled or given to someone else, I want "This job is no longer on your list" with a Back to jobs button, so that I am not stuck on a dead screen.
9. As a driver opening the Trip screen, I want the same loading, error and not-found behaviour as the job screen, so that the two never behave differently.
10. As a driver opening a receipt, I want a Retry button when it fails to load, so that a moment without signal does not force me to leave and come back.
11. As a driver opening an expense that is gone, I want "This expense is no longer on your list" with a Back to expenses button, so that I am not shown a database error.
12. As a driver, I want every "Couldn't load …" box in the app to look the same, with Retry in the same place, so that I know where to tap.
13. As a driver on the Jobs list, Expenses, Earnings and Notifications, I want Retry to keep reloading that screen's data, so that nothing I rely on stops working.
14. As a developer running the app without sign-in settings, I want the Jobs list error to keep its sign-in hint, so that I can see why it failed.
15. As a developer, I want one place that draws the route, so that a change to how stops look happens once.
16. As a developer, I want one place that decides loading, error or not found for a one-record screen, so that the next such screen gets it right for free.
17. As a developer, I want one error box component, so that the error layout cannot drift again.
18. As a developer, I want no unused demo data or dead stop fields, so that the stop shape says only what is drawn.

## Implementation Decisions

- **Route card component.** A new shared component takes the raw stops from
  the job detail query and the driver's clock style. It uses the existing
  route helpers to label and time the stops, shows the "Route" heading with
  the stop count, and draws each stop with the existing single-stop component
  and its pin rule. Both job screens replace their copied block with it.
- **One stop shape.** The single-stop component's stop type becomes the route
  helpers' stop shape (label, time, place, latitude, longitude). The renaming
  step on both screens is removed. The two fields nothing draws (an arrive
  label and a depart time) are dropped.
- **The Trip screen's top card** reads its first and last stop from the same
  labelled list the route helpers produce.
- **Record screen state component.** A new shared component draws the frame,
  the header with Back, and exactly one of: a spinner, the error box, or a
  not-found card. It is given the query's result (data, error, retry) and the
  screen's own words: the header title, the error title, the not-found title
  and body, and the not-found button's label and destination. Not found means
  the query finished and returned nothing (null). Loading means no data, no
  error and not finished.
- **Screen words.** Job screen and Trip screen: "Couldn't load job", "This job
  is no longer on your list", "Dispatch may have cancelled or reassigned it.",
  "Back to jobs". Receipt screen: "Couldn't load expense", "This expense is no
  longer on your list", "It may have been removed.", "Back to expenses". The
  receipt screen's header title stays "Receipt".
- **Receipt query.** The receipt's expense lookup returns null when no row
  comes back, instead of failing, so a gone expense reaches the not-found card.
- **Error box component.** A new shared component draws the red band with a
  title, the technical message and a Retry button in the band's action slot.
  It accepts extra content under the message, which the Jobs list uses for its
  developer-only sign-in hint. The Jobs list, Expenses, Earnings and
  Notifications screens and the record screen state all use it.
- **Deleted.** The unused demo data module.

## Testing Decisions

- Good tests check what the driver sees and what a tap does, through the
  component's props or the screen, never the inside of a component.
- **Route card** (component test): stop names Pickup, Stop N, Drop-off with no
  gaps; "1 stop" and "3 stops"; a stop with no time shows no time line; times
  follow the clock style.
- **Record screen state** (component test): the spinner while loading; the
  error box with its title and message, and Retry calling retry; the not-found
  card with its words, and its button going to the given destination.
- **Error box** (component test): title, message, Retry calls back, extra
  content shows.
- **Receipt screen** (screen test, written first, failing today): an error
  shows Retry and Retry reloads; an expense that comes back empty shows "This
  expense is no longer on your list" and Back to expenses.
- The existing job screen and Trip screen tests stay unchanged and must keep
  passing; they are the proof the job screens did not change for drivers.
- Prior art: the existing single-stop component test, the job screen and Trip
  screen tests, and the shared job fixtures.

## Out of Scope

- Rewording technical error messages into plain driver language. That needs a
  list of the common errors first.
- Renaming the receipt screen's title.
- Loading spinners on list screens (Jobs, Expenses, Earnings, Notifications).
- Any change to which data loads or when.

## Further Notes

- Settled in a grilling on 2026-11-17 (eight questions, all accepted as
  recommended). Glossary terms Route, Stop, Expense and Receipt were added.
- The Trip screen's error title changes from "Couldn't load active job" to
  "Couldn't load job", matching the glossary, which avoids "active job".
