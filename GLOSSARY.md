# FleetMS Driver

The phone app a driver uses to see, accept and run the jobs a dispatcher gives them in FleetMS.

## Language

### Jobs

**Job status**:
The stage a job is at, as the dispatcher's system records it: Pending, Confirmed, In progress, Done, Rejected or Cancelled. The app shows it in these words everywhere.
_Avoid_: Voided, state

**Pending**:
The job is assigned to the driver and waits for them to accept or reject it.

**Rejected**:
The driver turned the job down.
_Avoid_: Voided, declined

**Cancelled**:
The dispatcher called the job off.
_Avoid_: Voided

**Open job**:
A job that still needs the driver: Pending, Confirmed or In progress. Only an open job can be overdue.

**Overdue job**:
An open job whose pickup day has passed. It stays on the Jobs list, up to 30 days back, until the driver finishes it. Its card says "Missed" with the pickup date.
_Avoid_: late job, past job

**Finished job**:
A job that needs nothing more from the driver: Done, Rejected or Cancelled. It offers no actions.
_Avoid_: Closed, voided

**Unknown status**:
A job status the dispatcher uses that this version of the app does not know yet. The driver sees the dispatcher's own word, the job counts as open, and it offers no actions.

**Trip screen**:
The screen a driver uses while a job is In progress, with the route and Mark as done.
_Avoid_: active job screen, active screen

**Job action**:
Something the driver does to a job from the app: Accept, Reject, Start or Complete.
_Avoid_: mutation

**Live update**:
A change the dispatcher makes to one of the driver's jobs or assignments reaching the app while it is open, so every screen showing that job updates without the driver refreshing. A cancel, a new pickup time or address, a new job and a reassignment are all live updates.
_Avoid_: realtime event, push (a push is a phone notification)

**Route**:
The stops of one job, in the order the driver visits them.
_Avoid_: timeline, itinerary

**Stop**:
One place on a route. The first is the Pickup and the last is the Drop-off. The ones between are Stop 1, Stop 2 and so on, always numbered without gaps, even after dispatch deletes one.
_Avoid_: waypoint, leg

### Expenses

**Expense**:
Money the driver spent for work (fuel, a toll or something else), logged in the app with its amount, date and receipt.
_Avoid_: claim

**Receipt**:
The photo of the slip attached to an expense. It is part of the expense, not a record of its own.

### Notifications

**Notification**:
One alert the dispatcher's system sends a driver about a job, such as a new job, a change, a cancellation or a pickup reminder. It reaches the driver twice: as a push on the phone and as a row on the Notifications screen.
_Avoid_: message, inbox item

**Push**:
The banner the phone itself shows for a notification, even when the app is closed. Tapping it opens the app at the notification's link.
_Avoid_: push notification (in prose), alert

**Notifications screen**:
The screen listing the driver's recent notifications, newest first, with unread ones counted on the badge.
_Avoid_: inbox

**Allowed link**:
A screen a notification may open, from a short fixed list. A notification whose link is not allowed opens nothing from its row, and opens the Notifications screen from its push.

**Unknown notification type**:
A type of notification this version of the app does not know yet. It shows its job details in plain words, never its raw data.

### Settings

**Time format**:
The driver's choice on Profile of 12-hour ("2:30 pm") or 24-hour ("14:30") time. Every time in the app is shown in Malaysian time, in that format.
_Avoid_: clock style, clock setting
