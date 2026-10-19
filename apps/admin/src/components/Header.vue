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
  <header class="grid bg-white px-[1em] shadow-[0_2px_8px_rgba(var(--black),0.05)]">
    <nav
      class="grid grid-flow-row justify-items-start gap-1 py-2 xs:grid-flow-col xs:justify-start xs:gap-0 xs:py-0"
    >
      <RouterLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        :class="[
          'border-b-4 px-2 py-4 text-ink no-underline',
          isActive(link.to) ? 'border-accent' : 'border-transparent',
        ]"
      >
        {{ link.label }}
      </RouterLink>
    </nav>
  </header>
</template>
