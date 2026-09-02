import { useState, useMemo } from 'react';

interface UsePaginationOptions {
  total: number;
  limit?: number;
  initialOffset?: number;
}

export function usePagination({ total, limit = 50, initialOffset = 0 }: UsePaginationOptions) {
  const [offset, setOffset] = useState(initialOffset);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const pages = useMemo(() => {
    const range: (number | '...')[] = [];
    const delta = 2;
    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    range.push(1);
    if (left > 2) range.push('...');
    for (let i = left; i <= right; i++) range.push(i);
    if (right < totalPages - 1) range.push('...');
    if (totalPages > 1) range.push(totalPages);

    return range;
  }, [totalPages, currentPage]);

  const goToPage = (page: number) => {
    const newOffset = Math.max(0, Math.min(total - 1, (page - 1) * limit));
    setOffset(newOffset);
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  return {
    offset,
    limit,
    total,
    currentPage,
    totalPages,
    pages,
    goToPage,
    nextPage,
    prevPage,
    hasNext,
    hasPrev,
    setOffset,
  };
}
