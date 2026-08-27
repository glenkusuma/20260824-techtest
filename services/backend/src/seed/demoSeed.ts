import type Database from "better-sqlite3";
import { SiteRepository } from "../repositories/SiteRepository.js";
import { TelemetryRepository } from "../repositories/TelemetryRepository.js";
import type { Site, TelemetryStatus } from "../types/models.js";

/**
 * The two always-present demo sites (Cikarang A, Bekasi B). Both are real,
 * deterministic fixtures, marked `protected: true` so they survive a user's
 * delete action and keep the dashboard populated. Replayed by the simulator and
 * re-upserted on every backend start.
 */
export const DEMO_SITES: Site[] = [
  {
    id: "site-cikarang-a",
    inverterId: "inv-cikarang-a-01",
    name: "Cikarang Rooftop A",
    location: "Cikarang, West Java",
    pvPeakPowerW: 5500,
    inverterAcPowerW: 5000,
    timezone: "Asia/Jakarta",
    enabled: true,
    protected: true,
    createdAt: "2026-08-23T15:30:00.000Z",
    updatedAt: "2026-08-23T15:30:00.000Z",
  },
  {
    id: "site-bekasi-b",
    inverterId: "inv-bekasi-b-01",
    name: "Bekasi Rooftop B",
    location: "Bekasi, West Java",
    pvPeakPowerW: 6600,
    inverterAcPowerW: 6000,
    timezone: "Asia/Jakarta",
    enabled: true,
    protected: true,
    createdAt: "2026-08-23T15:31:00.000Z",
    updatedAt: "2026-08-23T15:31:00.000Z",
  },
];

/** Overrides the status for seeded readings at or after 23:00 so those rows read as `"night"`.
 * @param minute The minute-of-day (0-1439) of the reading.
 * @returns `"night"` at/after 23:00, otherwise `"running"`.
 */
const statusForSeed = (minute: number): TelemetryStatus =>
  minute >= 23 * 60 ? "night" : "running";

/**
 * Calendar date in Asia/Jakarta (UTC+7, no DST) `offsetDays` from today as `YYYY-MM-DD`.
 * The seeded readings cover the day before the two-day demo replay, so they are
 * anchored two days before today to stay in sync with {@link DEMO_SITES}.
 * @param {number} offsetDays Days from today, negative for the past.
 * @returns {string} The Jakarta-local date.
 */
const jakartaDate = (offsetDays: number): string =>
  new Date(Date.now() + 7 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

const PREVIOUS_ARCHIVED_DATE = jakartaDate(-2);

/**
 * Destructively resets the database to a deterministic demo state inside a
 * single transaction: clears telemetry, deletes and re-upserts the demo sites,
 * then seeds 12 archived readings per site (24 total) for the previous day
 * (23:00-24:00, 5-minute cadence). The archived readings give the UI immediate history without
 * obscuring the live two-day replay from the simulator.
 * @param db An open SQLite connection to reset.
 */
export const resetDemoData = (db: Database.Database): void => {
  const sites = new SiteRepository(db);
  const telemetry = new TelemetryRepository(db);
  db.transaction(() => {
    telemetry.clear();
    db.prepare("DELETE FROM sites").run();
    for (const site of DEMO_SITES) sites.upsert(site);

    // 24 previous-day readings are intentionally considered already archived.
    // They give the UI immediate history without obscuring the live two-day replay.
    let index = 0;
    for (let minute = 23 * 60; minute < 24 * 60; minute += 5) {
      for (const [siteIndex, site] of DEMO_SITES.entries()) {
        const observed = new Date(
          `${PREVIOUS_ARCHIVED_DATE}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00+07:00`,
        ).toISOString();
        telemetry.create({
          siteId: site.id,
          inverterId: site.inverterId,
          observedAt: observed,
          receivedAt: new Date(
            new Date(observed).getTime() + 3000 + siteIndex * 200,
          ).toISOString(),
          acPowerW: 0,
          acVoltageV: 230 + siteIndex,
          frequencyHz: 50,
          energyTodayWh: 24750 + siteIndex * 900,
          energyTotalWh: 12450000 + index * 3,
          status: statusForSeed(minute),
          errorCode: null,
        });
        index += 1;
      }
    }
  })();
};
