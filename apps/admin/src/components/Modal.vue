<script setup lang="ts">
defineProps<{
  open: boolean;
  title: string;
}>();

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 grid place-items-center p-4">
      <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>
      <div
        class="relative z-10 grid max-h-[85vh] w-full max-w-2xl gap-4 overflow-y-auto rounded-md border border-soft bg-white p-5 shadow-lg"
        role="dialog"
        aria-modal="true"
      >
        <div class="flex items-center justify-between gap-4">
          <h2 class="m-0 text-lg font-bold text-ink">{{ title }}</h2>
          <button type="button" class="btn" @click="emit('close')">Close</button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
