import Link from "next/link";
import { House, SearchX } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <Logo className="justify-center" />
        <div className="mx-auto mt-10 grid size-20 place-items-center rounded-full bg-light-blue text-primary">
          <SearchX className="size-9" aria-hidden />
        </div>
        <p className="mt-6 font-display text-6xl font-extrabold text-primary">404</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Stránka nebyla nalezena</h1>
        <p className="mt-2 text-muted">
          Odkaz je možná neplatný, nebo obsah ještě nebyl zveřejněn či k němu nemáte přístup.
        </p>
        <Button asChild className="mt-8">
          <Link href="/">
            <House /> Zpět na úvod
          </Link>
        </Button>
      </div>
    </main>
  );
}
