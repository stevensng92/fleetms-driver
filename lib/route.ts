import { formatClock, type ClockStyle } from './timeFormat';

// Plain decisions about a job's route, charges and vehicle, kept apart from the
// screens and the query so they can be tested without a database client.
// Ported from the design mock's rules.ts (stopLabel, surchargeNote,
// vehicleLine), adapted to the real data shapes.

/** What the database gives for a stop: "Pickup", "Stop 3" (by row position) or "Dropoff". */
type StopKindLike = { kind: string };

/**
 * The words a driver reads for stop `i`: Pickup, Stop 1, Stop 2, Drop-off.
 * The middle stops are counted here, not read from the row position, so the
 * driver always sees an unbroken 1, 2, 3 even if a stop was deleted.
 */
export function stopLabel(stops: StopKindLike[], i: number): string {
  const kind = stops[i].kind;
  if (kind === 'Pickup') return 'Pickup';
  if (kind === 'Dropoff') return 'Drop-off';
  const middle = stops.slice(0, i + 1).filter(s => s.kind !== 'Pickup' && s.kind !== 'Dropoff').length;
  return `Stop ${middle}`;
}

/** "1 stop", "3 stops". */
export function stopCountLabel(n: number): string {
  return `${n} ${n === 1 ? 'stop' : 'stops'}`;
}

/**
 * What a surcharge does to the driver's pay. Paid in advance wins: once the
 * cash is in hand it is not owed again, whatever the treatment says.
 */
export function surchargeNote(s: { treatment: 'commissionable' | 'pass_through'; paidInAdvance: boolean }): string {
  if (s.paidInAdvance) return 'Paid in advance';
  return s.treatment === 'pass_through' ? 'Added to your pay' : 'Counts toward fare';
}

// The one list of vehicle type names. The job card and the profile both read it.
const VEHICLE_TYPE_LABEL: Record<string, string> = {
  sedan:           'Sedan',
  sedan_executive: 'Executive',
  mpv:             'MPV',
  van:             'Van',
  coach:           'Coach',
};

/** "MPV" for "mpv"; a type we do not know passes through unchanged. */
export function vehicleTypeLabel(type: string): string {
  return VEHICLE_TYPE_LABEL[type] ?? type;
}

/**
 * The vehicle line on the client card: "MPV, Alphard WA 1234 B". The type is
 * what dispatch asked for; the model and plate belong to the assigned car.
 * Parts that are missing are dropped; null when there is nothing at all.
 */
export function vehicleLine(v: { type: string | null; model: string | null; plate: string | null }): string | null {
  const car = [v.model, v.plate].filter(Boolean).join(' ');
  const parts = [v.type ? vehicleTypeLabel(v.type) : null, car || null].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** A stop as the job detail query returns it. */
export type RawStop = {
  kind: string;
  location: string;
  detail: string | null;
  scheduledAt: string | null;
  lat: number | null;
  lng: number | null;
};

/** A stop as the route timeline draws it. `time` is null when the stop has none, and then no time line shows. */
export type RouteStop = {
  label: string;
  time: string | null;
  place: string;
  lat: number | null;
  lng: number | null;
};

export function routeStops(stops: RawStop[], clock: ClockStyle = '24h'): RouteStop[] {
  return stops.map((s, i) => ({
    label: stopLabel(stops, i),
    time: s.scheduledAt ? formatClock(s.scheduledAt, clock) : null,
    place: s.location + (s.detail ? `, ${s.detail}` : ''),
    lat: s.lat,
    lng: s.lng,
  }));
}
