/**
 * The uniform success envelope serialized as the body of every 2xx/3xx/4xx
 * response. `success` is derived from the HTTP status rather than stored, so
 * callers can rely on a single shape: `{ success, statusCode, data, message }`.
 * @template TData The type of the payload carried under `data`.
 */
export class ApiResponse<TData> {
  /** True when {@link statusCode} is in the 2xx/3xx range (i.e. `< 400`). */
  public readonly success: boolean;

  /**
   * @param statusCode The HTTP status code to echo back to the client.
   * @param data The application payload serialized under `data`.
   * @param message A short human-readable summary, defaulting to `"Success"`.
   */
  public constructor(
    public readonly statusCode: number,
    public readonly data: TData,
    public readonly message = "Success",
  ) {
    this.success = statusCode < 400;
  }
}
