import type { RequestHandler } from "express";
import {
  siteTelemetryQuerySchema,
  telemetryPageQuerySchema,
} from "../dto/TelemetryQueryDTO.js";
import { TelemetryIngestDTO } from "../dto/TelemetryIngestDTO.js";
import type { TelemetryService } from "../services/TelemetryService.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const paramId = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

/**
 * The object of {@link RequestHandler}s returned by {@link createTelemetryController}.
 * @typedef {Object} TelemetryController
 * @property {RequestHandler} ingest Validates and stores a reading.
 * @property {RequestHandler} bySite Route for site-scoped queries.
 * @property {RequestHandler} page Route for cross-site cursor pages.
 */

/**
 * Builds the Express handlers for telemetry ingest and collection queries.
 * @param {TelemetryService} service The service backing each handler.
 * @returns {TelemetryController} An object keyed by telemetry route.
 * @see {@link createTelemetryRoutes} {@link createSiteTelemetryRoutes}
 */
export const createTelemetryController = (service: TelemetryService) => ({
  /** Validates and ingests a telemetry reading, answering 201 when newly stored.
   * @param {import("express").Request} req The request whose body is parsed by {@link TelemetryIngestDTO}.
   * @param {import("express").Response} res The response.
   * @returns {void}
   * @example
   * POST /api/v1/telemetry
   * { "schemaVersion": "1.0", "source": "telemetry-simulator", "siteId": "site-abc", "inverterId": "inv-abc", "observedAt": "2026-08-24T00:00:00+07:00", "status": "running", "metrics": { "acPowerW": 5000, "acVoltageV": 225, "frequencyHz": 50, "energyTodayWh": 1200000, "energyTotalWh": 1200000000 } }
   */
  ingest: ((req, res) => {
    const result = service.ingest(TelemetryIngestDTO.parse(req.body));
    res
      .status(result.created ? 201 : 200)
      .json(
        new ApiResponse(
          result.created ? 201 : 200,
          result.reading,
          result.created ? "Telemetry stored" : "Telemetry already stored",
        ),
      );
  }) as RequestHandler,
  /**
   * Site-scoped collection. With `latest=true` responds with the most recent
   * reading (or null); otherwise responds with the recent history, newest last.
   * @param {import("express").Request} req The request carrying {@code :siteId} and {@code limit}/{@code latest} query params.
   * @param {import("express").Response} res The response.
   * @returns {void}
   */
  bySite: ((req, res) => {
    const siteId = paramId(req.params.siteId);
    const { limit, latest } = siteTelemetryQuerySchema.parse(req.query);
    if (latest) {
      res.json(new ApiResponse(200, service.latest(siteId)));
      return;
    }
    res.json(new ApiResponse(200, service.history(siteId, limit)));
  }) as RequestHandler,
  /** Cross-site cursor page over all telemetry.
   * @param {import("express").Request} req The request carrying {@code afterId} and {@code limit} query params.
   * @param {import("express").Response} res The response.
   * @returns {void}
   */
  page: ((req, res) => {
    const { afterId, limit } = telemetryPageQuerySchema.parse(req.query);
    res.json(new ApiResponse(200, service.collectionPage(afterId, limit)));
  }) as RequestHandler,
});
