import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createDependencies } from "./dependencies.js";

/** The HTTP server entrypoint. Waits for incoming connections on `env.PORT`. */
const dependencies = createDependencies(env.DATABASE_PATH);
const app = createApp(dependencies);
const server = app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT}`);
});

/**
 * Gracefully stops accepting connections, closes the database, then exits with
 * code `0`. Bound to both `SIGTERM` and `SIGINT` so container/CI shutdowns and
 * Ctrl-C leave no open SQLite handles behind.
 */
const shutdown = (): void => {
  server.close(() => {
    dependencies.database.close();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
