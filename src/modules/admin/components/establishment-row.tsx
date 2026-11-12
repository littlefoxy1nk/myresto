"use client";

import { useState, useTransition } from "react";
import { KeyRound, LifeBuoy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { enterAssistance, resendOwnerInvite, type InviteResult } from "@/modules/admin/server/actions";
import { InviteLinkCard } from "@/modules/admin/components/invite-link-card";
import type { AdminEstablishment } from "@/modules/admin/server/queries";

const TYPE_LABEL: Record<string, string> = { restaurant: "Restaurant", bar: "Bar", brasserie: "Brasserie", cafe: "Café" };

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function EstablishmentRow({ establishment: e }: { establishment: AdminEstablishment }) {
  const [pending, startTransition] = useTransition();
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold tracking-tight">
            {e.name}
            <Badge variant="neutral">{TYPE_LABEL[e.type] ?? e.type}</Badge>
            {e.isDemo && <Badge variant="accent">Démo</Badge>}
            {e.ownerPending && <Badge variant="important">Invitation en attente</Badge>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {e.ownerName ?? "Pas de propriétaire"}
            {e.ownerEmail ? ` · ${e.ownerEmail}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Créé le {formatDate(e.createdAt)} · {e.members} membre{e.members > 1 ? "s" : ""} · {e.reservationsLast30Days} réservation
            {e.reservationsLast30Days > 1 ? "s" : ""} sur 30 jours · réservation en ligne {e.onlineBookingEnabled ? "activée" : "désactivée"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {e.ownerPending && (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await resendOwnerInvite(e.id);
                  if ("error" in result) setError(result.error);
                  else setInvite(result);
                })
              }
            >
              <KeyRound size={14} aria-hidden="true" />
              Nouveau lien
            </Button>
          )}
          <form action={enterAssistance.bind(null, e.id)}>
            <Button type="submit" size="sm">
              <LifeBuoy size={14} aria-hidden="true" />
              Ouvrir en assistance
            </Button>
          </form>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-urgent-soft px-3.5 py-2 text-sm font-medium text-urgent">
          {error}
        </p>
      )}
      {invite && (
        <div className="mt-4">
          <InviteLinkCard invite={invite} onClose={() => setInvite(null)} />
        </div>
      )}
    </li>
  );
}
