import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type DriverVehicle = {
  id: string;
  plateNumber: string;
  type: string;
  model: string | null;
  capacity: number | null;
  isDefault: boolean;
};

async function fetchMyVehicles(): Promise<DriverVehicle[]> {
  const { data, error } = await supabase.rpc('driver_my_vehicles');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    plateNumber: r.plate_number,
    type: r.type,
    model: r.model,
    capacity: r.capacity,
    isDefault: r.is_default,
  }));
}

export function useMyVehicles() {
  return useQuery({
    queryKey: ['driver-vehicles'],
    queryFn: fetchMyVehicles,
    staleTime: 5 * 60_000,
  });
}
