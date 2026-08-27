import { randomUUID } from "node:crypto";
import type { CheckpointRepository } from "../repositories/CheckpointRepository.js";
import type { JobRunRepository } from "../repositories/JobRunRepository.js";
import type { CollectionSource } from "../source/BackendTelemetrySource.js";
import type { TelemetryRecord } from "../types/models.js";
import type { CsvSerializer } from "../io/CsvSerializer.js";
import type { ArtifactWriter } from "../io/ArtifactWriter.js";

const pad = (value: number): string => String(value).padStart(2, "0");

const filenameBase = (scheduledAt: string): string => {
  const date = new Date(scheduledAt);
  const jakarta = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return `cron_${pad(jakarta.getUTCMonth() + 1)}${pad(jakarta.getUTCDate())}${jakarta.getUTCFullYear()}_${pad(jakarta.getUTCHours())}.${pad(jakarta.getUTCMinutes())}`;
};

/**
 * Result of a completed {@link CollectionService.run} invocation.
 *
 * @typedef {Object} CollectionRunResult
 * @property {number} checkpointAfter - Last record id checkpointed as the cursor
 *   for the next run.
 * @property {number} recordsWritten - Number of telemetry records archived.
 * @property {string} outputFile - Absolute path of the finalized CSV artifact.
 */

/**
 * Orchestrates a telemetry collection run: paginate, archive, and checkpoint.
 *
 * A single run pulls all available pages from the {@link CollectionSource},
 * serializes them to CSV, writes the CSV and metadata artifacts via
 * {@link ArtifactWriter}, and then atomically advances the checkpoint via
 * {@link CheckpointRepository} while recording the run through
 * {@link JobRunRepository}. Artifacts are finalized before collector DB state
 * commits so a failed run cannot leave an advanced checkpoint behind.
 */
export class CollectionService {
  /**
   * Creates a service bound to a source, repository, and artifact pipeline.
   *
   * @param sourceName - Logical identifier of the collection source, used as
   *   the checkpoint key and recorded on each job run.
   * @param pageSize - Number of records requested per source page.
   * @param source - Backend cursor source that supplies telemetry pages.
   * @param checkpoints - Repository used to read and persist the cursor.
   * @param jobs - Repository used to record job-run lifecycle state.
   * @param csv - Serializer that turns records into CSV text.
   * @param writer - Writer that persists the CSV and metadata artifacts.
   */
  public constructor(
    private readonly sourceName: string,
    private readonly pageSize: number,
    private readonly source: CollectionSource,
    private readonly checkpoints: CheckpointRepository,
    private readonly jobs: JobRunRepository,
    private readonly csv: CsvSerializer,
    private readonly writer: ArtifactWriter,
  ) {}

  /**
   * Runs a full collection, writing CSV/metadata artifacts and advancing the checkpoint.
   *
   * Repeatedly pages records until the source reports no more data, then writes
   * and finalizes the artifacts and atomically commits the new checkpoint. On any
   * failure the current job run is marked FAILED and the original error is
   * re-thrown so the caller observes the same error.
   *
   * @param params - Options for this run.
   * @param params.scheduledAt - ISO timestamp identifying the scheduled run window,
   *   used to derive the artifact base name.
   * @param params.failpoint - When set to `"before-finalize"`, configures the writer
   *   to fail after writing temp files in order to exercise the rollback path.
   * @returns A promise resolving to a {@link CollectionRunResult} describing the
   *   advanced checkpoint, the number of records written, and the CSV output file.
   * @throws {Error} When the source returns a non-incremental cursor, fails to
   *   advance while claiming more data, or when artifact retrieval/writing,
   *   CSV serialization, or the checkpoint commit fails. The error is recorded
   *   on the job run and re-thrown.
   * @see {@link CheckpointRepository} for checkpoint persistence.
   * @see {@link JobRunRepository} for job-run lifecycle recording.
   * @see {@link ArtifactWriter} for artifact finalization and rollback.
   * @example
   * ```ts
   * const result = await collectionService.run({ scheduledAt: new Date().toISOString() });
   * console.log(result.recordsWritten, result.checkpointAfter, result.outputFile);
   * ```
   */
  public async run(params: {
    scheduledAt: string;
    failpoint?: "before-finalize";
  }): Promise<{
    checkpointAfter: number;
    recordsWritten: number;
    outputFile: string;
  }> {
    const checkpointBefore = this.checkpoints.get(this.sourceName);
    const jobId = randomUUID();
    const startedAt = new Date().toISOString();
    this.jobs.start({
      id: jobId,
      sourceName: this.sourceName,
      scheduledAt: params.scheduledAt,
      startedAt,
      finishedAt: null,
      status: "RUNNING",
      checkpointBefore,
      checkpointAfter: null,
      recordsFound: 0,
      recordsWritten: 0,
      outputFile: null,
      metadataFile: null,
      errorMessage: null,
    });

    const records: TelemetryRecord[] = [];
    let cursor = checkpointBefore;
    try {
      while (true) {
        const page = await this.source.fetchAfter(cursor, this.pageSize);
        if (page.records.some((record) => record.id <= cursor)) {
          throw new Error(
            "Collection source returned a non-incremental record ID",
          );
        }
        if (page.hasMore && page.nextAfterId <= cursor) {
          throw new Error(
            "Collection source cursor did not advance while hasMore=true",
          );
        }
        records.push(...page.records);
        cursor = page.nextAfterId;
        if (!page.hasMore) break;
      }

      const checkpointAfter = records.at(-1)?.id ?? checkpointBefore;
      const finishedAt = new Date().toISOString();
      const baseName = filenameBase(params.scheduledAt);
      const metadata = {
        schemaVersion: 1,
        jobRunId: jobId,
        jobType: "telemetry-archive",
        source: this.sourceName,
        scheduledAt: params.scheduledAt,
        startedAt,
        finishedAt,
        status: "SUCCESS",
        checkpointBefore,
        checkpointAfter,
        recordsFound: records.length,
        recordsWritten: records.length,
        dataFile: `${baseName}.csv`,
        generatedAt: finishedAt,
      };
      const files = await this.writer.write({
        baseName,
        csv: this.csv.serialize(records),
        metadata,
        ...(params.failpoint ? { failpoint: params.failpoint } : {}),
      });

      // Files are finalized first. Collector DB state then commits atomically so
      // a failed SUCCESS update cannot leave an advanced checkpoint behind.
      this.checkpoints.transaction(() => {
        this.checkpoints.save(this.sourceName, checkpointAfter);
        this.jobs.markSuccess(jobId, {
          checkpointAfter,
          recordsFound: records.length,
          recordsWritten: records.length,
          outputFile: files.csvPath,
          metadataFile: files.metadataPath,
        });
      });
      return {
        checkpointAfter,
        recordsWritten: records.length,
        outputFile: files.csvPath,
      };
    } catch (error) {
      this.jobs.markFailed(jobId, records.length, error);
      throw error;
    }
  }
}
