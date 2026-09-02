import { http } from './http';
import type { SearchResults } from '../types/api';

export const searchService = {
  search: (q: string) =>
    http.get<SearchResults>('/search', { q }),
};
