import type Database from "better-sqlite3";

/**
 * Persists and reads collection checkpoints keyed by source name.
 *
 * Each source tracks a single `last_record_id` cursor so the collector can
 * resume from where it stopped. Rows are upserted on save and read via a
 * prepared statement against the shared SQLite connection.
 */
export class CheckpointRepository {
  /**
   * Creates a repository operating on the given SQLite connection.
   *
   * @param db - Underlying better-sqlite3 connection used for all statements.
   */
  public constructor(private readonly db: Database.Database) {}

  /**
   * Returns the last record id checkpointed for a source, or 0 when none exists.
   *
   * @param sourceName - Name of the source whose checkpoint to read.
   * @returns The last recorded record id, or `0` if the source has no row yet.
   * @example
   * ```ts
   * const cursor = checkpoints.get("backend-telemetry");
   * ```
   */
  public get(sourceName: string): number {
    const row = this.db
      .prepare(
        "SELECT last_record_id FROM collection_checkpoints WHERE source_name = ?",
      )
      .get(sourceName) as { last_record_id: number } | undefined;
    return row?.last_record_id ?? 0;
  }

  /**
   * Upserts the checkpoint for a source with the given last record id.
   *
   * Inserts a new row when the source has no checkpoint yet, otherwise updates
   * the stored id and timestamps it with the current time.
   *
   * @param sourceName - Name of the source whose checkpoint to write.
   * @param lastRecordId - Last successfully archived record id to persist.
   * @returns Nothing.
   * @example
   * ```ts
   * checkpoints.save("backend-telemetry", 1042);
   * ```
   */
  public save(sourceName: string, lastRecordId: number): void {
    this.db
      .prepare(
        `
      INSERT INTO collection_checkpoints (source_name, last_record_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(source_name) DO UPDATE SET
        last_record_id = excluded.last_record_id,
        updated_at = excluded.updated_at
    `,
      )
      .run(sourceName, lastRecordId, new Date().toISOString());
  }

  /**
   * Runs work inside a single SQLite transaction.
   *
   * Commits the transaction if `work` returns normally and rolls it back if it
   * throws, so the caller can update multiple rows atomically.
   *
   * @template T - The return type of `work`.
   * @param work - Function whose statements run within the transaction; its
   *   return value is propagated out of the transaction.
   * @returns {T} The value returned by `work`.
   * @example
   * ```ts
   * checkpoints.transaction(() => {
   *   checkpoints.save(source, after);
   *   jobs.markSuccess(id, result);
   * });
   * ```
   */
  public transaction<T>(work: () => T): T {
    return this.db.transaction(work)();
  }
}
