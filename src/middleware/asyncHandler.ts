import { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Wraps an async route handler to automatically forward thrown errors to
 * Express's error-handling middleware via `next(err)`.
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await UserService.findAll();
 *   sendSuccess(res, users);
 * }));
 */
export function asyncHandler(fn: AsyncRouteHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
