import { loadRepositoryEnv } from "./loadRepositoryEnv.js";
import { createHash } from "node:crypto";
import { generateTelemetry } from "./generator.js";
import { BackendClient } from "./httpClient.js";
import type { SimulationDay, SiteProfile } from "./types.js";

loadRepositoryEnv();

/** Long-running simulator daemon. Resolves live site profiles from the backend,
 * then posts one telemetry reading per enabled site on a fixed cadence
 * (`SIMULATOR_CADENCE_MS`, default 300 s). Derives each reading's day, local
 * date, and five-minute boundary from the current Asia/Jakarta clock and exits
 * cleanly on SIGTERM/SIGINT. */
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";
const cadenceMs = Number(process.env.SIMULATOR_CADENCE_MS ?? 300_000);
const client = new BackendClient(backendUrl);

if (!Number.isFinite(cadenceMs) || cadenceMs < 1_000) {
  throw new Error("SIMULATOR_CADENCE_MS must be at least 1000 ms");
}

await client.waitUntilHealthy();
console.log(
  `Telemetry simulator connected to ${backendUrl}; cadence ${cadenceMs} ms.`,
);

/** Builds a {@link SiteProfile} for an enabled backend site, deriving a stable
 * baseline lifetime-energy figure from a hash of the site id so each site gets a
 * reproducible `totalEnergyBaseWh`.
 * @param site An enabled site discovered from the backend.
 * @returns The profile used to simulate readings for that site.
 */
const profileFor = (
  site: Awaited<ReturnType<BackendClient["listSites"]>>[number],
): SiteProfile => {
  const digest = createHash("sha256").update(site.id).digest();
  return {
    id: site.id,
    inverterId: site.inverterId,
    name: site.name,
    pvPeakPowerW: site.pvPeakPowerW,
    inverterAcPowerW: site.inverterAcPowerW,
    totalEnergyBaseWh: 8_000_000 + (digest.readUInt32BE(0) % 10_000_000),
  };
};

/** Publishes one reading per enabled site for the current clock boundary.
 * Computes the Asia/Jakarta local date, five-minute boundary, and simulated day
 * from the wall clock, then posts a synthesized reading for every enabled site.
 * @returns A promise resolving once all sites are published.
 */
const publishCurrent = async (): Promise<void> => {
  const now = new Date();
  const jakarta = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const minute =
    Math.floor((jakarta.getUTCHours() * 60 + jakarta.getUTCMinutes()) / 5) * 5;
  const localDate = jakarta.toISOString().slice(0, 10);
  const day: SimulationDay = jakarta.getUTCDate() % 2 === 0 ? 1 : 2;
  const sites = await client.listSites();

  for (const site of sites) {
    await client.publish(
      generateTelemetry(profileFor(site), day, minute, localDate),
    );
  }
};

await publishCurrent();
const timer = setInterval(() => {
  void publishCurrent().catch((error) =>
    console.error("Telemetry tick failed:", error),
  );
}, cadenceMs);

const shutdown = (): void => {
  clearInterval(timer);
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
