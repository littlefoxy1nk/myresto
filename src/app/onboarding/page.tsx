import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, LayoutGrid, Lock, Users } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { signupPolicy } from "@/lib/signup-policy";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";

export const metadata: Metadata = { title: "Créer mon établissement" };

export default function OnboardingPage() {
  const policy = signupPolicy();

  if (!policy.open) {
    return (
      <AuthShell
        headline="MYRESTO s'ouvre petit à petit."
        points={[
          { icon: LayoutGrid, text: "Un plan de salle simple à lire en plein service" },
          { icon: CalendarClock, text: "Des réservations en ligne et par téléphone" },
          { icon: Users, text: "Un planning clair pour toute l'équipe" },
        ]}
      >
        <div className="rounded-3xl border border-border/70 bg-card p-8 text-center shadow-pop">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Lock size={24} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Inscriptions sur invitation</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            La création d&apos;un établissement est ouverte uniquement aux restaurateurs invités. Contacte-nous pour recevoir ton code.
          </p>
          <Button asChild className="mt-6" variant="secondary">
            <Link href="/login">Se connecter</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return <OnboardingForm requiresCode={policy.requiresCode} />;
}
