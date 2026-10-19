<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { createPost, getPost, listCategories, listTags, updatePost } from "@/api/client";
import type { PostInput, PostStatus, Taxonomy } from "@/api/types";

interface PostForm {
  title: string;
  content: string;
  slug: string;
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
const error = ref("");

const form = reactive<PostForm>({
  title: "",
  content: "",
  slug: "",
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
    form.slug = p.slug;
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

async function submit() {
  error.value = "";
  saving.value = true;
  const input: PostInput = {
    title: form.title,
    content: form.content,
    slug: form.slug.trim() || undefined,
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
});
</script>

<template>
  <section>
    <div class="mb-4 grid grid-cols-1 gap-2 xs:grid-cols-[minmax(0,1fr)_auto] xs:items-center">
      <h1 class="m-0">{{ isEdit ? "Edit post" : "New post" }}</h1>
      <RouterLink to="/posts" class="link">← Back to posts</RouterLink>
    </div>

    <p v-if="error" class="text-danger">{{ error }}</p>

    <form v-if="!loading" class="grid gap-4" @submit.prevent="submit">
      <label class="grid gap-1 text-body">
        Title
        <input v-model="form.title" required maxlength="200" class="field" />
      </label>

      <label class="grid gap-1 text-body">
        Content
        <textarea v-model="form.content" rows="12" required class="field resize-y"></textarea>
      </label>

      <label class="grid gap-1 text-body">
        Slug <span class="font-normal text-muted">(optional, defaults from title)</span>
        <input v-model="form.slug" placeholder="my-post" class="field" />
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

      <label class="grid gap-1 text-body">
        Cover URL
        <input v-model="form.coverUrl" type="url" placeholder="https://…" class="field" />
      </label>

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

      <div class="grid grid-flow-col items-center justify-start gap-4">
        <button type="submit" class="btn" :disabled="saving">
          {{ saving ? "Saving…" : "Save" }}
        </button>
        <RouterLink to="/posts" class="link">Cancel</RouterLink>
      </div>
    </form>
  </section>
</template>
