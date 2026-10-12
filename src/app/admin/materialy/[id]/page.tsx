import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/admin/common";
import { getAdminMaterial, getAllSubjects } from "@/lib/data/admin";
import { getSettings } from "@/lib/data/portal";
import { MaterialForm } from "./material-form";

export const metadata = { title: "Materiál" };

export default async function AdminMaterialPage({ params, searchParams }: PageProps<"/admin/materialy/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const isNew = id === "novy";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [material, subjects, settings] = await Promise.all([
    isNew ? Promise.resolve(null) : getAdminMaterial(id),
    getAllSubjects(),
    getSettings(),
  ]);
  if (!isNew && !material) notFound();

  return (
    <>
      <PageHeader
        back={{ href: "/admin/materialy", label: "Materiály" }}
        title={isNew ? "Nový materiál" : material!.title}
        eyebrow={material ? <StatusBadge status={material.status} /> : undefined}
      />
      <MaterialForm
        material={material}
        subjects={subjects.filter((s) => !s.is_archived || s.id === material?.subject_id)}
        allowedTypes={settings?.allowed_file_types ?? ["pdf"]}
        maxMb={settings?.max_upload_mb ?? 25}
        defaultSubject={typeof sp.predmet === "string" ? sp.predmet : undefined}
      />
    </>
  );
}
