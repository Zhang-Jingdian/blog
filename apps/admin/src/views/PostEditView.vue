<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RouterLink, useRoute, useRouter } from "vue-router";
import {
  createPost,
  getPost,
  listCategories,
  listTags,
  updatePost,
  uploadImage,
} from "@/api/client";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import type { PostInput, PostStatus, Taxonomy } from "@/api/types";

interface PostForm {
  title: string;
  content: string;
  description: string;
  coverUrl: string;
  categoryId: number | null;
  tagIds: number[];
  status: string;
}

const route = useRoute();
const router = useRouter();

const rawId = route.params.id;
const id = typeof rawId === "string" ? Number(rawId) : NaN;
const isEdit = Number.isInteger(id) && id > 0;

const categories = ref<Taxonomy[]>([]);
const tags = ref<Taxonomy[]>([]);
const loading = ref(false);
const saving = ref(false);
const uploading = ref(false);
const insertingImage = ref(false);
const error = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
const editorHost = ref<HTMLDivElement | null>(null);
let reactRoot: Root | null = null;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const form = reactive<PostForm>({
  title: "",
  content: "",
  description: "",
  coverUrl: "",
  categoryId: null,
  tagIds: [],
  status: "draft",
});

async function loadRefs() {
  try {
    const [cats, tgs] = await Promise.all([listCategories(), listTags()]);
    categories.value = cats;
    tags.value = tgs;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load categories and tags";
  }
}

async function loadPost() {
  if (!isEdit) return;
  try {
    const p = await getPost(id);
    form.title = p.title;
    form.content = p.content;
    form.description = p.description ?? "";
    form.coverUrl = p.coverUrl ?? "";
    form.categoryId = p.categoryId;
    form.tagIds = p.tagIds;
    form.status = p.status;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load post";
  }
}

function onCategoryChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  form.categoryId = value === "" ? null : Number(value);
}

function toggleTag(tagId: number, checked: boolean) {
  const set = new Set(form.tagIds);
  if (checked) set.add(tagId);
  else set.delete(tagId);
  form.tagIds = [...set];
}

// Validate and upload a single image; returns the served URL or null on failure.
async function uploadFile(file: File | null | undefined): Promise<string | null> {
  if (!file) return null;
  if (!file.type.startsWith("image/")) {
    error.value = "Please choose an image file";
    return null;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    error.value = "Image is larger than 5 MB";
    return null;
  }
  error.value = "";
  try {
    const { url } = await uploadImage(file);
    return url;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Upload failed";
    return null;
  }
}

async function handleFile(file: File | null | undefined) {
  uploading.value = true;
  const url = await uploadFile(file);
  uploading.value = false;
  if (url) form.coverUrl = url;
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  handleFile(input.files?.[0]);
  input.value = "";
}

function onDrop(event: DragEvent) {
  handleFile(event.dataTransfer?.files?.[0]);
}

function onPaste(event: ClipboardEvent) {
  handleFile(event.clipboardData?.files?.[0]);
}

// Upload an image from the MDX editor and return its served URL (throws on failure).
async function handleEditorImageUpload(file: File): Promise<string> {
  const url = await uploadFile(file);
  if (!url) throw new Error("Image upload failed");
  return url;
}

// Mount the React-based MDX editor into the content host element.
function mountEditor() {
  if (!editorHost.value || reactRoot) return;
  reactRoot = createRoot(editorHost.value);
  reactRoot.render(
    createElement(MarkdownEditor, {
      initialMarkdown: form.content,
      onChange: (markdown: string) => {
        form.content = markdown;
      },
      imageUploadHandler: handleEditorImageUpload,
    }),
  );
}

async function submit() {
  error.value = "";
  saving.value = true;
  const input: PostInput = {
    title: form.title,
    content: form.content,
    description: form.description.trim() || null,
    coverUrl: form.coverUrl.trim() || null,
    categoryId: form.categoryId,
    tagIds: form.tagIds,
    status: form.status as PostStatus,
  };
  try {
    if (isEdit) await updatePost(id, input);
    else await createPost(input);
    router.push("/posts");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to save post";
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  await Promise.all([loadRefs(), loadPost()]);
  loading.value = false;
  await nextTick();
  mountEditor();
});

onUnmounted(() => {
  reactRoot?.unmount();
  reactRoot = null;
});
</script>

<template>
  <section>
    <p v-if="error" class="text-danger">{{ error }}</p>

    <form v-if="!loading" class="grid gap-4" @submit.prevent="submit" @paste="onPaste">
      <label class="grid gap-1 text-body">
        Title
        <input v-model="form.title" required maxlength="200" class="field" />
      </label>

      <label class="grid gap-1 text-body">
        Description
        <textarea
          v-model="form.description"
          rows="2"
          maxlength="500"
          class="field resize-y"
        ></textarea>
      </label>

      <fieldset class="grid gap-2">
        <legend class="px-2 text-body">Cover</legend>
        <div
          class="grid cursor-pointer place-items-center gap-2 rounded-md border border-dashed border-soft px-4 py-6 text-center text-muted"
          role="button"
          tabindex="0"
          @click="fileInput?.click()"
          @keydown.enter.prevent="fileInput?.click()"
          @dragover.prevent
          @drop.prevent="onDrop"
        >
          <p v-if="uploading">Uploading…</p>
          <template v-else>
            <img
              v-if="form.coverUrl"
              :src="form.coverUrl"
              alt="Cover preview"
              class="max-h-40 rounded-md object-contain"
            />
            <p v-else>Drag an image here, paste it, or click to browse</p>
          </template>
        </div>
        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileInput" />
        <label class="grid gap-1 text-body">
          Or enter a Cover URL
          <input v-model="form.coverUrl" type="url" placeholder="https://…" class="field" />
        </label>
      </fieldset>

      <label class="grid gap-1 text-body">
        Status
        <select v-model="form.status" class="field">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>

      <label class="grid gap-1 text-body">
        Category
        <select
          :value="form.categoryId === null ? '' : String(form.categoryId)"
          @change="onCategoryChange"
          class="field"
        >
          <option value="">None</option>
          <option v-for="c in categories" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
        </select>
      </label>

      <fieldset class="rounded-md border border-soft px-4 py-3">
        <legend class="px-2 text-body">Tags</legend>
        <div class="grid gap-2">
          <label
            v-for="t in tags"
            :key="t.id"
            class="grid grid-flow-col items-center justify-start gap-2"
          >
            <input
              type="checkbox"
              class="p-0"
              :checked="form.tagIds.includes(t.id)"
              @change="toggleTag(t.id, ($event.target as HTMLInputElement).checked)"
            />
            {{ t.name }}
          </label>
          <p v-if="!tags.length" class="text-muted">No tags yet.</p>
        </div>
      </fieldset>

      <div class="grid gap-1">
        <span class="text-body">Content</span>
        <div ref="editorHost" class="rounded-md border border-soft"></div>
      </div>

      <div class="grid grid-flow-col items-center justify-start gap-4">
        <button type="submit" class="btn" :disabled="saving">
          {{ saving ? "Saving…" : "Save" }}
        </button>
        <RouterLink to="/posts" class="link">Cancel</RouterLink>
      </div>
    </form>
  </section>
</template>
