import { connection } from "next/server";
import { AppShell } from "@/components/layout/app-shell";
import { SetupRequired } from "@/components/layout/setup-required";
import { requireUser } from "@/lib/auth";
import { getUnreadCount } from "@/lib/data/portal";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Vždy vykreslovat až při požadavku – konfigurace i relace se čtou za běhu
  await connection();
  if (!isSupabaseConfigured()) return <SetupRequired />;
  const user = await requireUser();
  const unread = await getUnreadCount(user.id);

  return (
    <AppShell
      user={{ name: user.profile.display_name, avatarPath: user.profile.avatar_path, role: user.profile.role }}
      unread={unread}
    >
      {children}
    </AppShell>
  );
}
