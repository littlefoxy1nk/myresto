import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CalendarDays, LayoutGrid } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "@/app/mot-de-passe-oublie/forgot-form";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      headline="Pas de panique, ça arrive à tout le monde."
      points={[
        { icon: CalendarClock, text: "Un lien t'est envoyé par email" },
        { icon: LayoutGrid, text: "Il est valable une heure et ne sert qu'une fois" },
        { icon: CalendarDays, text: "Tu choisis un nouveau mot de passe, et c'est reparti" },
      ]}
    >
      <div className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight">Mot de passe oublié</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Indique ton adresse email, on t&apos;envoie un lien pour en choisir un nouveau.</p>
      </div>
      <ForgotForm />
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-accent underline-offset-4 hover:underline">
          ← Retour à la connexion
        </Link>
      </p>
      <p className="mt-3 text-xs text-muted-foreground">Tu es employé et tu as perdu ton code ? Demande-en un nouveau à ton responsable.</p>
    </AuthShell>
  );
}
