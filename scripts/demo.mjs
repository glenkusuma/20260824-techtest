import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";

const getArg = (name, fallback) => {
  const prefix = `--${name}=`;
  return (
    process.argv
      .find((value) => value.startsWith(prefix))
      ?.slice(prefix.length) ?? fallback
  );
};

const dayDurationMs = Number(getArg("day-duration-ms", "60000"));
const includeFrontend = getArg("frontend", "true") === "true";
const keepOpen = getArg("keep-open", "true") === "true";
const backendPort = Number(getArg("backend-port", "3000"));
const frontendPort = Number(getArg("frontend-port", "5173"));
if (!Number.isFinite(dayDurationMs) || dayDurationMs < 1000)
  throw new Error("day-duration-ms must be >= 1000");

// The demo replays "yesterday" + "today" in Asia/Jakarta, so it stays valid on any
// real calendar date. Keep these derivations in sync with services/telemetry-simulator/src/generator.ts.
const jakartaDate = (offsetDays) =>
  new Date(Date.now() + 7 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
const day1Date = jakartaDate(-1); // yesterday
const day2Date = jakartaDate(0); // today
const mmddyyyy = (date) =>
  date.split("-").slice(1).join("") + date.split("-")[0];
const day1File = mmddyyyy(day1Date); // e.g. cron_08242026_*.csv
const day2File = mmddyyyy(day2Date);

const root = process.cwd();
const backendDir = resolve(root, ".runtime/backend");
const automationDir = resolve(root, ".runtime/automation");
const backendDb = resolve(backendDir, "application.db");
const collectorDb = resolve(automationDir, "collector.db");
const artifactDir = resolve(root, ".runtime/cron");

// Pre-flight: the demo spawns its own backend on backendPort. If a stale service
// (e.g. `npm run dev`) already owns the port, the demo would silently publish to a
// foreign server and corrupt its deterministic assertions. Detect that up front.
await assertPortFree(backendPort, "backend");
if (includeFrontend) await assertPortFree(frontendPort, "frontend");

rmSync(backendDb, { force: true });
rmSync(collectorDb, { force: true });
rmSync(artifactDir, { recursive: true, force: true });
mkdirSync(backendDir, { recursive: true });
mkdirSync(automationDir, { recursive: true });
mkdirSync(artifactDir, { recursive: true });

const commonEnv = {
  ...process.env,
  NODE_ENV: "development",
  DB_TIER: "prod",
  COLLECTOR_DB_TIER: "prod",
  HTTP_LOGGING: "false",
  RATE_LIMIT_MAX: "100000",
  CORS_ORIGIN: `http://localhost:${frontendPort}`,
};
const backendEnv = {
  ...commonEnv,
  PORT: String(backendPort),
  DATABASE_PATH: backendDb,
};
const automationEnv = {
  ...commonEnv,
  BACKEND_URL: `http://localhost:${backendPort}`,
  COLLECTOR_DATABASE_PATH: collectorDb,
  ARTIFACT_DIR: artifactDir,
  COLLECTION_SOURCE_NAME: "backend-telemetry",
};

runNode("services/backend/dist/scripts/resetDemoDb.js", [], backendEnv);
runNode(
  "services/automation/dist/scripts/resetDemoCollectorDb.js",
  [],
  automationEnv,
);

const processes = [];
const backend = spawn(process.execPath, ["services/backend/dist/server.js"], {
  env: backendEnv,
  stdio: ["ignore", "pipe", "pipe"],
});
backend.stdout.on("data", (data) => process.stdout.write(`[backend] ${data}`));
backend.stderr.on("data", (data) => process.stderr.write(`[backend] ${data}`));
processes.push(backend);

if (includeFrontend) {
  const frontend = spawn(
    npmCommand(),
    [
      "run",
      "preview",
      "-w",
      "@technical-test/frontend",
      "--",
      "--port",
      String(frontendPort),
    ],
    {
      env: commonEnv,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    },
  );
  frontend.stdout.on("data", (data) =>
    process.stdout.write(`[frontend] ${data}`),
  );
  frontend.stderr.on("data", (data) =>
    process.stderr.write(`[frontend] ${data}`),
  );
  processes.push(frontend);
}

const shutdown = () => {
  for (const child of processes) if (!child.killed) child.kill("SIGTERM");
};
const shutdownSignal = waitForShutdownSignal();

try {
  await waitForUrl(`http://localhost:${backendPort}/health`, 20_000);
  // If a foreign server had slipped onto the port, our own backend would have
  // crashed with EADDRINUSE before serving. Refuse to trust a stranger's /health.
  if (backend.exitCode !== null) {
    throw new Error(
      `Spawned backend exited (code ${backend.exitCode}). The health probe likely reached a different server.`,
    );
  }
  if (includeFrontend)
    await waitForUrl(`http://localhost:${frontendPort}`, 20_000);

  console.log(
    `\nDemo ready. Dashboard: http://localhost:${frontendPort}/?demo=1`,
  );
  console.log(
    `Each virtual day runs in about ${(dayDurationMs / 1000).toFixed(1)} seconds.\n`,
  );

  await runVirtualDay(1, true);
  await runVirtualDay(2, false);
  await validateScenario();
  console.log("\nTwo-day solar telemetry demo");
  console.log("\n=== Review window ===");
  if (includeFrontend)
    console.log(`Dashboard   : http://localhost:${frontendPort}/?demo=1`);
  console.log(`API docs    : http://localhost:${backendPort}/api-docs`);
  console.log(`Artifacts   : ${artifactDir}`);
  console.log(
    "Inspect the Site B warning state and generated CSV/.meta.json pairs.",
  );
  if (keepOpen) {
    console.log("Services will remain running until you press Ctrl+C.\n");
    await shutdownSignal;
  } else {
    console.log("Headless demo complete; stopping services.\n");
  }
} finally {
  shutdown();
}

async function runVirtualDay(day, failNoon) {
  console.log(`\n=== Virtual Day ${day} ===`);
  await segment(day, 0, 485); // through 08:00
  collect(day, 8, false);
  await segment(day, 485, 725); // 08:05 through 12:00
  collect(day, 12, failNoon);
  await segment(day, 725, 905); // 12:05 through 15:00
  collect(day, 15, false);
  await segment(day, 905, 1440); // 15:05 through 23:55
}

async function segment(day, fromMinute, toMinute) {
  const duration = Math.max(
    0,
    Math.round(dayDurationMs * ((toMinute - fromMinute) / 1440)),
  );
  const args = [
    `--day=${day}`,
    `--from-minute=${fromMinute}`,
    `--to-minute=${toMinute}`,
    `--duration-ms=${duration}`,
    `--backend-url=http://localhost:${backendPort}`,
  ];
  await runNodeAsync(
    "services/telemetry-simulator/dist/publishSegment.js",
    args,
    commonEnv,
  );
}

function collect(day, hour, fail) {
  const date = day === 1 ? day1Date : day2Date;
  const args = [
    `--scheduled-at=${date}T${String(hour).padStart(2, "0")}:00:00+07:00`,
  ];
  if (fail) args.push("--failpoint=before-finalize");
  const result = spawnSync(
    process.execPath,
    ["services/automation/dist/collect.js", ...args],
    {
      env: automationEnv,
      encoding: "utf8",
    },
  );
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (fail) {
    if (result.status === 0)
      throw new Error("Expected simulated noon archive failure");
    console.log(
      "Expected Day-1 12:00 archive failure observed; checkpoint remains unchanged.",
    );
  } else if (result.status !== 0) {
    throw new Error(`Collector failed unexpectedly for Day ${day} ${hour}:00`);
  }
}

async function validateScenario() {
  const ids = [];
  let afterId = 0;
  while (true) {
    const response = await fetch(
      `http://localhost:${backendPort}/api/v1/telemetry?afterId=${afterId}&limit=1000`,
    );
    if (!response.ok) throw new Error("Could not verify final telemetry count");
    const body = await response.json();
    const page = body.data;
    ids.push(...page.records.map((record) => record.id));
    afterId = page.nextAfterId;
    if (!page.hasMore) break;
  }
  assertEqual(ids.length, 1176, "stored telemetry rows including seed data");

  const bekasiHistory = await apiData(
    `http://localhost:${backendPort}/api/v1/sites/site-bekasi-b/telemetry?limit=1000`,
  );
  const cikarangHistory = await apiData(
    `http://localhost:${backendPort}/api/v1/sites/site-cikarang-a/telemetry?limit=1000`,
  );

  const day1Bekasi = onLocalDay(bekasiHistory, day1Date);
  const day2Bekasi = onLocalDay(bekasiHistory, day2Date);
  const day1Cikarang = onLocalDay(cikarangHistory, day1Date);
  const day2Cikarang = onLocalDay(cikarangHistory, day2Date);
  assertEqual(
    day1Bekasi.filter((row) => row.status === "warning").length,
    19,
    "Day-1 Bekasi warnings",
  );
  assertEqual(
    day2Bekasi.filter((row) => row.status === "warning").length,
    10,
    "Day-2 Bekasi warnings",
  );
  assertEqual(
    day1Cikarang.at(-1)?.energyTodayWh,
    24785,
    "Day-1 Cikarang energy",
  );
  assertEqual(day1Bekasi.at(-1)?.energyTodayWh, 22378, "Day-1 Bekasi energy");
  assertEqual(
    day2Cikarang.at(-1)?.energyTodayWh,
    24743,
    "Day-2 Cikarang energy",
  );
  assertEqual(day2Bekasi.at(-1)?.energyTodayWh, 25812, "Day-2 Bekasi energy");

  const files = readdirSync(artifactDir).sort();
  const expected = [
    `cron_${day1File}_08.00.csv`,
    `cron_${day1File}_08.00.meta.json`,
    `cron_${day1File}_15.00.csv`,
    `cron_${day1File}_15.00.meta.json`,
    `cron_${day2File}_08.00.csv`,
    `cron_${day2File}_08.00.meta.json`,
    `cron_${day2File}_12.00.csv`,
    `cron_${day2File}_12.00.meta.json`,
    `cron_${day2File}_15.00.csv`,
    `cron_${day2File}_15.00.meta.json`,
  ];
  assertEqual(JSON.stringify(files), JSON.stringify(expected), "artifact set");

  const metas = expected
    .filter((name) => name.endsWith(".meta.json"))
    .map((name) =>
      JSON.parse(readFileSync(resolve(artifactDir, name), "utf8")),
    );
  assertEqual(
    JSON.stringify(metas.map((meta) => meta.checkpointAfter)),
    JSON.stringify([218, 386, 794, 890, 962]),
    "archive checkpoints",
  );
  assertEqual(
    JSON.stringify(metas.map((meta) => meta.recordsWritten)),
    JSON.stringify([194, 168, 408, 96, 72]),
    "archive row counts",
  );

  console.log(
    "Verified telemetry volume, both warning windows, energy totals, five archives, and checkpoint catch-up.",
  );
}

function onLocalDay(records, localDate) {
  return records.filter((row) => {
    const jakarta = new Date(
      new Date(row.observedAt).getTime() + 7 * 60 * 60 * 1000,
    );
    return jakarta.toISOString().slice(0, 10) === localDate;
  });
}

async function apiData(url) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Verification request failed: ${response.status}`);
  return (await response.json()).data;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected)
    throw new Error(`Expected ${label} = ${expected}; got ${actual}`);
}

function runNode(file, args, env) {
  const result = spawnSync(process.execPath, [file, ...args], {
    env,
    stdio: "inherit",
  });
  if (result.status !== 0)
    throw new Error(`${file} exited with status ${result.status}`);
}

function runNodeAsync(file, args, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      env,
      stdio: "inherit",
    });
    child.on("exit", (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`${file} exited with status ${code}`)),
    );
    child.on("error", reject);
  });
}

async function waitForUrl(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

/**
 * Binds a server to the given port to confirm it is free, then releases it.
 * Throws early with an actionable message if something is already listening,
 * so the demo never silently targets a stale dev/compose server.
 */
async function assertPortFree(port, label) {
  await new Promise((resolvePromise, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        new Error(
          `${label} port ${port} is already in use! A stale \`npm run dev\` or compose service is likely holding it. ` +
            `Stop it, then re-run the demo.`,
        ),
      ),
    );
    probe.listen(port, "0.0.0.0", () => probe.close(resolvePromise));
  });
}

function waitForShutdownSignal() {
  return new Promise((resolvePromise) => {
    let resolved = false;
    const finish = (signal) => {
      if (resolved) return;
      resolved = true;
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
      console.log(`\n${signal} received; stopping demo services...`);
      resolvePromise();
    };
    const onSigint = () => finish("SIGINT");
    const onSigterm = () => finish("SIGTERM");
    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);
  });
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}
