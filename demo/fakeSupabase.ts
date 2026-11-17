// Fake stand-in for lib/supabase.ts, used by the WEB PREVIEW ONLY.
//
// metro.config.js redirects imports of lib/supabase.ts to this file when
// EXPO_PUBLIC_DEMO_DATA=1 and the platform is web. Nothing in app/, lib/ or
// components/ knows about it. Off by default; see demo/README.md.
//
// It is not a PostgREST emulator. It supports exactly the call shapes the app
// makes (grep for `.from('` / `.rpc(` to see them) and returns rows from
// demo/fixtures.ts. Select strings are ignored: nested `alias:table(...)`
// shapes are built per table in `readTable`.

import { buildDb, type Db, type JobRow } from './fixtures';

type Json = Record<string, any>;
type Result = { data: any; error: any; count: number | null; status: number; statusText: string };

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T/;

function clone<T>(v: T): T {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

// ---- value comparison ------------------------------------------------------

/** Compare two column values. ISO timestamps compare as instants (the app mixes +08:00 and Z), numbers as numbers, the rest as text. */
function compare(a: unknown, b: unknown): number {
  if (typeof a === 'string' && typeof b === 'string' && ISO_DATETIME.test(a) && ISO_DATETIME.test(b)) {
    return Date.parse(a) - Date.parse(b);
  }
  const na = typeof a === 'number' || typeof a === 'boolean' ? Number(a) : NaN;
  const nb = typeof b === 'number' || typeof b === 'boolean' ? Number(b) : NaN;
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

type Test = (cell: unknown) => boolean;

function makeTest(op: string, value: any): Test {
  switch (op) {
    case 'eq':  return c => c !== null && c !== undefined && compare(c, value) === 0;
    case 'neq': return c => c === null || c === undefined || compare(c, value) !== 0;
    case 'gt':  return c => c != null && compare(c, value) > 0;
    case 'gte': return c => c != null && compare(c, value) >= 0;
    case 'lt':  return c => c != null && compare(c, value) < 0;
    case 'lte': return c => c != null && compare(c, value) <= 0;
    case 'in':  return c => c != null && (value as unknown[]).some(v => compare(c, v) === 0);
    case 'is':  return c => (value === null ? c === null || c === undefined : c === value);
    default:    return () => true; // an operator the app doesn't use: don't hide rows over it
  }
}

/**
 * Keep rows whose value at `path` passes `test`. A dotted path reaches into an
 * embedded resource: an embedded array is filtered element by element and the
 * parent is dropped when nothing is left (every use in the app is `!inner`); an
 * embedded object that fails drops the parent; a null embed drops it too.
 */
function filterPath(rows: Json[], path: string, test: Test): Json[] {
  const dot = path.indexOf('.');
  if (dot === -1) return rows.filter(r => test(r[path]));
  const head = path.slice(0, dot);
  const rest = path.slice(dot + 1);
  const out: Json[] = [];
  for (const r of rows) {
    const nested = r[head];
    if (Array.isArray(nested)) {
      const kept = filterPath(nested, rest, test);
      if (kept.length) out.push({ ...r, [head]: kept });
    } else if (nested && typeof nested === 'object') {
      if (filterPath([nested], rest, test).length) out.push(r);
    }
  }
  return out;
}

// ---- .or('a.eq.1,and(b.gte.2,c.in.(x,y))') ---------------------------------

function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

function parseValue(op: string, raw: string): any {
  if (op === 'in') return raw.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''));
  if (op === 'is') return raw === 'null' ? null : raw === 'true' ? true : raw === 'false' ? false : raw;
  return raw;
}

/** Build a row predicate from a PostgREST logic-tree string (`or` / `and` groups of `col.op.value`). */
function parseLogic(expr: string, mode: 'or' | 'and'): (row: Json) => boolean {
  const preds = splitTop(expr).map((item): ((row: Json) => boolean) => {
    const group = /^(and|or)\((.*)\)$/s.exec(item);
    if (group) return parseLogic(group[2], group[1] as 'or' | 'and');
    const m = /^([^.]+)\.([^.]+)\.(.*)$/s.exec(item);
    if (!m) return () => true;
    const [, col, op, raw] = m;
    // `col.not.in.(a,b)`: the inner operator, negated. Like SQL, a null cell never passes.
    if (op === 'not') {
      const inner = /^([^.]+)\.(.*)$/s.exec(raw);
      if (!inner) return () => true;
      const t = makeTest(inner[1], parseValue(inner[1], inner[2]));
      return row => row[col] != null && !t(row[col]);
    }
    const test = makeTest(op, parseValue(op, raw));
    return row => test(row[col]);
  });
  return row => (mode === 'or' ? preds.some(p => p(row)) : preds.every(p => p(row)));
}

// ---- failures (tests only) --------------------------------------------------

