<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { AlertTriangle, RefreshCw, Zap } from "lucide-vue-next";
import Alert from "@/components/ui/Alert.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import FleetPowerChart from "@/components/FleetPowerChart.vue";
import MetricCard from "@/components/MetricCard.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useSolarStore } from "@/stores/solar";
import { isDemoMode } from "@/lib/demo";

/** Overview page for the fleet. On mount it loads every site plus all histories,
 * then polls on a cadence that matches the media: faster (1s latest / 5s history)
 * in demo mode, slower (15s / 60s) otherwise. Timers are cleared on unmount. */
const store = useSolarStore();
const demoMode = isDemoMode();
const pollMs = demoMode ? 1000 : 15000;
const historyPollMs = demoMode ? 5000 : 60000;
let latestTimer: number | undefined;
let historyTimer: number | undefined;
const power = computed(() => `${(store.totalPowerW / 1000).toFixed(2)} kW`);
const energy = computed(() => `${(store.totalEnergyTodayWh / 1000).toFixed(2)} kWh`);
const statusText = computed(() =>
  store.warningSites.length ? `${store.warningSites.length} needs attention` : "No active warnings",
);

/** Refreshes the latest readings and then all site histories in one sweep.
 * @returns A promise resolving once both refreshes complete. */
const refreshAll = async (): Promise<void> => {
  await store.refresh();
  await store.refreshHistories();
};

onMounted(async () => {
  await refreshAll();
  latestTimer = window.setInterval(() => void store.refresh(), pollMs);
  historyTimer = window.setInterval(() => void store.refreshHistories(), historyPollMs);
});
onBeforeUnmount(() => {
  if (latestTimer) window.clearInterval(latestTimer);
  if (historyTimer) window.clearInterval(historyTimer);
});
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p class="text-sm font-medium text-slate-500">Operations overview</p>
      <h1 class="mt-1 text-3xl font-semibold tracking-tight">Solar dashboard</h1>
      <p class="mt-2 text-sm text-slate-600">Live inverter telemetry</p>
    </div>
    <Button variant="outline" :disabled="store.loading" @click="refreshAll">
      <RefreshCw class="h-4 w-4" :class="store.loading && 'animate-spin'" />
      Refresh
    </Button>
  </header>

  <Alert v-if="store.error" class="mt-6" tone="warning">{{ store.error }}</Alert>
  <Alert v-if="store.warningSites.length" class="mt-6" tone="warning">
    <div class="flex gap-3">
      <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p class="font-semibold">Attention required</p>
        <p class="text-sm">
          {{ store.warningSites.map((site) => site.name).join(", ") }} reports simulated grid overvoltage.
          The inverter has stopped AC production for the affected observation.
        </p>
      </div>
    </div>
  </Alert>

  <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <MetricCard label="Current generation" :value="power" detail="Combined AC output" />
    <MetricCard label="Energy today" :value="energy" detail="Combined generated energy" />
    <MetricCard label="Monitored sites" :value="String(store.sites.length)" detail="Enabled solar installations" />
    <MetricCard label="Fleet status" :value="statusText" detail="Latest telemetry state" />
  </div>

  <Card class="mt-8 p-5">
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="font-semibold">Power profile</h2>
        <p class="text-sm text-slate-500">Latest history across all sites</p>
      </div>
      <span v-if="store.historyLoading" class="text-xs text-slate-500">Updating history…</span>
    </div>
    <FleetPowerChart :sites="store.sites" :history-by-site="store.historyBySite" />
  </Card>

  <section class="mt-8">
    <div class="mb-4 flex items-center gap-2">
      <Zap class="h-5 w-5" />
      <h2 class="text-xl font-semibold">Site status</h2>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <RouterLink v-for="site in store.sitesWithLatest" :key="site.id" :to="`/sites/${site.id}`">
        <Card class="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-semibold">{{ site.name }}</p>
              <p class="mt-1 text-sm text-slate-500">{{ site.location }}</p>
            </div>
            <StatusBadge :status="site.latest?.status ?? 'no-data'" />
          </div>
          <div class="mt-6 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 text-sm">
            <div>
              <p class="text-slate-500">Power</p>
              <p class="mt-1 font-medium">{{ site.latest ? `${(site.latest.acPowerW / 1000).toFixed(2)} kW` : "-" }}</p>
            </div>
            <div>
              <p class="text-slate-500">Voltage</p>
              <p class="mt-1 font-medium">{{ site.latest ? `${site.latest.acVoltageV.toFixed(1)} V` : "-" }}</p>
            </div>
            <div>
              <p class="text-slate-500">Frequency</p>
              <p class="mt-1 font-medium">{{ site.latest ? `${site.latest.frequencyHz.toFixed(2)} Hz` : "-" }}</p>
            </div>
          </div>
        </Card>
      </RouterLink>
    </div>
  </section>
</template>
