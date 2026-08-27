/** Operational states an inverter may report. */
export type TelemetryStatus =
  "night" | "starting" | "running" | "warning" | "offline";

/**
 * A single telemetry reading captured from an inverter.
 * Mirrors the backend's telemetry record shape with camelCased field names.
 */
export interface TelemetryRecord {
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
  status: TelemetryStatus;
  errorCode: string | null;
}

/**
 * One page of telemetry returned by a cursor-based collection source.
 */
export interface CollectionPage {
  records: TelemetryRecord[];
  nextAfterId: number;
  hasMore: boolean;
}

/**
 * A scheduled collection run and its lifecycle status and results.
 */
export interface JobRun {
  id: string;
  sourceName: string;
  scheduledAt: string;
  startedAt: string;
  finishedAt: string | null;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  checkpointBefore: number;
  checkpointAfter: number | null;
  recordsFound: number;
  recordsWritten: number;
  outputFile: string | null;
  metadataFile: string | null;
  errorMessage: string | null;
}