/** What a failing call answers with: PostgREST's error shape. `status` is optional and is only used as the HTTP status of the answer. */
export interface FakeError { message: string; code?: string; details?: string; hint?: string; status?: number }
/** What the failure rule is asked about: a table read, or a server command (rpc). */
export interface FailTarget { kind: 'table' | 'rpc'; name: string }

function failResult(error: FakeError): Result {
  return { data: null, error, count: null, status: error.status ?? 500, statusText: 'Error' };
}

// ---- the query builder -----------------------------------------------------

type Sort = { col: string; asc: boolean };

class FakeQuery implements PromiseLike<Result> {
  private filters: ((rows: Json[]) => Json[])[] = [];
  private sorts: Sort[] = [];
  private foreignSorts: (Sort & { table: string })[] = [];
  private limitN: number | null = null;
  private from = 0;
  private wantCount = false;
  private mode: 'many' | 'single' | 'maybe' = 'many';

  constructor(
    private readonly load: () => Json[] | null,
    /** Asked on every await. An error means this read fails; undefined means it goes ahead. */
    private readonly failure: () => FakeError | undefined = () => undefined,
  ) {}

  select(_columns?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.wantCount = true;
    return this;
  }
  private add(path: string, op: string, value: any) {
    const test = makeTest(op, value);
    this.filters.push(rows => filterPath(rows, path, test));
    return this;
  }
  eq(col: string, v: unknown)  { return this.add(col, 'eq', v); }
  neq(col: string, v: unknown) { return this.add(col, 'neq', v); }
  gt(col: string, v: unknown)  { return this.add(col, 'gt', v); }
  gte(col: string, v: unknown) { return this.add(col, 'gte', v); }
  lt(col: string, v: unknown)  { return this.add(col, 'lt', v); }
  lte(col: string, v: unknown) { return this.add(col, 'lte', v); }
  in(col: string, v: unknown[]) { return this.add(col, 'in', v); }
  is(col: string, v: unknown)  { return this.add(col, 'is', v); }

  /** With `foreignTable` the group tests the embedded row and nulls it when it fails (parent kept), like PostgREST. */
  or(expr: string, opts?: { foreignTable?: string; referencedTable?: string }) {
    const pred = parseLogic(expr, 'or');
    const table = opts?.foreignTable ?? opts?.referencedTable;
    this.filters.push(rows => table
      ? rows.map(r => (r[table] && !pred(r[table]) ? { ...r, [table]: null } : r))
      : rows.filter(pred));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean; foreignTable?: string; referencedTable?: string }) {
    const asc = opts?.ascending ?? true;
    const table = opts?.foreignTable ?? opts?.referencedTable;
    if (table) this.foreignSorts.push({ col, asc, table }); else this.sorts.push({ col, asc });
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) { this.from = from; this.limitN = to - from + 1; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  private run(): Result {
    const failed = this.failure();
    if (failed) return failResult(failed);
    const base = this.load();
    if (base === null) {
      return { data: null, count: null, status: 404, statusText: 'Not Found', error: { code: '42P01', message: 'relation does not exist', details: null, hint: null } };
    }
    let rows = clone(base);
    for (const f of this.filters) rows = f(rows);

    // Ordering through an embedded array reorders that array; through an
    // embedded object it is a no-op, exactly as in PostgREST.
    for (const fs of this.foreignSorts) {
      rows = rows.map(r => Array.isArray(r[fs.table])
        ? { ...r, [fs.table]: [...r[fs.table]].sort((a, b) => (fs.asc ? 1 : -1) * compare(a[fs.col] ?? '', b[fs.col] ?? '')) }
        : r);
    }
    if (this.sorts.length) {
      rows.sort((a, b) => {
        for (const s of this.sorts) {
          const av = a[s.col]; const bv = b[s.col];
          if (av == null && bv == null) continue;
          if (av == null) return 1;
          if (bv == null) return -1;
          const c = compare(av, bv);
          if (c !== 0) return s.asc ? c : -c;
        }
        return 0;
      });
    }
    const count = this.wantCount ? rows.length : null;
    if (this.limitN !== null || this.from) rows = rows.slice(this.from, this.limitN === null ? undefined : this.from + this.limitN);

    if (this.mode === 'many') return { data: rows, error: null, count, status: 200, statusText: 'OK' };
    if (rows.length === 0 && this.mode === 'single') {
      return {
        data: null, count, status: 406, statusText: 'Not Acceptable',
        error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows', hint: null },
      };
    }
    return { data: rows[0] ?? null, error: null, count, status: 200, statusText: 'OK' };
  }

  then<A = Result, B = never>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: any) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(onfulfilled, onrejected);
  }
}

// ---- tables ----------------------------------------------------------------

function toBase64(text: string): string {
  if (typeof btoa === 'function') return btoa(text);
  return Buffer.from(text, 'utf8').toString('base64');
}

