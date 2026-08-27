import type Database from "better-sqlite3";
import type { Site } from "../types/models.js";

type SiteRow = {
  id: string;
  inverter_id: string;
  name: string;
  location: string;
  pv_peak_power_w: number;
  inverter_ac_power_w: number;
  timezone: "Asia/Jakarta";
  enabled: number;
  protected: number;
  created_at: string;
  updated_at: string;
};

const mapSite = (row: SiteRow): Site => ({
  id: row.id,
  inverterId: row.inverter_id,
  name: row.name,
  location: row.location,
  pvPeakPowerW: row.pv_peak_power_w,
  inverterAcPowerW: row.inverter_ac_power_w,
  timezone: row.timezone,
  enabled: row.enabled === 1,
  protected: row.protected === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * SQLite-backed data access for the sites table, mapping rows to {@link Site} objects.
 * @see {@link SiteService} for the application logic built on top.
 */
export class SiteRepository {
  /**
   * @param {Database.Database} db The shared SQLite connection.
   */
  public constructor(private readonly db: Database.Database) {}

  /**
   * Inserts a new site row and returns it.
   * @param {Site} site The site to persist.
   * @returns {Site} The same site, now stored.
   * @example
   * repo.create({
   *   id: "site-abc", inverterId: "inv-abc", name: "Warehouse",
   *   location: "Bekasi", pvPeakPowerW: 100_000, inverterAcPowerW: 80_000,
   *   timezone: "Asia/Jakarta", enabled: true, protected: false,
   *   createdAt: now, updatedAt: now,
   * });
   */
  public create(site: Site): Site {
    this.db
      .prepare(
        `
      INSERT INTO sites (
        id, inverter_id, name, location, pv_peak_power_w, inverter_ac_power_w,
        timezone, enabled, protected, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        site.id,
        site.inverterId,
        site.name,
        site.location,
        site.pvPeakPowerW,
        site.inverterAcPowerW,
        site.timezone,
        site.enabled ? 1 : 0,
        site.protected ? 1 : 0,
        site.createdAt,
        site.updatedAt,
      );
    return site;
  }

  /**
   * Inserts the site or updates it on id conflict, then returns the stored row.
   * @param {Site} site The site to insert or update.
   * @returns {Site} The resulting stored row.
   */
  public upsert(site: Site): Site {
    this.db
      .prepare(
        `
      INSERT INTO sites (
        id, inverter_id, name, location, pv_peak_power_w, inverter_ac_power_w,
        timezone, enabled, protected, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        inverter_id = excluded.inverter_id,
        name = excluded.name,
        location = excluded.location,
        pv_peak_power_w = excluded.pv_peak_power_w,
        inverter_ac_power_w = excluded.inverter_ac_power_w,
        timezone = excluded.timezone,
        enabled = excluded.enabled,
        protected = excluded.protected,
        updated_at = excluded.updated_at
    `,
      )
      .run(
        site.id,
        site.inverterId,
        site.name,
        site.location,
        site.pvPeakPowerW,
        site.inverterAcPowerW,
        site.timezone,
        site.enabled ? 1 : 0,
        site.protected ? 1 : 0,
        site.createdAt,
        site.updatedAt,
      );
    return this.findById(site.id) ?? site;
  }

  /**
   * Partially updates an editable site and returns it.
   * @param {string} id The site id to update.
   * @param {Partial<Pick<Site, "name" | "location" | "pvPeakPowerW" | "inverterAcPowerW" | "enabled">>} patch The subset of editable fields to apply.
   * @returns {Site | null} The updated site, or null when no site has the given id.
   */
  public update(
    id: string,
    patch: Partial<
      Pick<
        Site,
        "name" | "location" | "pvPeakPowerW" | "inverterAcPowerW" | "enabled"
      >
    >,
  ): Site | null {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
      UPDATE sites SET
        name = ?,
        location = ?,
        pv_peak_power_w = ?,
        inverter_ac_power_w = ?,
        enabled = ?,
        updated_at = ?
      WHERE id = ?
    `,
      )
      .run(
        patch.name ?? "",
        patch.location ?? "",
        patch.pvPeakPowerW ?? 0,
        patch.inverterAcPowerW ?? 0,
        (patch.enabled ?? true) ? 1 : 0,
        now,
        id,
      );
    return this.findById(id);
  }

  /**
   * Deletes the site by id.
   * @param {string} id The site id to delete.
   * @returns {boolean} True when a row was removed, false otherwise.
   */
  public delete(id: string): boolean {
    const result = this.db.prepare("DELETE FROM sites WHERE id = ?").run(id);
    return result.changes > 0;
  }

  /**
   * Returns all sites ordered by creation, oldest first.
   * @returns {Site[]} Every site.
   */
  public findAll(): Site[] {
    const rows = this.db
      .prepare("SELECT * FROM sites ORDER BY created_at ASC, id ASC")
      .all() as SiteRow[];
    return rows.map(mapSite);
  }

  /**
   * Looks up a site by id.
   * @param {string} id The site id to find.
   * @returns {Site | null} The matching site, or null when absent.
   */
  public findById(id: string): Site | null {
    const row = this.db.prepare("SELECT * FROM sites WHERE id = ?").get(id) as
      SiteRow | undefined;
    return row ? mapSite(row) : null;
  }
}
