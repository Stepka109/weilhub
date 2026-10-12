import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Přihlášení" };

export default async function LoginPage({ searchParams }: PageProps<"/prihlaseni">) {
  const user = await getSessionUser();
  if (user) redirect("/");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const confirmed = sp.potvrzeno === "1";
  const linkError = sp.chyba === "odkaz";

  return (
    <>
      <h1 className="text-3xl font-bold text-ink">Vítej zpět</h1>
      <p className="mt-2 text-muted">Přihlas se ke svému účtu WeilHub.</p>
      {confirmed && (
        <p className="mt-6 rounded-2xl bg-mint px-4 py-3 text-sm text-mint-ink" role="status">
          E-mail byl potvrzen. Nyní se můžeš přihlásit.
        </p>
      )}
      {linkError && (
        <p className="mt-6 rounded-2xl bg-rose px-4 py-3 text-sm text-rose-ink" role="alert">
          Odkaz je neplatný nebo vypršel. Zkus to prosím znovu.
        </p>
      )}
      <LoginForm next={next} />
      <p className="mt-8 text-center text-sm text-muted">
        Nemáš účet?{" "}
        <Link href="/registrace" className="font-medium text-primary hover:underline">
          Zaregistruj se pozvánkou
        </Link>
      </p>
    </>
  );
}
