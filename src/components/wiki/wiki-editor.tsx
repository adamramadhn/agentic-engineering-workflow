"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  EditorContent,
  useEditor,
  type ChainedCommands,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extensions";
import { TableKit } from "@tiptap/extension-table";
import {
  CodeIcon,
  ImageIcon,
  Link02,
  ListIcon,
  Paperclip,
  RefreshCw,
  RotateCcw,
} from "@/components/icons";
import "./wiki.css";

/**
 * One component, two modes: the editing surface (toolbar + editable ProseMirror
 * document) and the read-only renderer (the same document with `editable:
 * false`).
 *
 * Rendering through an editor instance rather than `dangerouslySetInnerHTML`
 * is the XSS story: ProseMirror builds the DOM from its own schema, so a
 * hand-edited `content` JSONB blob cannot smuggle a script in — unknown node
 * and mark types are dropped instead of rendered.
 */

export interface WikiEditorProps {
  /** The stored tiptap document; null for a page that has never been saved. */
  content: JSONContent | null;
  /** false renders the read-only variant (no toolbar, no handlers). */
  editable?: boolean;
  /** Fired on every document change with the full JSON. */
  onChange?: (doc: JSONContent) => void;
  /** Upload an image and return its `/api/wiki/files/{id}` src. */
  onInsertImage?: (file: File) => Promise<string | null>;
  /** Upload a generic file and return its URL (inserted as a link). */
  onAttachFile?: (file: File) => Promise<string | null>;
  /** False → the upload buttons render disabled, with the hint beside them. */
  storageReady?: boolean;
  uploadHint?: string;
  placeholder?: string;
}

export function WikiEditor({
  content,
  editable = false,
  onChange,
  onInsertImage,
  onAttachFile,
  storageReady = false,
  uploadHint = "Storage is not configured",
  placeholder = "Write something, or attach a file…",
}: WikiEditorProps) {
  // Toolbar active-states must follow the selection. shouldRerenderOnTransaction
  // is flagged for removal upstream, so this bumps a counter on the same events
  // instead — same effect, no deprecated option.
  const [, bump] = useReducer((count: number) => count + 1, 0);
  const [uploading, setUploading] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Built ONCE: useEditor re-instantiates the whole editor when its deps
  // change, and an inline array (new identities every render) would recreate
  // ProseMirror on every parent render — which fires an update, which re-renders
  // the parent, which… #185 maximum update depth. The deps array stays EMPTY:
  // content is read at creation (mode flips remount via `key` upstream) and
  // editable is applied by the effect below.
  const extensions = useMemo(
    () => [
      // link is switched off here and registered explicitly below, so
      // StarterKit's copy is not registered twice under the same name.
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder }),
      TableKit.configure({ table: { resizable: true } }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    extensions,
    content: content ?? undefined,
    editable,
    // SSR safety: ProseMirror measures the DOM at construction, which would
    // otherwise differ between server and client markup.
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onChange?.(current.getJSON()),
    onSelectionUpdate: bump,
    onTransaction: bump,
  });

  // `editable` is read once at construction, so a mode flip has to be applied.
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  /** Shared upload path: hand the file to the caller, then insert the URL. */
  async function upload(
    file: File,
    send: (file: File) => Promise<string | null>,
    insert: (url: string) => void
  ): Promise<void> {
    if (!storageReady) return;
    setUploading(true);
    try {
      const url = await send(file);
      if (url) insert(url);
    } finally {
      setUploading(false);
    }
  }

  function pickImage(): void {
    imageInput.current?.click();
  }

  function pickFile(): void {
    fileInput.current?.click();
  }

  if (!editable) {
    return (
      <div className="wiki-prose" data-readonly="true">
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className="wiki-prose" data-readonly="false">
      <div
        className="mb-2 flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-muted/40 p-1"
        role="toolbar"
        aria-label="Formatting"
      >
        <ToolbarButton editor={editor} label="Undo" onClick={(chain) => chain.undo().run()} icon={<RotateCcw className="size-3.5" />} />
        <ToolbarButton editor={editor} label="Redo" onClick={(chain) => chain.redo().run()} icon={<RefreshCw className="size-3.5" />} />
        <ToolbarDivider />
        <ToolbarButton editor={editor} label="Heading 1" active={(e) => e.isActive("heading", { level: 1 })} onClick={(chain) => chain.toggleHeading({ level: 1 }).run()} text="H1" />
        <ToolbarButton editor={editor} label="Heading 2" active={(e) => e.isActive("heading", { level: 2 })} onClick={(chain) => chain.toggleHeading({ level: 2 }).run()} text="H2" />
        <ToolbarButton editor={editor} label="Heading 3" active={(e) => e.isActive("heading", { level: 3 })} onClick={(chain) => chain.toggleHeading({ level: 3 }).run()} text="H3" />
        <ToolbarDivider />
        <ToolbarButton editor={editor} label="Bold" active={(e) => e.isActive("bold")} onClick={(chain) => chain.toggleBold().run()} text="B" bold />
        <ToolbarButton editor={editor} label="Italic" active={(e) => e.isActive("italic")} onClick={(chain) => chain.toggleItalic().run()} text="I" italic />
        <ToolbarButton editor={editor} label="Strikethrough" active={(e) => e.isActive("strike")} onClick={(chain) => chain.toggleStrike().run()} text="S" struck />
        <ToolbarButton editor={editor} label="Inline code" active={(e) => e.isActive("code")} onClick={(chain) => chain.toggleCode().run()} text="</>" mono />
        <ToolbarDivider />
        <ToolbarButton editor={editor} label="Bullet list" active={(e) => e.isActive("bulletList")} onClick={(chain) => chain.toggleBulletList().run()} icon={<ListIcon className="size-3.5" />} />
        <ToolbarButton editor={editor} label="Ordered list" active={(e) => e.isActive("orderedList")} onClick={(chain) => chain.toggleOrderedList().run()} text="1." mono />
        <ToolbarButton editor={editor} label="Quote" active={(e) => e.isActive("blockquote")} onClick={(chain) => chain.toggleBlockquote().run()} text="❝" />
        <ToolbarButton editor={editor} label="Code block" active={(e) => e.isActive("codeBlock")} onClick={(chain) => chain.toggleCodeBlock().run()} icon={<CodeIcon className="size-3.5" />} />
        <ToolbarButton
          editor={editor}
          label="Insert table"
          onClick={(chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          text="Table"
        />
        <ToolbarDivider />
        <LinkButton editor={editor} />
        <ToolbarDivider />
        <ToolbarButton
          editor={editor}
          label={uploadButtonLabel("Insert image", storageReady, uploading)}
          icon={<ImageIcon className="size-3.5" />}
          disabled={!storageReady || uploading}
          title={storageReady ? undefined : uploadHint}
          onClick={pickImage}
        />
        <ToolbarButton
          editor={editor}
          label={uploadButtonLabel("Attach file", storageReady, uploading)}
          icon={<Paperclip className="size-3.5" />}
          disabled={!storageReady || uploading}
          title={storageReady ? undefined : uploadHint}
          onClick={pickFile}
        />
      </div>

      {!storageReady && (
        <p className="mb-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {uploadHint}. An administrator can configure storage on the Storage page — until then
          the page can still be written and saved.
        </p>
      )}

      <div className="rounded-xl border border-border">
        <EditorContent editor={editor} />
      </div>

      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file && onInsertImage) {
            void upload(file, onInsertImage, (url) =>
              editor?.chain().focus().setImage({ src: url }).run()
            );
          }
        }}
      />
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file && onAttachFile) {
            void upload(file, onAttachFile, (url) =>
              editor
                ?.chain()
                .focus()
                .insertContent({
                  type: "text",
                  text: file.name,
                  marks: [{ type: "link", attrs: { href: url } }],
                })
                .run()
            );
          }
        }}
      />
    </div>
  );
}

