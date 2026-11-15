// The pill look shared by job and payment statuses, and the payment table.
// Job statuses live in lib/jobStatus.ts, the one place that reads them. Pure,
// so it is tested alone. Ported from the design source's src/lib/statusTone.ts
// and the statusGlyph map in src/ui/Status.tsx. The real app has no "Invoiced"
// payment state, so it is left out.
import type { IconName } from '../components/Icon';

export type Tone = 'green' | 'amber' | 'blue' | 'red' | 'neutral';

export type StatusToneResult = {
  tone: Tone;
  label: string;
  icon: IconName | null;
  /** Shown with a tick, in the plain text colour (Done). */
  done?: boolean;
  /** Shown with a line through it (Cancelled, Rejected). */
  struck?: boolean;
};

const PAYMENT: Record<string, StatusToneResult> = {
  paid: { tone: 'green', label: 'Paid', icon: 'badgeCheck' },
  unpaid: { tone: 'amber', label: 'Unpaid', icon: 'hourglass' },
  waived: { tone: 'neutral', label: 'Waived', icon: 'circleMinus' },
  refunded: { tone: 'red', label: 'Refunded', icon: 'undo2' },
};

/** "In Progress", "in-progress", "IN_PROGRESS" all become "in_progress". */
export function toKey(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** A payment status's pill. Anything not in the table shows its own word, neutral. */
export function paymentTone(status: string): StatusToneResult {
  const hit = PAYMENT[toKey(status)];
  return hit ? { ...hit } : { tone: 'neutral', label: status, icon: null };
}
