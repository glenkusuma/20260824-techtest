import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Owns the collector's SQLite connection and applies schema migrations on open.
 *
 * Opening the class creates the database file (and its parent directories) when
 * it does not exist and ensures the WAL journal mode is active before any
 * statements run.
 */
export class CollectorDatabase {
  /** Live SQLite connection used for prepared statements and transactions. @readonly */
  public readonly connection: Database.Database;

  /**
   * Opens (or lazily creates) the database at the given path and migrates its schema.
   *
   * @param path - Filesystem path of the SQLite file, or {@code ":memory:"} for an
   *   in-memory database that skips directory creation.
   */
  public constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.connection = new Database(path);
    this.connection.pragma("journal_mode = WAL");
    this.migrate();
  }

  /** Idempotently creates the collector tables (`collection_checkpoints`,
   * `job_runs`) if missing and ensures the job-run start-time index exists. */
  private migrate(): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS collection_checkpoints (
        source_name TEXT PRIMARY KEY,
        last_record_id INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS job_runs (
        id TEXT PRIMARY KEY,
        source_name TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NULL,
        status TEXT NOT NULL CHECK(status IN ('RUNNING','SUCCESS','FAILED')),
        checkpoint_before INTEGER NOT NULL,
        checkpoint_after INTEGER NULL,
        records_found INTEGER NOT NULL DEFAULT 0,
        records_written INTEGER NOT NULL DEFAULT 0,
        output_file TEXT NULL,
        metadata_file TEXT NULL,
        error_message TEXT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_job_runs_started_at ON job_runs(started_at DESC);
    `);
  }

  /**
   * Closes the underlying SQLite connection, releasing the file handle.
   *
   * Should be called exactly once when the database is no longer needed, e.g. in
   * a process `finally` block so the handle is released cleanly.
   *
   * @returns Nothing.
   */
  public close(): void {
    this.connection.close();
  }
}
