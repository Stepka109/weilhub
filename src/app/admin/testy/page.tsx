import { PageHeader } from "@/components/ui/misc";
import { getAdminExams, getAllSubjects, getMaterialOptions } from "@/lib/data/admin";
import { ExamsManager } from "./exams-manager";

export const metadata = { title: "Testy" };

export default async function AdminExamsPage({ searchParams }: PageProps<"/admin/testy">) {
  const [exams, subjects, materials, sp] = await Promise.all([getAdminExams(), getAllSubjects(), getMaterialOptions(), searchParams]);
  return (
    <>
      <PageHeader title="Správa testů" description="Změna data se okamžitě projeví v kalendáři i na studentském dashboardu." />
      <ExamsManager
        exams={exams}
        subjects={subjects.filter((s) => !s.is_archived).map((s) => ({ id: s.id, name: s.name }))}
        materials={materials}
        openNew={sp.novy === "1"}
      />
    </>
  );
}
