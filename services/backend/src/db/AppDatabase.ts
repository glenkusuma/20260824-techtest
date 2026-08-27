import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Owns the SQLite connection for the backend database, applying schema migrations on open.
 * Callers use the exposed {@link AppDatabase#connection} for prepared statements, while the
 * constructor's migration pass keeps pre-existing local developer databases usable.
 */
export class AppDatabase {
  /** Live SQLite connection for prepared statements.
   * @readonly */
  public readonly connection: Database.Database;

  /**
   * Opens (or creates) the SQLite database at `path`, enables the WAL journal and foreign-key
   * pragmas, then runs the schema migration.
   *
   * @param {string} path Filesystem path to the database file, or {@code ":memory:"} for an in-memory DB.
   */
  public constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.connection = new Database(path);
    this.connection.pragma("foreign_keys = ON");
    this.connection.pragma("journal_mode = WAL");
    this.migrate();
  }

  /**
   * Whether a table with the given name exists in `sqlite_master`.
   * @param name The table name to check, e.g. `"sites"`.
   * @returns True when the table already exists.
   */
  private tableExists(name: string): boolean {
    return Boolean(
      this.connection
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .get(name),
    );
  }

  /**
   * Returns the set of column names currently present on a table. Used by the
   * migration pass to decide which additive migrations are still needed.
   * @param name The table name to introspect.
   * @returns The existing column names, or an empty set when the table is absent.
   */
  private tableColumns(name: string): Set<string> {
    if (!this.tableExists(name)) return new Set();
    const rows = this.connection
      .prepare(`PRAGMA table_info(${name})`)
      .all() as Array<{ name: string }>;
    return new Set(rows.map((row) => row.name));
  }

  /** Creates the `sites` table with constraints enforcing positive capacities,
   * the single `Asia/Jakarta` timezone, and boolean integer flags. */
  private createSitesTable(): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        inverter_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        pv_peak_power_w INTEGER NOT NULL CHECK (pv_peak_power_w > 0),
        inverter_ac_power_w INTEGER NOT NULL CHECK (inverter_ac_power_w > 0),
        timezone TEXT NOT NULL CHECK (timezone = 'Asia/Jakarta'),
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        protected INTEGER NOT NULL DEFAULT 0 CHECK (protected IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  /** Creates the `telemetry_readings` table with a unique `(site_id, observed_at)`
   * key and check constraints mirroring the ingest schema's value ranges. */
  private createTelemetryTable(): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS telemetry_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        inverter_id TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        received_at TEXT NOT NULL,
        ac_power_w REAL NOT NULL CHECK (ac_power_w >= 0),
        ac_voltage_v REAL NOT NULL CHECK (ac_voltage_v >= 0 AND ac_voltage_v <= 300),
        frequency_hz REAL NOT NULL CHECK (frequency_hz >= 45 AND frequency_hz <= 55),
        energy_today_wh REAL NOT NULL CHECK (energy_today_wh >= 0),
        energy_total_wh REAL NOT NULL CHECK (energy_total_wh >= energy_today_wh),
        status TEXT NOT NULL CHECK (status IN ('night', 'starting', 'running', 'warning', 'offline')),
        error_code TEXT NULL,
        UNIQUE(site_id, observed_at)
      );
    `);
  }

  /**
   * Idempotent schema migration. Creates missing tables, adds columns added by
   * later schema revisions (e.g. `inverter_id`, `protected`) to pre-existing
   * developer databases, rebuilds the telemetry table when it predates the
   * `inverter_id`/`night` status shape, and ensures the read-path indexes exist.
   */
  private migrate(): void {
    // The repository briefly contained an earlier telemetry prototype. Keep local
    // developer databases usable instead of requiring a manual delete.
    this.createSitesTable();
    const siteColumns = this.tableColumns("sites");
    if (!siteColumns.has("inverter_id")) {
      this.connection.exec("ALTER TABLE sites ADD COLUMN inverter_id TEXT");
      this.connection.exec(
        "UPDATE sites SET inverter_id = 'inv-' || id WHERE inverter_id IS NULL",
      );
    }
    this.connection.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_inverter_id ON sites(inverter_id)",
    );
    // Add the protection flag (deletability lock) to pre-existing developer DBs.
    if (!siteColumns.has("protected")) {
      this.connection.exec(
        "ALTER TABLE sites ADD COLUMN protected INTEGER NOT NULL DEFAULT 0 CHECK (protected IN (0, 1))",
      );
    }

    if (!this.tableExists("telemetry_readings")) {
      this.createTelemetryTable();
    } else {
      const columns = this.tableColumns("telemetry_readings");
      const tableSql = this.connection
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'telemetry_readings'",
        )
        .get() as { sql: string } | undefined;
      const requiresRebuild =
        !columns.has("inverter_id") || !tableSql?.sql.includes("'night'");

      if (requiresRebuild) {
        this.connection.transaction(() => {
          this.connection.exec(
            "ALTER TABLE telemetry_readings RENAME TO telemetry_readings_legacy",
          );
          this.createTelemetryTable();
          this.connection.exec(`
            INSERT INTO telemetry_readings (
              id, site_id, inverter_id, observed_at, received_at, ac_power_w,
              ac_voltage_v, frequency_hz, energy_today_wh, energy_total_wh,
              status, error_code
            )
            SELECT
              legacy.id,
              legacy.site_id,
              COALESCE(site.inverter_id, 'inv-' || legacy.site_id),
              legacy.observed_at,
              legacy.received_at,
              legacy.ac_power_w,
              legacy.ac_voltage_v,
              legacy.frequency_hz,
              legacy.energy_today_wh,
              legacy.energy_total_wh,
              CASE legacy.status WHEN 'normal' THEN 'running' ELSE legacy.status END,
              legacy.error_code
            FROM telemetry_readings_legacy AS legacy
            LEFT JOIN sites AS site ON site.id = legacy.site_id;
          `);
          this.connection.exec("DROP TABLE telemetry_readings_legacy");
        })();
      }
    }

    this.connection.exec(`
      CREATE INDEX IF NOT EXISTS idx_telemetry_site_id_id
        ON telemetry_readings(site_id, id DESC);
      CREATE INDEX IF NOT EXISTS idx_telemetry_site_observed
        ON telemetry_readings(site_id, observed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_telemetry_status_observed
        ON telemetry_readings(status, observed_at DESC);
    `);
  }

  /**
   * Closes the underlying SQLite connection, releasing all statements.
   * @returns {void}
   */
  public close(): void {
    this.connection.close();
  }
}
