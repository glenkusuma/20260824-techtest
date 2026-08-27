import { loadRepositoryEnv } from "./loadRepositoryEnv.js";
import { performance } from "node:perf_hooks";
import { getArg } from "./args.js";
import { generateTelemetry } from "./generator.js";
import { BackendClient } from "./httpClient.js";
import { SITE_PROFILES } from "./profiles.js";
import type { SimulationDay } from "./types.js";

loadRepositoryEnv();

/** CLI routine (via `tsx`) that backfills a contiguous `--from-minute` to
 * `--to-minute` slice of a simulated day to the backend, throttled to span
 * `--duration-ms`. Used to hydrate history for a demo day before the live
 * simulator takes over. Prints the count of readings published. */
const day = Number(getArg("day", "1")) as SimulationDay;
const fromMinute = Number(getArg("from-minute", "0"));
const toMinute = Number(getArg("to-minute", "1440"));
const durationMs = Number(getArg("duration-ms", "60000"));
const backendUrl = getArg(
  "backend-url",
  process.env.BACKEND_URL ?? "http://localhost:3000",
)!;

if (
  ![1, 2].includes(day) ||
  fromMinute < 0 ||
  toMinute > 1440 ||
  fromMinute >= toMinute ||
  fromMinute % 5 !== 0 ||
  toMinute % 5 !== 0 ||
  !Number.isFinite(durationMs) ||
  durationMs < 0
) {
  throw new Error("Invalid segment arguments");
}

const client = new BackendClient(backendUrl);
await client.waitUntilHealthy();
const sampleMinutes = Array.from(
  { length: (toMinute - fromMinute) / 5 },
  (_, index) => fromMinute + index * 5,
);
const started = performance.now();
let sent = 0;

for (const [index, minute] of sampleMinutes.entries()) {
  if (durationMs > 0 && sampleMinutes.length > 1) {
    const deadline =
      started + (index / (sampleMinutes.length - 1)) * durationMs;
    const waitMs = deadline - performance.now();
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  for (const site of SITE_PROFILES) {
    await client.publish(generateTelemetry(site, day, minute));
    sent += 1;
  }
}

console.log(
  `Published ${sent} readings for virtual day ${day}, minutes ${fromMinute}-${toMinute - 5}.`,
);
