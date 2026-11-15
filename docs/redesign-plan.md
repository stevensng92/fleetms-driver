# FleetMS Driver: bringing the redesign into the app

Written 15 Nov 2026. **Status: waiting for Steven's approval. No code written yet.**

The design is settled. This plan is about building it in this app, safely, in
small pieces you can check one at a time.

Sources, read in this order:

1. `P:/github/design-systems/fleetms/driver-inventory.md`: the 31 changes and 6 open items.
2. The mock: `P:/github/design-systems/fleetms/src/driver/` (`rules.ts`, `screens/*`, `JobPieces.tsx`, `driver.css`).
3. `fleetms/design.md` (the locked system) and `fleetms/real-build-colour-map.md` (violet becomes ink, cyan becomes the green accent).
4. The spec of today's app (`driver-app-spec.md`, 25 known issues).
5. `fleetms/real-build-plan.md`: the admin app's rollout, whose shape this copies.

## The short version

The good news: this app is in much better shape for a re-skin than the admin
app was. Every colour already comes from one file (`theme/tokens.ts`), and only
about 25 hard-coded colours sit in screens. So the new look can land in one
place and flow to every screen.

The work splits into 8 phases. **Phase 1 changes only the look**: colours,
type, corners and the shared pieces (buttons, pills, cards, tab bar). Nothing a
driver can do changes. **Phases 2 to 7 are the fixes** (changes 10 to 31), one
screen area per phase, each its own pull request. Phase 8 is a final check.

Nothing ships to drivers until you say so. No phase bumps the version, builds
an APK, or publishes an over-the-air update.

## What I found in this app (the facts the plan rests on)

| Fact | Where | What it means |
|---|---|---|
| All colours live in one token file, read through `useTokens()` | `theme/tokens.ts` (87 lines), `theme/ThemeProvider.tsx` | Swap the values once and every screen follows |
| Only ~25 literal colours in screens and pieces | `Button.tsx`, `active.tsx`, `TimelineStop.tsx`, `Logo.tsx` and ~12 others, 1 to 3 each | A short clean-up, not an 86-file sweep |
| Light, dark and "follow the phone" already work and are saved on the phone | `ThemeProvider.tsx` | The mock's Appearance setting matches today's. Nothing new to build |
| Styling is inline `style={{}}` objects, no UI library | every screen | Shared pieces are the lever, same as admin |
| Font is the phone's default; numbers and plates use a mono font in 7 places | `fontFamily: MONO` | Inter needs adding (one small package). Plates keep mono; job numbers, times and money move to Inter with even-width digits |
| Icons are hand-drawn SVG paths, 27 of them | `components/Icon.tsx` | The mock uses Lucide icons. Add the missing ones as paths in the same file (no new package) |
| New React Native engine is on | `app.json` `newArchEnabled: true` | Real soft shadows (`boxShadow`) work, so the mock's two shadows port exactly |
| Feedback is phone pop-ups (`Alert.alert`) everywhere; no toasts | all screens | Toast, confirm dialog and bottom sheet are new pieces |
| Tests: 10 files on pure helpers and 5 components, plus Earnings | `lib/__tests__`, `components/__tests__`, `__tests__/screens` | The habit is set. New rules go in pure `lib/` files with tests |
| CI runs type check and tests on every PR; lint is not in CI | `.github/workflows/test.yml` | I run lint by hand each phase |
| Signing in on the web preview needs a real driver phone and PIN against live data. The dev shortcut's password is blank | `lib/devSession.ts`, `.env` | **I can't see signed-in screens without you.** See "Before phase 1" |

## Before phase 1 (needs you, about 10 minutes)

1. **Approve this plan**, and answer the three questions at the end.
2. **A test driver to look through.** Either fill in `EXPO_PUBLIC_DEV_DRIVER_EMAIL` and `EXPO_PUBLIC_DEV_DRIVER_PASSWORD` in the main checkout's `.env` (a test driver in your test org), or sign in yourself in the preview pane when I ask. Without it I can only check the sign-in screen on the web, and the rest only in tests.
3. **How you'll see it on a phone.** I'll check whether the app opens in Expo Go. If it doesn't (it has Sentry and push notifications built in, which may need a custom build), the phone check waits for a build you choose to make. I won't start an EAS build or update myself.

## How the work is organised

