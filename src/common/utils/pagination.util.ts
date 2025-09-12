/**
 * Utility functions for handling pagination
 */

export interface PaginationOptions {
  page?: number;
  perPage?: number;
  maxPerPage?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Parse and validate pagination parameters
 */
export function parsePaginationOptions(
  options: PaginationOptions,
  defaults: { page: number; perPage: number; maxPerPage: number } = {
    page: 1,
    perPage: 50,
    maxPerPage: 100,
  },
): { page: number; perPage: number; skip: number; take: number } {
  const page = Math.max(1, options.page || defaults.page);
  const perPage = Math.min(
    Math.max(1, options.perPage || defaults.perPage),
    defaults.maxPerPage,
  );

  const skip = (page - 1) * perPage;
  const take = perPage;

  return { page, perPage, skip, take };
}

/**
 * Create pagination metadata
 */
export function createPaginationMeta(
  page: number,
  perPage: number,
  total: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / perPage);

  return {
    page,
    perPage,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Apply pagination to an array
 */
export function paginateArray<T>(
  array: T[],
  options: PaginationOptions,
): PaginationResult<T> {
  const { page, perPage, skip, take } = parsePaginationOptions(options);

  const total = array.length;
  const paginatedData = array.slice(skip, skip + take);
  const pagination = createPaginationMeta(page, perPage, total);

  return {
    data: paginatedData,
    pagination,
  };
}

/**
 * Create pagination response for upstream compatibility
 */
export function createUpstreamPaginationResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  upstreamFormat?: any,
): any {
  if (upstreamFormat) {
    return {
      ...upstreamFormat,
      data: data,
      pagination: {
        page: pagination.page,
        per_page: pagination.perPage,
        total: pagination.total,
        total_pages: pagination.totalPages,
        has_next: pagination.hasNext,
        has_prev: pagination.hasPrev,
      },
    };
  }

  return {
    code: 200,
    status: "OK",
    data: data,
    pagination: {
      page: pagination.page,
      per_page: pagination.perPage,
      total: pagination.total,
      total_pages: pagination.totalPages,
      has_next: pagination.hasNext,
      has_prev: pagination.hasPrev,
    },
  };
}
