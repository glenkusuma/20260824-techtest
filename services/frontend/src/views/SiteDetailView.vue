<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { AlertTriangle, ArrowLeft, Lock, Pencil, RefreshCw, Trash2 } from "lucide-vue-next";
import Alert from "@/components/ui/Alert.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import MetricCard from "@/components/MetricCard.vue";
import PowerChart from "@/components/PowerChart.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { isDemoMode } from "@/lib/demo";
import { solarApi } from "@/services/api";
import { useSolarStore } from "@/stores/solar";
import type { Site, TelemetryReading } from "@/types/solar";
import { useRouter } from "vue-router";

/** Detail page for a single site. Loads the site, its latest reading, and its
 * history on mount, then polls (1s in demo mode, 15s otherwise) until unmount.
 * Also hosts the edit link and a guarded delete action. */
const props = defineProps<{ siteId: string }>();
const site = ref<Site | null>(null);
const latest = ref<TelemetryReading | null>(null);
const history = ref<TelemetryReading[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);
const pollMs = isDemoMode() ? 1000 : 15000;
let timer: number | undefined;

const router = useRouter();
const store = useSolarStore();
const deleting = ref(false);
const deleteError = ref<string | null>(null);

/** Deletes the site after a confirm dialog, navigating back to the site list on success.
 * @returns A promise resolving once deleted or when the user cancels.
 */
const onDelete = async (): Promise<void> => {
  if (!site.value) return;
  const confirmed = window.confirm(`Delete "${site.value.name}"? This cannot be undone.`);
  if (!confirmed) return;
  deleting.value = true;
  deleteError.value = null;
  try {
    await store.removeSite(site.value.id);
    await router.push("/sites");
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : "Could not delete site";
  } finally {
    deleting.value = false;
  }
};

const latestObserved = computed(() =>
  latest.value
    ? new Date(latest.value.observedAt).toLocaleString("en-GB", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No telemetry yet",
);

/** Loads the site, latest reading, and history in parallel, updating all three refs.
 * @returns A promise resolving once the parallel fetch settles.
 */
const refresh = async (): Promise<void> => {
  loading.value = true;
  error.value = null;
  try {
    [site.value, latest.value, history.value] = await Promise.all([
      solarApi.getSite(props.siteId),
      solarApi.latest(props.siteId),
      solarApi.history(props.siteId),
    ]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unable to load site";
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await refresh();
  timer = window.setInterval(() => void refresh(), pollMs);
});
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <div v-if="site">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <RouterLink to="/sites" class="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950">
        <ArrowLeft class="h-4 w-4" /> Sites
      </RouterLink>
      <div class="flex items-center gap-2">
        <RouterLink :to="`/sites/${site.id}/edit`">
          <Button variant="outline" size="sm"><Pencil class="h-4 w-4" /> Edit</Button>
        </RouterLink>
        <Button
          variant="destructive"
          size="sm"
          :disabled="site.protected || deleting"
          :title="site.protected ? 'Protected sites cannot be deleted' : undefined"
          @click="onDelete"
        >
          <Trash2 class="h-4 w-4" /> Delete
        </Button>
        <Button variant="outline" size="sm" :disabled="loading" @click="refresh">
          <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" /> Refresh
        </Button>
      </div>
    </div>

    <header class="mt-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-3xl font-semibold">{{ site.name }}</h1>
          <Badge v-if="site.protected" variant="secondary"><Lock class="h-3 w-3" /> Protected</Badge>
        </div>
        <p class="mt-1 text-slate-500">
          {{ site.location }} · {{ (site.pvPeakPowerW / 1000).toFixed(1) }} kWp · {{ (site.inverterAcPowerW / 1000).toFixed(1) }} kW inverter
        </p>
        <p class="mt-1 font-mono text-xs text-slate-400">{{ site.inverterId }}</p>
      </div>
      <div class="text-right">
        <StatusBadge :status="latest?.status ?? 'no-data'" />
        <p class="mt-2 text-xs text-slate-500">{{ latestObserved }} (Asia/Jakarta)</p>
      </div>
    </header>

    <Alert v-if="error" tone="warning" class="mt-6">{{ error }}</Alert>
    <Alert v-if="deleteError" tone="warning" class="mt-6">{{ deleteError }}</Alert>
    <Alert v-if="latest?.status === 'warning'" tone="warning" class="mt-6">
      <div class="flex gap-3">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p class="font-semibold">{{ latest.errorCode }}</p>
          <p class="text-sm">
            The simulator reports grid voltage above its attention boundary. AC production is interrupted for this observation; the next valid reading can recover automatically.
          </p>
        </div>
      </div>
    </Alert>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="AC power" :value="latest ? `${(latest.acPowerW / 1000).toFixed(2)} kW` : '-'" />
      <MetricCard label="Energy today" :value="latest ? `${(latest.energyTodayWh / 1000).toFixed(2)} kWh` : '-'" />
      <MetricCard label="AC voltage" :value="latest ? `${latest.acVoltageV.toFixed(1)} V` : '-'" />
      <MetricCard label="Grid frequency" :value="latest ? `${latest.frequencyHz.toFixed(2)} Hz` : '-'" />
    </div>

    <Card class="mt-6 p-5">
      <div class="mb-4">
        <h2 class="font-semibold">Power profile</h2>
        <p class="text-sm text-slate-500">Latest {{ history.length }} observations</p>
      </div>
      <PowerChart :readings="history" />
    </Card>

    <Card class="mt-6 overflow-hidden">
      <div class="border-b border-slate-100 p-5">
        <h2 class="font-semibold">Recent readings</h2>
        <p class="mt-1 text-sm text-slate-500">Newest observations with operational status</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[720px] text-sm">
          <thead class="bg-slate-50 text-left text-slate-500">
            <tr>
              <th class="px-5 py-3 font-medium">Observed (Asia/Jakarta)</th>
              <th class="px-5 py-3 font-medium">Power</th>
              <th class="px-5 py-3 font-medium">Voltage</th>
              <th class="px-5 py-3 font-medium">Frequency</th>
              <th class="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="reading in history.slice(-12).reverse()" :key="reading.id" class="border-t border-slate-100">
              <td class="px-5 py-3">
                {{ new Date(reading.observedAt).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' }) }}
              </td>
              <td class="px-5 py-3">{{ (reading.acPowerW / 1000).toFixed(2) }} kW</td>
              <td class="px-5 py-3">{{ reading.acVoltageV.toFixed(1) }} V</td>
              <td class="px-5 py-3">{{ reading.frequencyHz.toFixed(2) }} Hz</td>
              <td class="px-5 py-3"><StatusBadge :status="reading.status" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </div>

  <Alert v-else-if="error" tone="warning">{{ error }}</Alert>
  <p v-else class="text-slate-500">Loading site…</p>
</template>
