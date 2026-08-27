import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Docker-path integration test for the automation >30-day cron + pruning.
//
// Proves, on the REAL containerized path (Containerfile -> automation), against
// REAL backend data:
//   1. cron is installed, the crontab is loaded (08:00/12:00/15:00 collect +
//      daily 00:15 cleanup), and the daemon is alive and fires (optional check).
//   2. the real collector archives real telemetry into /home/cron across 35
//      distinct virtual days x 3 collections = 105 artifact pairs, named
//      cron_MMDDYYYY_HH.MM.{csv,meta.json}.
//   3. the real cleanup.sh run inside the container prunes artifacts whose mtime
//      is older than RETENTION_DAYS (30) while preserving recent ones.
//
// A 30-real-day daemon run is not feasible in a test, so age is simulated
// honestly: the 105 dated artifacts are produced by driving the real collector
// with distinct --scheduled-at dates, then the old artifacts' filesystem mtimes
// (which the bind mount shares with the container) are backdated and the real
// cleanup.sh executes. find -mtime keys on filesystem mtime, so this is the same
// signal production uses -- but in seconds instead of a month.
// ---------------------------------------------------------------------------

const DAYS = Number(
  process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 35,
);
const RUN_REAL_FIRE = !process.argv.includes("--no-real-cron-fire");
const HOURS = [8, 12, 15];
const RETENTION_DAYS = 30;
const BACKDATE_DAYS = 40; // safely > RETENTION_DAYS; avoids -mtime whole-day rounding

if (!Number.isFinite(DAYS) || DAYS < 31)
  throw new Error("--days must be >= 31");
if (BACKDATE_DAYS <= RETENTION_DAYS)
  throw new Error("backdate window must exceed retention");

const root = process.cwd();
const artifactDir = resolve(".runtime/cron");
const collectorDir = resolve(".runtime/automation"); // rootless automation /data bind

// Compose: dedicated project + backend port unpinned (see override file).
const [bin, ...composeBase] = detectCompose();
const COMPOSE = [
  bin,
  ...composeBase,
  "-f",
  "compose.yaml",
  "-f",
  "scripts/docker-cleanup-test.compose.yaml",
];

