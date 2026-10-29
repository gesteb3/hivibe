import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

/** Paginación por page/limit. Valores inválidos (≤0, texto) usan el default; limit se topa en 50. */
export function parsePagination(page?: string | number, limit?: string | number): Pagination {
  const pn = Math.floor(Number(page));
  const ln = Math.floor(Number(limit));
  const p = pn >= 1 ? pn : 1;
  const l = ln >= 1 ? Math.min(MAX_LIMIT, ln) : DEFAULT_LIMIT;
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function buildMeta(total: number, { page, limit }: Pagination) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export const ApiPagination = () =>
  applyDecorators(
    ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Página (desde 1)' }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: DEFAULT_LIMIT, description: `Elementos por página (máx. ${MAX_LIMIT})` }),
  );
