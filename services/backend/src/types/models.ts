/**
 * Operational state reported by an inverter alongside each reading. An inverter
 * is `"night"` outside daylight hours, transitions to `"starting"` at sunrise,
 * runs at `"running"` while producing, degrades to `"warning"` when an
 * `errorCode` is present, and is `"offline"` when it stops reporting.
 */
export type TelemetryStatus =
  "night" | "starting" | "running" | "warning" | "offline";

/**
 * A registered solar site as persisted by the backend. All sites share the
 * single supported `Asia/Jakarta` timezone, and every site carries a stable
 * `id` plus the read-only server-managed `createdAt`/`updatedAt` timestamps.
 */
export interface Site {
  /** Stable public identifier, e.g. `site-cikarang-a`. */
  id: string;
  /** The upstream inverter identity this site maps to. */
  inverterId: string;
  /** Human-readable display name. */
  name: string;
  /** Free-form physical location description. */
  location: string;
  /** Installed DC panel capacity in watts. */
  pvPeakPowerW: number;
  /** Rated AC output of the inverter in watts. */
  inverterAcPowerW: number;
  /** The only supported timezone for telemetry bucketing. */
  timezone: "Asia/Jakarta";
  /** Whether the site accepts new telemetry readings. */
  enabled: boolean;
  /** Protected sites (the two always-present demo sites) may not be deleted. */
  protected: boolean;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp of the most recent write. */
  updatedAt: string;
}

/**
 * A single persisted 5-minute telemetry reading captured for a site. Values are
 * stored unrounded from the wall-clock sample the inverter reported.
 */
export interface TelemetryReading {
  /** Monotonic row id used for incremental pagination. */
  id: number;
  /** The site this reading belongs to. */
  siteId: string;
  /** The inverter that produced the sample. */
  inverterId: string;
  /** Wall-clock observation time in the site's timezone (ISO-8601). */
  observedAt: string;
  /** When the backend stored the reading (ISO-8601). */
  receivedAt: string;
  /** Instantaneous AC output in watts. */
  acPowerW: number;
  /** Instantaneous AC line voltage in volts. */
  acVoltageV: number;
  /** Instantaneous mains frequency in hertz. */
  frequencyHz: number;
  /** Energy produced since local midnight in watt-hours. */
  energyTodayWh: number;
  /** Cumulative energy produced over the inverter lifetime in watt-hours. */
  energyTotalWh: number;
  /** Inverter operational state at sample time. */
  status: TelemetryStatus;
  /** Manufacturer error code, present only when `status` is `"warning"`. */
  errorCode: string | null;
}
