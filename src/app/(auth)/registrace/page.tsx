import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Registrace" };

export default async function RegisterPage({ searchParams }: PageProps<"/registrace">) {
  if (await getSessionUser()) redirect("/");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("app_settings")
    .select("registration_enabled, registration_requires_invite, class_label")
    .single();

  const enabled = settings?.registration_enabled ?? false;
  const requiresInvite = settings?.registration_requires_invite ?? true;

  return (
    <>
      <h1 className="text-3xl font-bold text-ink">Vytvořit účet</h1>
      <p className="mt-2 text-muted">
        {requiresInvite
          ? "Registrace je možná pouze s kódem pozvánky od správce portálu."
          : "Po registraci tvůj účet schválí správce portálu."}
      </p>
      {!enabled && !requiresInvite ? (
        <p className="mt-8 rounded-2xl bg-yellow px-4 py-3 text-sm text-yellow-ink" role="status">
          Registrace jsou momentálně vypnuté. Pokud máš pozvánku, kontaktuj správce portálu.
        </p>
      ) : (
        <RegisterForm
          requiresInvite={requiresInvite || !enabled}
          defaultCode={typeof sp.pozvanka === "string" ? sp.pozvanka : ""}
        />
      )}
      <p className="mt-8 text-center text-sm text-muted">
        Už máš účet?{" "}
        <Link href="/prihlaseni" className="font-medium text-primary hover:underline">
          Přihlas se
        </Link>
      </p>
    </>
  );
}
