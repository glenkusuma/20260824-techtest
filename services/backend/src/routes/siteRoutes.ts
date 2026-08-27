import { Router } from "express";
import type { SiteService } from "../services/SiteService.js";
import { createSiteController } from "../controllers/siteController.js";

/**
 * Builds the site collection router mounted at `/api/v1/sites`.
 * @param {SiteService} service The service backing the site handlers.
 * @returns {Router} An Express router exposing the site REST endpoints.
 * @see {@link SiteController}
 */
export const createSiteRoutes = (service: SiteService): Router => {
  const router = Router();
  const controller = createSiteController(service);
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.put("/:siteId", controller.update);
  router.patch("/:siteId", controller.update);
  router.delete("/:siteId", controller.remove);
  router.get("/:siteId", controller.get);
  return router;
};
