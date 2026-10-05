<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiError, createPost, deletePost, getPost, listCategories, updatePost } from "@/api";
import type { Category, PostInput } from "@/api";

const route = useRoute();
const router = useRouter();

const id = computed(() => (typeof route.params.id === "string" ? route.params.id : null));
const isNew = computed(() => id.value === null);

const form = reactive<{
  title: string;
  slug: string;
  description: string;
  content: string;
  coverUrl: string;
  status: "draft" | "published";
  categoryId: "" | number;
}>({
  title: "",
  slug: "",
  description: "",
  content: "",
  coverUrl: "",
  status: "draft",
  categoryId: "",
});

const categories = ref<Category[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const result = await listCategories();
    categories.value = result.items;

    if (id.value !== null) {
      const post = await getPost(id.value);
      form.title = post.title;
      form.slug = post.slug;
      form.description = post.description ?? "";
      form.content = post.content;
      form.coverUrl = post.coverUrl ?? "";
      form.status = post.status;
      form.categoryId = post.categoryId ?? "";
    }
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) {
      await router.push({ name: "login" });
      return;
    }
    if (cause instanceof ApiError && cause.status === 404) {
      error.value = "Post not found.";
      return;
    }
    error.value = cause instanceof Error ? cause.message : "Failed to load";
  } finally {
    loading.value = false;
  }
}

function buildPayload(): PostInput {
  return {
    title: form.title.trim(),
    content: form.content,
    status: form.status,
    slug: form.slug.trim() || undefined,
    description: form.description.trim() || null,
    coverUrl: form.coverUrl.trim() || null,
    categoryId: form.categoryId === "" ? null : form.categoryId,
  };
}

async function save() {
  saving.value = true;
  error.value = "";
  try {
    const payload = buildPayload();
    if (id.value === null) await createPost(payload);
    else await updatePost(id.value, payload);
    await router.push({ name: "posts" });
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) {
      await router.push({ name: "login" });
      return;
    }
    error.value = cause instanceof Error ? cause.message : "Save failed";
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (id.value === null) return;
  if (!window.confirm(`Delete “${form.title}”? This cannot be undone.`)) return;
  try {
    await deletePost(id.value);
    await router.push({ name: "posts" });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Delete failed";
  }
}

onMounted(load);
</script>

<template>
  <main class="admin-main">
    <div class="page-head">
      <h1>{{ isNew ? "New post" : "Edit post" }}</h1>
      <RouterLink class="btn btn-ghost" :to="{ name: 'posts' }">← Back</RouterLink>
    </div>

    <p v-if="loading" class="muted">Loading…</p>

    <form v-else class="admin-form" @submit.prevent="save">
      <label class="field">
        <span>Title</span>
        <input v-model="form.title" type="text" required />
      </label>

      <label class="field">
        <span>Slug <em class="muted">(optional — derived from the title)</em></span>
        <input v-model="form.slug" type="text" placeholder="hello-world" />
      </label>

      <label class="field">
        <span>Description</span>
        <input v-model="form.description" type="text" />
      </label>

      <label class="field">
        <span>Content <em class="muted">(Markdown)</em></span>
        <textarea v-model="form.content" class="editor" rows="18" required></textarea>
      </label>

      <label class="field">
        <span>Cover image URL</span>
        <input v-model="form.coverUrl" type="text" />
      </label>

      <div class="field-row">
        <label class="field">
          <span>Status</span>
          <select v-model="form.status">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>

        <label class="field">
          <span>Category</span>
          <select v-model="form.categoryId">
            <option value="">None</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </label>
      </div>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <div class="form-actions">
        <button class="btn btn-primary" type="submit" :disabled="saving">
          {{ saving ? "Saving…" : "Save" }}
        </button>
        <button
          v-if="!isNew"
          class="btn btn-danger"
          type="button"
          :disabled="saving"
          @click="remove"
        >
          Delete
        </button>
      </div>
    </form>
  </main>
</template>
