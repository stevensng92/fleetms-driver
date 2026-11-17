# Spec: format times on screen, not in the downloaded data

Status: ready-for-agent

## Problem Statement

Two screens turn times into text at the moment their data is downloaded, then
keep that text in the app's cache:

- The Jobs list builds each card's pickup time ("14:30" or "2:30 pm"), the
  "Missed, Thu 2 Jul" date and the later-day headings ("Thu 22 May") inside the
  download. The split into Overdue, Today, Tomorrow and later days also happens
  there.
- The Notifications list builds each row's text, such as "KLIA, 29 Jul 09:15",
  inside the download.

Because the text is baked in, the driver's time format is part of the cache key
for both. Switching between 12-hour and 24-hour on Profile throws the cached
data away and downloads both lists again, with a spinner in between. With no
signal, the Jobs tab can show "Couldn't load jobs" right after the switch.

The day split has the same flaw in time: if the app stays open on the Jobs tab
past midnight, yesterday's Today jobs stay under Today until something reloads
the list.

Job details, the Trip screen, the Route card and Earnings already keep raw times
and format them on screen. These two screens are the odd ones out.

## Solution

- The jobs download and the notifications download return raw data only, with
  raw ISO times and no time text. Their cache keys no longer include the time
  format.
- The Jobs list decides each job's day section (Overdue, Today, Tomorrow, later
  days) on screen, against the current time, and redraws itself at Malaysian
  midnight.
- A job card formats its own pickup time and missed date from the raw pickup
  time and the driver's time format.
- A notification row's words are built on screen from the raw notification
  details, still by the one notification module.
- Switching the time format redraws both screens without downloading anything.

## User Stories

1. As a driver, I want switching between 12-hour and 24-hour time to change every job card's time at once, so that the setting feels instant.
2. As a driver, I want switching the time format with no signal to keep my jobs on screen, so that I am never shown "Couldn't load jobs" for changing a setting.
3. As a driver, I want switching the time format to change the times in my notifications at once, so that the two screens agree.
4. As a driver, I want my Jobs list to stay on screen while I switch the time format, with no spinner, so that I don't lose my place.
5. As a driver with the app open past midnight, I want tomorrow's jobs to move under Today on their own, so that Today always means today.
6. As a driver with the app open past midnight, I want a job I didn't finish yesterday to move under Overdue on its own, so that I don't mistake it for a job due today.
7. As a driver, I want a job under Overdue to keep saying "Missed" with its pickup date, so that I know which day it was.
8. As a driver, I want open jobs from up to 30 days back to stay under Overdue until I finish them, as today.
9. As a driver, I want later days to keep their headings ("Thu 22 May") and stay in date order, as today.
10. As a driver, I want every time and date to stay in Malaysian time whatever my phone's own time zone, as today.
11. As a driver, I want the unread badge and notification rows to keep working exactly as now, apart from the time text following my setting.
12. As a developer, I want the downloaded data to hold raw times only, so that a display setting never forces a download.
13. As a developer, I want the day split in the Jobs-tab rules module with an injectable "now", so that the midnight edges can be tested.
14. As a developer, I want one place that formats a job card's time, so that no screen can forget the driver's setting.

## Implementation Decisions

- **Jobs download.** The jobs fetch returns one flat list of jobs for the whole
  window it already fetches (open jobs from up to 30 days back through 14 days
  ahead), ordered by pickup time, each with its raw pickup time. It no longer
  takes the time format, formats nothing, and does not split by day. Its cache
  key drops the time format. The live-update refresh list keeps matching it
  (the key still starts with `jobs`).
- **Day split.** The Jobs-tab rules module gains the split: given the flat list
  and a "now", it returns Overdue (pickup before the start of today in
  Malaysian time), Today, Tomorrow, and later days grouped by Malaysian date
  with a stable date key, in date order. It then applies the existing rules on
  top (today's ordering, the Finished today fold, empty). Day boundaries are
  computed in Malaysian time, as the download does today, never with device
  local time.
- **Later-day headings** are formatted on screen from the date key or a job's
  raw time.
- **Midnight redraw.** The Jobs screen holds a "now" that updates at the next
  Malaysian midnight (one timer, rescheduled each midnight, cleared on unmount)
  and passes it to the day split.
- **Job card.** The card reads the raw pickup time and the driver's time format
  and formats its pickup time and, when overdue, its missed date itself. The
  ready-made time and date strings leave the card's job shape.
- **Notifications download** returns each row's raw details needed for its
  words (kind, the payload fields the words use, the raw pickup time, the
  checked link, job number) with no formatted text, and its cache key drops the
  time format. The unread count keeps reading the same cache.
- **Notification words.** The notification module builds a row's title and body
  from the raw details and the time format at draw time. It remains the only
  place that words a notification and checks its link. The link check result
  may stay in the download (it does not depend on the time format).
- No change to job details, the Trip screen, Earnings or push tap handling.

## Testing Decisions

- Good tests check what the driver sees or what a module returns through its
  public interface, never internals.
- **Jobs download** (existing query test, Supabase mocked): returns a flat list
  with raw pickup times and no formatted time text; the window and status
  filters are unchanged.
- **Day split** (Jobs-tab rules test, pure, injected now): a job lands in
  Overdue, Today, Tomorrow or a later day; edges just before and just after
  Malaysian midnight; an open job 30 days old stays Overdue; later days are
  grouped by Malaysian date and in date order; a device time zone other than
  Malaysia does not move a job's day.
- **Job card** (component test): the same raw time shows "14:30" in 24-hour and
  "2:30 pm" in 12-hour; an overdue card shows "Missed" with the pickup date.
- **Notification words** (existing notification test): the same raw details
  read correctly in 12-hour and 24-hour time; unknown types and links behave as
  today.
- **Jobs screen** (screen test, written first, failing today): switching the
  time format changes the card times without running the jobs download again.
- **Midnight redraw** (screen or hook test with fake timers): crossing Malaysian
  midnight moves a job from Tomorrow to Today without a download.
- Prior art: lib/__tests__/jobGroups.test.ts, lib/queries/__tests__/jobs.test.ts,
  lib/__tests__/notification.test.ts, lib/queries/__tests__/notifications.test.ts,
  __tests__/screens/jobs.test.tsx, components/__tests__/JobCard.test.tsx.

## Out of Scope

- Changing which jobs are fetched or the 30-day and 14-day windows.
- Any change to job details, the Trip screen, Earnings, or push tap handling.
- Rewording notification text beyond moving where the time is formatted.

## Further Notes

- Settled in a grilling on 2026-11-17 (seven questions, all accepted as
  recommended). Glossary terms Overdue job and Time format were added.
- The app pins all times to Malaysian time (lib/timeFormat.ts); tests run with a
  pinned time zone (see TESTING.md).
