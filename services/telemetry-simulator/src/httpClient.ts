import type { TelemetryPayload } from "./types.js";

/**
 * A site as discovered from the backend's site list endpoint.
 */
export interface BackendSite {
  /** Unique identifier of the site. */
  id: string;
  /** Identifier of the inverter installed at the site. */
  inverterId: string;
  /** Human-readable name of the site. */
  name: string;
  /** Peak PV array power of the site, in watts. */
  pvPeakPowerW: number;
  /** Rated AC power of the site's inverter, in watts. */
  inverterAcPowerW: number;
  /** Whether the site is currently enabled for telemetry collection. */
  enabled: boolean;
}

/** Backend success envelope wrapping a single `data` payload. */
type Envelope<T> = { data: T };

/**
 * HTTP client for talking to the telemetry backend.
 */
export class BackendClient {
  /** The base URL the client sends requests to. Read-only. */
  public constructor(private readonly baseUrl: string) {}

  /**
   * Polls the backend health endpoint until it responds.
   *
   * Retries every 250 ms until the endpoint returns an OK status, or throws once
   * the timeout elapses.
   *
   * @param {number} [timeoutMs] - Maximum number of milliseconds to wait before
   *   giving up. Defaults to 20,000.
   * @returns {Promise<void>} Resolves once the backend reports healthy.
   * @throws {Error} If the backend is not healthy before the timeout elapses.
   * @example
   * ```ts
   * const client = new BackendClient("http://localhost:3000");
   * await client.waitUntilHealthy();
   * ```
   */
  public async waitUntilHealthy(timeoutMs = 20_000): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        const response = await fetch(`${this.baseUrl}/health`);
        if (response.ok) return;
      } catch {
        // Retry until deadline.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Backend did not become healthy within ${timeoutMs} ms`);
  }

  /**
   * Fetches the sites registered on the backend.
   *
   * Returns only the sites that are currently enabled.
   *
   * @returns {Promise<BackendSite[]>} The enabled sites discovered from the
   *   backend's site list endpoint.
   * @throws {Error} If the backend responds with a non-OK status.
   */
  public async listSites(): Promise<BackendSite[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/sites`);
    if (!response.ok)
      throw new Error(`Site discovery failed with HTTP ${response.status}`);
    const body = (await response.json()) as Envelope<BackendSite[]>;
    return body.data.filter((site) => site.enabled);
  }

  /**
   * Publishes a telemetry payload to the backend's ingest endpoint.
   *
   * Sends the payload as JSON over HTTP POST and resolves once the backend
   * accepts it, or throws on a non-2xx response.
   *
   * @param {TelemetryPayload} payload - The telemetry data to send to the
   *   ingest endpoint.
   * @returns {Promise<void>} Resolves once the payload has been published.
   * @throws {Error} If the backend responds with a non-2xx status.
   * @example
   * ```ts
   * await client.publish({
   *   schemaVersion: "1.0",
   *   source: "telemetry-simulator",
   *   siteId: "site-01",
   *   // ...additional payload fields
   * });
   * ```
   */
  public async publish(payload: TelemetryPayload): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(
        `Telemetry publish failed (${response.status}): ${await response.text()}`,
      );
    }
  }
}
