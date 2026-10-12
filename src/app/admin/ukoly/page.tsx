import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { getAdminAssignments } from "@/lib/data/admin";
import { AssignmentsTable } from "./assignments-table";

export const metadata = { title: "Úkoly" };

export default async function AdminAssignmentsPage() {
  const assignments = await getAdminAssignments();
  return (
    <>
      <PageHeader
        title="Správa úkolů"
        description="Termíny se automaticky propíšou na dashboard, do přehledu úkolů i do kalendáře."
        actions={
          <Button asChild>
            <Link href="/admin/ukoly/novy">
              <Plus /> Nový úkol
            </Link>
          </Button>
        }
      />
      <AssignmentsTable assignments={assignments} />
    </>
  );
}
