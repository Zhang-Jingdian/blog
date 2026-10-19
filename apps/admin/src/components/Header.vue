<script setup lang="ts">
import { RouterLink } from "vue-router";

const links = [
  { to: "/posts", label: "Posts" },
  { to: "/tags", label: "Tags" },
  { to: "/categories", label: "Categories" },
];
</script>

<template>
  <header>
    <nav>
      <h2>
        <RouterLink to="/posts">Blog Admin</RouterLink>
      </h2>
      <div class="internal-links">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to">
          {{ link.label }}
        </RouterLink>
      </div>
    </nav>
  </header>
</template>

<style scoped>
header {
  margin: 0;
  padding: 0 1em;
  background: white;
  box-shadow: 0 2px 8px rgba(var(--black), 5%);
}
h2 {
  margin: 0;
  font-size: 1em;
}
h2 a {
  text-decoration: none;
}
nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
nav a {
  padding: 1em 0.5em;
  color: rgb(var(--black));
  border-bottom: 4px solid transparent;
  text-decoration: none;
}
nav a.router-link-active {
  border-bottom-color: var(--accent);
}
@media (max-width: 720px) {
  nav {
    flex-direction: column;
    gap: 0.5em;
    padding: 0.5em 0;
  }
}
</style>
