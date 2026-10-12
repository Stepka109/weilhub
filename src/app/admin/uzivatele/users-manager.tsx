"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Ban, Check, CircleCheck, Copy, Info, MoreHorizontal, Plus, ShieldCheck, Ticket, Trash2, UserCheck, UserRound, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { AdminTable, Td, Tr } from "@/components/admin/common";
import { UserAvatar } from "@/components/layout/user-avatar";
import { createInvitation, deleteUser, revokeInvitation, updateUserAccess } from "@/lib/actions/admin/users";
import { useAction } from "@/lib/use-action";
import { formatDateTime, formatTimestampDate } from "@/lib/dates";
import type { AdminUser } from "@/lib/data/admin";
import type { AccountStatus, AppRole, Invitation } from "@/lib/types";

const ROLE: Record<AppRole, { label: string; tone: "lavender" | "blue" | "slate" }> = {
  admin: { label: "Administrátor", tone: "lavender" },
  editor: { label: "Editor", tone: "blue" },
  student: { label: "Student", tone: "slate" },
};
const STATUS: Record<AccountStatus, { label: string; tone: "mint" | "yellow" | "red" }> = {
  approved: { label: "Schválený", tone: "mint" },
  pending: { label: "Čeká na schválení", tone: "yellow" },
  blocked: { label: "Zablokovaný", tone: "red" },
};

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pending, run } = useAction();
  const [created, setCreated] = React.useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { note: "", role: "student" as "student" | "editor", max_uses: 30, expires_in_days: 14 } });
  const link = created && typeof window !== "undefined" ? `${window.location.origin}/registrace?pozvanka=${created}` : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setCreated(null);
          reset();
        }
      }}
    >
      <DialogContent title="Nová pozvánka" description="Kód pozvánky umožní registraci. Admin roli pozvánkou udělit nelze.">
        {created ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-mint p-4 text-mint-ink">
              <p className="text-sm">Kód pozvánky</p>
              <p className="font-display text-2xl font-bold tracking-wider">{created}</p>
            </div>
            <Field label="Odkaz pro registraci">
              <div className="flex gap-2">
                <Input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Odkaz pro registraci" />
                <Button
                  variant="secondary"
                  onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Odkaz zkopírován."), () => toast.error("Kopírování se nezdařilo."))}
                >
                  <Copy /> Kopírovat
                </Button>
              </div>
            </Field>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Hotovo</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-5"
            noValidate
            onSubmit={handleSubmit(async (v) => {
              const res = await run(() => createInvitation(v));
              if (res.ok && res.data) setCreated(res.data.code);
            })}
          >
            <Field label="Poznámka" htmlFor="i-note" hint="Např. „Třída I1.M – září“">
              <Input id="i-note" {...register("note")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Role" htmlFor="i-role">
                <Select id="i-role" {...register("role")}>
                  <option value="student">Student</option>
                  <option value="editor">Editor</option>
                </Select>
              </Field>
              <Field label="Počet použití" htmlFor="i-uses">
                <Input id="i-uses" type="number" min={1} max={500} {...register("max_uses")} />
              </Field>
              <Field label="Platnost (dny)" htmlFor="i-exp" hint="0 = bez omezení">
                <Input id="i-exp" type="number" min={0} max={365} {...register("expires_in_days")} />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Zrušit
              </Button>
              <Button type="submit" loading={pending}>
                Vytvořit pozvánku
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function UsersManager({
  users,
  invitations,
  meId,
  emailsAvailable,
}: {
  users: AdminUser[];
  invitations: Invitation[];
  meId: string;
  emailsAvailable: boolean;
}) {
  const { run } = useAction();
  const [confirmDialog, ask] = useConfirm();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const pendingUsers = users.filter((u) => u.status === "pending");
  const now = new Date().toISOString();

  return (
    <div className="space-y-8">
      {!emailsAvailable && (
        <p className="flex items-start gap-2 rounded-2xl bg-sky px-4 py-3 text-sm text-sky-ink">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          E-maily a mazání účtů jsou dostupné po nastavení proměnné SUPABASE_SECRET_KEY na serveru (viz README). Role a schvalování fungují i bez ní.
        </p>
      )}

      {pendingUsers.length > 0 && (
        <Card className="border-yellow-ink/20">
          <CardHeader title={`Čekají na schválení (${pendingUsers.length})`} description="Neschválení uživatelé nevidí žádná studentská data." />
          <ul className="px-3 pt-3 pb-4">
            {pendingUsers.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-bg">
                <UserAvatar name={u.display_name} path={u.avatar_path} className="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{u.display_name}</span>
                  <span className="block truncate text-sm text-muted">
                    {u.email ?? "e-mail skrytý"} · registrace {formatTimestampDate(u.created_at)}
                  </span>
                </span>
                <Button size="sm" onClick={() => run(() => updateUserAccess(u.id, { status: "approved" }), { success: "Účet byl schválen." })}>
                  <Check /> Schválit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => run(() => updateUserAccess(u.id, { status: "blocked" }), { success: "Účet byl zamítnut." })}>
                  <XCircle /> Zamítnout
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-labelledby="uzivatele">
        <h2 id="uzivatele" className="mb-3 text-lg font-semibold text-ink">
          Všichni uživatelé ({users.length})
        </h2>
        {users.length === 0 ? (
          <Card>
            <EmptyState icon={Users} title="Žádní uživatelé" />
          </Card>
        ) : (
          <AdminTable head={["Uživatel", "Role", "Stav", "Registrace", "Akce"]}>
            {users.map((u) => (
              <Tr key={u.id}>
                <Td>
                  <span className="flex items-center gap-3">
                    <UserAvatar name={u.display_name} path={u.avatar_path} className="size-9" />
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">
                        {u.display_name} {u.id === meId && <span className="text-xs text-muted">(vy)</span>}
                      </span>
                      <span className="block truncate text-xs text-muted">{u.email ?? "—"}</span>
                    </span>
                  </span>
                </Td>
                <Td>
                  <Badge tone={ROLE[u.role].tone}>{ROLE[u.role].label}</Badge>
                </Td>
                <Td>
                  <Badge tone={STATUS[u.status].tone}>{STATUS[u.status].label}</Badge>
                </Td>
                <Td label="Registrace" className="whitespace-nowrap text-muted">
                  {formatTimestampDate(u.created_at)}
                  {u.last_sign_in_at && <span className="block text-xs">naposledy {formatDateTime(u.last_sign_in_at)}</span>}
                </Td>
                <Td className="md:text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon-sm" aria-label={`Akce pro ${u.display_name}`} className="mt-2 md:mt-0" disabled={u.id === meId}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Role</DropdownMenuLabel>
                      {(["student", "editor", "admin"] as AppRole[]).map((r) => (
                        <DropdownMenuItem
                          key={r}
                          disabled={u.role === r}
                          onSelect={() =>
                            r === "admin"
                              ? ask({
                                  title: "Udělit roli administrátora?",
                                  description: `${u.display_name} získá plný přístup ke správě aplikace, uživatelů a rolí.`,
                                  confirmLabel: "Udělit",
                                  destructive: false,
                                  onConfirm: () => run(() => updateUserAccess(u.id, { role: r })),
                                })
                              : run(() => updateUserAccess(u.id, { role: r }))
                          }
                        >
                          {r === "admin" ? <ShieldCheck /> : r === "editor" ? <UserCheck /> : <UserRound />} {ROLE[r].label}
                          {u.role === r && <CircleCheck className="ml-auto text-primary!" />}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      {u.status !== "approved" && (
                        <DropdownMenuItem onSelect={() => run(() => updateUserAccess(u.id, { status: "approved" }))}>
                          <Check /> Schválit účet
                        </DropdownMenuItem>
                      )}
                      {u.status !== "blocked" && (
                        <DropdownMenuItem onSelect={() => run(() => updateUserAccess(u.id, { status: "blocked" }))}>
                          <Ban /> Zablokovat
                        </DropdownMenuItem>
                      )}
                      {emailsAvailable && (
                        <DropdownMenuItem
                          destructive
                          onSelect={() =>
                            ask({
                              title: "Smazat účet?",
                              description: `Účet ${u.display_name} bude trvale smazán včetně osobních nastavení. Materiály, které vytvořil(a), zůstanou zachovány.`,
                              confirmLabel: "Smazat účet",
                              onConfirm: () => run(() => deleteUser(u.id)),
                            })
                          }
                        >
                          <Trash2 /> Smazat účet
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Td>
              </Tr>
            ))}
          </AdminTable>
        )}
      </section>

      <Card>
        <CardHeader
          title="Pozvánky"
          description="Registrace s platným kódem pozvánky (podle nastavení může být účet hned aktivní)."
          action={
            <Button variant="secondary" onClick={() => setInviteOpen(true)}>
              <Plus /> Nová pozvánka
            </Button>
          }
        />
        <div className="px-3 pt-3 pb-4">
          {invitations.length === 0 ? (
            <EmptyState icon={Ticket} title="Žádné pozvánky" />
          ) : (
            <ul>
              {invitations.map((i) => {
                const expired = i.expires_at !== null && i.expires_at < now;
                const exhausted = i.used_count >= i.max_uses;
                const active = !i.revoked && !expired && !exhausted;
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-bg">
                    <code className="rounded-lg bg-slate-soft px-2 py-1 font-mono text-sm text-ink">{i.code}</code>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="text-ink">{i.note ?? "Bez poznámky"}</span>
                      <span className="block text-xs text-muted">
                        {ROLE[i.role].label} · použito {i.used_count}/{i.max_uses}
                        {i.expires_at ? ` · platí do ${formatDateTime(i.expires_at)}` : " · bez omezení platnosti"}
                      </span>
                    </span>
                    <Badge tone={active ? "mint" : "slate"}>{i.revoked ? "Zrušená" : expired ? "Vypršela" : exhausted ? "Vyčerpaná" : "Aktivní"}</Badge>
                    {active && (
                      <Button size="sm" variant="ghost" onClick={() => run(() => revokeInvitation(i.id))}>
                        Zrušit
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {confirmDialog}
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
