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
      <Card className="space-y-3 p-6 text-center">
        <CheckCircle2 size={28} className="mx-auto text-good" aria-hidden="true" />
        <p className="text-base font-semibold">Tu es désinscrit(e)</p>
        <p className="text-sm text-muted-foreground">{restaurantName} ne t&apos;enverra plus d&apos;infos par email.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-6 text-center">
      <p className="text-base font-semibold">Ne plus recevoir les infos de {restaurantName} ?</p>
      {error && (
        <p className="text-sm text-urgent" role="alert">
          {error}
        </p>
      )}
      <Button
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
