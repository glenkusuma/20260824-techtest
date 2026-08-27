import { config } from "./config.js";
import { CollectorDatabase } from "./db/CollectorDatabase.js";
import { ArtifactWriter } from "./io/ArtifactWriter.js";
import { CsvSerializer } from "./io/CsvSerializer.js";
import { CheckpointRepository } from "./repositories/CheckpointRepository.js";
import { JobRunRepository } from "./repositories/JobRunRepository.js";
import { CollectionService } from "./services/CollectionService.js";
import { BackendTelemetrySource } from "./source/BackendTelemetrySource.js";

/**
 * CLI entrypoint invoked on a cron schedule (backed by `tsx`). Parses optional
 * `--scheduled-at` and `--failpoint` arguments, wires the collector over the
 * configured database and artifact pipeline, runs a single collection, reports
 * its outcome, and closes the database in a `finally` block so the file handle
 * is always released.
 */

/** Reads a `--name=value` CLI argument from the raw `process.argv` array.
 * @param name The argument name to look up.
 * @returns The argument's value, or `undefined` when it is not present.
 */
const arg = (name: string): string | undefined =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
const scheduledAt = arg("scheduled-at") ?? new Date().toISOString();
const failpointRaw = arg("failpoint");
const failpoint = failpointRaw === "before-finalize" ? failpointRaw : undefined;

const database = new CollectorDatabase(config.databasePath);
const service = new CollectionService(
  config.sourceName,
  config.pageSize,
  new BackendTelemetrySource(config.backendUrl),
  new CheckpointRepository(database.connection),
  new JobRunRepository(database.connection),
  new CsvSerializer(),
  new ArtifactWriter(config.artifactDir),
);

try {
  const result = await service.run({
    scheduledAt,
    ...(failpoint ? { failpoint } : {}),
  });
  console.log(
    `Collection success: ${result.recordsWritten} rows, checkpoint ${result.checkpointAfter}, ${result.outputFile}`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  database.close();
}
