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

    <form
      class="my-4 grid grid-cols-1 gap-2 xs:mb-6 xs:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      @submit.prevent="create"
    >
      <input v-model="createForm.name" placeholder="Name" required class="field" />
      <input v-model="createForm.description" placeholder="Description (optional)" class="field" />
      <button type="submit" class="btn">Add</button>
    </form>

    <p v-if="error" class="text-danger">{{ error }}</p>
    <p v-if="info" class="text-accent-dark">{{ info }}</p>
    <p v-if="loading" class="text-muted">Loading…</p>

    <ul v-if="items.length" class="m-0 list-none p-0">
      <li v-for="item in items" :key="item.id">
        <form
          v-if="editingId === item.id"
          class="grid grid-cols-1 gap-2 border-b border-soft py-4 xs:grid-cols-[auto_auto_auto_auto]"
          @submit.prevent="saveEdit(item)"
        >
          <input v-model="editForm.name" required class="field" />
          <input
            v-model="editForm.description"
            placeholder="Description (optional)"
            class="field"
          />
          <button type="submit" class="btn">Save</button>
          <button type="button" class="link" @click="cancelEdit">Cancel</button>
        </form>
        <div
          v-else
          class="grid grid-cols-1 gap-4 border-b border-soft py-4 xs:grid-cols-[minmax(0,1fr)_auto] xs:items-center"
        >
          <div
            class="grid min-w-0 grid-cols-1 gap-1 xs:grid-cols-[auto_auto_auto_auto] xs:items-baseline xs:gap-x-3 xs:gap-y-1"
          >
            <span class="text-ink">{{ item.name }}</span>
            <span class="text-muted">/{{ item.slug }}</span>
            <span v-if="item.description" class="text-muted">{{ item.description }}</span>
            <span class="text-muted">{{ item.postCount ?? 0 }} posts</span>
          </div>
          <div class="grid grid-flow-col items-center justify-start gap-3 xs:justify-end">
            <button class="link" @click="startEdit(item)">Edit</button>
            <button class="link text-danger hover:text-danger" @click="remove(item)">Delete</button>
          </div>
        </div>
      </li>
    </ul>
    <p v-else-if="!loading" class="text-muted">Nothing here yet.</p>
  </section>
</template>
