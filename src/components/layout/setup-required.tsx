import { Database, KeyRound, ShieldCheck, Upload } from "lucide-react";
import { Logo } from "@/components/brand/logo";

/**
 * Zobrazí se, dokud nejsou vyplněné proměnné prostředí Supabase.
 * Aplikace nepředstírá připojení – jasně říká, co je potřeba udělat.
 */
export function SetupRequired() {
  const steps = [
    { icon: Database, title: "Vytvořte projekt Supabase", text: "Na supabase.com založte nový projekt (region EU)." },
    {
      icon: ShieldCheck,
      title: "Spusťte migrace",
      text: "V SQL editoru spusťte soubory ze složky supabase/migrations (nebo `npx supabase db push`).",
    },
    {
      icon: KeyRound,
      title: "Doplňte .env.local",
      text: "Zkopírujte .env.example do .env.local a vyplňte URL a klíče projektu.",
    },
    {
      icon: Upload,
      title: "Založte prvního administrátora",
      text: "Zaregistrujte se a v SQL editoru zavolejte bootstrap_first_admin – postup je v README.",
    },
  ];
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-card border border-line bg-card p-6 shadow-card sm:p-10">
        <Logo />
        <h1 className="mt-8 text-2xl font-bold text-ink sm:text-3xl">Aplikace čeká na připojení databáze</h1>
        <p className="mt-2 text-muted">
          WeilHub zatím nemá nastavené připojení k Supabase. Bez něj nelze přihlásit ani načíst žádná data. Dokončete
          prosím tyto kroky:
        </p>
        <ol className="mt-8 space-y-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-2xl bg-bg p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-light-blue text-primary">
                <s.icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-ink">
                  {i + 1}. {s.title}
                </p>
                <p className="mt-0.5 text-sm text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-muted">
          Po doplnění proměnných restartujte vývojový server (<code className="rounded bg-slate-soft px-1.5 py-0.5">npm run dev</code>).
        </p>
      </div>
    </div>
  );
}
