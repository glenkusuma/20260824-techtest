import { describe, expect, it } from "vitest";
import { TelemetryIngestDTO } from "../../src/dto/TelemetryIngestDTO.js";

const healthyPayload = {
  schemaVersion: "1.0",
  source: "telemetry-simulator",
  siteId: "site-a",
  inverterId: "inv-site-a-01",
  observedAt: "2026-08-24T08:00:00+07:00",
  status: "running",
  errorCode: null,
  metrics: {
    acPowerW: 4200,
    acVoltageV: 231.2,
    frequencyHz: 50.01,
    energyTodayWh: 12000,
    energyTotalWh: 12000000,
  },
} as const;

describe("TelemetryIngestDTO", () => {
  it("accepts the versioned simulator envelope", () => {
    const parsed = TelemetryIngestDTO.parse(healthyPayload);
    expect(parsed.errorCode).toBeNull();
    expect(parsed.metrics.acPowerW).toBe(4200);
  });

  it("requires an error code for warning state", () => {
    expect(() =>
      TelemetryIngestDTO.parse({
        ...healthyPayload,
        status: "warning",
        errorCode: null,
        metrics: { ...healthyPayload.metrics, acPowerW: 0, acVoltageV: 256 },
      }),
    ).toThrow();
  });

  it("enforces the deterministic overvoltage behavior", () => {
    expect(() =>
      TelemetryIngestDTO.parse({
        ...healthyPayload,
        status: "warning",
        errorCode: "GRID_OVERVOLTAGE",
        metrics: { ...healthyPayload.metrics, acPowerW: 1200, acVoltageV: 256 },
      }),
    ).toThrow();
  });
});
