import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { getAdminMaterials, getAllSubjects } from "@/lib/data/admin";
import { MaterialsTable } from "./materials-table";

export const metadata = { title: "Materiály" };

export default async function AdminMaterialsPage() {
  const [materials, subjects] = await Promise.all([getAdminMaterials(), getAllSubjects()]);
  return (
    <>
      <PageHeader
        title="Správa materiálů"
        description="Zápisy a soubory – koncepty, publikované i archivované."
        actions={
          <Button asChild>
            <Link href="/admin/materialy/novy">
              <Plus /> Nový materiál
            </Link>
          </Button>
        }
      />
      <MaterialsTable materials={materials} subjects={subjects.map((s) => ({ id: s.id, name: s.name }))} />
    </>
  );
}