function uploadButtonLabel(base: string, storageReady: boolean, uploading: boolean): string {
  if (!storageReady) return `${base} (storage not configured)`;
  return uploading ? `${base} (uploading…)` : base;
}

// --- toolbar ----------------------------------------------------------------

interface ToolbarButtonProps {
  editor: Editor | null;
  label: string;
  /** Receives an already-focused chain, so every button body is one .run(). */
  onClick: (chain: ChainedCommands) => void;
  active?: (editor: Editor) => boolean;
  icon?: React.ReactNode;
  text?: string;
  bold?: boolean;
  italic?: boolean;
  struck?: boolean;
  mono?: boolean;
  disabled?: boolean;
  title?: string;
}

function ToolbarButton({
  editor,
  label,
  onClick,
  active,
  icon,
  text,
  bold,
  italic,
  struck,
  mono,
  disabled,
  title,
}: ToolbarButtonProps) {
  const isActive = editor ? Boolean(active?.(editor)) : false;
  const buttonDisabled = disabled || !editor;
  const accessibleName = title ? `${label} — ${title}` : label;
  return (
    <button
      type="button"
      className="wiki-toolbar-button inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      aria-label={accessibleName}
      aria-pressed={isActive}
      data-active={isActive ? "true" : "false"}
      disabled={buttonDisabled}
      onClick={() => {
        if (editor) onClick(editor.chain().focus());
      }}
    >
      {icon ?? (
        <span
          className={
            mono
              ? "font-mono"
              : bold
                ? "font-bold"
                : italic
                  ? "italic"
                  : struck
                    ? "line-through"
                    : undefined
          }
        >
          {text}
        </span>
      )}
    </button>
  );
}

function LinkButton({ editor }: { editor: Editor | null }) {
  const isActive = editor?.isActive("link") ?? false;
  return (
    <>
      <button
        type="button"
        className="wiki-toolbar-button inline-flex h-7 items-center justify-center rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        aria-label="Add link"
        aria-pressed={isActive}
        data-active={isActive ? "true" : "false"}
        disabled={!editor}
        onClick={() => {
          if (!editor) return;
          const previous = editor.getAttributes("link").href as string | undefined;
          // window.prompt is unpolished but honest: it keeps the editor
          // dependency-free and covers the single-URL case a wiki needs.
          const url = window.prompt("Link URL", previous ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().unsetLink().run();
            return;
          }
          editor.chain().focus().setLink({ href: url }).run();
        }}
      >
        <Link02 className="size-3.5" />
      </button>
      {isActive && (
        <button
          type="button"
          className="wiki-toolbar-button inline-flex h-7 items-center rounded-md px-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Remove link"
          onClick={() => editor?.chain().focus().unsetLink().run()}
        >
          <Link02 className="size-3.5 opacity-40" />
        </button>
      )}
    </>
  );
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />;
}
