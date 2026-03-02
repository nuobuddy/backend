import { Response } from 'express';

/**
 * Unified API response structure.
 * - `status`: HTTP status code or custom status string
 * - `data`: Response payload (optional)
 * - `message`: Human-readable message (optional)
 */
export interface ApiResponse<T = unknown> {
  status: number | string
  data?: T
  message?: string
}

/**
 * Send a successful response.
 */
export function sendSuccess<T = unknown>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200,
): void {
  const response: ApiResponse<T> = { status: statusCode };
  if (data !== undefined) response.data = data;
  if (message !== undefined) response.message = message;
  res.status(statusCode).json(response);
}

/**
 * Send a generic error response.
 */
export function sendError(res: Response, message?: string, statusCode = 400): void {
  const response: ApiResponse = { status: statusCode };
  if (message !== undefined) response.message = message;
  res.status(statusCode).json(response);
}

/**
 * Send a 404 Not Found response.
 */
export function sendNotFound(res: Response, message = 'Not Found'): void {
  const response: ApiResponse = { status: 404, message };
  res.status(404).json(response);
}

/**
 * Send a 401 Unauthorized response.
 */
export function sendUnauthorized(res: Response, message = 'Unauthorized'): void {
  const response: ApiResponse = { status: 401, message };
  res.status(401).json(response);
}

/**
 * Send a 403 Forbidden response.
 */
export function sendForbidden(res: Response, message = 'Forbidden'): void {
  const response: ApiResponse = { status: 403, message };
  res.status(403).json(response);
}

/**
 * Send a 500 Internal Server Error response.
 */
export function sendServerError(res: Response, message = 'Internal Server Error'): void {
  const response: ApiResponse = { status: 500, message };
  res.status(500).json(response);
}
