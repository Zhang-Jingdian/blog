<script setup lang="ts">
const year = new Date().getFullYear();
</script>

<template>
  <footer>&copy; {{ year }} Blog Admin. All rights reserved.</footer>
</template>

<style scoped>
footer {
  padding: 2em 1em 6em 1em;
  background: linear-gradient(var(--gray-gradient)) no-repeat;
  color: rgb(var(--gray));
  text-align: center;
}
</style>
