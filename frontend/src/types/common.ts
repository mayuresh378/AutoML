export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface QueryState<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isSuccess: boolean;
}

export interface MutationState<T = any> {
  mutate: (vars: T) => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isSuccess: boolean;
  reset: () => void;
}

export interface PaginationState {
  offset: number;
  limit: number;
  total: number;
}

export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

export interface FilterState {
  search?: string;
  status?: string;
  category?: string;
  tags?: string[];
  dateRange?: { start: string; end: string };
}

export type ActionState = 'idle' | 'submitting' | 'success' | 'error';

export interface FormField<T = string> {
  value: T;
  error?: string;
  touched: boolean;
  dirty: boolean;
}

export type Theme = 'dark' | 'light';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}
