import { createElement, Fragment, type ReactNode } from "react";
import {
  MDXEditor,
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  InsertCodeBlock,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

export interface MarkdownEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  imageUploadHandler: (file: File) => Promise<string>;
}

// Languages offered in the code-block language dropdown. Keys are matched by
// name/alias/extension against @codemirror/language-data, so unknown fences
// still render and their syntax is loaded on demand.
const codeBlockLanguages: Record<string, string> = {
  js: "JavaScript",
  jsx: "JavaScript (React)",
  ts: "TypeScript",
  tsx: "TypeScript (React)",
  css: "CSS",
  scss: "SCSS",
  html: "HTML",
  xml: "XML",
  json: "JSON",
  yaml: "YAML",
  bash: "Bash",
  shell: "Shell",
  python: "Python",
  java: "Java",
  c: "C",
  cpp: "C++",
  cs: "C#",
  go: "Go",
  rust: "Rust",
  ruby: "Ruby",
  php: "PHP",
  sql: "SQL",
  markdown: "Markdown",
  dockerfile: "Dockerfile",
  graphql: "GraphQL",
  diff: "Diff",
};

// MDXEditor 4.x ships no default toolbar, so we compose one explicitly.
const toolbarContents = (): ReactNode =>
  createElement(
    Fragment,
    null,
    createElement(UndoRedo),
    createElement(BoldItalicUnderlineToggles),
    createElement(CodeToggle),
    createElement(BlockTypeSelect),
    createElement(ListsToggle),
    createElement(CreateLink),
    createElement(InsertImage),
    createElement(InsertTable),
    createElement(InsertCodeBlock),
    createElement(InsertThematicBreak),
  );

// React wrapper around MDXEditor, mounted into the Vue post editor via createRoot.
// Written with createElement (no JSX) so it needs no React Vite plugin or a
// separate JSX tsconfig in this Vue app.
export function MarkdownEditor(props: MarkdownEditorProps): ReactNode {
  return createElement(MDXEditor, {
    markdown: props.initialMarkdown,
    onChange: props.onChange,
    plugins: [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      codeBlockPlugin(),
      codeMirrorPlugin({ codeBlockLanguages }),
      tablePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      imagePlugin({ imageUploadHandler: props.imageUploadHandler }),
      toolbarPlugin({ toolbarContents }),
    ],
  });
}
