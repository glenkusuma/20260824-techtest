import { config } from "../config.js";
import { CollectorDatabase } from "../db/CollectorDatabase.js";
import { CheckpointRepository } from "../repositories/CheckpointRepository.js";

/**
 * CLI routine invoked via `npm run db:reset:demo` (backed by `tsx`). Opens the
 * collector database at `COLLECTOR_DATABASE_PATH`, clears all job runs and
 * checkpoints, seeds a checkpoint of `24` for the configured source, reports the
 * reset, then closes the connection cleanly.
 */
const database = new CollectorDatabase(config.databasePath);
database.connection.exec(
  "DELETE FROM job_runs; DELETE FROM collection_checkpoints;",
);
new CheckpointRepository(database.connection).save(config.sourceName, 24);
console.log(
  `Collector state reset at ${config.databasePath}; checkpoint = 24.`,
);
database.close();
