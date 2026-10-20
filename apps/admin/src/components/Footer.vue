<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<template>
  <footer
    class="grid place-items-center bg-linear-to-b from-soft/50 to-white px-[1em] pt-[2em] pb-[6em] text-center text-muted"
  >
    © {{ year }} PILL. All rights reserved.
  </footer>
</template>
