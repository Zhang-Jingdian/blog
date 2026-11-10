<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import {
  assignUploads,
  createPost,
  getPost,
  listCategories,
  listTags,
  updatePost,
  uploadImage,
} from "@/api/client";
import MediaLibrary from "@/components/MediaLibrary.vue";
import Modal from "@/components/Modal.vue";
import RichTextEditor from "@/components/RichTextEditor.vue";
import { buildPreviewHtml } from "@/lib/previewHtml";
import { renderMarkdown } from "@/lib/renderMarkdown";
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
const error = ref("");

const coverOpen = ref(false);
const categoryOpen = ref(false);
const tagsOpen = ref(false);
const mediaOpen = ref(false);

const coverFileInput = ref<HTMLInputElement | null>(null);
const descriptionEl = ref<HTMLTextAreaElement | null>(null);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

// Keys uploaded while creating a post (before it has an id); assigned after save.
const pendingKeys = new Set<string>();

const form = reactive<PostForm>({
  title: "",
  content: "",
  description: "",
  coverUrl: "",
  categoryId: null,
  tagIds: [],
  status: "draft",
});

// Publication timestamps of the loaded post (edit mode), shown in the preview.
const publishedAt = ref<string | null>(null);
const updatedAt = ref<string | null>(null);

const categoryName = computed(
  () => categories.value.find((c) => c.id === form.categoryId)?.name ?? "Category",
);
const tagsLabel = computed(() => (form.tagIds.length ? `Tags (${form.tagIds.length})` : "Tags"));

// --- auto-growing description textarea ---
function autosizeDescription() {
  const el = descriptionEl.value;
  if (!el) return;
  // Same as the content editor: keep the viewport put while the box resizes.
  const y = window.scrollY;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
  window.scrollTo(0, y);
  requestAnimationFrame(() => window.scrollTo(0, y));
}

watch(
  () => form.description,
  async () => {
    await nextTick();
    autosizeDescription();
  },
);

// --- data loading ---
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
    publishedAt.value = p.publishedAt;
    updatedAt.value = p.updatedAt;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load post";
  }
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
    const { url, key } = await uploadImage(file, isEdit ? id : undefined);
    // In create mode there is no post id yet; remember the key so it can be
    // assigned to the post right after it is created.
    if (!isEdit) pendingKeys.add(key);
    return url;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Upload failed";
    return null;
  }
}

async function handleCoverFile(file: File | null | undefined) {
  uploading.value = true;
  const url = await uploadFile(file);
  uploading.value = false;
  if (url) form.coverUrl = url;
}

function onCoverFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  handleCoverFile(input.files?.[0]);
  input.value = "";
}

function onCoverDrop(event: DragEvent) {
  handleCoverFile(event.dataTransfer?.files?.[0]);
}

function onCoverPaste(event: ClipboardEvent) {
  handleCoverFile(event.clipboardData?.files?.[0]);
}

// Upload an inline image from the editor and return its served URL (throws on failure).
async function handleEditorImageUpload(file: File): Promise<string> {
  const url = await uploadFile(file);
  if (!url) throw new Error("Image upload failed");
  return url;
}

// When an upload is deleted from the media library, drop the cover reference if
// it pointed at that file, so the editor (and the saved post) don't keep a
// dangling URL to an object that no longer exists.
function onMediaDeleted(key: string) {
  if (form.coverUrl && form.coverUrl.includes(key)) {
    form.coverUrl = "";
  }
}

// Open a complete, website-style preview of the post in a new window.
async function openPreview() {
  const contentHtml = await renderMarkdown(form.content);
  const category = categories.value.find((c) => c.id === form.categoryId);
  const html = buildPreviewHtml({
    title: form.title || "Untitled",
    description: form.description.trim() || null,
    coverUrl: form.coverUrl.trim() || null,
    categoryName: category?.name ?? null,
    tagNames: tags.value.filter((t) => form.tagIds.includes(t.id)).map((t) => t.name),
    publishedAt: publishedAt.value,
    updatedAt: updatedAt.value,
    contentHtml,
  });
  const win = window.open("", "_blank");
  if (!win) {
    error.value = "Pop-up blocked — allow pop-ups to preview the post";
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
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
    if (isEdit) {
      await updatePost(id, input);
    } else {
      const created = await createPost(input);
      if (pendingKeys.size > 0) {
        // Best-effort: if the bulk assign fails, the uploads stay unassigned and
        // remain served by URL — never block saving the post.
        await assignUploads(created.id, [...pendingKeys]).catch(() => {});
      }
    }
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
  // The form (and its textareas) only render once `loading` is false, so run the
  // auto-grow after that render — the watch above fired while the description
  // textarea wasn't mounted yet.
  await nextTick();
  autosizeDescription();
});
</script>

