import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Paths of the finalized CSV and metadata files written by {@link ArtifactWriter}. */
export interface ArtifactFiles {
  csvPath: string;
  metadataPath: string;
}

/**
 * Writes CSV and metadata artifact pairs to a directory, atomically.
 *
 * Each artifact is first written to a temp file, then renamed into place. If the
 * second rename fails after the first succeeded, the already-finalized file is
 * rolled back and all temp files removed, leaving the directory unchanged.
 */
export class ArtifactWriter {
  /**
   * Creates a writer that emits artifacts underneath the given directory.
   *
   * @param directory - Directory into which `.csv` and `.meta.json` files are
   *   written; created recursively if it does not exist.
   */
  public constructor(private readonly directory: string) {}

  /**
   * Writes and finalizes both files, rolling back temp/final files on error.
   *
   * @param params - Parameters describing the artifacts to write.
   * @param params.baseName - Base file name; yields
   *   `{baseName}.csv` and `{baseName}.meta.json`.
   * @param params.csv - CSV text to write to the artifact.
   * @param params.metadata - Arbitrary metadata object serialized to JSON.
   * @param params.failpoint - When set to `"before-finalize"`, simulates a
   *   finalization failure after temp files are written to exercise rollback.
   * @returns A promise resolving to the {@link ArtifactFiles} paths of the
   *   finalized files.
   * @throws {Error} When writing temp files or renaming them into place fails,
   *   or when the `failpoint` is active. On failure any temp files and a partially
   *   finalized file pair are removed before the error is re-thrown.
   * @example
   * ```ts
   * const files = await writer.write({ baseName: "cron_08262025_0900", csv, metadata });
   * ```
   */
  public async write(params: {
    baseName: string;
    csv: string;
    metadata: Record<string, unknown>;
    failpoint?: "before-finalize";
  }): Promise<ArtifactFiles> {
    await mkdir(this.directory, { recursive: true });
    const csvFinal = join(this.directory, `${params.baseName}.csv`);
    const metadataFinal = join(this.directory, `${params.baseName}.meta.json`);
    const csvTemp = `${csvFinal}.tmp`;
    const metadataTemp = `${metadataFinal}.tmp`;
    let csvFinalized = false;
    let metadataFinalized = false;

    try {
      await writeFile(csvTemp, params.csv, "utf8");
      await writeFile(
        metadataTemp,
        `${JSON.stringify(params.metadata, null, 2)}\n`,
        "utf8",
      );
      if (params.failpoint === "before-finalize")
        throw new Error("Simulated artifact finalization failure");

      // Rename each file atomically and roll back the pair if the second rename fails.
      await rename(csvTemp, csvFinal);
      csvFinalized = true;
      await rename(metadataTemp, metadataFinal);
      metadataFinalized = true;
      return { csvPath: csvFinal, metadataPath: metadataFinal };
    } catch (error) {
      await Promise.allSettled([
        rm(csvTemp, { force: true }),
        rm(metadataTemp, { force: true }),
        ...(csvFinalized && !metadataFinalized
          ? [rm(csvFinal, { force: true })]
          : []),
        ...(metadataFinalized && !csvFinalized
          ? [rm(metadataFinal, { force: true })]
          : []),
      ]);
      throw error;
    }
  }
}
