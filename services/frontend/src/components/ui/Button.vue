<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<{ variant?: "default" | "outline" | "ghost" | "destructive"; size?: "default" | "sm"; disabled?: boolean; type?: "button" | "submit"; class?: string }>(), { variant: "default", size: "default", type: "button" });
const classes = computed(() => cn(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50",
  props.size === "sm" ? "h-8 px-3" : "h-10 px-4 py-2",
  props.variant === "default" && "bg-slate-900 text-white hover:bg-slate-800",
  props.variant === "outline" && "border border-slate-200 bg-white hover:bg-slate-50",
  props.variant === "ghost" && "hover:bg-slate-100",
  props.variant === "destructive" && "bg-red-600 text-white hover:bg-red-500",
  props.class
));
</script>
<template><button :type="type" :disabled="disabled" :class="classes"><slot /></button></template>
