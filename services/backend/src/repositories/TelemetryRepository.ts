import type Database from "better-sqlite3";
import type { TelemetryReading } from "../types/models.js";

type TelemetryRow = {
  id: number;
  site_id: string;
  inverter_id: string;
  observed_at: string;
  received_at: string;
  ac_power_w: number;
  ac_voltage_v: number;
  frequency_hz: number;
  energy_today_wh: number;
  energy_total_wh: number;
  status: TelemetryReading["status"];
  error_code: string | null;
};

type TelemetryCreate = Omit<TelemetryReading, "id">;

const mapReading = (row: TelemetryRow): TelemetryReading => ({
  id: row.id,
  siteId: row.site_id,
  inverterId: row.inverter_id,
  observedAt: row.observed_at,
  receivedAt: row.received_at,
  acPowerW: row.ac_power_w,
  acVoltageV: row.ac_voltage_v,
  frequencyHz: row.frequency_hz,
  energyTodayWh: row.energy_today_wh,
  energyTotalWh: row.energy_total_wh,
  status: row.status,
  errorCode: row.error_code,
});

/**
 * {@link TelemetryReading} plus whether the row was newly inserted.
 * @typedef {Object} TelemetryIngestResult
 * @property {TelemetryReading} reading The stored (or already-existing) reading.
 * @property {boolean} created True when the row was newly inserted this call.
 */

/**
 * SQLite-backed data access for the telemetry_readings table.
 * @see {@link TelemetryService} for the application logic built on top.
 */
export class TelemetryRepository {
  /**
   * @param {Database.Database} db The shared SQLite connection.
   */
  public constructor(private readonly db: Database.Database) {}

  /**
   * Inserts a reading unless one already exists for the same (site, observed_at) unique key.
   * @param {TelemetryCreate} input The telemetry values to persist.
   * @returns {TelemetryIngestResult} The stored reading and whether a row was newly created.
   */
  public create(input: TelemetryCreate): {
    reading: TelemetryReading;
    created: boolean;
  } {
    const result = this.db
      .prepare(
        `
      INSERT OR IGNORE INTO telemetry_readings (
        site_id, inverter_id, observed_at, received_at, ac_power_w, ac_voltage_v,
        frequency_hz, energy_today_wh, energy_total_wh, status, error_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        input.siteId,
        input.inverterId,
        input.observedAt,
        input.receivedAt,
        input.acPowerW,
        input.acVoltageV,
        input.frequencyHz,
        input.energyTodayWh,
        input.energyTotalWh,
        input.status,
        input.errorCode,
      );

    const row = this.db
      .prepare(
        "SELECT * FROM telemetry_readings WHERE site_id = ? AND observed_at = ?",
      )
      .get(input.siteId, input.observedAt) as TelemetryRow;

    return { reading: mapReading(row), created: result.changes === 1 };
  }

  /**
   * Returns the most recent reading for a site.
   * @param {string} siteId The site to query.
   * @returns {TelemetryReading | null} The newest reading, or null when the site has none.
   */
  public latestBySite(siteId: string): TelemetryReading | null {
    const row = this.db
      .prepare(
        "SELECT * FROM telemetry_readings WHERE site_id = ? ORDER BY observed_at DESC, id DESC LIMIT 1",
      )
      .get(siteId) as TelemetryRow | undefined;
    return row ? mapReading(row) : null;
  }

  /**
   * Returns recent history for a site, newest last, up to the given limit.
   * @param {string} siteId The site to query.
   * @param {number} limit Maximum number of readings to return.
   * @returns {TelemetryReading[]} The readings from oldest to newest within the limit.
   */
  public historyBySite(siteId: string, limit: number): TelemetryReading[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM telemetry_readings
      WHERE site_id = ?
      ORDER BY observed_at DESC, id DESC
      LIMIT ?
    `,
      )
      .all(siteId, limit) as TelemetryRow[];
    return rows.map(mapReading).reverse();
  }

  /**
   * Returns readings with id greater than afterId, ascending, up to limit.
   * @param {number} afterId Exclusive lower bound on reading id.
   * @param {number} limit Maximum number of readings to return.
   * @returns {TelemetryReading[]} The paginated readings in ascending id order.
   */
  public findAfterId(afterId: number, limit: number): TelemetryReading[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM telemetry_readings
      WHERE id > ?
      ORDER BY id ASC
      LIMIT ?
    `,
      )
      .all(afterId, limit) as TelemetryRow[];
    return rows.map(mapReading);
  }

  /**
   * Returns the total number of telemetry readings.
   * @returns {number} The row count.
   */
  public count(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM telemetry_readings")
      .get() as { count: number };
    return row.count;
  }

  /**
   * Returns the highest reading id.
   * @returns {number} The max id, or 0 when the table is empty.
   */
  public maxId(): number {
    const row = this.db
      .prepare("SELECT COALESCE(MAX(id), 0) AS id FROM telemetry_readings")
      .get() as { id: number };
    return row.id;
  }

  /**
   * Deletes all telemetry readings and resets the row id sequence.
   * @returns {void}
   */
  public clear(): void {
    this.db.exec(
      "DELETE FROM telemetry_readings; DELETE FROM sqlite_sequence WHERE name = 'telemetry_readings';",
    );
  }
}
