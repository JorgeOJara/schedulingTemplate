import { useMemo } from 'react';

interface PaginationParams {
  page: number;
  limit: number;
}

export const usePagination = (totalItems: number, params: PaginationParams) => {
  const { page, limit } = params;
  
  const totalPages = Math.ceil(totalItems / limit);
  
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * limit;
    return (items: any[]) => items.slice(start, start + limit);
  }, [page, limit]);

  return {
    page,
    limit,
    totalPages,
    paginatedItems,
  };
};
