<script setup lang="ts">
import { RouterView } from "vue-router";
import Header from "@/components/Header.vue";
import Footer from "@/components/Footer.vue";
</script>

<template>
  <div class="grid min-h-screen grid-rows-[auto_1fr_auto]">
    <Header />
    <main class="mx-auto w-[720px] max-w-[calc(100%-2em)] px-[1em] py-[1em] xs:py-[3em]">
      <RouterView />
    </main>
    <Footer />
  </div>
</template>
