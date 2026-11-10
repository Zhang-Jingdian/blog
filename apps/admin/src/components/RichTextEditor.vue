<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";

// A markdown *source* editor: a plain auto-growing textarea showing the raw
// markdown, plus a toolbar whose buttons insert markdown syntax at the cursor.
// The rendered result is only shown in the separate preview window, never here.
const props = defineProps<{
  imageUploadHandler: (file: File) => Promise<string>;
}>();

const model = defineModel<string>({ required: true });

const ta = ref<HTMLTextAreaElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const uploadingImage = ref(false);

// Last-known caret/selection range. Toolbar buttons run after the textarea has
// lost focus, so we track it here instead of reading selectionStart at click time.
const sel = ref({ start: 0, end: 0 });

function rememberSelection() {
  const el = ta.value;
  if (el) sel.value = { start: el.selectionStart, end: el.selectionEnd };
}

// --- auto-growing textarea, mirroring the description field ---
function autosize() {
  const el = ta.value;
  if (!el) return;
  // Resizing the box shifts the layout below it and can make the browser scroll
  // the caret into view; pin the viewport so typing never moves the page.
  const y = window.scrollY;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
  window.scrollTo(0, y);
  requestAnimationFrame(() => window.scrollTo(0, y));
}

watch(model, async () => {
  await nextTick();
  autosize();
});

onMounted(() => {
  nextTick(autosize);
});

// Replace [start, end) with `text`, then select the portion of `text` between
// `caretStart` and `caretEnd` (offsets relative to the inserted text).
function replaceRange(
  start: number,
  end: number,
  text: string,
  caretStart: number,
  caretEnd: number,
) {
  model.value = model.value.slice(0, start) + text + model.value.slice(end);
  nextTick(() => {
    const el = ta.value;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start + caretStart, start + caretEnd);
  });
}

// Wrap the selection (or a placeholder when nothing is selected) in `before`/`after`.
function wrap(before: string, after = before, placeholder = "text") {
  const { start, end } = sel.value;
  const selected = model.value.slice(start, end) || placeholder;
  replaceRange(
    start,
    end,
    before + selected + after,
    before.length,
    before.length + selected.length,
  );
}

// Prefix the line containing the caret, e.g. "# " for a heading or "- " for a list.
function prefixLine(prefix: string) {
  const { start } = sel.value;
  const lineStart = model.value.lastIndexOf("\n", start - 1) + 1;
  replaceRange(lineStart, lineStart, prefix, prefix.length, prefix.length);
}

// Insert a block on its own line (surrounding newlines are added as needed).
function insertBlock(block: string) {
  const { start, end } = sel.value;
  const before = model.value.slice(0, start);
  const after = model.value.slice(end);
  const lead = before && !before.endsWith("\n") ? "\n" : "";
  const trail = after && !after.startsWith("\n") ? "\n" : "";
  const text = lead + block + trail;
  replaceRange(start, end, text, text.length, text.length);
}

function codeBlock() {
  const { start, end } = sel.value;
  const inner = model.value.slice(start, end) || "code";
  const before = model.value.slice(0, start);
  const after = model.value.slice(end);
  const lead = before && !before.endsWith("\n") ? "\n" : "";
  const trail = after && !after.startsWith("\n") ? "\n" : "";
  const text = `${lead}\`\`\`\n${inner}\n\`\`\`${trail}`;
  replaceRange(start, end, text, lead.length + 4, lead.length + 4 + inner.length);
}

function insertLink() {
  const { start, end } = sel.value;
  const selected = model.value.slice(start, end);
  const text = selected || "link text";
  const url = window.prompt("Link URL", "https://");
  if (url == null) return;
  replaceRange(start, end, `[${text}](${url})`, 1, 1 + text.length);
}

const TABLE = "| Header | Header | Header |\n| --- | --- | --- |\n| cell | cell | cell |";

function pickImage() {
  rememberSelection();
  fileInput.value?.click();
}

