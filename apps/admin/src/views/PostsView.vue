<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { ApiError, deletePost, listPosts } from "@/api";
import type { Post } from "@/api";

const PAGE_SIZE = 10;

const router = useRouter();

const posts = ref<Post[]>([]);
const total = ref(0);
const totalPages = ref(0);
const page = ref(1);
const status = ref<"" | "draft" | "published">("");
const loading = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const result = await listPosts({
      page: page.value,
      limit: PAGE_SIZE,
      status: status.value || undefined,
    });
    posts.value = result.items;
    total.value = result.total;
    totalPages.value = result.totalPages;
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) {
      await router.push({ name: "login" });
      return;
    }
    error.value = cause instanceof Error ? cause.message : "Failed to load posts";
  } finally {
    loading.value = false;
  }
}

function filter() {
  page.value = 1;
  void load();
}

function go(delta: number) {
  page.value += delta;
  void load();
}

async function remove(post: Post) {
  if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
  try {
    await deletePost(post.id);
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Delete failed";
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

onMounted(load);
</script>

<template>
  <main class="admin-main">
    <div class="page-head">
      <h1>Posts</h1>
      <RouterLink class="btn btn-primary" :to="{ name: 'post-new' }">New post</RouterLink>
    </div>

    <div class="toolbar">
      <label class="field field-inline">
        <span>Status</span>
        <select v-model="status" @change="filter">
          <option value="">All</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </select>
      </label>
      <span class="muted small">{{ total }} post(s)</span>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="muted">Loading…</p>

    <table v-else-if="posts.length" class="admin-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Status</th>
          <th>Category</th>
          <th>Updated</th>
          <th aria-label="Actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="post in posts" :key="post.id">
          <td>
            <RouterLink :to="{ name: 'post-edit', params: { id: post.id } }">
              {{ post.title }}
            </RouterLink>
            <div class="muted small">/{{ post.slug }}</div>
          </td>
          <td>
            <span class="badge" :class="`badge-${post.status}`">{{ post.status }}</span>
          </td>
          <td>{{ post.category?.name ?? "—" }}</td>
          <td class="muted small">{{ formatDate(post.updatedAt) }}</td>
          <td class="row-actions">
            <RouterLink class="btn btn-ghost" :to="{ name: 'post-edit', params: { id: post.id } }">
              Edit
            </RouterLink>
            <button type="button" class="btn btn-danger" @click="remove(post)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="muted">No posts yet.</p>

    <div v-if="totalPages > 1" class="pager">
      <button type="button" class="btn btn-ghost" :disabled="page <= 1" @click="go(-1)">
        ← Newer
      </button>
      <span class="muted small">Page {{ page }} / {{ totalPages }}</span>
      <button type="button" class="btn btn-ghost" :disabled="page >= totalPages" @click="go(1)">
        Older →
      </button>
    </div>
  </main>
</template>