- One branch per phase off `master`: `redesign/phase-1-paint`, `redesign/phase-2-jobs`, and so on. One pull request each. I never push `master`.
- One worker owns a file at a time. Phases 2 to 7 touch different screens, so after phase 1 lands, some can run side by side.
- Logic changes are test first: the failing test, then the code. Where `rules.test.ts` in the mock has a matching case, I port it.
- The mock's fake data, its "Mock settings" box and its mock sign-in accounts stay in the mock.
- Every phase ends with the same checks (below), and a "Where I stopped" note.

## The checks, every phase

| Check | Command or how | Pass means |
|---|---|---|
| Unit tests | `npm test` | All green, new rules covered on both sides of every if |
| Type check | `npx tsc --noEmit` | No errors |
| Lint | `npm run lint` | No new warnings |
| No literal colours | a test that scans `app/` and `components/` for `#hex` and `rgba(` outside `theme/` | Zero hits (from phase 1 on) |
| Look, light and dark | Expo web preview at phone width (390px), screenshots of every screen that phase touched, beside the mock at `localhost:3025/driver.html` (add `&theme=dark`) | Matches the mock's layout, words and colours |
| On a phone | Expo Go or a build you make (see above), light and dark | Touch sizes, keyboard, safe areas and the Android back button behave |

CI runs the first two on the pull request. I attach the screenshots to each PR.

**Before and after page**: `docs/redesign-compare.html` puts today's app (left)
next to the mock (right) for each of the 13 screens, with that screen's
numbered changes underneath. The left side is the real app's own screens fed
the mock's fake day (Azman, Continental Travel) through a stand-in database,
`demo/` (see `demo/README.md`): no sign-in and no live data. The stand-in only
switches on for the web preview, when `EXPO_PUBLIC_DEMO_DATA=1` is set by hand;
phone builds never see it. To run it:

1. From `P:/github/fleetms-driver` (not the `C:` shortcut, where the web build stays blank): `EXPO_PUBLIC_DEMO_DATA=1 npx expo start --port 8091 --clear`
2. In `P:/github/design-systems/fleetms`: `npm run dev`
3. `python -m http.server 3030 --directory docs`, then open `http://localhost:3030/redesign-compare.html`

