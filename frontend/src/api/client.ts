import { API_BASE_URL } from '@/lib/env';

import type { ApiErrorPayload } from './types';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, message: string, status: number, details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  token?: string | null;
  body?: unknown;
  signal?: AbortSignal;
}

function buildHeaders(options: ApiRequestOptions): Headers {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  return headers;
}

function parseErrorPayload(payload: unknown, status: number): ApiError {
  const envelope = payload as Partial<ApiErrorPayload> | null;
  const error = envelope?.error;
  if (error && typeof error.code === 'string') {
    return new ApiError(error.code, error.message ?? '', status, error.details ?? null);
  }
  return new ApiError('internal_error', 'Unexpected server response', status, null);
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: buildHeaders(options),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError('network_error', 'Network request failed', 0, null);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw parseErrorPayload(payload, response.status);
  }

  return payload as T;
}

export { API_BASE_URL };
