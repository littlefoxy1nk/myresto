import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CalendarDays, LayoutGrid, LinkIcon } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { hashResetToken, isResetTokenUsable } from "@/modules/settings/password-reset";
import { ResetForm } from "@/app/reinitialiser/[token]/reset-form";

export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = /^[a-f0-9]{64}$/.test(token) ? await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) } }) : null;
  const valid = !!row && isResetTokenUsable(row, new Date());

  return (
    <AuthShell
      headline="Un nouveau départ, en toute sécurité."
      points={[
        { icon: CalendarClock, text: "Ce lien ne sert qu'une seule fois" },
        { icon: LayoutGrid, text: "Tes appareils déjà connectés seront déconnectés" },
        { icon: CalendarDays, text: "Tu retrouves ton établissement juste après" },
      ]}
    >
      {valid ? (
        <>
          <div className="mb-7">
            <h1 className="text-3xl font-bold tracking-tight">Nouveau mot de passe</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Choisis-en un que tu n&apos;utilises nulle part ailleurs.</p>
          </div>
          <ResetForm token={token} />
        </>
      ) : (
        <div className="rounded-3xl border border-border/70 bg-card p-8 text-center shadow-pop">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-urgent-soft text-urgent">
            <LinkIcon size={24} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Ce lien n&apos;est plus valable</h1>
          <p className="mt-2 text-sm text-muted-foreground">Il a expiré ou a déjà servi. Refais une demande, ça prend dix secondes.</p>
          <Button asChild className="mt-6">
            <Link href="/mot-de-passe-oublie">Recevoir un nouveau lien</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
