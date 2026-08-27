<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";
const props = withDefaults(defineProps<{ variant?: "default" | "success" | "warning" | "secondary"; class?: string }>(), { variant: "default" });
const classes = computed(() => cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", props.variant === "success" && "bg-emerald-100 text-emerald-800", props.variant === "warning" && "bg-amber-100 text-amber-900", props.variant === "secondary" && "bg-slate-100 text-slate-700", props.variant === "default" && "bg-slate-900 text-white", props.class));
</script>
<template><span :class="classes"><slot /></span></template>
