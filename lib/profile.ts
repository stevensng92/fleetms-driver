import type { Tone } from './statusTone';
import { vehicleTypeLabel } from './route';

// Pure words and rules for the Profile identity card (change 26). They live
// here, not in lib/queries/driverProfile.ts, because that file builds a live
// database client when it is imported.

type Availability = 'available' | 'pending_confirmation' | 'on_job' | 'unavailable';

/** The pill under the driver's name. An inactive driver is never green. */
export function availabilityPill(p: { isActive: boolean; availability: Availability }): { label: string; tone: Tone } {
  if (!p.isActive) return { label: 'Inactive', tone: 'neutral' };
  switch (p.availability) {
    case 'available': return { label: 'Available', tone: 'green' };
    case 'pending_confirmation': return { label: 'Pending confirmation', tone: 'amber' };
    case 'on_job': return { label: 'On shift', tone: 'green' };
    default: return { label: 'Off duty', tone: 'neutral' };
  }
}

/** "Azman bin Yusof" reads "AY": "bin", "binti", "bt" and "b." are skipped, then the first two words. */
export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter((w) => w !== '' && !/^(bin|binti|bt|b\.)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** "WXY 1234, MPV, Alphard": the vehicle line on Profile. */
export function formatVehicleLine(v: { plate: string; type: string; model: string | null } | null): string {
  if (!v) return 'No vehicle assigned';
  return [v.plate, vehicleTypeLabel(v.type), v.model].filter(Boolean).join(', ');
}
