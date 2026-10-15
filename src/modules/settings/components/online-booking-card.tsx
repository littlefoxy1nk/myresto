"use client";

import { useState, useSyncExternalStore } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { disableOnlineBooking, enableOnlineBooking } from "@/modules/booking/server/actions";

const noopSubscribe = () => () => {};

export function OnlineBookingCard({ slug, enabled }: { slug: string | null; enabled: boolean }) {
  const [pending, setPending] = useState(false);
  // Le serveur ne connaît pas l'adresse du site telle que vue par le navigateur : on la lit côté client
  // seulement (valeur vide au rendu serveur), sans écart d'hydratation.
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => ""
  );
  const url = slug ? `${origin}/reserver/${slug}` : null;

  async function toggle() {
    setPending(true);
    try {
      if (enabled) {
        await disableOnlineBooking();
        toast("Réservation en ligne désactivée");
      } else {
        await enableOnlineBooking();
        toast("Réservation en ligne activée");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {enabled && url && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-sm">{url}</code>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                toast("Lien copié");
              } catch {
                toast("Copie impossible : sélectionne le lien à la main.", "error");
              }
            }}
          >
            <Copy size={14} aria-hidden="true" />
            Copier
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir la page de réservation">
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </Button>
        </div>
      )}
      <Button size="sm" variant={enabled ? "outline" : "primary"} onClick={toggle} disabled={pending}>
        {pending ? "…" : enabled ? "Désactiver le lien" : "Activer le lien de réservation"}
      </Button>
    </div>
  );
}
