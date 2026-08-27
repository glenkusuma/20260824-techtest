import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { basename, resolve } from "node:path";

const getArg = (name, fallback) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? fallback;
const dayDurationMs = Number(getArg("day-duration-ms", "60000"));
if (!Number.isFinite(dayDurationMs) || dayDurationMs < 1000)
  throw new Error("day-duration-ms must be >= 1000");

// The compose demo replays "yesterday" + "today" in Asia/Jakarta. Keep these
// derivations in sync with services/telemetry-simulator/src/generator.ts.
const jakartaDate = (offsetDays) =>
  new Date(Date.now() + 7 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
const day1Date = jakartaDate(-1);
const day2Date = jakartaDate(0);
const mmddyyyy = (date) =>
  date.split("-").slice(1).join("") + date.split("-")[0];
const day1File = mmddyyyy(day1Date);
const day2File = mmddyyyy(day2Date);

const artifactDir = resolve(".runtime/cron");
const collectorDir = resolve(".runtime/automation");
const backendDir = resolve(".runtime/backend");
const composeProject = sanitizeComposeProjectName(basename(process.cwd()));
const compose = [...detectCompose(), "-p", composeProject, "-f", "compose.yaml"];

// Pre-flight: the compose backend publishes to host port 3000. Refuse to run if a
// stale local dev/compose service is already holding it, so the demo never validates
// against a stranger's backend.
await assertPortFree(3000, "compose backend");

rmSync(artifactDir, { recursive: true, force: true });
mkdirSync(artifactDir, { recursive: true });
// Rootless automation container (UID 1000) writes its collector DB via the
// ./runtime/automation:/data bind; pre-create it owned by the host user so UID 1000
// can write without a root chown.
mkdirSync(collectorDir, { recursive: true });
// Same for the rootless backend (UID 1000) writing ./runtime/backend:/data.
mkdirSync(backendDir, { recursive: true });
run([...compose, "down", "-v", "--remove-orphans"], true);
run([...compose, "build"]);
run([
  ...compose,
  "run",
  "--rm",
  "backend",
  "node",
  "services/backend/dist/scripts/resetDemoDb.js",
]);
run([
  ...compose,
  "run",
  "--rm",
  "--entrypoint",
  "node",
  "automation",
  "services/automation/dist/scripts/resetDemoCollectorDb.js",
]);
run([...compose, "up", "-d", "backend", "frontend"]);
await waitForUrl("http://localhost:3000/health", 30_000);
await waitForUrl("http://localhost:5173", 30_000);
console.log("Compose demo ready at http://localhost:5173/?demo=1");

let demoCompleted = false;
try {
  await virtualDay(1, true);
  await virtualDay(2, false);
  await validateComposeScenario();
  demoCompleted = true;

  console.log("\nCompose two-day demo");
  console.log("\n=== Review window ===");
  console.log("Dashboard   : http://localhost:5173/?demo=1");
  console.log("API docs    : http://localhost:3000/api-docs");
  console.log(`Artifacts   : ${artifactDir}`);
  console.log(
    "Inspect the warning state on Site B and the generated CSV/.meta.json pairs.",
  );
  console.log("Services will remain running until you press Ctrl+C.\n");

  await waitForShutdownSignal();
} finally {
  await shutdownCompose(demoCompleted ? "review window closed" : "demo interrupted/failed");
}

async function virtualDay(dayNumber, failNoon) {
  console.log(`\n=== Compose Virtual Day ${dayNumber} ===`);
  await segment(dayNumber, 0, 485);
  collect(dayNumber, 8, false);
  await segment(dayNumber, 485, 725);
  collect(dayNumber, 12, failNoon);
  await segment(dayNumber, 725, 905);
  collect(dayNumber, 15, false);
  await segment(dayNumber, 905, 1440);
}

async function segment(dayNumber, from, to) {
  const duration = Math.max(
    0,
    Math.round(dayDurationMs * ((to - from) / 1440)),
  );
  run([
    ...compose,
    "run",
    "--rm",
    "telemetry-simulator",
    "node",
    "services/telemetry-simulator/dist/publishSegment.js",
    `--day=${dayNumber}`,
    `--from-minute=${from}`,
    `--to-minute=${to}`,
    `--duration-ms=${duration}`,
    "--backend-url=http://backend:3000",
  ]);
}

function collect(dayNumber, hour, fail) {
  const date = dayNumber === 1 ? day1Date : day2Date;
  const command = [
    ...compose,
    "run",
    "--rm",
    "--entrypoint",
    "node",
    "automation",
    "services/automation/dist/collect.js",
    `--scheduled-at=${date}T${String(hour).padStart(2, "0")}:00:00+07:00`,
  ];
  if (fail) command.push("--failpoint=before-finalize");
  const result = spawnSync(command[0], command.slice(1), { stdio: "inherit" });
  if (fail && result.status === 0)
    throw new Error("Expected compose archive failpoint to fail");
  if (!fail && result.status !== 0)
    throw new Error("Compose collector failed unexpectedly");
}

async function validateComposeScenario() {
  let afterId = 0;
  let total = 0;
  while (true) {
    const response = await fetch(
      `http://localhost:3000/api/v1/telemetry?afterId=${afterId}&limit=1000`,
    );
    if (!response.ok)
      throw new Error(
        `Collection verification failed with HTTP ${response.status}`,
      );
    const page = (await response.json()).data;
    total += page.records.length;
    afterId = page.nextAfterId;
    if (!page.hasMore) break;
  }
  if (total !== 1176)
    throw new Error(`Expected 1176 stored telemetry rows, found ${total}`);

  const historyResponse = await fetch(
    "http://localhost:3000/api/v1/sites/site-bekasi-b/telemetry?limit=1000",
  );
  const history = (await historyResponse.json()).data;
  const warnings = history.filter(
    (row) => row.status === "warning" && row.errorCode === "GRID_OVERVOLTAGE",
  );
  if (warnings.length !== 29)
    throw new Error(
      `Expected 29 Bekasi warning readings, found ${warnings.length}`,
    );

  const files = readdirSync(artifactDir).sort();
  const expectedFiles = [
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
  if (JSON.stringify(files) !== JSON.stringify(expectedFiles)) {
    throw new Error(`Unexpected Compose artifact set: ${files.join(", ")}`);
  }

  const metas = expectedFiles
    .filter((name) => name.endsWith(".meta.json"))
    .map((name) =>
      JSON.parse(readFileSync(resolve(artifactDir, name), "utf8")),
    );
  const counts = metas.map((meta) => meta.recordsWritten);
  const checkpoints = metas.map((meta) => meta.checkpointAfter);
  if (JSON.stringify(counts) !== JSON.stringify([194, 168, 408, 96, 72])) {
    throw new Error(`Unexpected Compose archive counts: ${counts.join(", ")}`);
  }
  if (
    JSON.stringify(checkpoints) !== JSON.stringify([218, 386, 794, 890, 962])
  ) {
    throw new Error(
      `Unexpected Compose checkpoints: ${checkpoints.join(", ")}`,
    );
  }
  console.log(
    "Verified Compose HTTP telemetry, 29 warnings, five archive pairs, and catch-up checkpoints.",
  );
}

function detectCompose() {
  if (
    spawnSync("docker", ["compose", "version"], { stdio: "ignore" }).status ===
    0
  )
    return ["docker", "compose"];
  if (
    spawnSync("podman", ["compose", "version"], { stdio: "ignore" }).status ===
    0
  )
    return ["podman", "compose"];
  throw new Error("Neither `docker compose` nor `podman compose` is available");
}

function run(command, allowFailure = false) {
  const result = spawnSync(command[0], command.slice(1), { stdio: "inherit" });
  if (!allowFailure && result.status !== 0)
    throw new Error(`${command.join(" ")} failed`);
}

async function waitForUrl(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry while Compose services start.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function waitForShutdownSignal() {
  return new Promise((resolvePromise) => {
    let resolved = false;
    const finish = (signal) => {
      if (resolved) return;
      resolved = true;
      console.log(`\nReceived ${signal}. Preparing Compose shutdown...`);
      resolvePromise();
    };

    // Keep Node's event loop alive during the review window. A top-level await
    // on an unresolved Promise is not enough by itself on recent Node versions;
    // without an active handle, Node may print an unsettled top-level-await
    // warning and exit before cleanup runs.
    process.stdin.resume();

    // Keep the handlers installed until process exit. Removing them inside the
    // signal callback can let the same terminal interrupt race with the cleanup
    // child process, leaving containers running.
    process.on("SIGINT", () => finish("SIGINT"));
    process.on("SIGTERM", () => finish("SIGTERM"));
  });
}

async function shutdownCompose(reason) {
  console.log(`\nStopping Compose demo services (${reason})...`);

  // Give the terminal SIGINT a short moment to settle before spawning
  // `docker compose down`. This avoids the cleanup child receiving the same
  // Ctrl+C and being killed before it can remove containers.
  await sleepMs(250);

  const downCommand = [...compose, "down", "--remove-orphans"];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = spawnSync(downCommand[0], downCommand.slice(1), {
      stdio: "inherit",
    });
    if (result.status === 0) {
      process.stdin.pause();
      return;
    }
    console.warn(`Compose down attempt ${attempt} failed; retrying...`);
    await sleepMs(500);
  }

  console.warn("Compose down did not complete; trying stop + rm fallback...");
  spawnSync(compose[0], [...compose.slice(1), "stop"], { stdio: "inherit" });
  spawnSync(compose[0], [...compose.slice(1), "rm", "-f", "-s"], {
    stdio: "inherit",
  });
  process.stdin.pause();
}

function sanitizeComposeProjectName(name) {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!sanitized)
    throw new Error(
      "Unable to derive a Compose project name from the current directory",
    );
  return sanitized;
}

function sleepMs(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/**
 * Binds a server to the given port to confirm it is free, then releases it.
 * Throws early with an actionable message if something is already listening,
 * so the demo never targets a stale dev/compose server.
 */
async function assertPortFree(port, label) {
  await new Promise((resolvePromise, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        new Error(
          `${label} port ${port} is already in use - a stale \`npm run dev\`/compose service is likely holding it. ` +
            `Stop it, then re-run the demo.`,
        ),
      ),
    );
    probe.listen(port, "0.0.0.0", () => probe.close(resolvePromise));
  });
}
