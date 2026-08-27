import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";

const root = process.cwd();
const forceEnv = process.argv.includes("--force-env");
const resetDemo = process.argv.includes("--reset-demo");
const envExample = resolve(root, ".env.example");
const envFile = resolve(root, ".env");

if (!existsSync(envFile) || forceEnv) {
  copyFileSync(envExample, envFile);
  console.log(
    `${forceEnv ? "Replaced" : "Created"} .env from .env.example (normal local/demo database configuration).`,
  );
} else {
  console.log(
    "Keeping existing .env. Use --force-env to replace it from .env.example.",
  );
}

// For setup, the repository .env is authoritative so an unrelated exported
// shell variable cannot accidentally seed the test-tier database.
const fileEnv = parseEnv(readFileSync(envFile, "utf8"));
const setupEnv = { ...process.env, ...fileEnv };

for (const dir of [
  ".runtime/backend",
  ".runtime/automation",
  ".runtime/cron",
]) {
  mkdirSync(resolve(root, dir), { recursive: true });
}

const resolveConfiguredPath = (value, fallback) => {
  const path = value ?? fallback;
  return isAbsolute(path) ? path : resolve(root, path);
};

const backendDb = resolveConfiguredPath(
  setupEnv.DATABASE_PATH,
  ".runtime/backend/application.db",
);
const collectorDb = resolveConfiguredPath(
  setupEnv.COLLECTOR_DATABASE_PATH,
  ".runtime/automation/collector.db",
);

if (resetDemo || !existsSync(backendDb)) {
  runNpm(["run", "db:reset:demo", "-w", "@technical-test/backend"]);
} else {
  console.log(
    `Backend database already exists; leaving it unchanged: ${backendDb}`,
  );
}

if (resetDemo || !existsSync(collectorDb)) {
  runNpm(["run", "db:reset:demo", "-w", "@technical-test/automation"]);
} else {
  console.log(
    `Collector database already exists; leaving it unchanged: ${collectorDb}`,
  );
}

console.log(
  "Setup complete. Run `npm run dev` for local services or `npm run demo` for the two-minute demo.",
);

function runNpm(args) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, args, { stdio: "inherit", env: setupEnv });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}
