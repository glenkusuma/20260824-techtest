<script setup lang="ts">
import { computed } from "vue";
import type { Site, TelemetryReading } from "@/types/solar";

/** Fleet power-history SVG chart. Renders one polyline per site, scaled to the
 * maximum AC power across all readings, with a shared axis and a latest-timestamp
 * label in the Asia/Jakarta timezone. */
const props = defineProps<{
  sites: Site[];
  historyBySite: Record<string, TelemetryReading[]>;
}>();

const width = 900;
const height = 260;
const padding = { left: 42, right: 20, top: 20, bottom: 30 };
const plotWidth = width - padding.left - padding.right;
const plotHeight = height - padding.top - padding.bottom;

const allReadings = computed(() => props.sites.flatMap((site) => props.historyBySite[site.id] ?? []));
const maxPower = computed(() => Math.max(1000, ...allReadings.value.map((reading) => reading.acPowerW)));

/** Builds the SVG polyline point string for one site's readings.
 * @param siteId The site whose readings to plot.
 * @returns A space-separated `"x,y"` point list, or `""` when the site has none.
 */
const pointsFor = (siteId: string): string => {
  const readings = props.historyBySite[siteId] ?? [];
  if (!readings.length) return "";
  return readings.map((reading, index) => {
    const x = padding.left + (index / Math.max(1, readings.length - 1)) * plotWidth;
    const y = padding.top + plotHeight - (reading.acPowerW / maxPower.value) * plotHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
};

const latestObserved = computed(() => {
  const latest = allReadings.value.at(-1);
  return latest
    ? new Date(latest.observedAt).toLocaleString("en-GB", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No telemetry";
});
</script>

<template>
  <div>
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
      <div class="flex flex-wrap gap-4">
        <span v-for="(site, index) in sites" :key="site.id" class="inline-flex items-center gap-2">
          <span :class="['h-2.5 w-2.5 rounded-full', index === 0 ? 'bg-amber-500' : 'bg-slate-700']" />
          {{ site.name }}
        </span>
      </div>
      <span>Latest: {{ latestObserved }} (Asia/Jakarta)</span>
    </div>
    <div class="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
      <svg viewBox="0 0 900 260" class="h-64 w-full" role="img" aria-label="Power history for monitored solar sites">
        <line :x1="padding.left" :y1="padding.top + plotHeight" :x2="width - padding.right" :y2="padding.top + plotHeight" stroke="currentColor" class="text-slate-300" />
        <line :x1="padding.left" :y1="padding.top" :x2="padding.left" :y2="padding.top + plotHeight" stroke="currentColor" class="text-slate-300" />
        <text x="5" :y="padding.top + 4" class="fill-slate-500 text-[11px]">{{ (maxPower / 1000).toFixed(1) }} kW</text>
        <text x="14" :y="padding.top + plotHeight" class="fill-slate-500 text-[11px]">0</text>
        <template v-for="(site, index) in sites" :key="site.id">
          <polyline
            v-if="pointsFor(site.id)"
            :points="pointsFor(site.id)"
            fill="none"
            stroke-width="3"
            stroke-linejoin="round"
            stroke-linecap="round"
            :class="index === 0 ? 'stroke-amber-500' : 'stroke-slate-700'"
          />
        </template>
        <text v-if="!allReadings.length" x="450" y="130" text-anchor="middle" class="fill-slate-500 text-sm">No telemetry yet</text>
      </svg>
    </div>
  </div>
</template>