// Jakarta (UTC+7) date helpers, in sync with services/telemetry-simulator/src/generator.ts.
const jakartaNowMs = Date.now() + 7 * 60 * 60 * 1000;
const jakartaDate = (offset) =>
  new Date(jakartaNowMs + offset * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
const mmddyyyy = (date) =>
  date.split("-").slice(1).join("") + date.split("-")[0];
const baseName = (i, hour) => {
  const offset = i - (DAYS - 1); // oldest day -> newest (today)
  return `cron_${mmddyyyy(jakartaDate(offset))}_${String(hour).padStart(2, "0")}.00`;
};

// Pre-flight: compose.yaml publishes the backend to host :3000. If a stale
// dev/compose service holds it, refuse rather than validate against a stranger.
await assertPortFree(3000, "compose backend");

try {
  // ---- 1/2. Clean + reset -----------------------------------------------
  step("Cleaning artifacts and resetting demo databases");
  rmSync(artifactDir, { recursive: true, force: true });
  mkdirSync(artifactDir, { recursive: true });
  // The rootless automation container (UID 1000) writes its collector DB through
  // the ./.runtime/automation:/data bind; pre-create it owned by the host user so
  // UID 1000 can write without any root chown.
  mkdirSync(collectorDir, { recursive: true });
  // The rootless backend (UID 1000) writes its SQLite DB through ./.runtime/backend.
  mkdirSync(resolve(".runtime/backend"), { recursive: true });
  run(["down", "-v", "--remove-orphans"], true);
  run(["build", "backend", "automation", "telemetry-simulator"]);
  run([
    "run",
    "--rm",
    "backend",
    "node",
    "services/backend/dist/scripts/resetDemoDb.js",
  ]);
  run([
    "run",
    "--rm",
    "--entrypoint",
    "node",
    "automation",
    "services/automation/dist/scripts/resetDemoCollectorDb.js",
  ]);
  run(["up", "-d", "backend", "automation"]);

  // ---- Real backend data: seed one virtual day, assert rows exist ---------
  step("Seeding real telemetry into the backend");
  await waitForBackendHealth();
  run([
    "run",
    "--rm",
    "telemetry-simulator",
    "node",
    "services/telemetry-simulator/dist/publishSegment.js",
    "--day=1",
    "--from-minute=0",
    "--to-minute=1440",
    "--duration-ms=5000",
    "--backend-url=http://backend:3000",
  ]);
  const telemetryRows = await backendJson(
    "/api/v1/telemetry?afterId=0&limit=1000",
  );
  const seeded = telemetryRows.data?.records?.length ?? 0;
  if (seeded <= 0)
    throw new Error(
      `Expected real telemetry rows on the backend, found ${seeded}`,
    );

  // ---- Rootless cron (supercronic) wiring ----------------------------------
  step("Verifying rootless cron (supercronic) daemon + crontab");
  // supercronic runs as UID 1000 / PID 1. It refuses to start on an invalid
  // crontab, so a live daemon whose cmdline references the crontab is proof the
  // schedule loaded. The image is slim (no procps), so read /proc directly.
  const ALIVE = `[ "$(cat /proc/1/comm 2>/dev/null)" = supercronic ]`;
  assertExit(
    execOut("automation", ["sh", "-c", ALIVE]),
    "supercronic (PID 1, rootless) not running",
  );
  const argv = execOut("automation", [
    "sh",
    "-c",
    "tr '\\0' ' ' < /proc/1/cmdline",
  ]).stdout;
  if (!argv.includes("supercronic") || !argv.includes("automation/crontab")) {
    throw new Error(`supercronic not pointed at the crontab: ${argv.trim()}`);
  }
  if (RUN_REAL_FIRE) {
    step("Validating the crontab parses under supercronic (no root required)");
    assertExit(
      execOut("automation", [
        "supercronic",
        "-test",
        "/app/services/automation/crontab",
      ]),
      "supercronic rejected the crontab",
    );
    step("supercronic parses the crontab and is running rootless (UID 1000)");
  }

  // ---- Drive 35 days x 3 collections on the running automation container ----
  step(
    `Driving ${DAYS} days x ${HOURS.length} collections through the real collector`,
  );
  for (let i = 0; i < DAYS; i += 1) {
    for (const hour of HOURS) {
      const date = jakartaDate(i - (DAYS - 1));
      const scheduledAt = `${date}T${String(hour).padStart(2, "0")}:00:00+07:00`;
      assertExit(
        execOut("automation", [
          "node",
          "services/automation/dist/collect.js",
          `--scheduled-at=${scheduledAt}`,
        ]),
        `collector failed for ${scheduledAt}`,
      );
    }
  }

  // Sanity: the very first (oldest) archive must have drained real rows.
  const firstMeta = JSON.parse(
    readFileSync(resolve(artifactDir, `${baseName(0, 8)}.meta.json`), "utf8"),
  );
  if (firstMeta.recordsWritten <= 0) {
    throw new Error(
      `Expected the first archive to contain real data; got ${firstMeta.recordsWritten} rows`,
    );
  }
  const filesBefore = readdirSync(artifactDir).sort();
  if (filesBefore.length !== DAYS * HOURS.length * 2) {
    throw new Error(
      `Expected ${DAYS * HOURS.length * 2} artifact files, found ${filesBefore.length}`,
    );
  }

  // ---- Backdate old mtimes, then run the REAL cleanup inside the container ---
  // Keep the 2 newest days at their recent mtime; backdate everything older to
  // >RETENTION_DAYS ago. Artifacts are written as root inside the container, so we
  // backdate them IN the container (root) on the same bind-mounted /home/cron:
  // the host user cannot utimes root-owned files.
  const newestDates = new Set([jakartaDate(-1), jakartaDate(0)].map(mmddyyyy));
  const oldFiles = readdirSync(artifactDir).filter((file) => {
    const match = /^cron_(\d{8})/.exec(file);
    return match && !newestDates.has(match[1]);
  });
  step(
    `Backdating ${oldFiles.length} old artifact mtimes, then running real cleanup.sh in the container`,
  );
  execOut("automation", [
    "node",
    "-e",
    `const fs=require('fs'); const t=new Date(Date.now()-${BACKDATE_DAYS}*24*3600*1000); for (const f of ${JSON.stringify(oldFiles)}) fs.utimesSync('/home/cron/'+f,t,t);`,
  ]);

  run([
    "exec",
    "-T",
    "automation",
    "bash",
    "services/automation/scripts/cleanup.sh",
  ]);

  // ---- Assert pruning ------------------------------------------------------
  const filesAfter = readdirSync(artifactDir).sort();
  const expectedRemain = newestDateFiles(newestDates);
  if (JSON.stringify(filesAfter) !== JSON.stringify(expectedRemain.sort())) {
    throw new Error(
      `Unexpected artifact set after cleanup.\n  expected ${expectedRemain.length} files:\n    ${expectedRemain.join("\n    ")}\n  found:\n    ${filesAfter.join("\n    ")}`,
    );
  }
  step(
    `PASS: ${DAYS} days x ${HOURS.length} collections archived; cleanup retained ${filesAfter.length} files (>${RETENTION_DAYS}-day-old pruned)`,
  );

  // Post-cleanup: the collector must still run (no state was corrupted).
  assertExit(
    execOut("automation", [
      "node",
      "services/automation/dist/collect.js",
      "--scheduled-at=" + `${jakartaDate(0)}T15:00:00+07:00`,
    ]),
    "collector should still run after cleanup",
  );
} finally {
  run(["down", "-v", "--remove-orphans"], true);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function run(args, allowFailure = false) {
  const result = spawnSync(COMPOSE[0], [...COMPOSE.slice(1), ...args], {
    stdio: "inherit",
  });
  if (!allowFailure && result.status !== 0)
    throw new Error(`docker compose ${args.join(" ")} failed`);
}

function execOut(service, args) {
  const result = spawnSync(
    COMPOSE[0],
    [...COMPOSE.slice(1), "exec", "-T", service, ...args],
    { encoding: "utf8" },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function assertExit(result, message) {
  if (result.status !== 0)
    throw new Error(`${message}\n${result.stderr || result.stdout}`);
}

async function waitForBackendHealth() {
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    const r = execOut("backend", [
      "node",
      "-e",
      "fetch('http://localhost:3000/health').then((x)=>process.exit(x.ok?0:1)).catch(()=>process.exit(1))",
    ]);
    if (r.status === 0) return;
    await sleepMs(300);
  }
  throw new Error("Timed out waiting for compose backend health");
}

async function backendJson(path) {
  const r = execOut("backend", [
    "node",
    "-e",
    `fetch('http://localhost:3000${path}').then(async(x)=>{if(!x.ok)process.exit(1);process.stdout.write(JSON.stringify(await x.json()))}).catch(()=>process.exit(1))`,
  ]);
  if (r.status !== 0) throw new Error(`backend ${path} failed: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

function newestDateFiles(newestDates) {
  const out = [];
  for (let i = DAYS - 2; i < DAYS; i += 1) {
    const offset = i - (DAYS - 1);
    const dateKey = mmddyyyy(jakartaDate(offset));
    for (const hour of HOURS) {
      for (const ext of ["csv", "meta.json"])
        out.push(`cron_${dateKey}_${String(hour).padStart(2, "0")}.00.${ext}`);
    }
  }
  return out;
}

async function assertPortFree(port, label) {
  await new Promise((resolvePromise, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        new Error(
          `${label} port ${port} is already in use - a stale \`npm run dev\`/compose service is likely holding it. ` +
            `Stop it, then re-run the test.`,
        ),
      ),
    );
    probe.listen(port, "0.0.0.0", () => probe.close(resolvePromise));
  });
}

function sleepMs(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function step(message) {
  console.log(`\n=== ${message} ===`);
}
