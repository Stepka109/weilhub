import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Ban, Hourglass, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";

export const metadata = { title: "Čeká se na schválení" };

/** Přihlášený, ale neschválený (nebo zablokovaný) uživatel – bez přístupu k datům. */
export default async function PendingPage() {
  await connection();
  const user = await getSessionUser();
  if (!user) redirect("/prihlaseni");
  if (user.profile?.status === "approved") redirect("/");
  const blocked = user.profile?.status === "blocked";

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md rounded-card border border-line bg-card p-8 text-center shadow-card">
        <Logo className="justify-center" />
        <div className={`mx-auto mt-8 grid size-16 place-items-center rounded-full ${blocked ? "bg-rose text-rose-ink" : "bg-yellow text-yellow-ink"}`}>
          {blocked ? <Ban className="size-7" aria-hidden /> : <Hourglass className="size-7" aria-hidden />}
        </div>
        <h1 className="mt-5 text-2xl font-bold text-ink">{blocked ? "Účet je zablokovaný" : "Účet čeká na schválení"}</h1>
        <p className="mt-2 text-muted">
          {blocked
            ? "Přístup k portálu byl pozastaven. Pokud jde o omyl, kontaktuj správce."
            : "Správce portálu tvůj účet brzy zkontroluje. Po schválení se ti zpřístupní všechny materiály."}
        </p>
        <form action={signOut} className="mt-8">
          <Button type="submit" variant="outline">
            <LogOut aria-hidden /> Odhlásit se
          </Button>
        </form>
      </div>
    </main>
  );
}
