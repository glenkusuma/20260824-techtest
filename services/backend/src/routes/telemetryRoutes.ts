import { Router } from "express";
import type { TelemetryService } from "../services/TelemetryService.js";
import { createTelemetryController } from "../controllers/telemetryController.js";

/**
 * Builds the ingest + cross-site cursor router (POST/GET `/api/v1/telemetry`).
 * @param {TelemetryService} service The service backing the handlers.
 * @returns {Router} An Express router for the telemetry collection noun.
 * @see {@link createTelemetryController}
 */
export const createTelemetryRoutes = (service: TelemetryService): Router => {
  const router = Router();
  const controller = createTelemetryController(service);
  router.post("/", controller.ingest);
  router.get("/", controller.page);
  return router;
};

/**
 * Builds the site-scoped telemetry router (GET `/sites/:siteId/telemetry`).
 * @param {TelemetryService} service The service backing the handler.
 * @returns {Router} An Express router mounting the {@code bySite} handler with merged params.
 * @see {@link createTelemetryController}
 */
export const createSiteTelemetryRoutes = (
  service: TelemetryService,
): Router => {
  const router = Router({ mergeParams: true });
  const controller = createTelemetryController(service);
  router.get("/", controller.bySite);
  return router;
};
