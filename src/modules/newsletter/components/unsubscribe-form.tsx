"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { unsubscribeByToken } from "@/modules/newsletter/server/actions";

/// Le désabonnement demande un clic (pas d'effet à la simple ouverture du lien : les antivirus
/// et messageries ouvrent les liens des mails automatiquement).
export function UnsubscribeForm({
  token,
  restaurantName,
  alreadyUnsubscribed,
}: {
  token: string;
  restaurantName: string;
  alreadyUnsubscribed: boolean;
}) {
  const [done, setDone] = useState(alreadyUnsubscribed);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <Card className="page-in space-y-3 p-8 text-center shadow-pop">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-good">
          <CheckCircle2 size={28} aria-hidden="true" />
        </span>
        <p className="text-xl font-bold tracking-tight">Tu es désinscrit(e)</p>
        <p className="text-sm text-muted-foreground">{restaurantName} ne t&apos;enverra plus d&apos;infos par email.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-8 text-center shadow-pop">
      <p className="text-xl font-bold tracking-tight">Ne plus recevoir les infos de {restaurantName} ?</p>
      <p className="text-sm text-muted-foreground">Un clic suffit : tu pourras te réinscrire en réservant à nouveau.</p>
      {error && (
        <p className="text-sm text-urgent" role="alert">
          {error}
        </p>
      )}
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const res = await unsubscribeByToken(token);
            if (res.ok) setDone(true);
            else setError("Ce lien n'est plus valide.");
          } catch {
            setError("Une erreur est survenue, réessaie dans un instant.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "…" : "Me désinscrire"}
      </Button>
    </Card>
  );
}
