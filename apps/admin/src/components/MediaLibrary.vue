<script setup lang="ts">
import { onMounted, ref } from "vue";
import { deleteUpload, fileUrl, listUploads, replaceUpload, uploadImage } from "@/api/client";
import type { UploadItem } from "@/api/types";

// When `postId` is set, the library is scoped to that post. When `embedded` is
// true it lives inside the post editor's media modal, where images are uploaded
// by pasting into the article — so the upload/search controls are hidden and only
// the gallery (with copy/replace/delete) is shown.
const props = defineProps<{ postId?: number; embedded?: boolean }>();

// Emitted after an upload is deleted so the parent (the post editor) can drop
// any reference to the removed file — e.g. a post cover that pointed at it.
const emit = defineEmits<{ deleted: [key: string] }>();

const items = ref<UploadItem[]>([]);
const total = ref(0);
const totalPages = ref(1);
const page = ref(1);
const pageSize = 24;
const q = ref("");
const loading = ref(false);
const uploading = ref(false);
const error = ref("");
const info = ref("");

const uploadInput = ref<HTMLInputElement | null>(null);
const replaceInput = ref<HTMLInputElement | null>(null);
const replacingKey = ref<string | null>(null);
const copiedKey = ref<string | null>(null);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const res = await listUploads({
      q: q.value.trim() || undefined,
      postId: props.postId,
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
    error.value = e instanceof Error ? e.message : "Failed to load media";
  } finally {
    loading.value = false;
  }
}

function applySearch() {
  page.value = 1;
  load();
}

function go(n: number) {
  const target = Math.min(Math.max(1, n), totalPages.value);
  if (target === page.value) return;
  page.value = target;
  load();
}

async function uploadFiles(files: FileList | null | undefined) {
  if (!files || !files.length) return;
  uploading.value = true;
  error.value = "";
  info.value = "";
  try {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        error.value = `Skipped "${file.name}" (not an image)`;
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        error.value = `Skipped "${file.name}" (larger than 5 MB)`;
        continue;
      }
      await uploadImage(file, props.postId);
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Upload failed";
  } finally {
    uploading.value = false;
    await load();
  }
}

function onUploadInput(event: Event) {
  const input = event.target as HTMLInputElement;
  uploadFiles(input.files);
  input.value = "";
}

async function replaceFile(file: File | null | undefined) {
  const key = replacingKey.value;
  if (!file || !key) return;
  error.value = "";
  info.value = "";
  if (!file.type.startsWith("image/")) {
    error.value = "Please choose an image file";
    return;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    error.value = "Image is larger than 5 MB";
    return;
  }
  try {
    await replaceUpload(key, file);
    info.value = "Replaced";
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to replace";
  } finally {
    replacingKey.value = null;
  }
}

function onReplaceInput(event: Event) {
  const input = event.target as HTMLInputElement;
  replaceFile(input.files?.[0]);
  input.value = "";
}

function startReplace(item: UploadItem) {
  replacingKey.value = item.key;
  replaceInput.value?.click();
}

async function remove(item: UploadItem) {
  if (!window.confirm(`Delete "${item.key}"?`)) return;
  error.value = "";
  info.value = "";
  try {
    await deleteUpload(item.key);
    emit("deleted", item.key);
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to delete";
  }
}

async function copy(item: UploadItem) {
  try {
    await navigator.clipboard.writeText(fileUrl(item.key));
    copiedKey.value = item.key;
    setTimeout(() => {
      if (copiedKey.value === item.key) copiedKey.value = null;
    }, 1500);
  } catch {
    error.value = "Failed to copy URL";
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

onMounted(load);
</script>

<template>
  <section>
    <form
      v-if="!embedded"
      class="mb-6 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2"
      @submit.prevent="applySearch"
    >
      <input v-model="q" type="search" placeholder="Search filename" class="field" />
      <button type="submit" class="btn">Filter</button>
      <button type="button" class="btn" :disabled="uploading" @click="uploadInput?.click()">
        {{ uploading ? "Uploading…" : "Upload" }}
      </button>
      <input
        ref="uploadInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="onUploadInput"
      />
    </form>

    <p v-if="error" class="text-danger">{{ error }}</p>
    <p v-if="info" class="text-accent-dark">{{ info }}</p>
    <p v-if="loading" class="text-muted">Loading…</p>
    <p class="text-muted">{{ total }} file{{ total === 1 ? "" : "s" }}</p>

    <div v-if="items.length" class="grid grid-cols-2 gap-4 xs:grid-cols-3">
      <figure
        v-for="item in items"
        :key="item.key"
        class="m-0 grid gap-2 rounded-md border border-soft p-2"
      >
        <a :href="fileUrl(item.key)" target="_blank" rel="noopener noreferrer" class="block">
          <img
            :src="fileUrl(item.key)"
            :alt="item.key"
            loading="lazy"
            class="h-28 w-full rounded-md object-cover"
          />
        </a>
        <figcaption class="grid min-w-0 gap-1">
          <span class="truncate text-sm text-ink" :title="item.key">{{ item.key }}</span>
          <span class="text-sm text-muted">
            {{ formatSize(item.size) }} · {{ formatDate(item.uploaded) }}
          </span>
          <div class="grid grid-flow-col items-center justify-start gap-2">
            <button class="link text-sm" @click="copy(item)">
              {{ copiedKey === item.key ? "Copied" : "Copy URL" }}
            </button>
            <button class="link text-sm" @click="startReplace(item)">Replace</button>
            <button class="link text-sm text-danger hover:text-danger" @click="remove(item)">
              Delete
            </button>
          </div>
        </figcaption>
      </figure>
    </div>
    <p v-else-if="!loading" class="text-muted">No media yet.</p>

    <input
      ref="replaceInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onReplaceInput"
    />

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
