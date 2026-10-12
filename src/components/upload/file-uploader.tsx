"use client";

import * as React from "react";
import { CircleAlert, CloudUpload, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptAttribute, fileTypeOf, validateFileMeta } from "@/lib/files";
import { cn, formatBytes } from "@/lib/utils";
import { uploadFile, type UploadedFile } from "./upload-client";

export interface ExistingFile {
  id: string;
  file_name: string;
  size_bytes: number;
}

interface Pending {
  key: string;
  name: string;
  size: number;
  progress: number;
  error?: string;
}

/**
 * Nahrávání souborů: výběr i drag & drop, průběh, kontrola typu a velikosti
 * už v prohlížeči (server kontrolu provede znovu, včetně obsahu souboru).
 */
export function FileUploader({
  target,
  parentId,
  ensureParent,
  role = "attachment",
  files,
  onUploaded,
  onDelete,
  allowedTypes,
  maxMb,
  multiple = true,
  label,
}: {
  target: "material" | "assignment";
  parentId: string | null;
  /** Pokud záznam ještě neexistuje, uloží koncept a vrátí jeho ID. */
  ensureParent?: () => Promise<string | null>;
  role?: "main" | "attachment";
  files: ExistingFile[];
  onUploaded?: (f: UploadedFile) => void;
  onDelete?: (id: string) => Promise<unknown>;
  allowedTypes: string[];
  maxMb: number;
  multiple?: boolean;
  label: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [drag, setDrag] = React.useState(false);
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  async function handle(list: FileList | File[]) {
    const chosen = Array.from(list).slice(0, multiple ? 20 : 1);
    if (!chosen.length) return;
    const id = parentId ?? (await ensureParent?.()) ?? null;
    if (!id) return;

    for (const file of chosen) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const problem = validateFileMeta(file.name, file.size, allowedTypes, maxMb);
      if (problem) {
        setPending((p) => [...p, { key, name: file.name, size: file.size, progress: 0, error: problem }]);
        continue;
      }
      setPending((p) => [...p, { key, name: file.name, size: file.size, progress: 0 }]);
      try {
        const uploaded = await uploadFile(file, { target, parentId: id, role }, (progress) =>
          setPending((p) => p.map((x) => (x.key === key ? { ...x, progress } : x))),
        );
        setPending((p) => p.filter((x) => x.key !== key));
        onUploaded?.(uploaded);
        toast.success(`Soubor „${uploaded.fileName}“ byl nahrán.`);
      } catch (e) {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, error: (e as Error).message } : x)));
      }
    }
    if (input.current) input.current.value = "";
  }

  const busy = pending.some((p) => !p.error);

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-card border-2 border-dashed px-6 py-8 text-center transition-colors",
          drag ? "border-primary bg-light-blue/50" : "border-line bg-bg/60",
        )}
      >
        <CloudUpload className={cn("size-9", drag ? "text-primary" : "text-muted")} aria-hidden />
        <p className="mt-3 font-medium text-ink">{label}</p>
        <p className="mt-1 text-sm text-muted">
          Přetáhněte sem {multiple ? "soubory" : "soubor"} nebo{" "}
          <button type="button" onClick={() => input.current?.click()} className="font-medium text-primary underline-offset-2 hover:underline">
            vyberte z počítače
          </button>
        </p>
        <p className="mt-2 text-xs text-muted">
          {allowedTypes.map((t) => t.toUpperCase()).join(", ")} · max. {maxMb} MB
        </p>
        <input
          ref={input}
          type="file"
          multiple={multiple}
          accept={acceptAttribute(allowedTypes)}
          className="sr-only"
          aria-label={label}
          onChange={(e) => e.target.files && void handle(e.target.files)}
          disabled={busy}
        />
      </div>

      {(pending.length > 0 || files.length > 0) && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {pending.map((p) => (
            <li key={p.key} className={cn("rounded-2xl border px-4 py-3", p.error ? "border-rose-ink/20 bg-rose" : "border-line bg-card")}>
              <div className="flex items-center gap-3">
                {p.error ? <CircleAlert className="size-5 shrink-0 text-rose-ink" aria-hidden /> : <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                  <span className={cn("block text-xs", p.error ? "text-rose-ink" : "text-muted")}>
                    {p.error ?? `${formatBytes(p.size)} · ${p.progress < 100 ? `${p.progress} %` : "ověřuji obsah…"}`}
                  </span>
                </span>
                {p.error && (
                  <Button size="sm" variant="ghost" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>
                    Skrýt
                  </Button>
                )}
              </div>
              {!p.error && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Nahrávání ${p.name}`}>
                  <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${p.progress}%` }} />
                </div>
              )}
            </li>
          ))}
          {files.map((f) => {
            const t = fileTypeOf(f.file_name);
            return (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-bg text-[11px] font-bold text-slate-ink uppercase">{t?.ext ?? "?"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{f.file_name}</span>
                  <span className="block text-xs text-muted">{formatBytes(f.size_bytes)}</span>
                </span>
                <a href={`/api/soubory/${f.id}`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-slate-soft hover:text-primary" aria-label={`Stáhnout ${f.file_name}`}>
                  <Download className="size-4" />
                </a>
                {onDelete && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Odebrat ${f.file_name}`}
                    loading={deleting === f.id}
                    onClick={async () => {
                      setDeleting(f.id);
                      try {
                        await onDelete(f.id);
                      } finally {
                        setDeleting(null);
                      }
                    }}
                  >
                    {deleting !== f.id && <Trash2 />}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
