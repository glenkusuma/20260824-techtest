<script setup lang="ts">
import { LayoutDashboard, PanelsTopLeft, Plus, Sun } from "lucide-vue-next";
import { RouterLink, RouterView } from "vue-router";

/** Primary navigation entries (sidebar + mobile header), each a route path,
 * label, and lucide icon. */
const navigation = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sites", label: "Sites", icon: PanelsTopLeft },
  { to: "/sites/new", label: "Register", icon: Plus },
];
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-950">
    <aside class="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-5 lg:block">
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-amber-100 p-2"><Sun class="h-5 w-5 text-amber-700" /></div>
        <div>
          <p class="font-semibold">Solar Telemetry</p>
          <p class="text-xs text-slate-500">Operations demo</p>
        </div>
      </div>
      <nav class="mt-8 space-y-1 text-sm" aria-label="Primary navigation">
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-slate-100"
          active-class="bg-slate-100 font-medium"
        >
          <component :is="item.icon" class="h-4 w-4" />
          {{ item.label === "Register" ? "Register site" : item.label }}
        </RouterLink>
      </nav>
      <div class="absolute bottom-5 left-5 right-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        Solar telemetry operations
      </div>
    </aside>

    <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-2 font-semibold">
          <Sun class="h-5 w-5 text-amber-600" /> Solar Telemetry
        </div>
        <nav class="flex items-center gap-1" aria-label="Mobile navigation">
          <RouterLink
            v-for="item in navigation"
            :key="item.to"
            :to="item.to"
            class="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            active-class="bg-slate-100 text-slate-950"
            :aria-label="item.label"
          >
            <component :is="item.icon" class="h-5 w-5" />
          </RouterLink>
        </nav>
      </div>
    </header>

    <main class="lg:pl-64">
      <div class="mx-auto max-w-7xl p-5 md:p-8"><RouterView /></div>
    </main>
  </div>
</template>
