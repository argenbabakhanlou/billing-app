import { API_BASE_URL } from '../config';
import type { IsoDate } from '../types';

export const UNAVAILABLE = 530;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: string,
  ) {
    super(`${method} ${path} failed with ${status}: ${body}`);
    this.name = 'ApiError';
  }
}

export function isUnavailableError(error: unknown): boolean {
  return error instanceof ApiError && error.status === UNAVAILABLE;
}

interface RequestOptions {
  today: IsoDate;
  body?: unknown;
}

export async function apiRequest(
  method: 'GET' | 'POST',
  path: string,
  { today, body }: RequestOptions,
): Promise<string> {
  const headers: Record<string, string> = { Today: today };
  if (method === 'POST') headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  });

  const text = await response.text();
  if (!response.ok) throw new ApiError(response.status, method, path, text);
  return text;
}

export async function apiRequestJson<T>(
  method: 'GET' | 'POST',
  path: string,
  options: RequestOptions,
): Promise<T> {
  return JSON.parse(await apiRequest(method, path, options)) as T;
}
