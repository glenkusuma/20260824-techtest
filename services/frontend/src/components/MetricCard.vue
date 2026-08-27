<script setup lang="ts">
import Card from "@/components/ui/Card.vue";
defineProps<{ label: string; value: string; detail?: string }>();
</script>
<template><Card class="p-5"><p class="text-sm text-slate-500">{{ label }}</p><p class="mt-2 text-2xl font-semibold tracking-tight">{{ value }}</p><p v-if="detail" class="mt-1 text-xs text-slate-500">{{ detail }}</p></Card></template>
