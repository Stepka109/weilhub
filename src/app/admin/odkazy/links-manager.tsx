"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { ArrowDown, ArrowUp, Eye, EyeOff, Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Field, Input } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { EmptyState, IconTile } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { RowMenu } from "@/components/admin/row-menu";
import { IconPicker } from "@/components/admin/pickers";
import { iconFor } from "@/components/icons/icon-registry";
import { deleteRow, reorder, saveLink } from "@/lib/actions/admin/content";
import { useAction } from "@/lib/use-action";
import { isSafeExternalUrl } from "@/lib/utils";
import type { UsefulLink } from "@/lib/types";

interface Values {
  title: string;
  description: string;
  url: string;
  icon: string;
  is_visible: boolean;
}

function LinkDialog({ link, open, onOpenChange }: { link: UsefulLink | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pending, run } = useAction();
  const { register, handleSubmit, control, formState, setError } = useForm<Values>({
    values: {
      title: link?.title ?? "",
      description: link?.description ?? "",
      url: link?.url ?? "https://",
      icon: link?.icon ?? "link",
      is_visible: link?.is_visible ?? true,
    },
  });
  const e = formState.errors;
  const onSubmit = handleSubmit(async (v) => {
    const res = await run(() => saveLink(link?.id ?? null, v), { onSuccess: () => onOpenChange(false) });
    if (!res.ok) for (const [k, m] of Object.entries(res.fieldErrors ?? {})) if (m?.[0]) setError(k as keyof Values, { message: m[0] });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={link ? "Upravit odkaz" : "Nový odkaz"} wide>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Název" htmlFor="l-title" required error={e.title?.message}>
              <Input id="l-title" placeholder="např. Bakaláři" {...register("title", { required: "Zadejte název." })} />
            </Field>
            <Field label="Adresa (URL)" htmlFor="l-url" required error={e.url?.message}>
              <Input
                id="l-url"
                type="url"
                inputMode="url"
                {...register("url", { validate: (v) => isSafeExternalUrl(v) || "Zadejte platnou adresu začínající https://." })}
              />
            </Field>
          </div>
          <Field label="Popis" htmlFor="l-desc" hint="Nepovinné">
            <Input id="l-desc" {...register("description")} />
          </Field>
          <Field label="Ikonka">
            <Controller control={control} name="icon" render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} />} />
          </Field>
          <Controller
            control={control}
            name="is_visible"
            render={({ field }) => (
              <label className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-4 py-3">
                <span className="font-medium text-ink">Zobrazit studentům</span>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </label>
            )}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button type="submit" loading={pending}>
              Uložit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LinksManager({ links }: { links: UsefulLink[] }) {
  const { pending, run } = useAction();
  const [confirmDialog, ask] = useConfirm();
  const [dialog, setDialog] = React.useState<{ open: boolean; link: UsefulLink | null }>({ open: false, link: null });

  function move(i: number, dir: -1 | 1) {
    const ids = links.map((l) => l.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void run(() => reorder("useful_links", ids), { success: "Pořadí uloženo." });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialog({ open: true, link: null })}>
          <Plus /> Nový odkaz
        </Button>
      </div>
      {links.length === 0 ? (
        <Card>
          <EmptyState icon={Link2} title="Zatím žádné odkazy" />
        </Card>
      ) : (
        <ul className="space-y-3">
          {links.map((l, i) => (
            <li key={l.id}>
              <Card className="flex items-center gap-4 p-4 sm:px-6">
                <div className="flex flex-col">
                  <button type="button" disabled={i === 0 || pending} onClick={() => move(i, -1)} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-30" aria-label={`Posunout ${l.title} nahoru`}>
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" disabled={i === links.length - 1 || pending} onClick={() => move(i, 1)} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-30" aria-label={`Posunout ${l.title} dolů`}>
                    <ArrowDown className="size-4" />
                  </button>
                </div>
                <IconTile icon={iconFor(l.icon, Link2)} className="bg-light-blue text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {l.title}
                    {!l.is_visible && <Badge tone="slate">Skrytý</Badge>}
                  </p>
                  <p className="truncate text-sm text-muted">{l.url}</p>
                </div>
                <RowMenu
                  label={l.title}
                  onEdit={() => setDialog({ open: true, link: l })}
                  extra={
                    <DropdownMenuItem onSelect={() => run(() => saveLink(l.id, { ...l, description: l.description ?? "", is_visible: !l.is_visible }))}>
                      {l.is_visible ? <EyeOff /> : <Eye />} {l.is_visible ? "Skrýt" : "Zveřejnit"}
                    </DropdownMenuItem>
                  }
                  onDelete={() =>
                    ask({
                      title: "Smazat odkaz?",
                      description: `Odkaz „${l.title}“ bude trvale smazán.`,
                      confirmLabel: "Smazat",
                      onConfirm: () => run(() => deleteRow("useful_links", l.id)),
                    })
                  }
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
      {confirmDialog}
      <LinkDialog link={dialog.link} open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} />
    </>
  );
}
