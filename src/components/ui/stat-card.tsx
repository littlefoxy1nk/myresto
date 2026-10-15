import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

const TONES = {
  accent: "bg-accent-soft text-accent",
  salle: "bg-salle-soft text-salle",
  cuisine: "bg-cuisine-soft text-cuisine",
  bar: "bg-bar-soft text-bar",
  direction: "bg-direction-soft text-direction",
} as const;

/// Un chiffre clé : pastille d'icône colorée, libellé, valeur en grand.
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "accent",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  hint?: string;
}) {
  return (
    <Card className="p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop sm:p-5">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-2xl", TONES[tone])} aria-hidden="true">
        <Icon size={18} />
      </span>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
