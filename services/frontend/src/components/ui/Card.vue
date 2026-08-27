<script setup lang="ts">import { cn } from "@/lib/utils"; defineProps<{ class?: string }>();</script>
<template><section :class="cn('rounded-xl border border-slate-200 bg-white shadow-sm', $props.class)"><slot /></section></template>
