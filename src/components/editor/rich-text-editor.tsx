"use client";

import * as React from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Image } from "@tiptap/extension-image";
import { Highlight } from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import { Superscript } from "@tiptap/extension-superscript";
import { Subscript } from "@tiptap/extension-subscript";
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
  Sigma,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
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
import { FormulaDialog } from "./formula-dialog";
import { createInlineMath } from "./math-extension";
import { convertTextFormulas, findTextFormulas } from "./math-convert";
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

function Toolbar({
  editor,
  onImage,
  onFormula,
  uploading,
}: {
  editor: Editor;
  onImage?: () => void;
  onFormula: () => void;
  uploading: boolean;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      sup: e.isActive("superscript"),
      sub: e.isActive("subscript"),
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
      <ToolButton label="Horní index – mocnina (x²)" active={s.sup} onClick={() => chain().toggleSuperscript().run()}>
        <SuperscriptIcon />
      </ToolButton>
      <ToolButton label="Dolní index (H₂O)" active={s.sub} onClick={() => chain().toggleSubscript().run()}>
        <SubscriptIcon />
      </ToolButton>
      <ToolButton label="Vzorec – zlomek, odmocnina… ($…$)" onClick={onFormula}>
        <Sigma />
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
  const [formula, setFormula] = React.useState<{ latex: string; pos: number | null } | null>(null);
  const mathExtension = React.useMemo(() => createInlineMath((latex, pos) => setFormula({ latex, pos })), []);

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
      Superscript,
      Subscript,
      mathExtension,
      Placeholder.configure({ placeholder }),
    ],
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: { class: "prose-wh px-5 py-5 sm:px-8 sm:py-7", "aria-label": "Obsah zápisu", role: "textbox", "aria-multiline": "true" },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as TiptapNode),
  });

  // Vzorce napsané jako text „$…$“ (např. vložené odjinud) – nabídneme převod
  const subscribeFormulas = React.useCallback(
    (cb: () => void) => {
      if (!editor) return () => {};
      editor.on("transaction", cb);
      editor.on("create", cb);
      return () => {
        editor.off("transaction", cb);
        editor.off("create", cb);
      };
    },
    [editor],
  );
  const textFormulas = React.useSyncExternalStore(
    subscribeFormulas,
    () => (editor && !editor.isDestroyed ? findTextFormulas(editor).length : 0),
    () => 0,
  );

  function saveFormula(latex: string) {
    if (!editor) return;
    if (formula?.pos != null) {
      editor.chain().setNodeSelection(formula.pos).updateInlineMath({ latex, pos: formula.pos }).focus().run();
    } else {
      editor.chain().focus().insertInlineMath({ latex }).run();
    }
    setFormula(null);
  }

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
        <Toolbar
          editor={editor}
          uploading={uploading}
          onImage={onUploadImage ? () => fileInput.current?.click() : undefined}
          onFormula={() => setFormula({ latex: "", pos: null })}
        />
      ) : (
        <div className="h-12 rounded-t-[20px] border-b border-line" />
      )}
      {editor && textFormulas > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-light-blue/50 px-5 py-3 sm:px-8" role="status">
          <span className="flex items-center gap-2 text-sm text-ink">
            <Sigma className="size-4 shrink-0 text-primary" aria-hidden />
            {textFormulas === 1
              ? "V zápisu je 1 vzorec napsaný jako text ($…$). Převést ho na vykreslený vzorec?"
              : textFormulas < 5
                ? `V zápisu jsou ${textFormulas} vzorce napsané jako text ($…$). Převést je na vykreslené vzorce?`
                : `V zápisu je ${textFormulas} vzorců napsaných jako text ($…$). Převést je na vykreslené vzorce?`}
          </span>
          <button
            type="button"
            onClick={() => {
              const n = convertTextFormulas(editor);
              if (n) toast.success(n === 1 ? "Vzorec byl převeden." : `Převedeno vzorců: ${n}.`);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Převést
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
      <FormulaDialog
        open={!!formula}
        initial={formula?.latex ?? ""}
        editing={formula?.pos != null}
        onClose={() => setFormula(null)}
        onSave={saveFormula}
        onDelete={() => {
          if (editor && formula?.pos != null) editor.chain().focus().deleteRange({ from: formula.pos, to: formula.pos + 1 }).run();
          setFormula(null);
        }}
      />
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
