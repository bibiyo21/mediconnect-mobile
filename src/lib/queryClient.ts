import { ApiError } from '@mediconnect/api-client';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';

// React Query pauses and resumes requests with the device's connectivity.
onlineManager.setEventListener((setOnline) => {
  const subscription = Network.addNetworkStateListener((state) => setOnline(state.isConnected !== false));
  return () => subscription.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Never retry client errors (401/403/404/422); retry network and 5xx twice.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
});