<template>
  <section>
    <p v-if="error" class="text-danger">{{ error }}</p>

    <form v-if="!loading" class="grid gap-4" @submit.prevent="submit">
      <label class="grid gap-1 text-body">
        Title
        <input v-model="form.title" required maxlength="200" class="field" />
      </label>

      <label class="grid gap-1 text-body">
        Description
        <textarea
          ref="descriptionEl"
          v-model="form.description"
          rows="2"
          maxlength="500"
          class="field resize-none overflow-hidden"
        ></textarea>
      </label>

      <div class="flex flex-wrap items-center gap-2">
        <label class="grid grid-flow-col items-center gap-2 text-body">
          Status
          <select v-model="form.status" class="field w-auto">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <button type="button" class="btn" @click="coverOpen = true">
          Cover{{ form.coverUrl ? " ✓" : "" }}
        </button>
        <button type="button" class="btn" @click="categoryOpen = true">{{ categoryName }}</button>
        <button type="button" class="btn" @click="tagsOpen = true">{{ tagsLabel }}</button>
        <button type="button" class="btn" @click="mediaOpen = true">Media</button>
        <button type="button" class="btn" @click="openPreview">Preview</button>
      </div>

      <div class="grid gap-1">
        <span class="text-body">Content</span>
        <RichTextEditor v-model="form.content" :image-upload-handler="handleEditorImageUpload" />
      </div>

      <div class="grid grid-flow-col items-center justify-start gap-4">
        <button type="submit" class="btn" :disabled="saving">
          {{ saving ? "Saving…" : "Save" }}
        </button>
        <RouterLink to="/posts" class="link">Cancel</RouterLink>
      </div>
    </form>

    <Modal :open="coverOpen" title="Cover" @close="coverOpen = false">
      <div class="grid gap-3">
        <img
          v-if="form.coverUrl"
          :src="form.coverUrl"
          alt="Cover preview"
          class="max-h-48 rounded-md object-contain"
        />
        <div
          class="grid cursor-pointer place-items-center gap-2 rounded-md border-2 border-dashed border-soft px-4 py-8 text-center text-body"
          tabindex="0"
          role="button"
          @click="coverFileInput?.click()"
          @dragover.prevent
          @drop.prevent="onCoverDrop"
          @paste="onCoverPaste"
        >
          <template v-if="uploading">Uploading…</template>
          <template v-else>
            <span class="font-semibold">Drop an image here</span>
            <span class="text-muted">or click to browse · you can also paste an image</span>
          </template>
        </div>
        <input
          ref="coverFileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="onCoverFileInput"
        />
        <button
          v-if="form.coverUrl"
          type="button"
          class="link text-left"
          @click="form.coverUrl = ''"
        >
          Remove cover
        </button>
      </div>
    </Modal>

    <Modal :open="categoryOpen" title="Category" @close="categoryOpen = false">
      <div class="grid gap-2">
        <button
          type="button"
          class="rounded-md border border-soft bg-white px-3 py-2 text-left text-body"
          :class="{ 'border-accent text-accent': form.categoryId === null }"
          @click="
            form.categoryId = null;
            categoryOpen = false;
          "
        >
          None
        </button>
        <button
          v-for="c in categories"
          :key="c.id"
          type="button"
          class="rounded-md border border-soft bg-white px-3 py-2 text-left text-body"
          :class="{ 'border-accent text-accent': form.categoryId === c.id }"
          @click="
            form.categoryId = c.id;
            categoryOpen = false;
          "
        >
          {{ c.name }}
        </button>
        <p v-if="!categories.length" class="text-muted">No categories yet.</p>
      </div>
    </Modal>

    <Modal :open="tagsOpen" title="Tags" @close="tagsOpen = false">
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
    </Modal>

    <Modal :open="mediaOpen" title="Media" @close="mediaOpen = false">
      <MediaLibrary :post-id="isEdit ? id : undefined" embedded @deleted="onMediaDeleted" />
    </Modal>
  </section>
</template>