Each phase's PR uses it for the look check, so the left side becomes the new
app as phases land. Known gap: the receipt photo on the left's Receipt screen
stays blank (the stand-in picture doesn't draw); the rest of that screen shows.

## Phase 1: paint only (changes 1 to 9)

No behaviour changes. Every button does what it did; every rule stays. Split
into four pull requests so each is easy to review.

### 1a. The theme module

Rewrite `theme/tokens.ts` with the mock's tokens from `colors_and_type.css`,
light and dark:

- **Colours**: ground, well, surface, surface-sunk, track, ink, text, text-2, text-3, on-ink, hairline, hairline-strong, feature (the dark card, dark in both themes), on-feature, on-feature-2, feature-track, the green accent (go, go-text, go-soft, on-go), the four status hues each with soft and text (amber, blue, red, neutral, plus green), danger, scrim, control-ring.
- **Type**: Inter at 500, 600 and 700; sizes 12, 13, 14, 16, 20, 28, 40; tracking turned from `em` into pixels per size (-0.01em at 14px is -0.14). Named text styles: title, heading, body, label, caption, figure.
- **Space** 4 to 64 in 4px steps, **radius** 8, 12, 16, 24, 32 and pill, **shadow-1** and **shadow-2** as real `boxShadow` strings.
- **Motion**: the two lengths (120ms, 200ms), the one curve, press scale .97, and the reduced-motion switch (React Native's `AccessibilityInfo.isReduceMotionEnabled`).

Three things React Native can't read from CSS, converted once:

- The blues are written in `oklch`. React Native doesn't understand it, so I convert each to hex in the file, with a comment showing the original.
- The scrim uses `color-mix`; it becomes a plain `rgba`.
- The green-to-lime gradient becomes a small `GoFill` piece drawn with `react-native-svg` (already installed). It is used in three places only: the drop-off pin, progress fills and the selected state.

The old token names (`primary`, `accent`, `muted`, `heroBg`...) stay as aliases
pointing at the new values, so every screen keeps compiling and instantly wears
the new colours. Phase 1d removes the aliases.

**Checked by**: a test that pins every token value in both themes, and a test
that the text colours pass contrast (4.5 to 1) on their surfaces.

### 1b. The shared pieces

Rebuilt in `components/`, each with a test for its states:

| Piece | Today | After |
|---|---|---|
| `Button` | violet, 6px corners, green "done" variant | ink primary, white secondary with shadow, danger, quiet; pill shape; 44px touch; press shrinks to .97. The green variant goes (the accent never fills a button) |
| `StatusPill` | coloured dot, In Progress pulses | the admin pill: soft tint, icon plus word. Only In Progress moves: a slow blue glow, 2.4 seconds a cycle, added to the mock 15 Nov at Steven's request. Build it as a soft halo whose opacity loops (react-native-reanimated), and hold it still when the phone's Reduce Motion is on. On the dark job card (`FeatureCard`), pills use the dark-theme tints in both themes, since that card stays black in light mode. Job words: Pending, Confirmed, In Progress, Done, Cancelled. Payment words: Paid, Unpaid, Waived, Refunded |
| `Pill` | none | a plain tone pill for things that aren't statuses ("New", "Default") |
| `Card` | 12px corners, coloured left stripe, can pulse | 24px corners, shadow-1, no stripe, no pulse |
| `FeatureCard` | `heroBg`, flips to white in dark | the one dark card, dark in both themes. Used for the job being driven and the Expenses month total |
| `Sheet` | the vehicle picker draws its own | one bottom sheet: scrim, grabber, title, rises over 200ms, fades only under reduced motion |
| `ConfirmDialog` | `Alert.alert`, different on iOS and Android | one dialog on both: title, line, optional reason box, safe button "Keep ..." focused, the act named on the red button |
| `Toast` | none | one toast area above the tab bar: "Job accepted", "Expense logged". Arrives in 200ms, leaves in 120ms |
| `TabBar` | full-width bar, violet active | the admin's floating pill: the current tab shows icon and word, the others icon only; the red mark on Profile stays |
| `AppHeader` | 26px title, uppercase section labels | 28px title, sentence-case section headings |
| `Band` | each screen draws its own amber and red boxes | one soft band: amber, red or neutral, always with an icon |
| `FormField`, `Input`, `Segmented` | each screen draws its own | label, hint, error at the field; segmented control on the track colour |
| `Icon` | 27 paths | plus the mock's extra Lucide icons (clock, navigation, ban, hourglass, badge-check, circle-x and others) |

### 1c. Screens wear the new pieces (changes 1 to 9)

Screen by screen, swap old pieces for new and apply the look rules. Words and
behaviour stay the same except for the formatting rules below, which are
display only:

| # | Change | Where |
|---|---|---|
| 1 | Violet becomes ink, cyan becomes green, pills get icons | everywhere, via 1a and 1b |
| 2 | Capital labels become sentence case | every `SectionLabel` and field label |
| 3 | Dot-joined lines become separate items with icons | job card meta, client card vehicle line, expense rows, notifications |
| 4 | Times in 24 hour: "14:30", not "14:30 pm". This is the default; phase 5 adds a 12-hour choice | `formatClock` in `lib/timeFormat.ts` (tests updated first) |
| 5 | "Sat, 12 Dec" and "Saturday, 12 December 2026"; ranges say "to" | `lib/timeFormat.ts` (`formatDate`, `formatWeekRange`) |
| 6 | Nothing pulses; the job being driven is the dark card | `JobCard`, `active.tsx` |
| 7 | Floating tab bar | `app/(tabs)/_layout.tsx` |
| 8 | "+60" text prefix instead of the flag emoji | `sign-in.tsx` |
| 9 | Expenses month total is the dark card; category colours on rows go | `expenses.tsx` |

Layouts follow the mock: on each screen the next pickup time and route first,
money and paperwork after.

### 1d. Clean-up

Remove the old token aliases. Turn on the "no literal colours" test. Fix what it
finds (Logo, Waze and Maps icon colours become tokens; the Logo mark becomes the
green chevron per the colour map).

**Phase 1 done when**: every screen matches the mock's look in light and dark,
all tests pass, and a driver could not tell anything works differently.

**Your call after phase 1** (as with admin): ship the new look on its own, or
wait for the fixes. I'd wait for at least phases 2 and 3, because the Jobs
screens are where the look and the fixes meet.

## Phases 2 to 7: the fixes (changes 10 to 31)

Each phase is one screen area, one branch, one pull request. Each change is
test first. Order is by how often drivers use the screen.

### Phase 2: Jobs tab (changes 10, 11, 14, 15, 19, 32, 35, 36)

| # | Change | Test first |
|---|---|---|
| 10 | Drop the made-up "RM n × 80" from the Today heading; show the jobs still to do | heading shows "3 jobs to go" ("All done" when none are left), no RM |
| 11 | Reject from the list asks first, with an optional reason, the same as the job screen | Reject opens the dialog; nothing is sent until confirmed; the reason is passed through |
| 14 | An in-progress job opens the trip screen from every group, Upcoming included | `jobScreen` port |
| 15 | "No jobs scheduled today" only when nothing is coming at all | `jobGroups(...).empty` port |
| 19 | "View details" and "Completed" lines fold into the card | card render test |
| 32 | Today leads with the job under way, then jobs still to do by pickup time; done and cancelled jobs sit in a "Finished today" fold, closed by default (added to the mock 15 Nov) | port the mock's `jobGroups` cases: `today` order, `todayFinished`, a day of only finished jobs is not empty; fold starts closed and opens on tap |
| 35 | Accept: the buttons fade out (120ms) and lock, then the job turns Confirmed and the pill settles; a light success haptic on the tap (`expo-haptics`, already a dependency) | a second tap during the fade does nothing; accept fires once; haptic called once |
| 36 | Finished today: the panel opens at once and its jobs fade in (never animate height); its count bumps once when it grew since the driver last saw it, including after Mark done on the trip screen | port `countRose` cases; count bumps after a job is marked done, not on first draw |

New pure file: `lib/jobGroups.ts` (groups, which screen opens, "1 job" / "2 jobs").

### Phase 3: Job detail and trip (changes 12, 13, 16, 17, 18, 20)

| # | Change | Test first |
|---|---|---|
| 12 | Mark as done asks first | nothing is sent until confirmed |
| 13 | The trip screen's frozen "Stop 1 of N" bar goes; it shows the time and route instead | bar is gone |
| 16 | A stop with no time shows no time line; "Dropoff" becomes "Drop-off" | `stopLabel` port; no "—: —" |
| 17 | "Route · 1 stops" fixed; the count sits beside the Route heading | "1 stop", "3 stops" |
| 18 | Report an issue: **open item, today's behaviour kept** (the link stays and does nothing). Only restyled | none |
| 20 | A job that left the driver's list says "This job is no longer on your list" instead of an error | a not-found result shows the message, a network error still shows Retry |

New pure file: `lib/route.ts` (stop names, stop count, surcharge note, vehicle
line). This also merges the two copies of the vehicle type names (`ClientCard.tsx`
and `driverProfile.ts`) into one.

### Phase 4: Earnings (changes 21, 22, 23, 37, 38)

| # | Change | Test first |
|---|---|---|
| 21 | Cents everywhere ("in fares" and the average dropped them) | figures keep cents |
| 22 | Payment words on rows: Paid, Unpaid, Waived, Refunded. "Pending" figure renamed "Unpaid" | each payment value maps to its word |
| 23 | Page dots go; arrows and swipe stay. No commission yet says "Awaiting commission" | row with null commission |
| 37 | A page turn slides the period name, figures and job list 16px in and fades them in (200ms, react-native-reanimated). An arrow brings them from its own side; a swipe from the side the finger moved away from. Week/Month/All does not slide; Reduce Motion fades only (added to the mock 15 Nov) | the side picked for each arrow and each swipe direction, as a pure helper; no slide on a mode switch |
| 38 | Swipe right for earlier, left for later (today it is the other way round), so the swipe agrees with the arrows. Decided 15 Nov | the swipe rule: a rightward drag past 40px is earlier, leftward is later; short or mostly vertical drags do nothing |

Extends the existing `lib/earningsPeriod.ts` (already tested) and adds
`lib/money.ts` (`formatRM`, `splitRM`).

### Phase 5: Profile and time off (changes 24, 26, 27, plus Time format)

| # | Change | Test first |
|---|---|---|
| 24 | One tap is a one-day request; Submit always on and says what is missing | `pickDay` port, missing-day message |
| 26 | An inactive driver never shows a green pill; initials skip "bin" and "binti" | `availabilityPill`, `initials` ports |
| 27 | Sign out asks first | nothing happens until confirmed |

**New, added to the mock 15 Nov: Time format.** Profile > Appearance gets a Time format choice under Theme: 24-hour ("14:30", the default) or 12-hour ("2:30 pm", "12:15 am"). It is saved on the phone and every clock follows it: job cards, the job and trip screens, notification text and sent times. Test first: port the mock's `clockTime` cases (`rules.test.ts`) into `lib/__tests__/timeFormat.test.ts`, then add the style to `formatClock`. Job cards and notification rows build their times inside query functions, so a change must also refetch those queries. Today's app does not get this before the redesign.

New pure files: `lib/timeOff.ts`, `lib/profile.ts`.

### Phase 6: Sign in, PIN, update and notifications (changes 25, 29, 30, 31)

| # | Change | Test first |
|---|---|---|
| 25 | Sign in button always on; says what is missing at the field. Wrong PIN and lockout messages unchanged | field checks port (without the mock accounts) |
| 29 | A notification row that leads nowhere doesn't look tappable; new items get a "New" pill, not a red dot | row with an unknown link is not a button |
| 30 | Update required is a calm card with an ink "Update now" | render test |
| 31 | Temporary PIN expired says its message once | message appears once |

New pure files: `lib/phone.ts` (taken out of `lib/auth.ts`, which imports the
live database client and so can't be tested directly), `lib/notificationText.ts`
(taken out of `lib/queries/notifications.ts` for the same reason).

### Phase 7: Expenses (change 28)

Change 28 is six fixes in one line, so it is split into small pull requests:

| Part | Change | Test first |
|---|---|---|
| 28a | Amount and vehicle errors at the field, not pop-ups; "12abc" no longer read as 12 | `checkExpense`, `parseAmount` ports |
| 28b | Receipt really checked for JPG or PNG and 10 MB | `checkReceiptFile` port |
| 28c | Vehicle list shows "MPV, Toyota Alphard", not "sedan_executive"; an empty list stops spinning | uses `lib/route.ts`'s one name list |
| 28d | Leaving a filled form asks first | `hasDraft` port |

New pure file: `lib/expenses.ts` (totals, state, row text, the band text).

### Phase 8: final check

Every screen, light and dark, beside the mock. README's Status section and the
wiki page updated (as `AGENTS.md` asks). Then you decide when to release.

## The mock's rules: which become real, and where

`rules.ts` and the four `*Rules.ts` files in the mock. "Exists" means this app
already has the rule; I update its words, not its logic.

| Mock rule | Becomes | Lives in | Phase |
|---|---|---|---|
| `shortDate`, `longDate`, `dayMonth`, `dateNoWeekday`, `monthLong` | the existing formatters, new formats | `lib/timeFormat.ts` (exists) | 1c |
| `greeting` | moved out of the Jobs screen | `lib/jobGroups.ts` | 2 |
| `jobGroups`, `jobScreen`, `jobCount` | real, on real pickup timestamps | `lib/jobGroups.ts` (new) | 2 |
| `JOB_STATUS`, pill words and icons | one status table | `lib/statusTone.ts` (new) | 1b |
| `specialPay`, `payLabel` | exists; "20% comm" becomes "20% of the fare" | `lib/commissionRate.ts` (exists) | 3 |
| `contactFor`, `isDialable` | exists, unchanged | `lib/jobContact.ts` (exists) | none |
| `stopLabel`, `surchargeNote`, `vehicleLine` | real | `lib/route.ts` (new) | 3 |
| `navLinks` | **not ported**: today's links use the stop's map pin when it has one, which is better than the mock's place-name search | `TimelineStop.tsx` (exists) | none |
| `expenseTotals`, `expenseState`, `categoryLabel`, `expenseRowTitle`, `expenseRowSub`, `receiptTitle`, `stateBand`, `hasDraft`, `amountValue` | real | `lib/expenses.ts` (new) | 1c, 7 |
| `checkExpense`, `checkReceiptFile`, `parseAmount` | real | `lib/expenses.ts`, `lib/amount.ts` (new) | 7 |
| `normalisePhone`, `pinDigits`, `phoneChars` | moved out of `lib/auth.ts` | `lib/phone.ts` (new) | 6 |
| `checkSignIn` | **field checks only**; the account lookup is the mock's fake sign-in and stays there | `lib/phone.ts` | 6 |
| `checkPin` | real | `lib/phone.ts` | 6 |
| `pickDay`, `dayCount`, `rangeLabel`, `upcomingTimeOff`, `timeOffMeta`, `requestNote` | real | `lib/timeOff.ts` (new) | 5 |
| `monthCells`, `dayRole`, `shiftMonth`, `canGoPrev` | **not ported**: this app's calendar comes from `react-native-calendars`, which does these itself. I theme it with the tokens instead | none | 5 |
| `periodLabel`, `earnings`, `emptyEarnings`, `pagerHint`, `swipeStep`, `unpaidText` | update the existing period rules | `lib/earningsPeriod.ts` (exists) | 4 |
| `splitRM`, `formatRM` | real | `lib/money.ts` (new) | 4 |
| `notificationText`, `sentAt` | real, on the real payload | `lib/notificationText.ts` (new) | 6 |
| `availabilityPill`, `initials` | real | `lib/profile.ts` (new) | 5 |
| `MIN_VERSION`, `MOCK_ACCOUNTS`, `data.ts`, `store.ts`, `nav.ts`, `theme.ts` | **not ported**: mock-only. The real minimum version comes from the server; theme is already real | none | none |

## Where the mock and the real data disagree (the real data wins)

| What | Mock | Real app | What I'll do |
|---|---|---|---|
| Payment words | five, including Invoiced | four: paid, unpaid, waived, refunded (`lib/queries/earnings.ts:61`) | four words; no Invoiced |
| Cancelled and rejected jobs | shows "Cancelled"; rejected never shows | both come back as one "voided" kind (`lib/queries/jobs.ts:22`) | keep the raw status the database sends, so a cancelled job reads "Cancelled". Rejected jobs already leave the list |
| Drop-off | every job has one | the drop-off is only the last stop row. A job with no stop rows shows no drop-off at all (known issue 2) | flagged, not fixed here: it's a data question for the dispatcher side |
| Lockout message | always "15 minutes" | the server says how many minutes are left | keep the server's number |
| Notification title | "New job" | "New job · JOB-047": the job number is in it | keep the number, as its own small item beside the title (no dot) |
| Earnings | no 200-job limit | a "Showing your 200 most recent jobs" note when the cap is hit | keep the note, restyled as a neutral band |
| Navigation links | search by place name | uses the map pin when the stop has one | keep the real links |
| Receipt file | checked as picked | the app shrinks every photo to a JPEG before upload | check type and size before shrinking, as the mock says |
| Vehicle type on the job | the car's type | the type dispatch *asked for*, plus the assigned car's model and plate | keep it; the mock's line already reads the same way |

## Open items: not decided, today's behaviour stays

From "For you to decide" in `driver-inventory.md`. None of these block a phase.

1. **Report an issue** does nothing today. Kept as is (restyled only). Needs your call: call dispatch, or send a note?
2. **Rejected time off** never shows why. The database has no reason field. Kept as is.
3. **Loading, failed load, pull to refresh, push notifications**: the mock doesn't draw them. Today's behaviour stays; I restyle the spinner and the error boxes with the new pieces (the red band and a Retry button) so they don't look like the old app.
4. **Required version**: comes from the server, as today. The mock's "0.12.0" isn't used.
5. **Shared pill fix**: the admin mock's struck "Cancelled" pill is a little faint. This app gets its own pill, so I draw it at full contrast here. The admin mock's shared file isn't touched.
6. **One data set** (mock jobs JOB-137 to JOB-144): mock-only, nothing to do here.

Also noted from the spec's 25 known issues, outside the 31 changes and not in
this plan: notifications not marked read when the list is full (16), the
greeting using the phone's clock beside a Malaysia date (21, deliberate), and
no WhatsApp (22).

## Risks

- **A halfway look.** Phase 1 alone puts the new paint on today's layouts. That's why I suggest holding the release until phase 3.
- **Fonts on Android.** Inter has to load before the first screen draws, or text jumps. Today the splash screen hides by itself; I'll make it wait for the font (`expo-splash-screen` is already installed).
- **Can't see signed-in screens without a test driver.** If that isn't sorted before phase 1, each phase's look check falls back to tests and the sign-in screen only.
- **New package.** Only `@expo-google-fonts/inter` (fonts, no native code). It changes `package-lock.json`, so worktrees need `npm ci` rather than the shared `node_modules` shortcut.

## Questions for you

1. **Approve the plan?** Including the order of phases 2 to 7.
2. **Test driver**: will you add dev driver details to `.env`, or sign in yourself in the preview when needed?
3. **Release**: hold everything until all 8 phases are done, or release after phase 3 (look plus Jobs fixes)?
