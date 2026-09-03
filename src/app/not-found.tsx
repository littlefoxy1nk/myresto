import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Compass size={24} aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold">Page introuvable</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Cette page n&apos;existe pas ou plus.
      </p>
      <Button asChild className="mt-6">
        <Link href="/aujourdhui">Retour à l&apos;accueil</Link>
      </Button>
    </div>
  );
}
