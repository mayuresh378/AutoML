import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { getErrorMessage } from '../services/http';

interface DataQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  isSuccess: boolean;
  isEmpty: boolean;
  refetch: () => void;
}

export function useDataQuery<T>(
  queryKey: any[],
  queryFn: () => Promise<T>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    select?: (data: T) => any;
    emptyCheck?: (data: T) => boolean;
  },
): DataQueryResult<T> {
  const { data, isLoading, isError, error, isSuccess, refetch } = useQuery({
    queryKey,
    queryFn,
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    ...options,
  } as UseQueryOptions);

  const isEmpty = isSuccess && (options?.emptyCheck ? options.emptyCheck(data as T) : !data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && data !== null && Object.keys(data).length === 0));

  return {
    data: data as T | undefined,
    isLoading,
    isError,
    errorMessage: isError ? getErrorMessage(error) : null,
    isSuccess,
    isEmpty,
    refetch,
  };
}
