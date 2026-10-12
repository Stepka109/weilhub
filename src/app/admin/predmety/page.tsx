import { PageHeader } from "@/components/ui/misc";
import { getAllSubjects } from "@/lib/data/admin";
import { SubjectsManager } from "./subjects-manager";

export const metadata = { title: "Předměty" };

export default async function AdminSubjectsPage({ searchParams }: PageProps<"/admin/predmety">) {
  const [subjects, sp] = await Promise.all([getAllSubjects(), searchParams]);
  return (
    <>
      <PageHeader title="Správa předmětů" description="Předměty, jejich pořadí, barvy, ikonky a tematické okruhy." />
      <SubjectsManager subjects={subjects} openNew={sp.novy === "1"} />
    </>
  );
}
