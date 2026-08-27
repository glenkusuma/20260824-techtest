import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { solarApi } from "@/services/api";
import { useSolarStore } from "@/stores/solar";
import type { Site } from "@/types/solar";

vi.mock("@/services/api", () => ({
  solarApi: {
    listSites: vi.fn(),
    latest: vi.fn(),
    history: vi.fn(),
    createSite: vi.fn(),
    updateSite: vi.fn(),
    deleteSite: vi.fn(),
  },
}));

const mockedApi = vi.mocked(solarApi);

const seedSite = (overrides: Partial<Site> = {}): Site => ({
  id: "site-1",
  inverterId: "inv-1",
  name: "Site A",
  location: "West Java",
  pvPeakPowerW: 5000,
  inverterAcPowerW: 5000,
  timezone: "Asia/Jakarta",
  enabled: true,
  protected: false,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
  ...overrides,
});

describe("solar store CRUD", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockedApi.latest.mockResolvedValue(null);
    mockedApi.history.mockResolvedValue([]);
  });

  it("updateSite replaces the site in place", async () => {
    const store = useSolarStore();
    const original = seedSite();
    mockedApi.listSites.mockResolvedValue([original]);
    await store.refresh();

    const updated = { ...original, name: "Site A (renamed)" };
    mockedApi.updateSite.mockResolvedValue(updated);
    const result = await store.updateSite("site-1", {
      name: "Site A (renamed)",
      location: original.location,
      pvPeakPowerW: 5000,
      inverterAcPowerW: 5000,
      enabled: true,
    });

    expect(mockedApi.updateSite).toHaveBeenCalledWith(
      "site-1",
      expect.any(Object),
    );
    expect(result.name).toBe("Site A (renamed)");
    expect(store.sites).toHaveLength(1);
    expect(store.sites[0]?.name).toBe("Site A (renamed)");
  });

  it("removeSite filters the site and clears its telemetry", async () => {
    const store = useSolarStore();
    const original = seedSite({ protected: true });
    mockedApi.listSites.mockResolvedValue([original]);
    await store.refresh();
    store.historyBySite[original.id] = [];

    mockedApi.deleteSite.mockResolvedValue(undefined);
    await store.removeSite(original.id);

    expect(mockedApi.deleteSite).toHaveBeenCalledWith(original.id);
    expect(store.sites).toHaveLength(0);
    expect(store.latestBySite[original.id]).toBeUndefined();
    expect(store.historyBySite[original.id]).toBeUndefined();
  });
});
