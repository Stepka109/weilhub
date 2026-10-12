import { CalendarDays, Mail, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { UserAvatar } from "@/components/layout/user-avatar";
import { requireUser } from "@/lib/auth";
import { formatTimestampDate } from "@/lib/dates";
import { ProfileForm } from "./profile-form";
import { AvatarUpload } from "./avatar-upload";

export const metadata = { title: "Profil" };

const ROLE = { admin: "Administrátor", editor: "Editor", student: "Student" } as const;

export default async function ProfilePage() {
  const user = await requireUser();
  const p = user.profile;

  return (
    <>
      <PageHeader title="Můj profil" description="Jméno a avatar uvidí spolužáci u materiálů, které přidáš." />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="p-6 text-center">
          <UserAvatar name={p.display_name} path={p.avatar_path} className="mx-auto size-24 text-2xl" />
          <h2 className="mt-4 text-xl font-semibold text-ink">{p.display_name}</h2>
          <Badge tone="blue" className="mt-2">
            <ShieldCheck aria-hidden /> {ROLE[p.role]}
          </Badge>
          <dl className="mt-6 space-y-3 text-left text-sm">
            <div className="flex items-center gap-3 rounded-2xl bg-bg px-4 py-3">
              <Mail className="size-4 text-muted" aria-hidden />
              <div className="min-w-0">
                <dt className="text-muted">E-mail</dt>
                <dd className="truncate font-medium text-ink">{user.email}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-bg px-4 py-3">
              <CalendarDays className="size-4 text-muted" aria-hidden />
              <div>
                <dt className="text-muted">Registrace</dt>
                <dd className="font-medium text-ink">{formatTimestampDate(p.created_at)}</dd>
              </div>
            </div>
          </dl>
          <AvatarUpload userId={p.id} hasAvatar={!!p.avatar_path} />
        </Card>
        <div className="space-y-6">
          <ProfileForm displayName={p.display_name} />
        </div>
      </div>
    </>
  );
}
