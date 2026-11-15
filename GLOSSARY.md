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

**Finished job**:
A job that needs nothing more from the driver: Done, Rejected or Cancelled. It offers no actions.
_Avoid_: Closed, voided

**Unknown status**:
A job status the dispatcher uses that this version of the app does not know yet. The driver sees the dispatcher's own word, the job counts as open, and it offers no actions.

**Trip screen**:
The screen a driver uses while a job is In progress, with the route and Mark as done.
_Avoid_: active job screen, active screen
