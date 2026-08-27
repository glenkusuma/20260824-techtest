import { describe, expect, it } from "vitest";
import { CsvSerializer } from "../src/io/CsvSerializer.js";

describe("CsvSerializer", () => {
  it("escapes values according to CSV rules and includes inverter identity", () => {
    const text = new CsvSerializer().serialize([
      {
        id: 1,
        siteId: 'site,"a',
        inverterId: "inv-site-a-01",
        observedAt: "2026-08-24T00:00:00.000Z",
        receivedAt: "2026-08-24T00:00:01.000Z",
        acPowerW: 0,
        acVoltageV: 230,
        frequencyHz: 50,
        energyTodayWh: 0,
        energyTotalWh: 100,
        status: "night",
        errorCode: null,
      },
    ]);
    expect(text).toContain('"site,""a"');
    expect(text.split("\n")[0]).toContain("inverter_id");
  });
});
