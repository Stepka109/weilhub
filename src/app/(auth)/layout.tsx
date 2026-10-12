import { connection } from "next/server";
import { BookOpen, CalendarDays, ClipboardCheck, GraduationCap } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SetupRequired } from "@/components/layout/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Vždy vykreslovat až při požadavku – konfigurace i relace se čtou za běhu
  await connection();
  if (!isSupabaseConfigured()) return <SetupRequired />;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(480px,560px)]">
      {/* Ilustrační panel */}
      <div className="relative hidden overflow-hidden bg-light-blue/60 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(47,104,255,0.14),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div className="max-w-md">
            <h2 className="text-4xl leading-tight font-bold text-ink">Všechno důležité ke studiu na jednom místě.</h2>
            <p className="mt-4 text-lg text-slate-ink">
              Zápisy, materiály, úkoly, testy i rozvrh – přehledně pro celou třídu.
            </p>
            <ul className="mt-10 grid grid-cols-2 gap-3">
              {[
                { icon: BookOpen, label: "Studijní materiály", tone: "bg-card text-primary" },
                { icon: ClipboardCheck, label: "Domácí úkoly", tone: "bg-mint text-mint-ink" },
                { icon: CalendarDays, label: "Rozvrh hodin", tone: "bg-yellow text-yellow-ink" },
                { icon: GraduationCap, label: "Testy a písemky", tone: "bg-lavender text-lavender-ink" },
              ].map((f) => (
                <li key={f.label} className="flex items-center gap-3 rounded-2xl bg-card/80 p-3 shadow-card">
                  <span className={`grid size-10 place-items-center rounded-xl ${f.tone}`}>
                    <f.icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-medium text-ink">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-slate-ink">Neoficiální studentský portál.</p>
        </div>
      </div>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
