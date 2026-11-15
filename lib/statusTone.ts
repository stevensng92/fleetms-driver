// One status table for the driver app: which tone, words and icon a job or
// payment status gets. Pure, so it is tested alone. Ported from the design
// source's src/lib/statusTone.ts and the statusGlyph map in src/ui/Status.tsx.
// The real app has no "Invoiced" payment state, so it is left out.
import type { IconName } from '../components/Icon';

export type Tone = 'green' | 'amber' | 'blue' | 'red' | 'neutral';
export type StatusSort = 'job' | 'payment';

export type StatusToneResult = {
  tone: Tone;
  label: string;
  icon: IconName | null;
  /** Shown with a tick, in the plain text colour (Done). */
  done?: boolean;
  /** Shown with a line through it (Cancelled). */
  struck?: boolean;
};

const JOB: Record<string, StatusToneResult> = {
  pending: { tone: 'amber', label: 'Pending', icon: 'clock' },
  confirmed: { tone: 'green', label: 'Confirmed', icon: 'circleCheck' },
  in_progress: { tone: 'blue', label: 'In Progress', icon: 'navigation' },
  done: { tone: 'neutral', label: 'Done', icon: 'check', done: true },
  cancelled: { tone: 'neutral', label: 'Cancelled', icon: 'ban', struck: true },
};

const PAYMENT: Record<string, StatusToneResult> = {
  paid: { tone: 'green', label: 'Paid', icon: 'badgeCheck' },
  unpaid: { tone: 'amber', label: 'Unpaid', icon: 'hourglass' },
  waived: { tone: 'neutral', label: 'Waived', icon: 'circleMinus' },
  refunded: { tone: 'red', label: 'Refunded', icon: 'undo2' },
};

const TABLES = { job: JOB, payment: PAYMENT };

/** "In Progress", "in-progress", "IN_PROGRESS" all become "in_progress". */
function toKey(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function statusTone(kind: StatusSort, status: string): StatusToneResult {
  const hit = TABLES[kind][toKey(status)];
  return hit ? { ...hit } : { tone: 'neutral', label: status, icon: null };
}
