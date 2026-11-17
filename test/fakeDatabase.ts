// Switch a test file onto the demo's fake database (demo/fakeSupabase.ts, with
// the shared story in demo/fixtures.ts) instead of a hand-made stand-in.
//
// Two lines at the top of the test file. The first must sit at the top level of
// the file so Jest can hoist it above the imports; the path in `require` is
// relative to the test file, like the path in the mock:
//
//   jest.mock('../../supabase', () => require('../../../test/fakeDatabase').supabaseModule);
//   const fake = installFakeDatabase();            // import { installFakeDatabase } from '<rel>/test/fakeDatabase'
//
// Then, inside a test:
//   fake.db.jobs[0].status = 'cancelled';      // edit the story before the code under test runs
//   fake.failWith(t => (t.name === 'push_log' ? { message: 'offline' } : undefined));
//   jest.spyOn(supabase, 'rpc');               // count or inspect calls; the fake still answers
//
// Why the `require` form: the factory runs lazily, after Jest has hoisted the
// mock, so it cannot reach an `import`ed binding (the TDZ trap in TESTING.md).
//
// Each test gets a fresh story (`beforeEach`), so edits never leak. The client
// the app sees is one stable plain object that forwards to the current fake, so
// `jest.spyOn` works on it. Restore any spy you make (`spy.mockRestore()`).
//
// The fake ignores select strings: it cannot catch a misspelt or missing column.

import { createFakeSupabase, type FailTarget, type FakeError } from '../demo/fakeSupabase';
import { buildDb, type Db } from '../demo/fixtures';

type Fake = ReturnType<typeof createFakeSupabase>;
type FailRule = (target: FailTarget) => FakeError | undefined;

let current: Fake | null = null;
const live = (): Fake => {
  if (!current) throw new Error('test/fakeDatabase: call installFakeDatabase() at the top of the test file.');
  return current;
};

/** What the `jest.mock` factory returns: the same shape as lib/supabase.ts. */
export const supabaseModule = {
  supabase: {
    from: (table: string) => live().from(table),
    rpc: (name: string, args?: Record<string, any>) => live().rpc(name, args),
    get auth() { return live().auth; },
    get storage() { return live().storage; },
    channel: (name: string) => live().channel(name),
    getChannels: () => live().getChannels(),
    removeChannel: (ch: any) => live().removeChannel(ch),
  },
  supabaseConfigured: true,
};

export interface FakeDatabase {
  /** The plain story data of the current test. Edit rows here before the code under test runs. */
  readonly db: Db;
  /** Make table reads or rpcs fail. Return an error to fail that call, undefined to let it through. Cleared before each test. */
  failWith(rule: FailRule | undefined): void;
}

/**
 * Call once at the top level of a test file. Builds a fresh story before each
 * test. `now` picks "today" for the story (default: the real now). It moves the
 * story's dates only; if the code under test reads the clock, that is still the
 * real clock (TESTING.md: do not freeze Date).
 */
export function installFakeDatabase(opts: { now?: Date } = {}): FakeDatabase {
  let db: Db;
  let rule: FailRule | undefined;
  beforeEach(() => {
    const now = opts.now ?? new Date();
    db = buildDb(now);
    rule = undefined;
    current = createFakeSupabase({ db, now: () => now, search: () => '', fail: t => rule?.(t) });
  });
  return {
    get db() { return db; },
    failWith(r) { rule = r; },
  };
}
