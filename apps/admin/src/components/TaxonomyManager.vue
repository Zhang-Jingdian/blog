<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { createTaxonomy, deleteTaxonomy, listTaxonomy, updateTaxonomy } from "@/api/client";
import type { Taxonomy, TaxonomyInput, TaxonomyKind } from "@/api/types";

const props = defineProps<{ kind: TaxonomyKind; title: string }>();

const items = ref<Taxonomy[]>([]);
const loading = ref(false);
const error = ref("");
const info = ref("");
const editingId = ref<number | null>(null);

const createForm = reactive({ name: "", description: "" });
const editForm = reactive({ name: "", description: "" });

function taxonomyInput(name: string, description: string): TaxonomyInput {
  return { name, description: description.trim() ? description.trim() : null };
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    items.value = await listTaxonomy(props.kind);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load";
  } finally {
    loading.value = false;
  }
}

async function create() {
  error.value = "";
  try {
    await createTaxonomy(props.kind, taxonomyInput(createForm.name, createForm.description));
    createForm.name = "";
    createForm.description = "";
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to create";
  }
}

function startEdit(item: Taxonomy) {
  editingId.value = item.id;
  editForm.name = item.name;
  editForm.description = item.description ?? "";
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(item: Taxonomy) {
  error.value = "";
  try {
    await updateTaxonomy(props.kind, item.id, taxonomyInput(editForm.name, editForm.description));
    editingId.value = null;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to update";
  }
}

async function remove(item: Taxonomy) {
  if (!window.confirm(`Delete "${item.name}"?`)) return;
  error.value = "";
  info.value = "";
  try {
    const res = await deleteTaxonomy(props.kind, item.id);
    if (props.kind === "category" && res.affectedPosts) {
      info.value = `Deleted; ${res.affectedPosts} post${res.affectedPosts === 1 ? "" : "s"} uncategorized.`;
    }
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to delete";
  }
}

onMounted(load);
</script>

<template>
  <section>
    <h1>{{ title }}</h1>

    <form class="create" @submit.prevent="create">
      <input v-model="createForm.name" placeholder="Name" required />
      <input v-model="createForm.description" placeholder="Description (optional)" />
      <button type="submit" class="btn">Add</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="info" class="info">{{ info }}</p>
    <p v-if="loading" class="muted">Loading…</p>

    <ul v-if="items.length" class="list">
      <li v-for="item in items" :key="item.id">
        <form v-if="editingId === item.id" class="edit" @submit.prevent="saveEdit(item)">
          <input v-model="editForm.name" required />
          <input v-model="editForm.description" placeholder="Description (optional)" />
          <button type="submit" class="btn">Save</button>
          <button type="button" class="link" @click="cancelEdit">Cancel</button>
        </form>
        <div v-else class="row">
          <div class="row-main">
            <span class="name">{{ item.name }}</span>
            <span class="muted">/{{ item.slug }}</span>
            <span v-if="item.description" class="muted">{{ item.description }}</span>
            <span class="muted">{{ item.postCount ?? 0 }} posts</span>
          </div>
          <div class="row-actions">
            <button class="link" @click="startEdit(item)">Edit</button>
            <button class="link danger" @click="remove(item)">Delete</button>
          </div>
        </div>
      </li>
    </ul>
    <p v-else-if="!loading" class="muted">Nothing here yet.</p>
  </section>
</template>

<style scoped>
.create {
  display: flex;
  gap: 0.5em;
  margin: 1em 0 1.5em;
}
.create input {
  flex: 1;
  min-width: 0;
}
.edit {
  display: flex;
  gap: 0.5em;
  padding: 1em 0;
  border-bottom: 1px solid rgb(var(--gray-light));
}
input {
  font-size: 16px;
  padding: 0.4em 0.6em;
  border: 1px solid rgb(var(--gray-light));
  border-radius: 6px;
  color: rgb(var(--gray-dark));
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1em;
  padding: 1em 0;
  border-bottom: 1px solid rgb(var(--gray-light));
}
.row-main {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em 0.75em;
  align-items: baseline;
}
.name {
  color: rgb(var(--black));
}
.row-actions {
  display: flex;
  gap: 0.75em;
  flex-shrink: 0;
}
.btn {
  padding: 0.4em 0.9em;
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
.link {
  background: none;
  border: none;
  padding: 0;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.95em;
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
.info {
  color: var(--accent-dark);
}
</style>
