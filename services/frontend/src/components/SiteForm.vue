<script setup lang="ts">
import { toTypedSchema } from "@vee-validate/zod";
import { useForm } from "vee-validate";
import { z } from "zod";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import type { SiteEditInput } from "@/types/solar";

/** Shared create/edit site form. Collects the client-editable fields (name,
 * location, capacities, optional `enabled` toggle), validates them with a
 * vee-validate/zod schema, and emits `submit` with the typed payload. The
 * server-managed `timezone`, `inverterId`, and `protected` fields are never
 * edited here. */
const props = withDefaults(
  defineProps<{
    initial?: Partial<SiteEditInput>;
    submitLabel?: string;
    cancelTo?: string;
    /** Show the `enabled` toggle. Only PATCH (edit) supports it; create ignores it. */
    showEnabled?: boolean;
  }>(),
  {
    initial: () => ({}),
    submitLabel: "Save",
    cancelTo: "/sites",
    showEnabled: false,
  },
);

const emit = defineEmits<{ (e: "submit", payload: SiteEditInput): void }>();

/** Zod schema backing the form: capacities are whole watts of at least 500 and
 * the inverter rating may not exceed 125% of the PV capacity. */
const schema = toTypedSchema(
  z
    .object({
      name: z.string().trim().min(2, "Enter a site name").max(100),
      location: z.string().trim().min(2, "Enter a location").max(150),
      pvPeakPowerW: z.coerce.number().int().min(500, "Minimum 500 W"),
      inverterAcPowerW: z.coerce.number().int().min(500, "Minimum 500 W"),
      enabled: z.boolean(),
    })
    .refine(
      (data) => data.inverterAcPowerW <= data.pvPeakPowerW * 1.25,
      {
        path: ["inverterAcPowerW"],
        message: "Inverter rating must be within 125% of PV capacity",
      },
    ),
);

const { defineField, errors, handleSubmit, isSubmitting } = useForm({
  validationSchema: schema,
  initialValues: {
    name: props.initial.name ?? "",
    location: props.initial.location ?? "",
    pvPeakPowerW: props.initial.pvPeakPowerW ?? 5000,
    inverterAcPowerW: props.initial.inverterAcPowerW ?? 5000,
    enabled: props.initial.enabled ?? true,
  },
});

const [name] = defineField("name");
const [location] = defineField("location");
const [pvPeakPowerW] = defineField("pvPeakPowerW");
const [inverterAcPowerW] = defineField("inverterAcPowerW");
const [enabled] = defineField("enabled");

const onSubmit = handleSubmit((values) => {
  emit("submit", {
    name: values.name,
    location: values.location,
    pvPeakPowerW: values.pvPeakPowerW,
    inverterAcPowerW: values.inverterAcPowerW,
    enabled: values.enabled,
  });
});
</script>

<template>
  <form class="space-y-5" @submit.prevent="onSubmit">
    <div class="space-y-2">
      <Label for="name">Site name</Label>
      <Input id="name" v-model="name" placeholder="Warehouse Rooftop" />
      <p v-if="errors.name" class="text-sm text-red-600">{{ errors.name }}</p>
    </div>
    <div class="space-y-2">
      <Label for="location">Location</Label>
      <Input id="location" v-model="location" placeholder="West Java" />
      <p v-if="errors.location" class="text-sm text-red-600">{{ errors.location }}</p>
    </div>
    <div class="grid gap-5 sm:grid-cols-2">
      <div class="space-y-2">
        <Label for="pv">PV peak capacity (W)</Label>
        <Input id="pv" v-model="pvPeakPowerW" type="number" min="500" />
        <p v-if="errors.pvPeakPowerW" class="text-sm text-red-600">{{ errors.pvPeakPowerW }}</p>
      </div>
      <div class="space-y-2">
        <Label for="inverter">Inverter AC rating (W)</Label>
        <Input id="inverter" v-model="inverterAcPowerW" type="number" min="500" />
        <p v-if="errors.inverterAcPowerW" class="text-sm text-red-600">{{ errors.inverterAcPowerW }}</p>
      </div>
    </div>
    <template v-if="showEnabled">
      <div class="flex items-center gap-2">
        <input
          id="enabled"
          v-model="enabled"
          type="checkbox"
          class="h-4 w-4 rounded border-slate-300"
        />
        <Label for="enabled">Site enabled</Label>
      </div>
      <p class="text-xs text-slate-500">Disabled sites stop receiving telemetry from the simulator.</p>
    </template>
    <div class="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
      <span class="font-medium text-slate-800">Timezone:</span> Asia/Jakarta
    </div>
    <div class="flex justify-end gap-3">
      <RouterLink :to="cancelTo"><Button variant="outline">Cancel</Button></RouterLink>
      <Button type="submit" :disabled="isSubmitting">{{ isSubmitting ? 'Saving…' : submitLabel }}</Button>
    </div>
  </form>
</template>