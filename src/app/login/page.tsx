import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

async function authenticate(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=1&email=${encodeURIComponent(email)}`);
    }
    throw error;
  }
  redirect("/aujourdhui");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const { error, email } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-accent-foreground">
            M
          </div>
          <h1 className="text-xl font-semibold">Bon retour</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connectez-vous pour retrouver votre établissement.
          </p>
        </div>

        <form action={authenticate} className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {error && (
            <p role="alert" className="rounded-lg bg-urgent-soft px-3 py-2 text-sm text-urgent">
              Email ou mot de passe incorrect.
            </p>
          )}
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              required
              autoFocus={!error}
              defaultValue={email ?? ""}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-sm font-medium">
              Mot de passe
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              required
              autoFocus={!!error}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <Button type="submit" className="w-full" size="lg">
            Se connecter
          </Button>
        </form>
      </div>
    </div>
  );
}
