"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, ExternalLink, EyeOff, FolderOpen, MoreHorizontal, Pencil, Search, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/admin/common";
import { setStatus } from "@/lib/actions/admin/content";
import { deleteMaterial, duplicateMaterial } from "@/lib/actions/admin/materials";
import { useAction } from "@/lib/use-action";
import { formatDateTime } from "@/lib/dates";
import { materialType } from "@/components/portal/shared";
import type { AdminMaterialRow } from "@/lib/data/admin";
import { GroupBadge } from "@/components/portal/group-badge";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function MaterialsTable({ materials, subjects }: { materials: AdminMaterialRow[]; subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const { run } = useAction();
  const [confirmDialog, ask] = useConfirm();
  const [q, setQ] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [status, setStatusFilter] = React.useState("");
  const [kind, setKind] = React.useState("");
  const [sort, setSort] = React.useState("updated");

  const rows = React.useMemo(() => {
    const term = fold(q.trim());
    const filtered = materials.filter(
      (m) =>
        (!term || fold(m.title).includes(term)) &&
        (!subject || m.subject_id === subject) &&
        (!status || m.status === status) &&
        (!kind || m.kind === kind),
    );
    return [...filtered].sort((a, b) =>
      sort === "title" ? a.title.localeCompare(b.title, "cs") : sort === "created" ? b.created_at.localeCompare(a.created_at) : b.updated_at.localeCompare(a.updated_at),
    );
  }, [materials, q, subject, status, kind, sort]);

  return (
    <>
      <Card className="mb-4 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_200px_170px_150px_170px]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat podle názvu…" className="h-10 rounded-full pl-10" aria-label="Hledat materiály" />
          </div>
          <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10" aria-label="Předmět">
            <option value="">Všechny předměty</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatusFilter(e.target.value)} className="h-10" aria-label="Stav">
            <option value="">Všechny stavy</option>
            <option value="draft">Koncepty</option>
            <option value="published">Publikované</option>
            <option value="archived">Archivované</option>
          </Select>
          <Select value={kind} onChange={(e) => setKind(e.target.value)} className="h-10" aria-label="Typ">
            <option value="">Všechny typy</option>
            <option value="note">Zápisy</option>
            <option value="file">Soubory</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10" aria-label="Řazení">
            <option value="updated">Naposledy upravené</option>
            <option value="created">Nejnovější</option>
            <option value="title">Podle názvu</option>
          </Select>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={FolderOpen} title="Žádné materiály" description={materials.length ? "Zkuste upravit filtry." : "Přidejte první materiál."} />
        </Card>
      ) : (
        <AdminTable head={["Název", "Předmět", "Typ", "Autor", "Upraveno", "Stav", "Akce"]}>
          {rows.map((m) => {
            const t = materialType({ kind: m.kind, files: m.files });
            return (
              <Tr key={m.id}>
                <Td>
                  <Link href={`/admin/materialy/${m.id}`} className="font-medium text-ink hover:text-primary">
                    {m.title}
                  </Link>
                </Td>
                <Td label="Předmět" className="text-muted">
                  {m.subject?.name ?? "—"}
                  <GroupBadge group={m.study_group} className="ml-1.5" />
                </Td>
                <Td label="Typ" className="text-muted">
                  {t.label}
                </Td>
                <Td label="Autor" className="text-muted">
                  {m.author?.display_name ?? "—"}
                </Td>
                <Td label="Upraveno" className="whitespace-nowrap text-muted">
                  {formatDateTime(m.updated_at)}
                </Td>
                <Td>
                  <StatusBadge status={m.status} />
                </Td>
                <Td className="md:text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon-sm" aria-label={`Akce pro ${m.title}`} className="mt-2 md:mt-0">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {m.status === "published" && (
                        <DropdownMenuItem asChild>
                          <Link href={`/materialy/${m.id}`} target="_blank">
                            <ExternalLink /> Otevřít v portálu
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/materialy/${m.id}`}>
                          <Pencil /> Upravit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => run(() => duplicateMaterial(m.id), { onSuccess: (d) => d && router.push(`/admin/materialy/${d.id}`) })}
                      >
                        <Copy /> Duplikovat
                      </DropdownMenuItem>
                      {m.status === "published" ? (
                        <DropdownMenuItem onSelect={() => run(() => setStatus("materials", m.id, "draft"))}>
                          <EyeOff /> Stáhnout z publikace
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onSelect={() => run(() => setStatus("materials", m.id, "published"))}
                          disabled={m.kind === "file" && !m.files.some((f) => f.role === "main")}
                        >
                          <Send /> Publikovat
                        </DropdownMenuItem>
                      )}
                      {m.status !== "archived" && (
                        <DropdownMenuItem onSelect={() => run(() => setStatus("materials", m.id, "archived"))}>
                          <Archive /> Archivovat
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onSelect={() =>
                          ask({
                            title: "Smazat materiál?",
                            description: `Materiál „${m.title}“ bude trvale smazán včetně příloh, které nepoužívá jiný materiál. Tuto akci nelze vrátit.`,
                            confirmLabel: "Smazat trvale",
                            onConfirm: () => run(() => deleteMaterial(m.id)),
                          })
                        }
                      >
                        <Trash2 /> Smazat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Td>
              </Tr>
            );
          })}
        </AdminTable>
      )}
      <p className="mt-3 text-sm text-muted">Zobrazeno {rows.length} z {materials.length} materiálů.</p>
      {confirmDialog}
    </>
  );
}
