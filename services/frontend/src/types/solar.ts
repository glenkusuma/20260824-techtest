/** Operational states an inverter may report. Mirrors the backend's telemetry status union. */
export type SiteStatus =
  "night" | "starting" | "running" | "warning" | "offline";

/**
 * A registered solar site as returned by the backend's site endpoints. All
 * fields mirror the API response, including the server-managed `inverterId`,
 * `timezone` (always `"Asia/Jakarta"`), and `protected` delete-lock flags.
 */
export interface Site {
  id: string;
  inverterId: string;
  name: string;
  location: string;
  pvPeakPowerW: number;
  inverterAcPowerW: number;
  timezone: "Asia/Jakarta";
  enabled: boolean;
  protected: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * The client-editable site fields, sent on create and update. `timezone`,
 * `inverterId`, and `protected` are managed by the backend.
 */
export type SiteEditInput = Pick<
  Site,
  "name" | "location" | "pvPeakPowerW" | "inverterAcPowerW" | "enabled"
>;

/**
 * A single telemetry reading captured from an inverter, mirroring the backend's
 * telemetry record shape with camelCased field names.
 */
export interface TelemetryReading {
  id: number;
  siteId: string;
  inverterId: string;
  observedAt: string;
  receivedAt: string;
  acPowerW: number;
  acVoltageV: number;
  frequencyHz: number;
  energyTodayWh: number;
  energyTotalWh: number;
  status: SiteStatus;
  errorCode: string | null;
}

/** A {@link Site} augmented with its most recent {@link TelemetryReading}, or
 * `null` when no reading has been observed yet. */
export interface SiteWithLatest extends Site {
  latest: TelemetryReading | null;
}
