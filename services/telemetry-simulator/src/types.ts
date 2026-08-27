/** Operational states an inverter may report. Mirrors the backend's telemetry status union. */
export type TelemetryStatus =
  "night" | "starting" | "running" | "warning" | "offline";
/** Which simulated calendar day a reading belongs to: 1 (yesterday) or 2 (today). */
export type SimulationDay = 1 | 2;

/** Inverter metrics and capacity for one site, used to synthesize readings. */
export interface SiteProfile {
  id: string;
  inverterId: string;
  name: string;
  pvPeakPowerW: number;
  inverterAcPowerW: number;
  totalEnergyBaseWh: number;
}

/** Numeric electrical metrics captured in a telemetry reading. */
export interface TelemetryMetrics {
  acPowerW: number;
  acVoltageV: number;
  frequencyHz: number;
  energyTodayWh: number;
  energyTotalWh: number;
}

/** Payload posted to the backend's telemetry ingest endpoint. */
export interface TelemetryPayload {
  schemaVersion: "1.0";
  source: "telemetry-simulator";
  siteId: string;
  inverterId: string;
  observedAt: string;
  status: TelemetryStatus;
  errorCode: string | null;
  metrics: TelemetryMetrics;
}
