import { env } from "../config/env.js";
import { AppDatabase } from "../db/AppDatabase.js";
import { resetDemoData } from "../seed/demoSeed.js";

/**
 * CLI routine invoked via `npm run db:reset:demo` (backed by `tsx`). Opens the
 * database at `DATABASE_PATH`, seeds the deterministic demo state, reports the
 * resulting telemetry row count, then closes the connection cleanly.
 */
const database = new AppDatabase(env.DATABASE_PATH);
resetDemoData(database.connection);
const count = database.connection
  .prepare("SELECT COUNT(*) AS count FROM telemetry_readings")
  .get() as { count: number };
console.log(
  `Demo database reset at ${env.DATABASE_PATH}; seeded ${count.count} telemetry readings.`,
);
database.close();
