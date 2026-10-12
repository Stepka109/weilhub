import { PageHeader } from "@/components/ui/misc";
import { requireAdmin } from "@/lib/auth";
import { getAdminUsers, getInvitations } from "@/lib/data/admin";
import { UsersManager } from "./users-manager";

export const metadata = { title: "Uživatelé" };

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const [{ users, emailsAvailable }, invitations] = await Promise.all([getAdminUsers(), getInvitations()]);
  return (
    <>
      <PageHeader title="Uživatelé a role" description="Schvalování účtů, role a pozvánky do portálu." />
      <UsersManager users={users} invitations={invitations} meId={me.id} emailsAvailable={emailsAvailable} />
    </>
  );
}
