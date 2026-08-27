<script setup lang="ts">defineProps<{ for?: string }>();</script>
<template><label :for="$props.for" class="text-sm font-medium leading-none"><slot /></label></template>
