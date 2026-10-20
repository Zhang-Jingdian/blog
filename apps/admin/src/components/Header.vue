<script setup lang="ts">
import { RouterLink, useRoute } from "vue-router";

const route = useRoute();

const links = [
  { to: "/posts", label: "Posts" },
  { to: "/tags", label: "Tags" },
  { to: "/categories", label: "Categories" },
];

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`);
}
</script>

<template>
  <header class="bg-white px-2 shadow-[0_2px_8px_rgba(var(--black),0.05)] xs:px-4">
    <nav class="grid grid-cols-[1fr_auto] items-center">
      <h2 class="m-0 text-lg font-bold">
        <a href="/" class="text-ink no-underline">PILL</a>
      </h2>

      <div class="grid grid-flow-col items-center">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :class="[
            'border-b-4 px-2 py-4 text-ink no-underline xs:px-1.5 xs:text-[0.9em]',
            isActive(link.to) ? 'font-bold border-accent' : 'border-transparent',
          ]"
        >
          {{ link.label }}
        </RouterLink>
      </div>
    </nav>
  </header>
</template>
