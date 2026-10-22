import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/admin/common";
import { getAdminAssignment, getAllSubjects, getMaterialOptions } from "@/lib/data/admin";
import { getSettings } from "@/lib/data/portal";
import { AssignmentForm } from "./assignment-form";

export const metadata = { title: "Úkol" };

export default async function AdminAssignmentPage({ params }: PageProps<"/admin/ukoly/[id]">) {
  const { id } = await params;
  const isNew = id === "novy";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [assignment, subjects, materials, settings] = await Promise.all([
    isNew ? Promise.resolve(null) : getAdminAssignment(id),
    getAllSubjects(),
    getMaterialOptions(),
    getSettings(),
  ]);
  if (!isNew && !assignment) notFound();

  return (
    <>
      <PageHeader
        back={{ href: "/admin/ukoly", label: "Úkoly" }}
        title={assignment?.title ?? "Nový úkol"}
        eyebrow={assignment ? <StatusBadge status={assignment.status} /> : undefined}
      />
      <AssignmentForm
        assignment={assignment}
        subjects={subjects.filter((s) => !s.is_archived || s.id === assignment?.subject_id).map((s) => ({ id: s.id, name: s.name, has_groups: s.has_groups }))}
        materials={materials}
        allowedTypes={settings?.allowed_file_types ?? ["pdf"]}
        maxMb={settings?.max_upload_mb ?? 25}
      />
    </>
  );
}
