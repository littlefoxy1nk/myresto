"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-urgent-soft text-urgent">
        <AlertTriangle size={24} aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Une erreur est survenue</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Quelque chose s&apos;est mal passé de notre côté. Vous pouvez réessayer, ou revenir à
        l&apos;accueil si le problème persiste.
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" onClick={() => reset()}>
          Réessayer
        </Button>
        <Button asChild>
          <Link href="/aujourdhui">Retour à l&apos;accueil</Link>
        </Button>
      </div>
    </div>
  );
}
