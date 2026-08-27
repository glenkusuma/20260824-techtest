import { randomUUID } from "node:crypto";
import type { SiteCreateInput } from "../dto/SiteCreateDTO.js";
import type { SiteUpdateInput } from "../dto/SiteUpdateDTO.js";
import { ApiError } from "../errors/ApiError.js";
import type { SiteRepository } from "../repositories/SiteRepository.js";
import type { Site } from "../types/models.js";

/**
 * Application logic for site CRUD, delegating persistence to {@link SiteRepository}.
 * Invalid states surface as {@link ApiError} with HTTP-style status codes.
 */
export class SiteService {
  /**
   * @param {SiteRepository} repository The repository supplying site persistence.
   */
  public constructor(private readonly repository: SiteRepository) {}

  /**
   * Returns all sites, oldest first.
   * @returns {Site[]} Every site ordered by creation, then id.
   * @see {@link SiteRepository#findAll}
   */
  public list(): Site[] {
    return this.repository.findAll();
  }

  /**
   * Returns a single site by id.
   * @param {string} id The site id to look up.
   * @returns {Site} The matching site.
   * @throws {ApiError} 404 when no site has the given id.
   */
  public get(id: string): Site {
    const site = this.repository.findById(id);
    if (!site) throw new ApiError(404, "Site not found");
    return site;
  }

  /**
   * Creates a new site with generated ids, answering with the stored row.
   * @param {SiteCreateInput} input The validated site-create payload.
   * @returns {Site} The created site as persisted.
   * @example
   * const site = service.create({
   *   name: "Warehouse",
   *   location: "Bekasi",
   *   pvPeakPowerW: 100_000,
   *   inverterAcPowerW: 80_000,
   *   timezone: "Asia/Jakarta",
   * });
   */
  public create(input: SiteCreateInput): Site {
    const now = new Date().toISOString();
    const id = randomUUID();
    return this.repository.create({
      id,
      inverterId: `inv-${randomUUID()}`,
      name: input.name,
      location: input.location,
      pvPeakPowerW: input.pvPeakPowerW,
      inverterAcPowerW: input.inverterAcPowerW,
      timezone: input.timezone,
      enabled: true,
      protected: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Applies the given patch to an existing site and returns the updated row.
   * @param {string} id The site id to update.
   * @param {SiteUpdateInput} input The validated site-update payload (all fields optional).
   * @returns {Site} The updated site as persisted.
   * @throws {ApiError} 404 when no site has the given id.
   * @example
   * const updated = service.update(id, { enabled: false });
   */
  public update(id: string, input: SiteUpdateInput): Site {
    const existing = this.get(id);
    const updated = this.repository.update(id, {
      name: input.name ?? existing.name,
      location: input.location ?? existing.location,
      pvPeakPowerW: input.pvPeakPowerW ?? existing.pvPeakPowerW,
      inverterAcPowerW: input.inverterAcPowerW ?? existing.inverterAcPowerW,
      enabled: input.enabled ?? existing.enabled,
    });
    if (!updated) throw new ApiError(404, "Site not found");
    return updated;
  }

  /**
   * Deletes a site by id.
   * @param {string} id The site id to delete.
   * @returns {void}
   * @throws {ApiError} 404 when the site does not exist; 409 when the site is protected.
   */
  public delete(id: string): void {
    const existing = this.get(id);
    if (existing.protected) {
      throw new ApiError(409, "Protected sites may not be deleted");
    }
    if (!this.repository.delete(id)) {
      throw new ApiError(404, "Site not found");
    }
  }
}
