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

**AsyncStorage is mocked globally.** `ThemeProvider` imports
`@react-native-async-storage/async-storage` at module scope, so *any* component
that calls `useTokens()` pulls it in. Without a mock every such test dies with
`NativeModule: AsyncStorage is null`. The library's own Jest mock is wired in
`test/setup.ts` — you don't need to do anything per-test.

**The timezone is pinned to `Asia/Kuala_Lumpur`** in `test/globalSetup.js`.
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
  globalSetup.js   TZ pin, runs before workers spawn
  setup.ts         per-file mocks (AsyncStorage, expo-haptics, Sentry)
lib/__tests__/     pure helper tests
components/__tests__/  component tests
```

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

## Not covered yet

Screens (`app/`), the React Query data hooks (`lib/queries/`, `lib/mutations/`),
realtime subscriptions, and auth. These need Supabase mocking and a query-client
wrapper. The commission-rate and time-format helpers were done first because
they carry real logic and need no mocking at all.
