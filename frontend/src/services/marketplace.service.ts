import { http } from './http';
import type { MarketplaceItem } from '../types/api';

export const marketplaceService = {
  list: (category?: string) =>
    http.get<{ items: MarketplaceItem[] }>('/marketplace', category ? { category } : undefined),

  install: (item_id: string) =>
    http.post<{ message: string }>(`/marketplace/${item_id}/install`),
};
