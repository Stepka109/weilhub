"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/form-controls";
import { MATH_SNIPPETS, MAX_LATEX_LENGTH, renderLatex } from "@/lib/math";

/**
 * Editor vzorce: tlačítka pro zlomek, mocniny, indexy a symboly
 * + ruční zápis v LaTeXu, s živým náhledem.
 */
export function FormulaDialog({
  open,
  initial,
  editing,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initial: string;
  editing: boolean;
  onClose: () => void;
  onSave: (latex: string) => void;
  onDelete?: () => void;
}) {
  const [latex, setLatex] = React.useState(initial);
  const [lastInitial, setLastInitial] = React.useState(initial);
  const [lastOpen, setLastOpen] = React.useState(open);
  const area = React.useRef<HTMLTextAreaElement>(null);

  // Při každém otevření začít z aktuálního vzorce
  if (open !== lastOpen || initial !== lastInitial) {
    setLastOpen(open);
    setLastInitial(initial);
    if (open) setLatex(initial);
  }

  function insert(snippet: string) {
    const el = area.current;
    const start = el?.selectionStart ?? latex.length;
    const end = el?.selectionEnd ?? latex.length;
    const selected = latex.slice(start, end);
    // Označený text se vloží do prvního volného místa (např. do čitatele)
    const text = selected && snippet.includes("▢") ? snippet.replace("▢", selected) : snippet;
    const hole = text.indexOf("▢");
    const clean = text.replaceAll("▢", "");
    setLatex(latex.slice(0, start) + clean + latex.slice(end));
    const caret = start + (hole >= 0 ? hole : clean.length);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }

  const preview = latex.trim() ? renderLatex(latex) : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={editing ? "Upravit vzorec" : "Vložit vzorec"}
        description="Klikněte na tlačítko (zlomek, mocnina, index…) nebo pište přímo, např. \frac{1}{2}, x^{2}, H_{2}O."
        wide
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Části vzorce">
            {MATH_SNIPPETS.map((s) => (
              <button
                key={s.title}
                type="button"
                title={s.title}
                aria-label={s.title}
                onClick={() => insert(s.latex)}
                className="h-10 min-w-11 rounded-xl border border-line bg-card px-2.5 font-display text-[0.95rem] font-semibold text-ink transition-colors hover:border-primary/40 hover:bg-light-blue/50 hover:text-primary"
              >
                {s.label}
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="formula-latex">Zápis vzorce</Label>
            <Textarea
              ref={area}
              id="formula-latex"
              autoFocus
              rows={3}
              maxLength={MAX_LATEX_LENGTH}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (latex.trim()) onSave(latex.trim());
                }
              }}
              className="font-mono text-[0.95rem]"
              spellCheck={false}
              placeholder="\frac{m_s}{m}"
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Náhled</p>
            <div className="grid min-h-20 place-items-center overflow-x-auto rounded-2xl border border-line bg-bg px-4 py-4 text-xl">
              {preview ? (
                <span dangerouslySetInnerHTML={{ __html: preview }} />
              ) : (
                <span className="text-sm text-muted">Zatím prázdné</span>
              )}
            </div>
          </div>

          <details className="rounded-2xl bg-bg px-4 py-3 text-sm text-slate-ink">
            <summary className="cursor-pointer font-medium text-ink">Nápověda k zápisu</summary>
            <ul className="mt-2 space-y-1">
              <li>
                Zlomek: <code>\frac{"{čitatel}"}{"{jmenovatel}"}</code>
              </li>
              <li>
                Mocnina: <code>x^{"{2}"}</code>, dolní index: <code>H_{"{2}"}O</code>
              </li>
              <li>
                Odmocnina: <code>\sqrt{"{x}"}</code>, krát: <code>\cdot</code>, šipka: <code>\rightarrow</code>
              </li>
              <li>
                V textu zápisu lze vzorec napsat i rovnou mezi dolary: <code>$\frac{"{1}"}{"{2}"}$</code>
              </li>
            </ul>
          </details>
        </div>

        <DialogFooter className="sm:justify-between">
          {editing && onDelete ? (
            <Button variant="danger-soft" onClick={onDelete}>
              Odstranit vzorec
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={onClose}>
              Zrušit
            </Button>
            <Button disabled={!latex.trim()} onClick={() => onSave(latex.trim())}>
              {editing ? "Uložit vzorec" : "Vložit vzorec"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
