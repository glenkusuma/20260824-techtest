<script setup lang="ts">
import { onMounted } from "vue";
import { Lock, Plus } from "lucide-vue-next";
import Alert from "@/components/ui/Alert.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import { useSolarStore } from "@/stores/solar";

/** Site-list page. Shows every site with its latest reading and a `Protected`
 * badge, and refreshes the store on mount so the list is current. */
const store = useSolarStore();
onMounted(() => void store.refresh());
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p class="text-sm text-slate-500">Configuration</p>
      <h1 class="mt-1 text-3xl font-semibold">Solar sites</h1>
      <p class="mt-2 text-sm text-slate-600">Registered site resources returned by the Express backend.</p>
    </div>
    <RouterLink to="/sites/new"><Button><Plus class="h-4 w-4" /> Register site</Button></RouterLink>
  </header>

  <Alert v-if="store.error" tone="warning" class="mt-6">{{ store.error }}</Alert>

  <div class="mt-6 space-y-3">
    <RouterLink v-for="site in store.sitesWithLatest" :key="site.id" :to="`/sites/${site.id}`">
      <Card class="mb-3 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <p class="font-semibold">{{ site.name }}</p>
              <Badge v-if="site.protected" variant="secondary"><Lock class="h-3 w-3" /> Protected</Badge>
            </div>
            <p class="mt-1 text-sm text-slate-500">
              {{ site.location }} · {{ (site.pvPeakPowerW / 1000).toFixed(1) }} kWp
            </p>
            <p class="mt-2 font-mono text-xs text-slate-400">{{ site.inverterId }}</p>
          </div>
          <StatusBadge :status="site.latest?.status ?? 'no-data'" />
        </div>
        <div class="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
          <div><span class="text-slate-500">Inverter</span><p class="font-medium">{{ (site.inverterAcPowerW / 1000).toFixed(1) }} kW AC</p></div>
          <div><span class="text-slate-500">Current power</span><p class="font-medium">{{ site.latest ? `${(site.latest.acPowerW / 1000).toFixed(2)} kW` : '-' }}</p></div>
          <div><span class="text-slate-500">Energy today</span><p class="font-medium">{{ site.latest ? `${(site.latest.energyTodayWh / 1000).toFixed(2)} kWh` : '-' }}</p></div>
        </div>
      </Card>
    </RouterLink>
  </div>
</template>
