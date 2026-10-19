<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { deletePost, listPosts, updatePostStatus } from "@/api/client";
import type { PostListItem } from "@/api/types";

const items = ref<PostListItem[]>([]);
const total = ref(0);
const totalPages = ref(1);
const page = ref(1);
const pageSize = 10;
const status = ref("all");
const q = ref("");
const loading = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const res = await listPosts({
      status: status.value,
      q: q.value.trim() || undefined,
      page: page.value,
      pageSize,
    });
    items.value = res.items;
    total.value = res.total;
    totalPages.value = res.totalPages;
    // After deleting the last item on the last page, clamp and re-fetch.
    if (res.totalPages > 0 && page.value > res.totalPages) {
      page.value = res.totalPages;
      return load();
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load posts";
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  page.value = 1;
  load();
}

function go(n: number) {
  const target = Math.min(Math.max(1, n), totalPages.value);
  if (target === page.value) return;
  page.value = target;
  load();
}

async function toggleStatus(post: PostListItem) {
  error.value = "";
  try {
    await updatePostStatus(post.id, post.status === "published" ? "draft" : "published");
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to update status";
  }
}

async function remove(post: PostListItem) {
  if (!window.confirm(`Delete "${post.title}"?`)) return;
  error.value = "";
  try {
    await deletePost(post.id);
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to delete post";
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

onMounted(load);
</script>

<template>
  <section>
    <div class="mb-4 grid grid-cols-1 gap-2 xs:grid-cols-[minmax(0,1fr)_auto] xs:items-center">
      <h1 class="m-0">Posts</h1>
      <RouterLink to="/posts/new" class="btn justify-self-start">New post</RouterLink>
    </div>

    <form
      class="mb-6 grid grid-cols-1 gap-2 xs:grid-cols-[auto_minmax(0,1fr)_auto]"
      @submit.prevent="applyFilters"
    >
      <select v-model="status" class="field">
        <option value="all">All</option>
        <option value="draft">Drafts</option>
        <option value="published">Published</option>
      </select>
      <input v-model="q" type="search" placeholder="Search title or description" class="field" />
      <button type="submit" class="btn">Filter</button>
    </form>

    <p v-if="error" class="text-danger">{{ error }}</p>
    <p v-if="loading" class="text-muted">Loading…</p>

    <p class="text-muted">{{ total }} post{{ total === 1 ? "" : "s" }}</p>

    <ul v-if="items.length" class="m-0 list-none p-0">
      <li
        v-for="post in items"
        :key="post.id"
        class="grid grid-cols-1 gap-4 border-b border-soft py-4 xs:grid-cols-[minmax(0,1fr)_auto] xs:items-center"
      >
        <div class="grid min-w-0 justify-items-start gap-1">
          <RouterLink
            :to="`/posts/${post.id}/edit`"
            class="text-xl text-ink no-underline hover:text-accent"
          >
            {{ post.title }}
          </RouterLink>
          <span
            :class="[
              'rounded-full bg-soft px-2.5 py-0.5 text-xs uppercase tracking-wider',
              post.status === 'draft' ? 'text-body' : 'text-accent-dark',
            ]"
          >
            {{ post.status }}
          </span>
          <span class="text-muted">
            {{ post.category ? post.category.name : "Uncategorized" }} · updated
            {{ formatDate(post.updatedAt) }}
          </span>
        </div>
        <div class="grid grid-flow-col items-center justify-start gap-3 xs:justify-end">
          <button class="link" @click="toggleStatus(post)">
            {{ post.status === "published" ? "Unpublish" : "Publish" }}
          </button>
          <RouterLink class="link" :to="`/posts/${post.id}/edit`">Edit</RouterLink>
          <button class="link text-danger hover:text-danger" @click="remove(post)">Delete</button>
        </div>
      </li>
    </ul>
    <p v-else-if="!loading" class="text-muted">No posts yet.</p>

    <nav v-if="totalPages > 1" class="mt-8 grid grid-flow-col items-center justify-center gap-2">
      <button
        class="link disabled:cursor-default disabled:opacity-40"
        :disabled="page <= 1"
        @click="go(page - 1)"
      >
        Prev
      </button>
      <template v-for="n in totalPages" :key="n">
        <span v-if="n === page" class="min-w-6 rounded bg-accent px-2 py-1 text-center text-white">
          {{ n }}
        </span>
        <button v-else class="link min-w-6 rounded px-2 py-1 text-center" @click="go(n)">
          {{ n }}
        </button>
      </template>
      <button
        class="link disabled:cursor-default disabled:opacity-40"
        :disabled="page >= totalPages"
        @click="go(page + 1)"
      >
        Next
      </button>
    </nav>
  </section>
</template>
