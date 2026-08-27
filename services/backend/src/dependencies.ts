import { AppDatabase } from "./db/AppDatabase.js";
import { SiteRepository } from "./repositories/SiteRepository.js";
import { TelemetryRepository } from "./repositories/TelemetryRepository.js";
import { SiteService } from "./services/SiteService.js";
import { TelemetryService } from "./services/TelemetryService.js";
import { DEMO_SITES } from "./seed/demoSeed.js";

/**
 * The wiring graph handed to {@link ../app.ts createApp}. Controllers receive a
 * single `AppDependencies` object so the HTTP layer never constructs services
 * or repositories directly and can be swapped for fakes in tests.
 */
export interface AppDependencies {
  /** The open SQLite database handle. */
  database: AppDatabase;
  /** Application logic for operating on solar sites. */
  siteService: SiteService;
  /** Application logic for ingesting and querying telemetry. */
  telemetryService: TelemetryService;
}

/**
 * Builds the full dependency graph for a concrete database file: opens the
 * database, constructs repositories and services over its connection, and
 * seeds the always-present demo sites. Idempotent calls to `upsert` keep the
 * seeds stable across restarts.
 * @param databasePath Filesystem path to the SQLite database file.
 * @returns A ready-to-use {@link AppDependencies} graph.
 */
export const createDependencies = (databasePath: string): AppDependencies => {
  const database = new AppDatabase(databasePath);
  const siteRepository = new SiteRepository(database.connection);
  const telemetryRepository = new TelemetryRepository(database.connection);
  for (const site of DEMO_SITES) siteRepository.upsert(site);
  return {
    database,
    siteService: new SiteService(siteRepository),
    telemetryService: new TelemetryService(siteRepository, telemetryRepository),
  };
};
