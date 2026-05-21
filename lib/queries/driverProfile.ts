import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

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
