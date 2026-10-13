"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    label: "Création",
    items: [
      { href: "/marketing/ligne-editoriale", label: "Ligne éditoriale" },
      { href: "/marketing/sujet", label: "Traitement de sujet" },
    ],
  },
  {
    label: "Publication",
    items: [
      { href: "/marketing/en-attente", label: "En attente" },
      { href: "/marketing/publie", label: "Publié" },
      { href: "/marketing/statistiques", label: "Statistiques" },
    ],
  },
] as const;

/// Les deux rubriques de Communication dans un seul onglet de la barre de navigation : Création
/// (comment on écrit) et Publication (ce qui part, ce qui est parti, ce que ça donne).
export function CommunicationNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Communication" className="space-y-2 rounded-2xl border border-border bg-card p-3">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <p className="w-24 shrink-0 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                    active ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                  )}
                >
                  {item.label}
                  {item.href === "/marketing/en-attente" && pendingCount > 0 && (
                    <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">{pendingCount}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
