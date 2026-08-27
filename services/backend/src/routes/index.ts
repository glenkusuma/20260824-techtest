import { Router } from "express";
import healthRoutes from "./healthRoutes.js";
import type { AppDependencies } from "../dependencies.js";
import { createSiteRoutes } from "./siteRoutes.js";
import {
  createSiteTelemetryRoutes,
  createTelemetryRoutes,
} from "./telemetryRoutes.js";

/**
 * Builds the top-level router mounting the health check and the `/api/v1/*` routes.
 * @param {AppDependencies} dependencies The resolved services injected into each subtree.
 * @returns {Router} The fully assembled application router.
 */
export const createRoutes = (dependencies: AppDependencies): Router => {
  const router = Router();
  router.use("/health", healthRoutes);
  router.use("/api/v1/sites", createSiteRoutes(dependencies.siteService));
  router.use(
    "/api/v1/sites/:siteId/telemetry",
    createSiteTelemetryRoutes(dependencies.telemetryService),
  );
  router.use(
    "/api/v1/telemetry",
    createTelemetryRoutes(dependencies.telemetryService),
  );
  return router;
};
