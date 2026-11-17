// The one place an error becomes words a driver sees. Every load box and every
// pop-up after a failed button press asks this module; no screen shows an
// error's own text. The raw error goes to Sentry instead.
//
// Pure apart from the Sentry report: no database client or React at import
// time, so it is tested without mocks. All five sentences live here, so a
// Malay version later is one file.

export type ErrorKind = 'offline' | 'signedOut' | 'notAllowed' | 'jobChanged' | 'other';

const WORDS: Record<ErrorKind, string> = {
  offline: 'No signal. Check your connection and try again.',
  signedOut: "You've been signed out. Please sign in again.",
  notAllowed: "This isn't available to you. Call dispatch if you think it should be.",
  jobChanged: "Dispatch has changed this job. It's been updated on your screen.",
  other: 'Something went wrong. Try again, or call dispatch if it keeps happening.',
};

// Read the fields of whatever was thrown: a PostgREST error object, an Error,
// a string, or nothing at all.
function fieldsOf(e: unknown) {
  if (typeof e === 'string') return { message: e, code: '', status: undefined as number | undefined, name: '' };
  const o = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
  return {
    message: typeof o.message === 'string' ? o.message : '',
    code: typeof o.code === 'string' ? o.code : '',
    // supabase-js puts no HTTP status on rpc errors by default; accept it when present.
    status: typeof o.status === 'number' ? o.status : undefined,
    name: typeof o.name === 'string' ? o.name : '',
  };
}

const OFFLINE_WORDING = /network request failed|failed to fetch|network error|request timed out|operation was aborted/i;
const SIGNED_OUT_WORDING = /jwt expired|invalid refresh token|refresh token.*(not found|invalid)/i;
const NOT_ALLOWED_WORDING = /^(not authorized|not an active driver)/i;
// "Cannot <action> a <status> job|assignment": the status word is open, so a new one still matches.
const JOB_CHANGED_WORDING = [
  /^cannot (confirm|reject|start|complete) an? .+ (job|assignment)\b/i,
  /^assignment not found or no longer current/i,
  /^no current assignment for job/i,
];

/** Sort any thrown value into one of five kinds. Order matters: offline, signedOut, notAllowed, jobChanged, other. */
export function errorKind(e: unknown): ErrorKind {
  const { message, code, status, name } = fieldsOf(e);
  if (status === 0 || name === 'AbortError' || name === 'TimeoutError' || OFFLINE_WORDING.test(message)) return 'offline';
  if (status === 401 || code === 'PGRST301' || code === 'PGRST303' || SIGNED_OUT_WORDING.test(message)) return 'signedOut';
  if (status === 403 || code === '42501' || NOT_ALLOWED_WORDING.test(message)) return 'notAllowed';
  if (JOB_CHANGED_WORDING.some(re => re.test(message))) return 'jobChanged';
  return 'other';
}

// Sentry hears about each kind once per app run, so a driver tapping Retry in a
// dead spot does not flood it. "other" and "jobChanged" also report each new
// raw wording once, so an unrecognised server rule still surfaces.
const reportedKinds = new Set<ErrorKind>();
const reportedWordings = new Set<string>();
/** For tests only: forget what was already reported. */
export const resetErrorWordsReported = () => { reportedKinds.clear(); reportedWordings.clear(); };

function report(e: unknown, kind: ErrorKind) {
  const wording = fieldsOf(e).message || String(e);
  const newKind = !reportedKinds.has(kind);
  const newWording = (kind === 'other' || kind === 'jobChanged') && !reportedWordings.has(wording);
  if (!newKind && !newWording) return;
  reportedKinds.add(kind);
  reportedWordings.add(wording);
  // Lazy require so a test that never meets an error needs no Sentry mock.
  try { require('@sentry/react-native').captureException(e, { tags: { errorKind: kind } }); } catch {}
}

/** The one sentence a driver sees for any error. Reports the raw error to Sentry on the way. */
export function errorWords(e: unknown): string {
  const kind = errorKind(e);
  report(e, kind);
  return WORDS[kind];
}
