import type { LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/nav/brand-mark";

/// L'écran partagé par la connexion et la création d'établissement : un panneau de marque à gauche
/// (caché sur téléphone), le formulaire à droite.
export function AuthShell({
  headline,
  points,
  children,
}: {
  headline: string;
  points: { icon: LucideIcon; text: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/50 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent-2/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <BrandMark name="M" className="h-11 w-11 text-lg" />
          <span className="text-lg font-bold tracking-tight">MYRESTO</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-tight">{headline}</h2>
          <ul className="mt-10 space-y-4 text-[15px] text-white/75">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                  <Icon size={18} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">Le copilote du restaurateur.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="page-in w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
