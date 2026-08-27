import type { CollectionPage } from "../types/models.js";

/**
 * Source of telemetry pages for a collection run.
 *
 * Implementations wrap a cursor-based pagination endpoint and expose a single
 * method that returns one page of readings following a given record id.
 */
export interface CollectionSource {
  /**
   * Fetches the page of telemetry records whose ids are greater than `afterId`.
   *
   * @param afterId - Cursor id; only records with an id strictly greater than
   *   this value are returned.
   * @param limit - Maximum number of records to return in a single page.
   * @returns The requested page of records plus pagination metadata.
   */
  fetchAfter(afterId: number, limit: number): Promise<CollectionPage>;
}

/**
 * Fetches telemetry pages from the backend's cursor endpoint.
 *
 * Clients on a non-2xx response produces a helpful error describing the remote
 * HTTP status. The backend is expected to expose `GET /api/v1/telemetry` with
 * `afterId` and `limit` query parameters.
 */
export class BackendTelemetrySource implements CollectionSource {
  /**
   * Creates a source that reads from the given backend origin.
   *
   * @param baseUrl - Base origin (scheme, host, optional port) of the backend.
   */
  public constructor(private readonly baseUrl: string) {}

  /**
   * Requests one page of readings whose ids are greater than `afterId`.
   *
   * Sends an HTTP GET to the backend cursor endpoint. Throws on a non-2xx
   * response or when the payload does not contain a valid `data` page.
   *
   * @param afterId - Cursor id; records returned have ids strictly greater than
   *   this value.
   * @param limit - Maximum number of records to request in the page.
   * @returns A promise resolving to the parsed {@link CollectionPage}.
   * @throws {Error} When the backend responds with a non-2xx status or the body
   *   is missing an expected `data` page.
   */
  public async fetchAfter(
    afterId: number,
    limit: number,
  ): Promise<CollectionPage> {
    const url = new URL("/api/v1/telemetry", this.baseUrl);
    url.searchParams.set("afterId", String(afterId));
    url.searchParams.set("limit", String(limit));
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Collection source returned HTTP ${response.status}`);
    const payload = (await response.json()) as { data?: CollectionPage };
    if (!payload.data)
      throw new Error("Collection source returned an invalid response");
    return payload.data;
  }
}
