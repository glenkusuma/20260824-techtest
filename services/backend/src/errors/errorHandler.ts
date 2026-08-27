import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

/**
 * Express error middleware that normalizes any thrown error into the standard
 * error envelope. Zod validation failures map to `400`, operational
 * {@link ApiError}s relay their own status/message/details, and anything else
 * becomes `500` (with the message stripped in production). Internal errors are
 * logged here since they represent genuinely unhandled failures.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const isValidation = error instanceof ZodError;
  const isOperational = error instanceof ApiError;
  const statusCode = isOperational
    ? error.statusCode
    : isValidation
      ? 400
      : 500;

  if (!isOperational && !isValidation) {
    console.error("Unhandled backend error:", error);
  }

  const response: {
    success: false;
    statusCode: number;
    message: string;
    details?: unknown;
    stack?: string;
  } = {
    success: false,
    statusCode,
    message: isValidation
      ? "Validation failed"
      : isOperational
        ? error.message
        : env.NODE_ENV === "production"
          ? "Internal Server Error"
          : error instanceof Error
            ? error.message
            : "Internal Server Error",
  };

  if (isOperational && error.details !== undefined)
    response.details = error.details;
  if (isValidation) response.details = error.issues;
  if (env.NODE_ENV !== "production" && error instanceof Error && error.stack)
    response.stack = error.stack;
  res.status(statusCode).json(response);
};
