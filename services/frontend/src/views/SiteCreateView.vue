<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import Alert from "@/components/ui/Alert.vue";
import Card from "@/components/ui/Card.vue";
import SiteForm from "@/components/SiteForm.vue";
import { useSolarStore } from "@/stores/solar";
import type { SiteEditInput } from "@/types/solar";

/** Create-site page. Renders the shared {@link SiteForm} in create mode (no
 * `enabled` toggle) and, on submit, registers the site with a fixed
 * `Asia/Jakarta` timezone before navigating to its detail page. */
const store = useSolarStore();
const router = useRouter();
const submitError = ref<string | null>(null);

/** Registers the submitted site and navigates to its detail page.
 * @param payload The form's typed site fields.
 * @returns A promise resolving once created and navigated, or on error.
 */
const onCreate = async (payload: SiteEditInput): Promise<void> => {
  try {
    submitError.value = null;
    const site = await store.createSite({
      name: payload.name,
      location: payload.location,
      pvPeakPowerW: payload.pvPeakPowerW,
      inverterAcPowerW: payload.inverterAcPowerW,
      timezone: "Asia/Jakarta",
    });
    await router.push(`/sites/${site.id}`);
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : "Could not register site";
  }
};
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <p class="text-sm text-slate-500">Configuration</p>
    <h1 class="mt-1 text-3xl font-semibold">Register solar site</h1>
    <p class="mt-2 text-sm text-slate-600">
      Register a new solar site. New sites are stored by the API and can be monitored by the simulator.
    </p>
    <Alert v-if="submitError" tone="warning" class="mt-5">{{ submitError }}</Alert>
    <Card class="mt-6 p-6">
      <SiteForm submit-label="Register site" cancel-to="/sites" @submit="onCreate" />
    </Card>
  </div>
</template>