<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { deletePost, listPosts, updatePostStatus } from "@/api/client";
import type { PostListItem } from "@/api/types";

const items = ref<PostListItem[]>([]);
const total = ref(0);
const status = ref("all");
const q = ref("");
const loading = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const res = await listPosts({ status: status.value, q: q.value.trim() || undefined });
    items.value = res.items;
    total.value = res.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load posts";
  } finally {
    loading.value = false;
  }
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
    <div class="page-head">
      <h1>Posts</h1>
      <RouterLink to="/posts/new" class="btn">New post</RouterLink>
    </div>

    <form class="filters" @submit.prevent="load">
      <select v-model="status">
        <option value="all">All</option>
        <option value="draft">Drafts</option>
        <option value="published">Published</option>
      </select>
      <input v-model="q" type="search" placeholder="Search title or description" />
      <button type="submit" class="btn">Filter</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" class="muted">Loading…</p>

    <p class="muted">{{ total }} post{{ total === 1 ? "" : "s" }}</p>

    <ul v-if="items.length" class="posts">
      <li v-for="post in items" :key="post.id" class="post">
        <div class="post-main">
          <RouterLink :to="`/posts/${post.id}/edit`" class="title">{{ post.title }}</RouterLink>
          <span class="badge" :class="post.status">{{ post.status }}</span>
          <span class="muted">
            {{ post.category ? post.category.name : "Uncategorized" }} · updated
            {{ formatDate(post.updatedAt) }}
          </span>
        </div>
        <div class="post-actions">
          <button class="link" @click="toggleStatus(post)">
            {{ post.status === "published" ? "Unpublish" : "Publish" }}
          </button>
          <RouterLink class="link" :to="`/posts/${post.id}/edit`">Edit</RouterLink>
          <button class="link danger" @click="remove(post)">Delete</button>
        </div>
      </li>
    </ul>
    <p v-else-if="!loading" class="muted">No posts yet.</p>
  </section>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1em;
}
.page-head h1 {
  margin: 0;
}
.filters {
  display: flex;
  gap: 0.5em;
  margin-bottom: 1.5em;
}
.filters select,
.filters input {
  font-size: 16px;
  padding: 0.4em 0.6em;
  border: 1px solid rgb(var(--gray-light));
  border-radius: 6px;
  background: white;
  color: rgb(var(--gray-dark));
}
.filters input {
  flex: 1;
  min-width: 0;
}
.btn {
  display: inline-block;
  padding: 0.4em 0.9em;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 6px;
  text-decoration: none;
  font-size: 16px;
  cursor: pointer;
}
.btn:hover {
  background: var(--accent-dark);
  color: white;
}
.posts {
  list-style: none;
  margin: 0;
  padding: 0;
}
.post {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1em;
  padding: 1em 0;
  border-bottom: 1px solid rgb(var(--gray-light));
}
.post-main {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  min-width: 0;
}
.title {
  font-size: 1.1em;
  color: rgb(var(--black));
  text-decoration: none;
}
.title:hover {
  color: var(--accent);
}
.badge {
  align-self: flex-start;
  padding: 0.1em 0.6em;
  border-radius: 999px;
  font-size: 0.75em;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.badge.draft {
  background: rgb(var(--gray-light));
  color: rgb(var(--gray-dark));
}
.badge.published {
  background: rgb(var(--gray-light));
  color: var(--accent-dark);
}
.post-actions {
  display: flex;
  gap: 0.75em;
  flex-shrink: 0;
}
.link {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.95em;
  color: var(--accent);
  text-decoration: none;
  cursor: pointer;
}
.link:hover {
  color: var(--accent-dark);
}
.link.danger {
  color: rgb(180, 60, 60);
}
.muted {
  color: rgb(var(--gray));
}
.error {
  color: rgb(180, 60, 60);
}
</style>
