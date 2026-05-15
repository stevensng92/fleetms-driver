import { QueryClient } from '@tanstack/react-query';

// Conservative defaults tuned for a phone on flaky LTE.
//   - staleTime 30s: prevents thrash on rapid screen revisits.
//   - retry 2: typical mobile dropouts recover within a couple of tries.
//   - refetchOnReconnect: when LTE comes back, refresh the jobs list.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
