"use client";

import * as React from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Image } from "@tiptap/extension-image";
import { Highlight } from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { safeHref } from "@/lib/tiptap";
import { IMAGE_EXTS, acceptAttribute } from "@/lib/files";
import { cn } from "@/lib/utils";
import type { TiptapNode } from "@/lib/types";

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-xl text-slate-ink transition-colors disabled:opacity-35 [&_svg]:size-[18px]",
        active ? "bg-light-blue text-primary" : "hover:bg-slate-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden />;

function Toolbar({ editor, onImage, uploading }: { editor: Editor; onImage?: () => void; uploading: boolean }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      link: e.isActive("link"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Adresa odkazu (https://…)", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") return chain().extendMarkRange("link").unsetLink().run();
    const safe = safeHref(url.trim());
    if (!safe) return toast.error("Odkaz musí začínat https://, http:// nebo mailto:.");
    chain().extendMarkRange("link").setLink({ href: safe }).run();
  }

  return (
    <div role="toolbar" aria-label="Formátování textu" className="scrollbar-none sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto rounded-t-[20px] border-b border-line bg-card/95 px-2 py-1.5 backdrop-blur">
      <ToolButton label="Zpět (Ctrl+Z)" disabled={!s.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 />
      </ToolButton>
      <ToolButton label="Znovu (Ctrl+Y)" disabled={!s.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 />
      </ToolButton>
      <Divider />
      <ToolButton label="Odstavec" onClick={() => chain().setParagraph().run()}>
        <Pilcrow />
      </ToolButton>
      <ToolButton label="Nadpis 1" active={s.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
        <Heading1 />
      </ToolButton>
      <ToolButton label="Nadpis 2" active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </ToolButton>
      <ToolButton label="Nadpis 3" active={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </ToolButton>
      <Divider />
      <ToolButton label="Tučně (Ctrl+B)" active={s.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label="Kurzíva (Ctrl+I)" active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <ToolButton label="Podtržení (Ctrl+U)" active={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <UnderlineIcon />
      </ToolButton>
      <ToolButton label="Přeškrtnutí" active={s.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </ToolButton>
      <ToolButton label="Zvýraznění" active={s.highlight} onClick={() => chain().toggleHighlight().run()}>
        <Highlighter />
      </ToolButton>
      <Divider />
      <ToolButton label="Odrážky" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </ToolButton>
      <ToolButton label="Číslovaný seznam" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolButton>
      <ToolButton label="Citace" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote />
      </ToolButton>
      <ToolButton label="Blok kódu" active={s.code} onClick={() => chain().toggleCodeBlock().run()}>
        <Code2 />
      </ToolButton>
      <ToolButton label="Oddělovač" onClick={() => chain().setHorizontalRule().run()}>
        <Minus />
      </ToolButton>
      <Divider />
      <ToolButton label="Vložit odkaz" active={s.link} onClick={setLink}>
        <Link2 />
      </ToolButton>
      {s.link && (
        <ToolButton label="Odebrat odkaz" onClick={() => chain().unsetLink().run()}>
          <Unlink />
        </ToolButton>
      )}
      {onImage && (
        <ToolButton label="Vložit obrázek" disabled={uploading} onClick={onImage}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        </ToolButton>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Tabulka"
            title="Tabulka"
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl text-slate-ink hover:bg-slate-soft [&_svg]:size-[18px]",
              s.table && "bg-light-blue text-primary",
            )}
          >
            <Table2 />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Vložit tabulku 3 × 3</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!s.table} onSelect={() => chain().addRowAfter().run()}>Přidat řádek</DropdownMenuItem>
          <DropdownMenuItem disabled={!s.table} onSelect={() => chain().addColumnAfter().run()}>Přidat sloupec</DropdownMenuItem>
          <DropdownMenuItem disabled={!s.table} onSelect={() => chain().deleteRow().run()}>Smazat řádek</DropdownMenuItem>
          <DropdownMenuItem disabled={!s.table} onSelect={() => chain().deleteColumn().run()}>Smazat sloupec</DropdownMenuItem>
          <DropdownMenuItem disabled={!s.table} onSelect={() => chain().toggleHeaderRow().run()}>Přepnout záhlaví</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive disabled={!s.table} onSelect={() => chain().deleteTable().run()}>
            Smazat tabulku
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Editor zápisů (TipTap). Obsah se předává jako JSON – formátování se
 * při opakovaných úpravách nikdy neztrácí.
 */
export function RichTextEditor({
  value,
  onChange,
  onUploadImage,
  placeholder = "Začněte psát zápis…",
}: {
  value: TiptapNode | null;
  onChange: (doc: TiptapNode) => void;
  /** Nahraje obrázek a vrátí jeho interní adresu (/api/soubory/…) */
  onUploadImage?: (file: File) => Promise<string | null>;
  placeholder?: string;
}) {
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ["https", "http", "mailto"], isAllowedUri: (url) => safeHref(url) !== null },
      }),
      TableKit.configure({ table: { resizable: false } }),
      Image.configure({ inline: false, allowBase64: false }),
      Highlight,
      Placeholder.configure({ placeholder }),
    ],
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: { class: "prose-wh px-5 py-5 sm:px-8 sm:py-7", "aria-label": "Obsah zápisu", role: "textbox", "aria-multiline": "true" },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as TiptapNode),
  });

  async function insertImage(file: File) {
    if (!editor || !onUploadImage) return;
    setUploading(true);
    try {
      const src = await onUploadImage(file);
      if (src) editor.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, "") }).run();
    } catch (e) {
      toast.error((e as Error).message || "Obrázek se nepodařilo nahrát.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="tiptap-editor rounded-card border border-line bg-card shadow-card focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
      {editor ? (
        <Toolbar editor={editor} uploading={uploading} onImage={onUploadImage ? () => fileInput.current?.click() : undefined} />
      ) : (
        <div className="h-12 rounded-t-[20px] border-b border-line" />
      )}
      <EditorContent editor={editor} />
      {onUploadImage && (
        <input
          ref={fileInput}
          type="file"
          accept={acceptAttribute(IMAGE_EXTS)}
          className="sr-only"
          aria-label="Vybrat obrázek"
          onChange={(e) => e.target.files?.[0] && void insertImage(e.target.files[0])}
        />
      )}
    </div>
  );
}
