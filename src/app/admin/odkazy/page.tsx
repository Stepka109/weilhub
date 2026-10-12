import { PageHeader } from "@/components/ui/misc";
import { getAdminLinks } from "@/lib/data/admin";
import { LinksManager } from "./links-manager";

export const metadata = { title: "Odkazy" };

export default async function AdminLinksPage() {
  const links = await getAdminLinks();
  return (
    <>
      <PageHeader title="Užitečné odkazy" description="Odkazy na školní systémy a další stránky. Pořadí lze měnit šipkami." />
      <LinksManager links={links} />
    </>
  );
}
