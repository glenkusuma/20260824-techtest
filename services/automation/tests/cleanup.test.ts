import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];
afterEach(async () =>
  Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  ),
);

describe("cleanup.sh", () => {
  it("removes only expired cron artifact pairs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cleanup-"));
    directories.push(dir);
    const oldCsv = join(dir, "cron_01012026_08.00.csv");
    const oldMeta = join(dir, "cron_01012026_08.00.meta.json");
    const recentCsv = join(dir, "cron_08252026_08.00.csv");
    const unrelated = join(dir, "notes.txt");
    await Promise.all(
      [oldCsv, oldMeta, recentCsv, unrelated].map((file) =>
        writeFile(file, "x"),
      ),
    );
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await Promise.all(
      [oldCsv, oldMeta, unrelated].map((file) => utimes(file, old, old)),
    );

    const script = fileURLToPath(
      new URL("../scripts/cleanup.sh", import.meta.url),
    );
    const result = spawnSync("bash", [script], {
      env: { ...process.env, ARTIFACT_DIR: dir, RETENTION_DAYS: "30" },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect((await readdir(dir)).sort()).toEqual([
      "cron_08252026_08.00.csv",
      "notes.txt",
    ]);
  });
});
