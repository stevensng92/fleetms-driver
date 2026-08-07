import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { resolveDriverBaseline, type CommissionBasis } from '../commissionRate';

// Full driver profile for the Profile screen + the Jobs tab greeting.
// Joins drivers → organizations → default vehicle via PostgREST embeds.
// RLS scopes to the calling user's own driver row (private.is_driver_self).
//
// Composite-FK gotcha: default_vehicle FK is composite (org_id, default_vehicle_id),
// so we spell the constraint name to dodge PGRST201. Same trick as elsewhere.

export type DriverAvailability =
  | 'available'
  | 'pending_confirmation'
  | 'on_job'
  | 'unavailable';

export type DriverProfile = {
  id: string;
  name: string;
  initials: string;
  phone: string;
  licenseClass: string | null;
  availability: DriverAvailability;
  isActive: boolean;
  org: { name: string };
  vehicle: {
    plate: string;
    type: string;
    model: string | null;
  } | null;
};

function deriveInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

export function useDriverProfile() {
  return useQuery({
    queryKey: ['driver-profile'],
    queryFn: async (): Promise<DriverProfile | null> => {
      const { data, error } = await supabase
        .from('drivers')
        .select(`
          id, name, phone, license_class, availability, is_active,
          organization:organizations!drivers_org_id_fkey ( name ),
          default_vehicle:vehicles!drivers_default_vehicle_org_fkey ( plate_number, type, model )
        `)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const org = Array.isArray(data.organization)
        ? (data.organization[0] as any)
        : (data.organization as any);
      const veh = Array.isArray(data.default_vehicle)
        ? (data.default_vehicle[0] as any)
        : (data.default_vehicle as any);

      return {
        id: data.id as string,
        name: data.name as string,
        initials: deriveInitials(data.name as string),
        phone: data.phone as string,
        licenseClass: (data.license_class as string | null) ?? null,
        availability: data.availability as DriverAvailability,
        isActive: data.is_active as boolean,
        org: { name: org?.name ?? '—' },
        vehicle: veh
          ? { plate: veh.plate_number, type: veh.type, model: veh.model ?? null }
          : null,
      };
    },
    // Profile data is stable; long stale time avoids hammering on every screen mount
    staleTime: 5 * 60 * 1000,
  });
}

// The driver's normal pay — ladder rungs 3, 4, 5 — read in ONE round-trip.
//
// A plain async function, not a hook, because its three callers are all
// `queryFn` bodies (Jobs list, Job Detail, Earnings) and cannot call hooks.
// Each of them used to fetch `organizations.driver_commission_rate` on its own;
// they now share this, so a driver's own rate can't reach one screen and miss
// another — the exact split that had `normalizeOrgRate` guarding the value on
// Earnings only.
//
// The org rate rides along on the embed rather than in a second query: the
// `drivers` row has to be read anyway for rungs 3–4, and its organization is
// one FK hop away. `drivers_org_id_fkey` is spelled out for the same reason as
// above — the composite-FK ambiguity that yields PGRST201.
//
// Degrades to null on any failure, which reads as "we don't know what normal is
// for this driver": fees still surface, rate badges go quiet. Losing a badge
// beats blocking the driver's job board, and this call is deliberately NOT
// allowed to throw into the queries that depend on it.
//
// Both `drivers.commission_rate` (dispatcher v0.30.0.0) and
// `drivers.commission_fixed_amount` (v0.31.0.0) were verified present on prod
// before this shipped. That check is not optional: PostgREST fails the ENTIRE
// query on one unknown column, so selecting a column that hasn't been migrated
// yet would empty every driver's job board rather than degrade.
export async function fetchCommissionBaseline(): Promise<CommissionBasis | null> {
  const { data, error } = await supabase
    .from('drivers')
    .select(`
      commission_rate,
      commission_fixed_amount,
      organization:organizations!drivers_org_id_fkey ( driver_commission_rate )
    `)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const org = Array.isArray(data.organization)
    ? (data.organization[0] as any)
    : (data.organization as any);

  return resolveDriverBaseline(
    data.commission_fixed_amount == null ? null : Number(data.commission_fixed_amount),
    data.commission_rate == null ? null : Number(data.commission_rate),
    org?.driver_commission_rate,
  );
}

// Derived display strings for the Profile screen.

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  sedan:           'Sedan',
  sedan_executive: 'Executive',
  mpv:             'MPV',
  van:             'Van',
  coach:           'Coach',
};

export function formatVehicleLine(v: DriverProfile['vehicle']): string {
  if (!v) return 'No vehicle assigned';
  const parts = [v.plate, VEHICLE_TYPE_LABEL[v.type] ?? v.type, v.model].filter(Boolean);
  return parts.join(' · ');
}

const AVAILABILITY_LABEL: Record<DriverAvailability, { label: string; on: boolean }> = {
  available:            { label: 'AVAILABLE',     on: true  },
  pending_confirmation: { label: 'PENDING CONFIRMATION', on: true },
  on_job:               { label: 'ON SHIFT',      on: true  },
  unavailable:          { label: 'OFF DUTY',      on: false },
};

export function availabilityBadge(a: DriverAvailability): { label: string; on: boolean } {
  return AVAILABILITY_LABEL[a] ?? { label: a.toUpperCase(), on: false };
}