// Upload an image file and insert it as markdown image syntax at `start`/`end`.
// Shared by the toolbar picker, pasted images, and dropped images.
async function uploadImageAndInsert(file: File, start: number, end: number) {
  uploadingImage.value = true;
  try {
    const url = await props.imageUploadHandler(file);
    const alt = model.value.slice(start, end) || "image";
    replaceRange(start, end, `![${alt}](${url})`, 2, 2 + alt.length);
  } catch {
    // The upload handler reports validation/upload errors to the parent; here we
    // just avoid inserting a broken image.
  } finally {
    uploadingImage.value = false;
  }
}

async function onImageInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  await uploadImageAndInsert(file, sel.value.start, sel.value.end);
}

// Pasted and dropped images are uploaded to R2 and inserted as markdown syntax,
// instead of becoming an inline data URL (or navigating the page, on drop).
async function onPaste(event: ClipboardEvent) {
  const file = Array.from(event.clipboardData?.files ?? []).find((f) =>
    f.type.startsWith("image/"),
  );
  if (!file) return;
  event.preventDefault();
  rememberSelection();
  await uploadImageAndInsert(file, sel.value.start, sel.value.end);
}

async function onDrop(event: DragEvent) {
  const file = Array.from(event.dataTransfer?.files ?? []).find((f) => f.type.startsWith("image/"));
  if (!file) return;
  event.preventDefault();
  await uploadImageAndInsert(file, sel.value.start, sel.value.end);
}
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-md border border-soft bg-white">
    <div
      class="flex flex-wrap items-center gap-1 border-b border-soft px-2 py-1.5"
      @mousedown.prevent
    >
      <button type="button" class="toolbar-btn" title="Bold" @click="wrap('**', '**', 'bold text')">
        B
      </button>
      <button
        type="button"
        class="toolbar-btn"
        title="Italic"
        @click="wrap('*', '*', 'italic text')"
      >
        I
      </button>
      <button
        type="button"
        class="toolbar-btn"
        title="Strikethrough"
        @click="wrap('~~', '~~', 'strikethrough')"
      >
        S̶
      </button>
      <button type="button" class="toolbar-btn" title="Inline code" @click="wrap('`', '`', 'code')">
        &lt;/&gt;
      </button>

      <span class="mx-1 h-4 w-px bg-soft"></span>

      <button type="button" class="toolbar-btn" title="Heading 1" @click="prefixLine('# ')">
        H1
      </button>
      <button type="button" class="toolbar-btn" title="Heading 2" @click="prefixLine('## ')">
        H2
      </button>
      <button type="button" class="toolbar-btn" title="Heading 3" @click="prefixLine('### ')">
        H3
      </button>

      <span class="mx-1 h-4 w-px bg-soft"></span>

      <button type="button" class="toolbar-btn" title="Bullet list" @click="prefixLine('- ')">
        • List
      </button>
      <button type="button" class="toolbar-btn" title="Numbered list" @click="prefixLine('1. ')">
        1. List
      </button>
      <button type="button" class="toolbar-btn" title="Blockquote" @click="prefixLine('> ')">
        ❝
      </button>
      <button type="button" class="toolbar-btn" title="Code block" @click="codeBlock">
        Code block
      </button>

      <span class="mx-1 h-4 w-px bg-soft"></span>

      <button type="button" class="toolbar-btn" title="Horizontal rule" @click="insertBlock('---')">
        —
      </button>
      <button type="button" class="toolbar-btn" title="Link" @click="insertLink">Link</button>
      <button type="button" class="toolbar-btn" title="Image" @click="pickImage">
        {{ uploadingImage ? "Uploading…" : "Image" }}
      </button>
      <button type="button" class="toolbar-btn" title="Table" @click="insertBlock(TABLE)">
        Table
      </button>
    </div>

    <textarea
      ref="ta"
      v-model="model"
      rows="12"
      spellcheck="false"
      placeholder="Write your post in markdown…"
      class="block w-full resize-none overflow-hidden border-0 bg-white px-4 py-3 font-mono text-[15px] leading-relaxed text-body focus:outline-none"
      @keyup="rememberSelection"
      @mouseup="rememberSelection"
      @select="rememberSelection"
      @focus="rememberSelection"
      @blur="rememberSelection"
      @paste="onPaste"
      @drop.prevent="onDrop"
    ></textarea>

    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onImageInput" />
  </div>
</template>
