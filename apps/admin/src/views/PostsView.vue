<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { deletePost, listPosts } from "@/api/client";
import type { PostListItem } from "@/api/types";
import defaultCover from "@/assets/defualt-cover.png";

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
    <form
      class="mb-6 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2"
      @submit.prevent="applyFilters"
    >
      <input v-model="q" type="search" placeholder="Search title or description" class="field" />

      <select v-model="status" class="field">
        <option value="all">All</option>
        <option value="draft">Drafts</option>
        <option value="published">Published</option>
      </select>

      <button type="submit" class="btn">Filter</button>

      <RouterLink to="/posts/new" class="btn">New</RouterLink>
    </form>

    <p v-if="error" class="text-danger">{{ error }}</p>
    <p v-if="loading" class="text-muted">Loading…</p>

    <p class="text-muted">{{ total }} post{{ total === 1 ? "" : "s" }}</p>

    <ul v-if="items.length" class="m-0 list-none p-0">
      <li
        v-for="post in items"
        :key="post.id"
        class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-soft py-4"
      >
        <img
          :src="post.coverUrl || defaultCover"
          alt=""
          class="h-14 w-20 rounded-md object-contain xs:h-20 xs:w-28"
        />
        <div class="grid min-w-0 justify-items-start gap-1">
          <RouterLink
            :to="`/posts/${post.id}/edit`"
            class="text-xl text-ink no-underline hover:text-accent"
          >
            {{ post.title }}
          </RouterLink>
          <span
            :class="[
              'rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider',
              post.status === 'published' ? 'bg-accent text-white' : 'bg-soft text-body',
            ]"
          >
            {{ post.status }}
          </span>
          <span class="text-muted">
            {{ post.category ? post.category.name : "Uncategorized" }} · updated
            {{ formatDate(post.updatedAt) }}
          </span>
        </div>
        <div class="grid grid-flow-col items-center justify-end gap-2">
          <RouterLink
            :to="`/posts/${post.id}/edit`"
            class="rounded-md bg-accent px-2.5 py-1 text-sm font-bold text-white no-underline hover:bg-accent-dark"
          >
            Edit
          </RouterLink>
          <button
            class="rounded-md bg-danger px-2.5 py-1 text-sm font-bold text-white hover:bg-danger-dark"
            @click="remove(post)"
          >
            Delete
          </button>
        </div>
      </li>
    </ul>
    <p v-else-if="!loading" class="text-muted">No posts yet.</p>

    <nav
      v-if="totalPages > 1"
      class="mt-8 grid grid-flow-col items-center justify-center gap-2 font-bold"
    >
      <button
        v-if="page > 1"
        class="min-w-6 cursor-pointer rounded px-2 py-1 text-center text-accent"
        @click="go(page - 1)"
      >
        Prev
      </button>
      <template v-for="n in totalPages" :key="n">
        <span v-if="n === page" class="min-w-6 rounded bg-accent px-2 py-1 text-center text-white">
          {{ n }}
        </span>
        <button
          v-else
          class="min-w-6 cursor-pointer rounded px-2 py-1 text-center text-accent"
          @click="go(n)"
        >
          {{ n }}
        </button>
      </template>
      <button
        v-if="page < totalPages"
        class="min-w-6 cursor-pointer rounded px-2 py-1 text-center text-accent"
        @click="go(page + 1)"
      >
        Next
      </button>
    </nav>
  </section>
</template>
