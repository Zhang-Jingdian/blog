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
      tablePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      imagePlugin({ imageUploadHandler: props.imageUploadHandler }),
      toolbarPlugin({ toolbarContents }),
    ],
  });
}
