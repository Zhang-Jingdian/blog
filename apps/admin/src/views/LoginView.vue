<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authClient } from "@/auth";
import { refreshSession } from "@/session";

const route = useRoute();
const router = useRouter();

const email = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);

async function submit() {
  error.value = "";
  busy.value = true;
  try {
    const { error: authError } = await authClient.signIn.email({
      email: email.value.trim(),
      password: password.value,
    });
    if (authError) {
      error.value = authError.message || "Sign in failed";
      return;
    }
    await refreshSession();
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/posts";
    await router.push(redirect);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Sign in failed";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="admin-narrow">
    <h1>Sign in</h1>
    <form class="admin-form" @submit.prevent="submit">
      <label class="field">
        <span>Email</span>
        <input v-model="email" type="email" autocomplete="username" required />
      </label>
      <label class="field">
        <span>Password</span>
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button class="btn btn-primary" type="submit" :disabled="busy">
        {{ busy ? "Signing in…" : "Sign in" }}
      </button>
    </form>
  </main>
</template>
