# Spec: one Notification module

Status: ready-for-agent

## Problem Statement

The app has two ways into a notification: a row on the Notifications screen,
and a tap on the push banner the phone shows. They do not follow the same rules.

- The Notifications screen only opens a link on a short list of allowed
  screens, so a bad or broken message cannot send a driver somewhere strange.
  A tap on the push banner skips that check and opens whatever link the push
  carries.
- The allowed list checks only how a link starts, so `/(tabs)` followed by
  anything also passes.
- The app starts listening for taps only after it has saved the phone's push
  address on the server. If that save fails, tapping a push opens the app and
  goes nowhere.
- Tapping a push does not mark it read, so the unread count still includes an
  alert the driver has already opened.
- A notification type the app does not know shows its raw data as the row's
  text, cut at 120 characters. It looks broken and can show internal fields.
- Inside the Notifications screen, the link is checked twice: once when the
  rows are loaded and again when each row is drawn.

## Solution

One Notification module is the only place that reads a notification. It turns
a Notifications screen row into its title, job number, text and checked link.
It turns a push tap into its checked link and the matching row. The
Notifications screen, its data query and the push tap all ask it, and nothing
else checks links.

For the driver:

- Tapping a push opens the job it is about, exactly as tapping its row does.
- A push whose link is missing or not allowed opens the Notifications screen
  instead of doing nothing.
- Tapping a push marks its row read, and the unread count drops.
- Taps work even when saving the push address failed.
- An unknown notification type shows its job number and pickup place when it
  has them, and nothing otherwise.

## User Stories

1. As a driver, I want tapping a "New job" push to open that job, so that I can accept it straight away.
2. As a driver, I want tapping a push and tapping its row on the Notifications screen to take me to the same place, so that the app behaves predictably.
3. As a driver, I want a push with a broken or missing link to open the Notifications screen, so that a tap is never a dead end.
4. As a driver, I want a push I have tapped to count as read, so that the unread badge only counts alerts I have not seen.
5. As a driver, I want a tap to open the job even if marking it read fails, so that a network blip never blocks me from my work.
6. As a driver, I want push taps to work even when the app failed to save my push address this launch, so that alerts already on my phone still open.
7. As a driver, I want a notification type my app does not know yet to show plain details rather than raw data, so that the Notifications screen never looks broken.
8. As a driver, I want a row with no usable link to look like plain text, not a button, so that I am not tapping something that goes nowhere.
9. As a dispatcher, I want a job alert to land the driver on that job, so that new and changed jobs get seen fast.
10. As the app owner, I want a push link the app refuses to be reported to Sentry once, so that I find out when the server sends a link the app does not expect.
11. As the app owner, I want a new notification type to be reported to Sentry once, so that I know to add its words to the app.
12. As the app owner, I want only links of an exact, known shape to open, so that a compromised or buggy server trigger cannot route a driver to an unexpected screen.
13. As a developer, I want one module to be the only reader of a notification, so that a new type or link is added in one place.
14. As a developer, I want the tap handler testable on its own, so that push behaviour is covered without the whole sign-in and push setup.

## Implementation Decisions

- **New module, `notification`, replaces `notificationText`.** It is pure: no
  database client at import time. It exports:
  - a reader for a Notifications screen row: given the type, the data and the
    clock setting, it returns title, job number, text and checked link (or
    no link).
  - a reader for a push tap: given the push's data, it returns the checked
    link (falling back to the Notifications screen) and the matching row's ID
    (or none).
  - the sent-at formatter, moved unchanged.
- **Allowed links are exact shapes, not prefixes:**
  - `/jobs/<one path part>` (what the dispatcher sends for job alerts)
  - `/(tabs)` (what the dispatcher sends for a reassignment)
  - `/notifications`
  - `/profile/time-off`

  Anything else, including extra path parts, `..`, a query string or a full
  web address, is refused. The two shapes the dispatcher's triggers send today
  (`/jobs/` + job number, `/(tabs)`) still pass.
- **A refused link is reported to Sentry once per link per app run**, through a
  lazy import, the same way the Job status module reports an unknown status.
  A missing link is not reported.
- **Unknown notification type:** the title is the type with underscores as
  spaces (as today). The text is the pickup place and pickup time when present,
  else empty. Never raw data. Reported to Sentry once per type per app run.
- **Push tap handler** is its own exported function in the push module. Given
  the tapped push and the router, it reads the push through the Notification
  module, opens the link, then marks the matching row read if there is one. A
  failed mark is swallowed (the open has already happened). After marking, it
  refreshes the Notifications query so the badge drops.
- **Listening for taps no longer depends on saving the push address.** The tap
  listener is wired whenever permission is granted, before and regardless of
  the token save. Its result type is unchanged.
- **The Notifications query keeps the checked link on each item; the row
  trusts it** and no longer checks again.
- **The push's data shape** (from the dispatcher's send function): the
  notification's stored data plus `push_log_id`, the matching row's ID. The
  type itself is not in the push, which is why the tap reader only needs the
  link and the ID.

## Testing Decisions

- Good tests check what a caller sees (the returned words, link and ID, the
  screen opened, the row marked), not how the module is built.
- **Notification module, no mocks:** every known type's title and text, the
  unknown type (plain details, no raw data, Sentry once), every allowed link
  shape, refused links (prefix tricks, extra parts, `..`, query strings, web
  addresses), Sentry once per refused link, the tap reader's fallback to the
  Notifications screen and its row ID.
- **Push tap handler, with the database and push library mocked:** it opens the
  right screen, it marks the right row read, a failed mark still opens the
  screen, a push with no row ID marks nothing. Also: the tap listener is wired
  even when the token save fails. Prior art: the supabase mock pattern in
  `lib/queries/__tests__/jobDetail.clientPhone.test.ts`.
- **Notifications query, with the database mocked:** rows carry the checked
  link, and a refused link becomes no link.
- The existing `notificationText` tests move into the new module's tests.

## Out of Scope

- Making the banner's words match the Notifications screen's words. The
  banner text is written by the dispatcher's server (its compose step), in the
  dispatcher repo. Known gap.
- Clearing the push address on sign-out. Sign-out never calls the clear
  function today, so a signed-out phone can keep receiving that driver's alerts.
  Its own PR, straight after this one.
- Changing which notifications the dispatcher sends, or their links.

## Further Notes

- The Sentry report on a refused link is the signal that the dispatcher started
  sending a new link shape. The fix is then a new row in the allowed list.
- Device check after merge: tap a real push from a cold start and from the
  background. The cold-start race (FLEETMS-DRIVER-4) is handled by the layout
  waiting for the navigator; this change must keep that order.
