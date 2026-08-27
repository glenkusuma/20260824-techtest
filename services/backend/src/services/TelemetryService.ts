import type { TelemetryIngestInput } from "../dto/TelemetryIngestDTO.js";
import { ApiError } from "../errors/ApiError.js";
import type { SiteRepository } from "../repositories/SiteRepository.js";
import type { TelemetryRepository } from "../repositories/TelemetryRepository.js";
import type { TelemetryReading } from "../types/models.js";

/**
 * `TelemetryReading` plus whether the row was newly inserted.
 * @typedef {Object} IngestResult
 * @property {TelemetryReading} reading The stored (or already-existing) reading.
 * @property {boolean} created True when the row was newly inserted this call.
 */

/** Application logic for telemetry ingest and retrieval.
 * @see {@link SiteService} for the sites these readings belong to.
 */
export class TelemetryService {
  /**
   * @param {SiteRepository} sites Repository used to validate a reading's site.
   * @param {TelemetryRepository} telemetry Repository used to persist readings.
   */
  public constructor(
    private readonly sites: SiteRepository,
    private readonly telemetry: TelemetryRepository,
  ) {}

  /** Validates the site/reading, stores it, and reports whether a row was created.
   * @param {TelemetryIngestInput} input The validated inbound telemetry payload.
   * @returns {IngestResult} The stored reading and whether a new row was created.
   * @throws {ApiError} 404 if the site does not exist; 409 if the site is disabled,
   *   the inverter mismatches, or a conflicting duplicate already exists; 400 if AC
   *   power exceeds the configured inverter capacity.
   * @example
   * const { reading, created } = service.ingest(payload);
   */
  public ingest(input: TelemetryIngestInput): {
    reading: TelemetryReading;
    created: boolean;
  } {
    const site = this.sites.findById(input.siteId);
    if (!site) throw new ApiError(404, "Telemetry site does not exist");
    if (!site.enabled) throw new ApiError(409, "Telemetry site is disabled");
    if (input.inverterId !== site.inverterId) {
      throw new ApiError(
        409,
        "Telemetry inverter does not match the configured site inverter",
      );
    }
    if (input.metrics.acPowerW > site.inverterAcPowerW) {
      throw new ApiError(400, "AC power exceeds configured inverter capacity", {
        maximumW: site.inverterAcPowerW,
      });
    }

    const result = this.telemetry.create({
      siteId: input.siteId,
      inverterId: input.inverterId,
      observedAt: input.observedAt,
      receivedAt: new Date().toISOString(),
      acPowerW: input.metrics.acPowerW,
      acVoltageV: input.metrics.acVoltageV,
      frequencyHz: input.metrics.frequencyHz,
      energyTodayWh: input.metrics.energyTodayWh,
      energyTotalWh: input.metrics.energyTotalWh,
      status: input.status,
      errorCode: input.errorCode ?? null,
    });

    if (!result.created) {
      const existing = result.reading;
      const sameReading =
        existing.inverterId === input.inverterId &&
        existing.acPowerW === input.metrics.acPowerW &&
        existing.acVoltageV === input.metrics.acVoltageV &&
        existing.frequencyHz === input.metrics.frequencyHz &&
        existing.energyTodayWh === input.metrics.energyTodayWh &&
        existing.energyTotalWh === input.metrics.energyTotalWh &&
        existing.status === input.status &&
        existing.errorCode === (input.errorCode ?? null);
      if (!sameReading) {
        throw new ApiError(
          409,
          "Telemetry already exists for this site and observation time with different values",
        );
      }
    }

    return result;
  }

  /** Returns the most recent reading for a site, or null if none exists.
   * @param {string} siteId The site to query.
   * @returns {TelemetryReading | null} The newest reading, or null when the site has none.
   * @throws {ApiError} 404 when the site does not exist.
   */
  public latest(siteId: string): TelemetryReading | null {
    if (!this.sites.findById(siteId)) throw new ApiError(404, "Site not found");
    return this.telemetry.latestBySite(siteId);
  }

  /** Returns a site's recent readings, newest last, capped by limit.
   * @param {string} siteId The site to query.
   * @param {number} limit Maximum number of readings to return.
   * @returns {TelemetryReading[]} The readings from oldest to newest within the limit.
   * @throws {ApiError} 404 when the site does not exist.
   */
  public history(siteId: string, limit: number): TelemetryReading[] {
    if (!this.sites.findById(siteId)) throw new ApiError(404, "Site not found");
    return this.telemetry.historyBySite(siteId, limit);
  }

  /** Returns a cursor page of readings after `afterId` plus a next-cursor and `hasMore`.
   * The limit is treated as the page size; one extra row is fetched internally to
   * decide whether more rows follow.
   * @param {number} afterId Exclusive lower bound on reading id.
   * @param {number} limit The requested page size.
   * @returns {{records: TelemetryReading[], nextAfterId: number, hasMore: boolean}}
   *   The page of readings, the cursor to resume after, and whether more exist.
   */
  public collectionPage(
    afterId: number,
    limit: number,
  ): {
    records: TelemetryReading[];
    nextAfterId: number;
    hasMore: boolean;
  } {
    const records = this.telemetry.findAfterId(afterId, limit + 1);
    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    return {
      records: page,
      nextAfterId: page.at(-1)?.id ?? afterId,
      hasMore,
    };
  }
}
