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
    <div class="page-head">
      <h1>{{ isEdit ? "Edit post" : "New post" }}</h1>
      <RouterLink to="/posts" class="link">← Back to posts</RouterLink>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <form v-if="!loading" class="form" @submit.prevent="submit">
      <label>
        Title
        <input v-model="form.title" required maxlength="200" />
      </label>

      <label>
        Content
        <textarea v-model="form.content" rows="12" required></textarea>
      </label>

      <label>
        Slug <span class="muted">(optional, defaults from title)</span>
        <input v-model="form.slug" placeholder="my-post" />
      </label>

      <label>
        Description
        <textarea v-model="form.description" rows="2" maxlength="500"></textarea>
      </label>

      <label>
        Cover URL
        <input v-model="form.coverUrl" type="url" placeholder="https://…" />
      </label>

      <label>
        Status
        <select v-model="form.status">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>

      <label>
        Category
        <select
          :value="form.categoryId === null ? '' : String(form.categoryId)"
          @change="onCategoryChange"
        >
          <option value="">None</option>
          <option v-for="c in categories" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
        </select>
      </label>

      <fieldset>
        <legend>Tags</legend>
        <label v-for="t in tags" :key="t.id" class="checkbox">
          <input
            type="checkbox"
            :checked="form.tagIds.includes(t.id)"
            @change="toggleTag(t.id, ($event.target as HTMLInputElement).checked)"
          />
          {{ t.name }}
        </label>
        <p v-if="!tags.length" class="muted">No tags yet.</p>
      </fieldset>

      <div class="actions">
        <button type="submit" class="btn" :disabled="saving">
          {{ saving ? "Saving…" : "Save" }}
        </button>
        <RouterLink to="/posts" class="link">Cancel</RouterLink>
      </div>
    </form>
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
.form {
  display: flex;
  flex-direction: column;
  gap: 1em;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  color: rgb(var(--gray-dark));
}
input,
textarea,
select {
  font-size: 16px;
  padding: 0.5em 0.6em;
  border: 1px solid rgb(var(--gray-light));
  border-radius: 6px;
  color: rgb(var(--gray-dark));
  font-family: inherit;
}
textarea {
  resize: vertical;
}
fieldset {
  border: 1px solid rgb(var(--gray-light));
  border-radius: 6px;
  padding: 0.75em 1em;
}
fieldset legend {
  padding: 0 0.5em;
  color: rgb(var(--gray-dark));
}
.checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.5em;
}
.checkbox input {
  padding: 0;
}
.actions {
  display: flex;
  align-items: center;
  gap: 1em;
}
.btn {
  padding: 0.5em 1em;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
}
.btn:hover {
  background: var(--accent-dark);
}
.btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.link {
  color: var(--accent);
  text-decoration: none;
}
.link:hover {
  color: var(--accent-dark);
}
.muted {
  color: rgb(var(--gray));
  font-weight: normal;
}
.error {
  color: rgb(180, 60, 60);
}
</style>
