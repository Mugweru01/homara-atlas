import { useQuery } from '@tanstack/react-query';

export function useAnalytics<T>(path: string) {
  return useQuery({
    queryKey: ['analytics', path],
    queryFn: async (): Promise<T> => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/v1/analytics/${path}`
      );
      if (!response.ok) throw new Error(`Analytics request failed (${response.status})`);
      return response.json();
    },
  });
}
