import type { RequestHandler } from "express";
import { SiteCreateDTO } from "../dto/SiteCreateDTO.js";
import { SiteUpdateDTO } from "../dto/SiteUpdateDTO.js";
import type { SiteService } from "../services/SiteService.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const paramId = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

/**
 * The object of {@link RequestHandler}s returned by {@link createSiteController}.
 * @typedef {Object} SiteController
 * @property {RequestHandler} list Lists all sites.
 * @property {RequestHandler} get Returns one site by id.
 * @property {RequestHandler} create Validates and creates a site.
 * @property {RequestHandler} update Validates and updates a site.
 * @property {RequestHandler} remove Deletes a site.
 */

/**
 * Builds the Express handlers for the site collection, wired to the given service.
 * @param {SiteService} service The service backing each handler.
 * @returns {SiteController} An object keyed by REST verb for the site routes.
 * @see {@link createSiteRoutes}
 */
export const createSiteController = (service: SiteService) => ({
  /** Lists all sites.
   * @param {import("express").Request} _req The request (unused).
   * @param {import("express").Response} res The response.
   * @returns {void}
   */
  list: ((_req, res) =>
    res.json(new ApiResponse(200, service.list()))) as RequestHandler,
  /** Returns a single site by {@code :siteId}.
   * @param {import("express").Request} req The request carrying {@code :siteId}.
   * @param {import("express").Response} res The response.
   * @returns {void}
   */
  get: ((req, res) => {
    res.json(new ApiResponse(200, service.get(paramId(req.params.siteId))));
  }) as RequestHandler,
  /** Validates and creates a new site, answering 201 Created.
   * @param {import("express").Request} req The request whose body is parsed by {@link SiteCreateDTO}.
   * @param {import("express").Response} res The response.
   * @returns {void}
   * @example
   * POST /api/v1/sites
   * { "name": "Warehouse", "location": "Bekasi", "pvPeakPowerW": 100000, "inverterAcPowerW": 80000 }
   */
  create: ((req, res) => {
    const site = service.create(SiteCreateDTO.parse(req.body));
    res.status(201).json(new ApiResponse(201, site, "Site created"));
  }) as RequestHandler,
  /** Validates and updates a site by {@code :siteId}.
   * @param {import("express").Request} req The request carrying {@code :siteId} and a body parsed by {@link SiteUpdateDTO}.
   * @param {import("express").Response} res The response.
   * @returns {void}
   */
  update: ((req, res) => {
    const site = service.update(
      paramId(req.params.siteId),
      SiteUpdateDTO.parse(req.body),
    );
    res.json(new ApiResponse(200, site, "Site updated"));
  }) as RequestHandler,
  /** Deletes a site by {@code :siteId}, answering 204 No Content on success.
   * @param {import("express").Request} req The request carrying {@code :siteId}.
   * @param {import("express").Response} res The response.
   * @returns {void}
   */
  remove: ((req, res) => {
    service.delete(paramId(req.params.siteId));
    res.status(204).send();
  }) as RequestHandler,
});
