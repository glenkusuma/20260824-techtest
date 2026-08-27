import type { SiteProfile } from "./types.js";

/** The two always-present demo site profiles (Cikarang A, Bekasi B) used by the
 * one-off publish segment. These mirror the seeded demo sites on the backend,
 * including their real inverter and capacity ratings. */
export const SITE_PROFILES: SiteProfile[] = [
  {
    id: "site-cikarang-a",
    inverterId: "inv-cikarang-a-01",
    name: "Cikarang Rooftop A",
    pvPeakPowerW: 5500,
    inverterAcPowerW: 5000,
    totalEnergyBaseWh: 12_650_000,
  },
  {
    id: "site-bekasi-b",
    inverterId: "inv-bekasi-b-01",
    name: "Bekasi Rooftop B",
    pvPeakPowerW: 6600,
    inverterAcPowerW: 6000,
    totalEnergyBaseWh: 15_980_000,
  },
];
