import { Download, Eye, Paperclip } from "lucide-react";
import { fileTypeOf } from "@/lib/files";
import { formatBytes } from "@/lib/utils";
import type { StoredFile } from "@/lib/types";

/** Seznam příloh s možností stažení (a zobrazení u bezpečných typů). */
export function FileList({ files, title = "Přílohy" }: { files: StoredFile[]; title?: string }) {
  if (!files.length) return null;
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink">
        <Paperclip className="size-4 text-muted" aria-hidden />
        {title}
      </h2>
      <ul className="space-y-2">
        {files.map((f) => {
          const t = fileTypeOf(f.file_name);
          return (
            <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-bg text-[11px] font-bold text-slate-ink uppercase">
                {t?.ext ?? "?"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{f.file_name}</span>
                <span className="block text-xs text-muted">
                  {t?.label ?? "Soubor"} · {formatBytes(f.size_bytes)}
                </span>
              </span>
              {t?.inline && (
                <a
                  href={`/api/soubory/${f.id}?inline=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-slate-soft hover:text-primary"
                  aria-label={`Zobrazit ${f.file_name}`}
                >
                  <Eye className="size-[18px]" aria-hidden />
                </a>
              )}
              <a
                href={`/api/soubory/${f.id}`}
                className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-slate-soft hover:text-primary"
                aria-label={`Stáhnout ${f.file_name}`}
              >
                <Download className="size-[18px]" aria-hidden />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
