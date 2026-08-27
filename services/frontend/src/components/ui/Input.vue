<script setup lang="ts">
import { useAttrs } from "vue";
defineOptions({ inheritAttrs: false });
const attrs = useAttrs();
const model = defineModel<string | number>({ required: false });
</script>
<template><input v-model="model" v-bind="attrs" class="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-offset-white placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50" /></template>
