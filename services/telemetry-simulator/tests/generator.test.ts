import { describe, expect, it } from "vitest";
import {
  expectedDayEnergyWh,
  generateDay,
  generateTelemetry,
} from "../src/generator.js";
import { SITE_PROFILES } from "../src/profiles.js";

const cikarang = SITE_PROFILES[0]!;
const bekasi = SITE_PROFILES[1]!;

describe("solar telemetry generator", () => {
  it("creates 576 readings per simulated day", () => {
    expect(generateDay(1)).toHaveLength(576);
  });

  it("uses explicit night / starting / running states", () => {
    expect(generateTelemetry(cikarang, 1, 2 * 60).status).toBe("night");
    expect(generateTelemetry(cikarang, 1, 5 * 60 + 30).status).toBe("starting");
    expect(generateTelemetry(cikarang, 1, 12 * 60).status).toBe("running");
  });

  it("keeps healthy voltage and frequency in the documented demo range", () => {
    for (const reading of generateDay(1).filter(
      (row) => row.siteId === cikarang.id,
    )) {
      expect(reading.metrics.acVoltageV).toBeGreaterThanOrEqual(225);
      expect(reading.metrics.acVoltageV).toBeLessThanOrEqual(238);
      expect(reading.metrics.frequencyHz).toBeGreaterThanOrEqual(49.95);
      expect(reading.metrics.frequencyHz).toBeLessThanOrEqual(50.05);
    }
  });

  it("makes Bekasi visibly require attention during the day-one fault", () => {
    const reading = generateTelemetry(bekasi, 1, 12 * 60);
    expect(reading.status).toBe("warning");
    expect(reading.errorCode).toBe("GRID_OVERVOLTAGE");
    expect(reading.metrics.acVoltageV).toBeGreaterThanOrEqual(254);
    expect(reading.metrics.acVoltageV).toBeLessThanOrEqual(258);
    expect(reading.metrics.acPowerW).toBe(0);
  });

  it("produces exactly 19 and 10 warning observations across the two demo days", () => {
    const day1Warnings = generateDay(1).filter(
      (row) => row.siteId === bekasi.id && row.status === "warning",
    );
    const day2Warnings = generateDay(2).filter(
      (row) => row.siteId === bekasi.id && row.status === "warning",
    );
    expect(day1Warnings).toHaveLength(19);
    expect(day2Warnings).toHaveLength(10);
  });

  it("keeps energy monotonic and near the accepted healthy 4.5 kWh/kWp daily yield", () => {
    const siteReadings = generateDay(1).filter(
      (row) => row.siteId === cikarang.id,
    );
    for (let index = 1; index < siteReadings.length; index += 1) {
      expect(siteReadings[index]!.metrics.energyTodayWh).toBeGreaterThanOrEqual(
        siteReadings[index - 1]!.metrics.energyTodayWh,
      );
    }
    expect(expectedDayEnergyWh(cikarang, 1)).toBeGreaterThanOrEqual(24_000);
    expect(expectedDayEnergyWh(cikarang, 1)).toBeLessThanOrEqual(25_500);
  });

  it("never exceeds configured inverter output", () => {
    for (const reading of generateDay(2)) {
      const site = SITE_PROFILES.find(
        (candidate) => candidate.id === reading.siteId,
      )!;
      expect(reading.metrics.acPowerW).toBeLessThanOrEqual(
        site.inverterAcPowerW,
      );
    }
  });
});