const RECEIPT_SVG =
  // base64, not a URL-encoded string: react-native-web's Image drops the utf8 form.
  'data:image/svg+xml;base64,' +
  toBase64(
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480">' +
    '<rect width="360" height="480" fill="#f4f1ea"/>' +
    '<text x="180" y="60" font-family="monospace" font-size="20" text-anchor="middle" fill="#333">DEMO RECEIPT</text>' +
    '<g stroke="#bbb"><line x1="40" y1="100" x2="320" y2="100"/><line x1="40" y1="140" x2="320" y2="140"/>' +
    '<line x1="40" y1="180" x2="260" y2="180"/><line x1="40" y1="220" x2="300" y2="220"/></g>' +
    '<text x="180" y="420" font-family="monospace" font-size="14" text-anchor="middle" fill="#888">Not a real receipt</text></svg>',
  );

function defaultSearch(): string {
  try {
    return typeof window !== 'undefined' && window.location ? window.location.search : '';
  } catch {
    return '';
  }
}

/** The version-gate row. ?version=required or ?version=recommended forces that state. */
function versionConfig(search: string): Json {
  const want = /[?&]version=(required|recommended)\b/.exec(search)?.[1];
  const row = { id: true, recommended_version: '0.11.0', minimum_version: '0.1.0' };
  if (want === 'required') row.minimum_version = '99.0.0';
  if (want === 'recommended') row.recommended_version = '99.0.0';
  return row;
}

/** Plain job columns (no embeds), for the `jobs:job_id (...)` embed on assignments. */
const flatJob = (j: JobRow): Json => ({ ...j });

function readTable(db: Db, search: () => string, table: string): Json[] | null {
  const vehicleOf = (id: string) => db.vehicles.find(v => v.id === id) ?? null;
  const plate = (id: string) => { const v = vehicleOf(id); return v && { plate_number: v.plate_number, type: v.type, model: v.model }; };
  switch (table) {
    case 'drivers':
      return [{
        ...db.driver,
        organization: { name: db.org.name, driver_commission_rate: db.org.driver_commission_rate },
        default_vehicle: plate(db.driver.default_vehicle_id),
      }];
    case 'jobs':
      return db.jobs.map(j => ({
        ...j,
        assignments: db.assignments.filter(a => a.job_id === j.id).map(a => ({ id: a.id, is_current: a.is_current, vehicle: plate(a.vehicle_id) })),
        job_stops: db.jobStops.filter(s => s.job_id === j.id),
        job_surcharges: db.surcharges.filter(s => s.job_id === j.id),
      }));
    case 'assignments':
      return db.assignments.map(a => ({
        ...a,
        vehicle: plate(a.vehicle_id),
        jobs: flatJob(db.jobs.find(j => j.id === a.job_id)!),
      }));
    case 'expenses':
      return db.expenses.map(e => ({ ...e, vehicle: plate(e.vehicle_id) }));
    case 'driver_time_off': return db.timeOff as Json[];
    case 'push_log':        return db.pushLog as Json[];
    case 'driver_app_version_config': return [versionConfig(search())];
    default: return null;
  }
}

// ---- rpc -------------------------------------------------------------------

type Rpc = (args: Json) => any;

/** What the dispatcher would stamp as the driver's take-home when a job is done. */
function commissionFor(db: Db, job: JobRow): number | null {
  const passThrough = db.surcharges
    .filter(s => s.job_id === job.id && s.treatment_snapshot === 'pass_through' && !s.paid_in_advance)
    .reduce((sum, s) => sum + s.amount_snapshot, 0);
  if (job.commission_fixed_amount != null) return job.commission_fixed_amount + passThrough;
  if (job.amount == null) return null;
  const pct = job.commission_rate_override ?? db.driver.commission_rate ?? db.org.driver_commission_rate;
  return Math.round(job.amount * pct) / 100 + passThrough;
}

