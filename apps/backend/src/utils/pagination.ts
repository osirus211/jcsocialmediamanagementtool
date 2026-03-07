/**
 * Pagination Utility
 * 
 * Provides standardized pagination across the backend API
 */

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Parse and validate pagination parameters from query
 * 
 * @param query - Request query object
 * @returns Validated pagination parameters with skip calculated
 */
export function getPaginationParams(query: any): PaginationParams {
  // Parse page (default: 1, min: 1)
  let page = parseInt(query.page as string, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  // Parse limit (default: 20, min: 1, max: 100)
  let limit = parseInt(query.limit as string, 10);
  if (isNaN(limit) || limit < 1) {
    limit = 20;
  }
  if (limit > 100) {
    limit = 100;
  }

  // Calculate skip
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

/**
 * Format paginated response with data and metadata
 * 
 * @param data - Array of items for current page
 * @param total - Total count of items across all pages
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Formatted paginated response
 */
export function formatPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Create pagination metadata without data
 * Useful for responses that already have data formatted
 * 
 * @param total - Total count of items
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Pagination metadata
 */
export function createPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
  };
}
