import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { supabase } from '../supabase';
import { compareVersions } from '../semver';

// Force-update version gate. Reads the singleton driver_app_version_config
// row (readable by anon, so this works pre-login too) and compares it
// against the installed app's semver.
//
//   status 'required'    -> currentVersion < minimum_version    (hard block)
//   status 'recommended' -> currentVersion < recommended_version (soft nag)
//   status 'ok'          -> otherwise, OR while loading/erroring (fail-open —
//                            never trap a driver on a stuck screen over a
//                            network hiccup or a misconfigured/missing row)
//
// Query key ['app-version-config'] is invalidated from app/_layout.tsx on
// AppState 'active' transitions so a backgrounded-then-resumed app re-checks
// without needing a full cold start.

export type AppVersionGateStatus = 'ok' | 'recommended' | 'required';

export type AppVersionGateResult = {
  status: AppVersionGateStatus;
  currentVersion: string;
  recommendedVersion: string | null;
  minimumVersion: string | null;
  isLoading: boolean;
};

type ConfigRow = {
  recommended_version: string | null;
  minimum_version: string | null;
};

export function useAppVersionGate(): AppVersionGateResult {
  const currentVersion = Constants.expoConfig?.version ?? null;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['app-version-config'],
    queryFn: async (): Promise<ConfigRow> => {
      const { data, error } = await supabase
        .from('driver_app_version_config')
        .select('recommended_version, minimum_version')
        .eq('id', true)
        .single();
      if (error) throw error;
      return data as ConfigRow;
    },
    // Config changes rarely; avoid hammering it on every screen focus.
    staleTime: 5 * 60 * 1000,
  });

  const currentVersionStr = currentVersion ?? '0.0.0';

  // Fail-open: loading or errored -> 'ok', never block/nag on a network hiccup.
  if (isLoading || isError || !data) {
    return {
      status: 'ok',
      currentVersion: currentVersionStr,
      recommendedVersion: null,
      minimumVersion: null,
      isLoading,
    };
  }

  const { recommended_version: recommendedVersion, minimum_version: minimumVersion } = data;

  let status: AppVersionGateStatus = 'ok';
  if (minimumVersion && compareVersions(currentVersion, minimumVersion) < 0) {
    status = 'required';
  } else if (recommendedVersion && compareVersions(currentVersion, recommendedVersion) < 0) {
    status = 'recommended';
  }

  return {
    status,
    currentVersion: currentVersionStr,
    recommendedVersion,
    minimumVersion,
    isLoading: false,
  };
}
