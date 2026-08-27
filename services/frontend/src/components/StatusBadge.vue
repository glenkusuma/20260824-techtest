<script setup lang="ts">
import { computed } from "vue";
import Badge from "@/components/ui/Badge.vue";
import type { SiteStatus } from "@/types/solar";

/** Renders a site's run status as a colored {@link Badge}. Maps each status to a
 * badge variant and a human label; `"no-data"` renders a neutral `No data` badge. */
const props = defineProps<{ status: SiteStatus | "no-data" }>();
const variant = computed(() => {
  if (props.status === "running") return "success";
  if (props.status === "warning") return "warning";
  return "secondary";
});
const label = computed(() => ({
  "no-data": "No data",
  night: "Night",
  starting: "Starting",
  running: "Running",
  warning: "Needs attention",
  offline: "Offline",
})[props.status]);
</script>

<template>
  <Badge :variant="variant">{{ label }}</Badge>
</template>
