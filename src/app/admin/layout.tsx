import { connection } from "next/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { SetupRequired } from "@/components/layout/setup-required";
import { requireStaff } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: { default: "Administrace", template: "%s · Administrace WeilHub" } };

/** Přístup do administrace ověřuje server (role) i databáze (RLS). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Vždy vykreslovat až při požadavku – konfigurace i relace se čtou za běhu
  await connection();
  if (!isSupabaseConfigured()) return <SetupRequired />;
  const user = await requireStaff();
  return (
    <AdminShell user={{ name: user.profile.display_name, avatarPath: user.profile.avatar_path, role: user.profile.role }}>
      {children}
    </AdminShell>
  );
}
