# Testing — FleetMS Driver

100% test coverage is the key to great vibe coding. Tests let you move fast,
trust your instincts, and ship with confidence — without them, vibe coding is
just yolo coding. With tests, it's a superpower.

This app went a long time with no tests at all. That is now fixed for the pure
logic and the shared components; screens and data hooks are still uncovered.
Add to this as you touch things.

## Stack

- **[jest](https://jestjs.io/) 29** with the **`jest-expo` 54** preset — the
  preset handles the React Native / Expo module transforms so you don't hand-roll
  a Babel config.
- **[@testing-library/react-native](https://callstack.github.io/react-native-testing-library/) 14**
  for component tests.

## Run

```bash
npm test
```

Watch mode while working:

```bash
npm run test:watch
```

Coverage:

```bash
npm test -- --coverage
```

CI runs `npx tsc --noEmit` and `npm test` on every push to `master` and every
PR — see `.github/workflows/test.yml`.

## Sharp edges

**`render` is async.** RNTL v14 made `render()` return a Promise (React 19
concurrent rendering). Always `await` it:

```tsx
await render(<CommissionPill pct={20}/>);
expect(screen.getByText('20% comm')).toBeTruthy();
```

Forget the `await` and you get `TypeError: toJSON is not a function` followed by
`` `render` function has not been called `` — neither message mentions promises,
so it is easy to lose ten minutes here.

**Safe-area is mocked globally, and the `.default` unwrap is load-bearing.**
`AppFrame` calls `useSafeAreaInsets()` at the top of every screen, so screen
tests throw "No safe area value available" without a mock. The library ships one
at `react-native-safe-area-context/jest/mock`, but it is `export default {...}` —
requiring it without `.default` yields a module whose `useSafeAreaInsets` is
`undefined`, which fails with a *different* error that looks unrelated.

**AsyncStorage is mocked globally.** `ThemeProvider` imports
`@react-native-async-storage/async-storage` at module scope, so *any* component
that calls `useTokens()` pulls it in. Without a mock every such test dies with
`NativeModule: AsyncStorage is null`. The library's own Jest mock is wired in
`test/setup.ts` — you don't need to do anything per-test.

**All dates and times go through `lib/timeFormat.ts`, pinned to UTC+8.** Nothing
else in the app should call `toLocaleDateString`, `toLocaleTimeString`,
`getHours()`, `setHours(0,0,0,0)`, or `new Date(...).toISOString().slice(0,10)`.
The one deliberate exception is the greeting in `app/(tabs)/index.tsx`, which
describes the driver rather than a job.

Two traps worth knowing, both of which shipped before being caught:

- `new Date('2026-08-01')` — a date-ONLY string parses as **UTC**, while
  `new Date('2026-08-01T00:00:00')` parses as **local**. Rendering a stored
  `DATE` column through the first form shows the previous day west of UTC. Use
  `formatDateKey`, which formats the string and never builds a `Date`.
- `new Date(y, m, 1).toISOString().slice(0, 10)` builds *local* midnight and
  then prints it in UTC — at UTC+8 that lands on the last day of the previous
  month. Use `myMonthStartKey` / `myStartOfMonth`.

Date tests assert across several device timezones (`America/New_York`,
`Australia/Sydney`, …) so they can't pass by accident on a Malaysian machine.

**The timezone is also pinned to `Asia/Kuala_Lumpur`** in `test/globalSetup.js`.
Drivers and jobs are all in Malaysia and the app renders device-local wall-clock
time, so date tests need a fixed zone or they pass locally and fail on CI. This
has to be `globalSetup` rather than a setup file — Node caches the zone on first
`Date` use.

Where you can, sidestep the zone entirely by building dates from local
components (`new Date(2026, 6, 30, 14, 30)` is 14:30 local in *any* zone) rather
than from an ISO instant.

## Layout

```
test/
  globalSetup.js        TZ pin, runs before workers spawn
  setup.ts              per-file mocks (AsyncStorage, safe-area, expo-haptics, Sentry)
lib/__tests__/          pure helper tests
components/__tests__/   component tests
__tests__/screens/      screen tests — NOT under app/, see below
```

**Screen tests must not live under `app/`.** expo-router's `require.context`
regex matches every `.tsx` under the app root, and its ignore list covers only
`+html`, `+native-intent`, `+api`, and `+middleware` — nothing for `__tests__`
or `.test.`. A test file under `app/` therefore registers as a real **route**:
it ships inside the production APK, drags `react-test-renderer` in with it, and
renders as a stray tab that throws `jest is not defined` when tapped. Keep
screen tests in `__tests__/screens/` at the repo root.

## Conventions

- Test files sit in a `__tests__/` directory beside the code, named
  `<module>.test.ts` / `.test.tsx`.
- **Test what the code does, not that it exists.** `expect(x).toBeDefined()` is
  not a test. Assert real behaviour and real values.
- Say *why* in a comment when the assertion encodes a decision someone might
  otherwise "clean up" — e.g. the deliberate `14:30 pm` redundancy in
  `timeFormat.test.ts`, or the value-vs-null-check rule in
  `commissionRate.test.ts`. A test that fails without explaining itself invites
  a wrong fix.
- Never import secrets, API keys, or credentials into a test.

## What to cover

- New function → a test for it.
- Bug fix → a regression test that fails without the fix.
- New conditional (`if`/`else`, `switch`) → both branches.
- New error path → a test that triggers the error.
- Never commit code that makes existing tests fail.

## Keep pure decisions out of query modules

Anything under `lib/queries/` imports `lib/supabase.ts`, which constructs a live
client at import time. A test that only wants to check date arithmetic then has
to stand up a network client to do it.

So when a query module grows a real decision — a date range, a rule, a
comparison — put it in its own module beside the query and import it back in.
`lib/earningsPeriod.ts` was split out of `lib/queries/earnings.ts` on exactly
this basis, and the period boundaries went from untestable to 18 tests that run
in a millisecond with no mocks. `lib/commissionRate.ts` and `lib/semver.ts`
follow the same shape.

The screen test proves the payoff: `__tests__/screens/earnings.test.tsx` mocks
`lib/queries/earnings` but uses the REAL `lib/earningsPeriod`, so it asserts
against genuine period values rather than a mock's idea of them.

## Not covered yet

The screens other than Earnings, the React Query data hooks (`lib/queries/`,
`lib/mutations/`), realtime subscriptions, and auth. These need Supabase mocking
and a query-client wrapper. The commission-rate, earnings-period and time-format
helpers were done first because they carry real logic and need no mocking at all.
