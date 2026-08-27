import type { Site, SiteEditInput, TelemetryReading } from "@/types/solar";

/** Backend origin, from `VITE_API_BASE_URL` with a trailing slash stripped, else `http://localhost:3000`. */
const baseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "http://localhost:3000";

/** Uniform success envelope returned by the backend for JSON responses. */
type ApiEnvelope<T> = {
  success: boolean;
  statusCode: number;
  data: T;
  message: string;
};

/**
 * Fetches a backend path, wrapping non-2xx responses as `Error`s.
 *
 * A `204 No Content` resolves to `undefined`. Otherwise the response body is
 * read as an {@link ApiEnvelope} and on a non-OK status either the backend's
 * `message` (when present) or a generic HTTP message is thrown.
 *
 * @template T The type of the unwrapped `data` payload.
 * @param path Path appended to {@link baseUrl}, e.g. `/api/v1/sites`.
 * @param init Optional fetch init (method, body, headers).
 * @throws {Error} When the backend responds with a non-OK status, surfaced from
 *   the envelope's `message` when available.
 * @returns A promise resolving to the envelope's `data`, or `undefined` for `204`.
 */
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as ApiEnvelope<T> | { message?: string };
  if (!response.ok)
    throw new Error(
      "message" in body && body.message
        ? body.message
        : `Request failed with HTTP ${response.status}`,
    );
  return (body as ApiEnvelope<T>).data;
};

/**
 * Typed client for the backend's REST API, built on {@link request}. Each method
 * resolves to the current backend `data` payload; errors (including a `409` from
 * deleting a protected site) surface as thrown `Error`s.
 */
export const solarApi = {
  /** Lists all registered sites.
   * @returns A promise resolving to the full site array. */
  listSites: (): Promise<Site[]> => request("/api/v1/sites"),
  /** Fetches a single site by id.
   * @param id The site id.
   * @returns A promise resolving to the site. */
  getSite: (id: string): Promise<Site> =>
    request(`/api/v1/sites/${encodeURIComponent(id)}`),
  /** Fetches a site's most recent telemetry reading, or `null` when none exists.
   * @param id The site id.
   * @returns A promise resolving to the latest reading or `null`. */
  latest: (id: string): Promise<TelemetryReading | null> =>
    request(`/api/v1/sites/${encodeURIComponent(id)}/telemetry?latest=true`),
  /** Fetches a site's recent telemetry history.
   * @param id The site id.
   * @param limit Maximum number of readings to return (default 288, a full day at 5-min cadence).
   * @returns A promise resolving to the reading array, oldest-first. */
  history: (id: string, limit = 288): Promise<TelemetryReading[]> =>
    request(`/api/v1/sites/${encodeURIComponent(id)}/telemetry?limit=${limit}`),
  /** Registers a new site.
   * @param payload The client-editable site fields (name, location, capacities, timezone).
   * @returns A promise resolving to the created site. */
  createSite: (
    payload: Pick<
      Site,
      "name" | "location" | "pvPeakPowerW" | "inverterAcPowerW" | "timezone"
    >,
  ): Promise<Site> =>
    request("/api/v1/sites", { method: "POST", body: JSON.stringify(payload) }),
  /** Updates the editable fields of an existing site.
   * @param id The site id.
   * @param payload The fields to patch.
   * @returns A promise resolving to the updated site. */
  updateSite: (id: string, payload: SiteEditInput): Promise<Site> =>
    request(`/api/v1/sites/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  /** Deletes a site. Protected sites may be refused with a `409`.
   * @param id The site id.
   * @returns A promise resolving once the site is deleted. */
  deleteSite: (id: string): Promise<void> =>
    request<void>(`/api/v1/sites/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};
