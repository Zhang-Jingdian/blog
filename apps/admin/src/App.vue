<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from "vue-router";
import { authClient } from "@/auth";
import { clearSession, currentUser } from "@/session";

const router = useRouter();
const user = currentUser();

async function logout() {
  await authClient.signOut();
  clearSession();
  await router.push({ name: "login" });
}
</script>

<template>
  <header class="admin-header">
    <div class="admin-header-inner">
      <RouterLink :to="{ name: 'posts' }" class="admin-brand">Blog Admin</RouterLink>
      <nav v-if="user" class="admin-nav">
        <span class="muted small">{{ user.email }}</span>
        <button type="button" class="btn btn-ghost" @click="logout">Sign out</button>
      </nav>
    </div>
  </header>

  <RouterView />
</template>
