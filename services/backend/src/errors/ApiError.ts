/**
 * A domain-level error that carries an HTTP status code and is treated as
 * expected (operational) by the error handler middleware. Unlike internal
 * `Error`s, an `ApiError` is surfaced to the caller with its `message` intact
 * and is never logged as an unhandled failure.
 */
export class ApiError extends Error {
  /** Marks this error as expected; the middleware relays it verbatim. */
  public readonly isOperational = true;

  /**
   * @param statusCode The HTTP status code to respond with.
   * @param message The human-readable error message shown to the client.
   * @param details Optional structured details attached to the response body.
   */
  public constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";

    Error.captureStackTrace?.(this, this.constructor);
  }
}
