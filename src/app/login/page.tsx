import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import Link from "next/link";
import { CalendarClock, CalendarDays, LayoutGrid, Lock, User } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { PasswordInput } from "@/components/ui/password-input";
import { BrandMark } from "@/components/nav/brand-mark";
import { AuthShell } from "@/components/auth/auth-shell";

async function authenticate(formData: FormData) {
  "use server";
  const identifier = String(formData.get("identifier") ?? "");
  try {
    await signIn("credentials", {
      identifier,
      secret: formData.get("secret"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=1&identifier=${encodeURIComponent(identifier)}`);
    }
    throw error;
  }
  redirect("/aujourdhui");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; identifier?: string }>;
}) {
  const { error, identifier } = await searchParams;

  return (
    <AuthShell
      headline="Votre salle, votre équipe, votre service. Au même endroit."
      points={[
        { icon: CalendarClock, text: "Les réservations, en ligne ou par téléphone" },
        { icon: LayoutGrid, text: "Le plan de salle, simple à lire en plein service" },
        { icon: CalendarDays, text: "Le planning de l'équipe, clair pour tout le monde" },
      ]}
    >
      <div className="mb-8 text-center lg:text-left">
        <BrandMark name="M" className="mb-4 inline-flex h-12 w-12 text-xl lg:hidden" />
        <h1 className="text-3xl font-bold tracking-tight">Bon retour</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Connectez-vous pour retrouver votre établissement.</p>
      </div>

      <form action={authenticate} className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-pop">
        {error && (
          <p role="alert" className="rounded-2xl bg-urgent-soft px-3.5 py-2.5 text-sm font-medium text-urgent">
            Identifiant ou mot de passe incorrect.
          </p>
        )}
        <div className="space-y-1.5">
          <label htmlFor="login-identifier" className="text-sm font-semibold">
            Email ou identifiant
          </label>
          <div className="relative">
            <User size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="login-identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              required
              autoFocus={!error}
              defaultValue={identifier ?? ""}
              className="w-full rounded-2xl border border-border bg-card/80 py-3 pl-11 pr-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="login-secret" className="text-sm font-semibold">
            Mot de passe ou code
          </label>
          <div className="relative">
            <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <PasswordInput id="login-secret" name="secret" autoComplete="current-password" required autoFocus={!!error} className="w-full rounded-2xl border border-border bg-card/80 py-3 pl-11 pr-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15" />
          </div>
        </div>
        <SubmitButton className="w-full" size="lg" pendingLabel="Connexion…">
          Se connecter
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground lg:text-left">
        Pas encore d&apos;établissement sur MYRESTO ?{" "}
        <Link href="/onboarding" className="font-semibold text-accent underline-offset-4 hover:underline">
          Créer le mien
        </Link>
      </p>
    </AuthShell>
  );
}
