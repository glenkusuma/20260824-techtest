<script setup lang="ts">import { cn } from "@/lib/utils"; defineProps<{ tone?: "warning" | "info"; class?: string }>();</script>
<template><div role="alert" :class="cn('rounded-lg border p-4', tone === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-slate-200 bg-slate-50', $props.class)"><slot /></div></template>
