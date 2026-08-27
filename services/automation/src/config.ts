import { isAbsolute, resolve } from "node:path";
import { loadRepositoryEnv } from "./loadRepositoryEnv.js";

const repositoryRoot = loadRepositoryEnv();

/** Collector database tier: `"test"` when testing, otherwise `"prod"`. Overridable
 * via `COLLECTOR_DB_TIER`. */
const tier = (process.env.COLLECTOR_DB_TIER ??
  (process.env.NODE_ENV === "test" ? "test" : "prod")) as "test" | "prod";

/** Resolves an optional repository-relative path from environment configuration. */
const runtimePath = (value: string | undefined, fallback: string): string => {
  const path = value ?? fallback;
  return isAbsolute(path) ? path : resolve(repositoryRoot, path);
};

/** Runtime configuration for the collector, sourced from environment variables. */
export const config = {
  backendUrl: process.env.BACKEND_URL ?? "http://localhost:3000",
  databasePath: runtimePath(
    process.env.COLLECTOR_DATABASE_PATH,
    `.runtime/automation/collector${tier === "test" ? "-test" : ""}.db`,
  ),
  artifactDir: runtimePath(process.env.ARTIFACT_DIR, ".runtime/cron"),
  sourceName: process.env.COLLECTION_SOURCE_NAME ?? "backend-telemetry",
  pageSize: Number(process.env.COLLECTION_PAGE_SIZE ?? 500),
};
