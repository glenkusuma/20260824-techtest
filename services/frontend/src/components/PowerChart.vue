<script setup lang="ts">
import { computed } from "vue";
import type { TelemetryReading } from "@/types/solar";
/** Single-site AC power line chart. Plots the supplied readings as an SVG
 * polyline normalized to the maximum power, or an empty-state label. */
const props = defineProps<{ readings: TelemetryReading[] }>();
const width = 720; const height = 220; const pad = 22;
const points = computed(() => {
  if (!props.readings.length) return "";
  const max = Math.max(1, ...props.readings.map((r) => r.acPowerW));
  return props.readings.map((r, index) => {
    const x = pad + (index / Math.max(1, props.readings.length - 1)) * (width - pad * 2);
    const y = height - pad - (r.acPowerW / max) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
});
</script>
<template>
  <div class="overflow-hidden rounded-lg border border-slate-100 bg-slate-50 p-2">
    <svg viewBox="0 0 720 220" class="h-56 w-full" role="img" aria-label="AC power history line chart">
      <line x1="22" y1="198" x2="698" y2="198" stroke="currentColor" class="text-slate-300" />
      <polyline v-if="points" :points="points" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" class="text-slate-900" />
      <text v-else x="360" y="110" text-anchor="middle" class="fill-slate-500 text-sm">No telemetry yet</text>
    </svg>
  </div>
</template>
