import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { solarApi } from "@/services/api";
import type {
  Site,
  SiteEditInput,
  SiteWithLatest,
  TelemetryReading,
} from "@/types/solar";

/**
 * Central Pinia store for solar telemetry. Holds the site list, per-site latest
 * readings and histories, and derived summaries (`sitesWithLatest`,
 * `warningSites`, `totalPowerW`, `totalEnergyTodayWh`). Actions mirror the
 * {@link solarApi} client and update local state from its responses.
 */
export const useSolarStore = defineStore("solar", () => {
  const sites = ref<Site[]>([]);
  const latestBySite = ref<Record<string, TelemetryReading | null>>({});
  const historyBySite = ref<Record<string, TelemetryReading[]>>({});
  const loading = ref(false);
  const historyLoading = ref(false);
  const error = ref<string | null>(null);

  const sitesWithLatest = computed<SiteWithLatest[]>(() =>
    sites.value.map((site) => ({
      ...site,
      latest: latestBySite.value[site.id] ?? null,
    })),
  );
  const warningSites = computed(() =>
    sitesWithLatest.value.filter((site) => site.latest?.status === "warning"),
  );
  const totalPowerW = computed(() =>
    sitesWithLatest.value.reduce(
      (sum, site) => sum + (site.latest?.acPowerW ?? 0),
      0,
    ),
  );
  const totalEnergyTodayWh = computed(() =>
    sitesWithLatest.value.reduce(
      (sum, site) => sum + (site.latest?.energyTodayWh ?? 0),
      0,
    ),
  );

  /** Reloads the site list and each site's latest reading. Sets `loading` while
   * in flight and captures any error message into `error`.
   * @returns A promise resolving once sites and their latest readings are loaded. */
  const refresh = async (): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
      sites.value = await solarApi.listSites();
      const entries = await Promise.all(
        sites.value.map(
          async (site) => [site.id, await solarApi.latest(site.id)] as const,
        ),
      );
      latestBySite.value = Object.fromEntries(entries);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Unable to load solar telemetry";
    } finally {
      loading.value = false;
    }
  };

  /** Loads telemetry history for every site. Ensures the site list is loaded first.
   * @param limit Maximum readings per site (default 288, a full day at 5-min cadence).
   * @returns A promise resolving once all histories are loaded. */
  const refreshHistories = async (limit = 288): Promise<void> => {
    if (!sites.value.length) await refresh();
    historyLoading.value = true;
    try {
      const entries = await Promise.all(
        sites.value.map(
          async (site) =>
            [site.id, await solarApi.history(site.id, limit)] as const,
        ),
      );
      historyBySite.value = Object.fromEntries(entries);
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Unable to load telemetry history";
    } finally {
      historyLoading.value = false;
    }
  };

  /** Registers a new site and appends it to local state.
   * @param payload The client-editable site fields to create with.
   * @returns A promise resolving to the created site. */
  const createSite = async (
    payload: Parameters<typeof solarApi.createSite>[0],
  ): Promise<Site> => {
    const site = await solarApi.createSite(payload);
    sites.value.push(site);
    latestBySite.value[site.id] = null;
    historyBySite.value[site.id] = [];
    return site;
  };

  /** Updates an existing site and replaces it in the local list in place.
   * @param id The site id to update.
   * @param payload The fields to patch.
   * @returns A promise resolving to the updated site. */
  const updateSite = async (
    id: string,
    payload: SiteEditInput,
  ): Promise<Site> => {
    const updated = await solarApi.updateSite(id, payload);
    sites.value = sites.value.map((site) => (site.id === id ? updated : site));
    return updated;
  };

  /** Deletes a site and drops it (plus its cached latest/history) from local state.
   * @param id The site id to delete.
   * @returns A promise resolving once the site is removed. */
  const removeSite = async (id: string): Promise<void> => {
    await solarApi.deleteSite(id);
    sites.value = sites.value.filter((site) => site.id !== id);
    delete latestBySite.value[id];
    delete historyBySite.value[id];
  };

  return {
    sites,
    latestBySite,
    historyBySite,
    loading,
    historyLoading,
    error,
    sitesWithLatest,
    warningSites,
    totalPowerW,
    totalEnergyTodayWh,
    refresh,
    refreshHistories,
    createSite,
    updateSite,
    removeSite,
  };
});
