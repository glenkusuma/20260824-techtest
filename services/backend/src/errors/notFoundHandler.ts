import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./ApiError.js";

/**
 * Terminal route handler for unmatched paths. Delegates a 404
 * {@link ApiError} to the error handler so the response uses the standard
 * envelope rather than Express's default HTML error page.
 * @param req The incoming request; its method and URL form the error message.
 * @param _res The response (unused, the error handler writes it).
 * @param next The next middleware, invoked with the 404 `ApiError`.
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};
