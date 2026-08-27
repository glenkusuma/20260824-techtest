import type Database from "better-sqlite3";
import type { JobRun } from "../types/models.js";

/**
 * Persists scheduled and completed job-run records.
 *
 * Every collection run is recorded as a row that transitions from RUNNING to
 * SUCCESS or FAILED. Completed rows optionally carry output paths and an error
 * message, and the most recent run can be inspected via {@link latest}.
 */
export class JobRunRepository {
  /**
   * Creates a repository operating on the given SQLite connection.
   *
   * @param db - Underlying better-sqlite3 connection used for all statements.
   */
  public constructor(private readonly db: Database.Database) {}

  /**
   * Inserts a new job run row in the RUNNING state.
   *
   * @param run - The job run to insert, including its id, scheduling metadata,
   *   and initial RUNNING status.
   * @returns Nothing.
   * @example
   * ```ts
   * jobs.start({ id: jobId, sourceName: "backend-telemetry",
   *   scheduledAt, startedAt, finishedAt: null, status: "RUNNING",
   *   checkpointBefore: cursor, checkpointAfter: null });
   * ```
   */
  public start(run: JobRun): void {
    this.db
      .prepare(
        `
      INSERT INTO job_runs (
        id, source_name, scheduled_at, started_at, finished_at, status,
        checkpoint_before, checkpoint_after, records_found, records_written,
        output_file, metadata_file, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        run.id,
        run.sourceName,
        run.scheduledAt,
        run.startedAt,
        run.finishedAt,
        run.status,
        run.checkpointBefore,
        run.checkpointAfter,
        run.recordsFound,
        run.recordsWritten,
        run.outputFile,
        run.metadataFile,
        run.errorMessage,
      );
  }

  /**
   * Marks a job run SUCCESS and records its results and output paths.
   *
   * @param id - Id of the job run row to update.
   * @param result - Completion details: the advanced checkpoint, record counts,
   *   and the finalized output file paths.
   * @returns Nothing.
   */
  public markSuccess(
    id: string,
    result: {
      checkpointAfter: number;
      recordsFound: number;
      recordsWritten: number;
      outputFile: string;
      metadataFile: string;
    },
  ): void {
    this.db
      .prepare(
        `
      UPDATE job_runs SET
        finished_at = ?, status = 'SUCCESS', checkpoint_after = ?,
        records_found = ?, records_written = ?, output_file = ?, metadata_file = ?
      WHERE id = ?
    `,
      )
      .run(
        new Date().toISOString(),
        result.checkpointAfter,
        result.recordsFound,
        result.recordsWritten,
        result.outputFile,
        result.metadataFile,
        id,
      );
  }

  /**
   * Marks a job run FAILED and records the error message.
   *
   * @param id - Id of the job run row to update.
   * @param recordsFound - Number of records collected before the failure.
   * @param error - The thrown error, or any value, whose message or string form
   *   is persisted as the row's error message.
   * @returns Nothing.
   */
  public markFailed(id: string, recordsFound: number, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.db
      .prepare(
        `
      UPDATE job_runs SET
        finished_at = ?, status = 'FAILED', records_found = ?, error_message = ?
      WHERE id = ?
    `,
      )
      .run(new Date().toISOString(), recordsFound, message, id);
  }

  /**
   * Returns the most recently started job run, or null when none exists.
   *
   * @returns The latest {@link JobRun} ordered by start time descending, or
   *   `null` when the table is empty.
   * @example
   * ```ts
   * const lastRun = jobs.latest();
   * if (lastRun) console.log(lastRun.status);
   * ```
   */
  public latest(): JobRun | null {
    const row = this.db
      .prepare("SELECT * FROM job_runs ORDER BY started_at DESC LIMIT 1")
      .get() as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      sourceName: row.source_name as string,
      scheduledAt: row.scheduled_at as string,
      startedAt: row.started_at as string,
      finishedAt: row.finished_at as string | null,
      status: row.status as JobRun["status"],
      checkpointBefore: row.checkpoint_before as number,
      checkpointAfter: row.checkpoint_after as number | null,
      recordsFound: row.records_found as number,
      recordsWritten: row.records_written as number,
      outputFile: row.output_file as string | null,
      metadataFile: row.metadata_file as string | null,
      errorMessage: row.error_message as string | null,
    };
  }
}
