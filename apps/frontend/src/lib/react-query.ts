import { QueryClient, DefaultOptions } from '@tanstack/react-query';

const queryConfig: DefaultOptions = {
  queries: {
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (client errors)
      if (error && typeof error === 'object' && 'status' in error) {
        const status = error.status as number;
        if (status >= 400 && status < 500) return false;
      }
      return failureCount < 2; // Retry up to 2 times
    },
    staleTime: 2 * 60 * 1000, // 2 minutes default
    gcTime: 30 * 60 * 1000, // 30 minutes in memory
  },
  mutations: {
    retry: 1,
  },
};

export const queryClient = new QueryClient({ 
  defaultOptions: queryConfig,
});

// Export devtools for development (install @tanstack/react-query-devtools if needed)
// export { ReactQueryDevtools } from '@tanstack/react-query-devtools';