function rpcTable(db: Db): Record<string, Rpc> {
  const jobById = (id: string) => db.jobs.find(j => j.id === id);
  const newId = (prefix: string) => `${prefix}-demo-${db.nextId++}`;
  return {
    driver_confirm_assignment: ({ target_assignment_id }) => {
      const a = db.assignments.find(x => x.id === target_assignment_id);
      const j = a && jobById(a.job_id);
      if (j) j.status = 'confirmed';
      return null;
    },
    driver_reject_assignment: ({ target_assignment_id }) => {
      const a = db.assignments.find(x => x.id === target_assignment_id);
      if (a) a.is_current = false;
      return null;
    },
    driver_start_job: ({ target_job_id }) => {
      const j = jobById(target_job_id);
      if (j) j.status = 'in_progress';
      return null;
    },
    driver_complete_job: ({ target_job_id }) => {
      const j = jobById(target_job_id);
      if (j) {
        j.status = 'done';
        j.commission_amount = commissionFor(db, j);
        j.payment_status = 'unpaid';
        const a = db.assignments.find(x => x.job_id === j.id);
        if (a) a.completed_at = new Date().toISOString();
      }
      return null;
    },
    driver_log_expense: a => {
      const id = newId('x');
      const date: string = a.p_expense_date;
      db.expenses.unshift({
        id, category: a.p_category, amount: Number(a.p_amount), expense_date: date,
        receipt_path: a.p_receipt_path ?? null, notes: a.p_notes ?? null, voided_at: null,
        status: 'pending', vehicle_id: a.p_vehicle_id, created_at: new Date().toISOString(),
      });
      return id;
    },
    request_driver_time_off: a => {
      const id = newId('t');
      db.timeOff.push({
        id, starts_at: a.p_starts_at, ends_at: a.p_ends_at, reason: a.p_reason,
        notes: a.p_notes ?? null, status: 'pending', created_at: new Date().toISOString(),
      });
      return id;
    },
    cancel_driver_time_off: ({ p_id }) => {
      db.timeOff = db.timeOff.filter(t => t.id !== p_id);
      return null;
    },
    mark_notifications_read: ({ p_ids }) => {
      let n = 0;
      for (const row of db.pushLog) {
        if ((p_ids as string[]).includes(row.id) && row.read_at === null) { row.read_at = new Date().toISOString(); n++; }
      }
      return n;
    },
    driver_job_client_phone: ({ target_job_id }) => {
      const j = jobById(target_job_id);
      return db.clients.find(c => c.id === j?.client_id)?.phone ?? null;
    },
    driver_my_vehicles: () => db.vehicles.map(v => ({ ...v })),
  };
}

// ---- the client ------------------------------------------------------------

export interface FakeOptions {
  db?: Db;
  now?: () => Date;
  /** Page query string; read on every call so ?version=... works without a reload of the module. */
  search?: () => string;
  /**
   * FOR TESTS ONLY (the web demo never passes it). Called on every table read
   * and every rpc. Return an error to make that call resolve `{ data: null, error }`,
   * or undefined to let it through. Keep a counter in the function to fail once
   * and then succeed. An rpc that fails does not run.
   */
  fail?: (target: FailTarget) => FakeError | undefined;
}

export function createFakeSupabase(opts: FakeOptions = {}) {
  const db = opts.db ?? buildDb((opts.now ?? (() => new Date()))());
  const search = opts.search ?? defaultSearch;
  const rpcs = rpcTable(db);
  const fail = opts.fail ?? (() => undefined);
  let signedIn = true;
  const channels: any[] = [];

  const session = () => (signedIn
    ? { access_token: 'demo-token', refresh_token: 'demo-refresh', token_type: 'bearer', expires_in: 3600, user: { id: db.driver.id, email: 'demo-driver@example.com' } }
    : null);

  return {
    from: (table: string) => new FakeQuery(() => readTable(db, search, table), () => fail({ kind: 'table', name: table })),

    rpc: (name: string, args: Json = {}) => {
      const failed = fail({ kind: 'rpc', name });
      if (failed) return Promise.resolve(failResult(failed));
      const fn = rpcs[name];
      // Unknown rpcs (push token, version ping, PIN setup...) succeed quietly.
      return Promise.resolve({ data: fn ? clone(fn(args)) : null, error: null, count: null, status: 200, statusText: 'OK' });
    },

    auth: {
      getSession: async () => ({ data: { session: session() }, error: null }),
      signInWithPassword: async (_creds: Json) => {
        signedIn = true;
        return { data: { session: session(), user: session()?.user ?? null }, error: null };
      },
      signOut: async (_opts?: Json) => {
        if (!_opts || _opts.scope !== 'others') signedIn = false;
        return { error: null };
      },
      onAuthStateChange: (_cb: (event: string, session: unknown) => void) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },

    storage: {
      from: (_bucket: string) => ({
        createSignedUrl: async (_path: string, _expires: number) => ({ data: { signedUrl: RECEIPT_SVG }, error: null }),
        upload: async (path: string, _body: unknown, _opts?: Json) => ({ data: { path }, error: null }),
      }),
    },

    channel: (name: string) => {
      const ch: any = {
        topic: `realtime:${name}`,
        on: () => ch,
        subscribe: () => { if (!channels.includes(ch)) channels.push(ch); return ch; },
        unsubscribe: async () => 'ok',
      };
      return ch;
    },
    getChannels: () => [...channels],
    removeChannel: async (ch: any) => {
      const i = channels.indexOf(ch);
      if (i !== -1) channels.splice(i, 1);
      return 'ok';
    },
  };
}

export const supabase = createFakeSupabase();
export const supabaseConfigured = true;
