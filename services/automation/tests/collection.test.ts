import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CollectorDatabase } from "../src/db/CollectorDatabase.js";
import { ArtifactWriter } from "../src/io/ArtifactWriter.js";
import { CsvSerializer } from "../src/io/CsvSerializer.js";
import { CheckpointRepository } from "../src/repositories/CheckpointRepository.js";
import { JobRunRepository } from "../src/repositories/JobRunRepository.js";
import { CollectionService } from "../src/services/CollectionService.js";
import type { CollectionSource } from "../src/source/BackendTelemetrySource.js";
import type { TelemetryRecord } from "../src/types/models.js";

const tempDirs: string[] = [];
afterEach(async () =>
  Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  ),
);

const record = (id: number): TelemetryRecord => ({
  id,
  siteId: "site-a",
  inverterId: "inv-site-a-01",
  observedAt: `2026-08-24T0${id}:00:00.000Z`,
  receivedAt: `2026-08-24T0${id}:00:01.000Z`,
  acPowerW: 1000,
  acVoltageV: 230,
  frequencyHz: 50,
  energyTodayWh: 100,
  energyTotalWh: 1000,
  status: "running",
  errorCode: null,
});

class FakeSource implements CollectionSource {
  public async fetchAfter(afterId: number, limit: number) {
    const all = [record(1), record(2), record(3)].filter(
      (item) => item.id > afterId,
    );
    const page = all.slice(0, limit);
    return {
      records: page,
      nextAfterId: page.at(-1)?.id ?? afterId,
      hasMore: all.length > limit,
    };
  }
}

const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), "collector-"));
  tempDirs.push(directory);
  const db = new CollectorDatabase(":memory:");
  const checkpoints = new CheckpointRepository(db.connection);
  const jobs = new JobRunRepository(db.connection);
  const service = new CollectionService(
    "test",
    2,
    new FakeSource(),
    checkpoints,
    jobs,
    new CsvSerializer(),
    new ArtifactWriter(directory),
  );
  return { directory, db, checkpoints, jobs, service };
};

describe("CollectionService", () => {
  it("pages, writes artifacts, then advances checkpoint", async () => {
    const { directory, db, checkpoints, service } = await fixture();
    const result = await service.run({
      scheduledAt: "2026-08-24T08:00:00+07:00",
    });
    expect(result.recordsWritten).toBe(3);
    expect(checkpoints.get("test")).toBe(3);
    expect((await readdir(directory)).sort()).toEqual([
      "cron_08242026_08.00.csv",
      "cron_08242026_08.00.meta.json",
    ]);
    const csv = await readFile(
      join(directory, "cron_08242026_08.00.csv"),
      "utf8",
    );
    expect(csv.split("\n")).toHaveLength(5);
    db.close();
  });

  it("does not advance checkpoint when finalization fails", async () => {
    const { directory, db, checkpoints, jobs, service } = await fixture();
    checkpoints.save("test", 1);
    await expect(
      service.run({
        scheduledAt: "2026-08-24T12:00:00+07:00",
        failpoint: "before-finalize",
      }),
    ).rejects.toThrow("Simulated");
    expect(checkpoints.get("test")).toBe(1);
    expect(jobs.latest()?.status).toBe("FAILED");
    expect(await readdir(directory)).toEqual([]);
    db.close();
  });

  it("rejects a source that claims more pages without advancing its cursor", async () => {
    const { directory, db, checkpoints, jobs } = await fixture();
    class StuckSource implements CollectionSource {
      public async fetchAfter(afterId: number) {
        return { records: [], nextAfterId: afterId, hasMore: true };
      }
    }
    const service = new CollectionService(
      "stuck",
      2,
      new StuckSource(),
      checkpoints,
      jobs,
      new CsvSerializer(),
      new ArtifactWriter(directory),
    );
    await expect(
      service.run({ scheduledAt: "2026-08-24T08:00:00+07:00" }),
    ).rejects.toThrow("cursor did not advance");
    expect(checkpoints.get("stuck")).toBe(0);
    db.close();
  });
});
