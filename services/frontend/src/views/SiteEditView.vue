<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Alert from "@/components/ui/Alert.vue";
import Card from "@/components/ui/Card.vue";
import SiteForm from "@/components/SiteForm.vue";
import { solarApi } from "@/services/api";
import { useSolarStore } from "@/stores/solar";
import type { Site, SiteEditInput } from "@/types/solar";

/** Edit-site page. Loads the target site by its route param, renders it in the
 * shared {@link SiteForm} (with the `enabled` toggle enabled), and saves via the
 * store on submit before returning to the detail page. */
const route = useRoute();
const router = useRouter();
const store = useSolarStore();

const siteId = String(route.params.siteId);
const site = ref<Site | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const saveError = ref<string | null>(null);

/** Fetches the site being edited into `site`.
 * @returns A promise resolving once the fetch settles.
 */
const loadSite = async (): Promise<void> => {
  loading.value = true;
  loadError.value = null;
  try {
    site.value = await solarApi.getSite(siteId);
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : "Unable to load site";
  } finally {
    loading.value = false;
  }
};

onMounted(() => void loadSite());

/** Applies the edited fields and navigates back to the detail page.
 * @param payload The form's typed site fields.
 * @returns A promise resolving once saved and navigated, or on error.
 */
const onSubmit = async (payload: SiteEditInput): Promise<void> => {
  saveError.value = null;
  try {
    await store.updateSite(siteId, payload);
    await router.push(`/sites/${siteId}`);
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Could not update site";
  }
};
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <p class="text-sm text-slate-500">Configuration</p>
    <h1 class="mt-1 text-3xl font-semibold">Edit solar site</h1>
    <p class="mt-2 text-sm text-slate-600">Update the site's configuration and capacity.</p>
    <Alert v-if="saveError" tone="warning" class="mt-5">{{ saveError }}</Alert>
    <Card v-if="site" class="mt-6 p-6">
      <SiteForm
        :initial="site"
        show-enabled
        submit-label="Save changes"
        :cancel-to="`/sites/${site.id}`"
        @submit="onSubmit"
      />
    </Card>
    <p v-else-if="loading" class="mt-6 text-slate-500">Loading site…</p>
    <Alert v-else tone="warning" class="mt-6">{{ loadError }}</Alert>
  </div>
</template>