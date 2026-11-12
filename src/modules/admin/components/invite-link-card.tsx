"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InviteResult } from "@/modules/admin/server/actions";

/// Le lien à transmettre au patron : il y choisit lui-même son mot de passe. Copier, ou l'envoyer par WhatsApp / email.
export function InviteLinkCard({ invite, onClose }: { invite: InviteResult; onClose?: () => void }) {
  const [copied, setCopied] = useState(false);
  const message = `Bonjour ${invite.ownerName.split(" ")[0]}, ton espace MYRESTO pour ${invite.establishmentName} est prêt. Choisis ton mot de passe ici (lien valable 7 jours) : ${invite.link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Le lien reste sélectionnable à la main.
    }
  }

  return (
    <div className="rounded-3xl border border-good/40 bg-good-soft/50 p-5" role="status">
      <p className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-good">
        <Check size={17} aria-hidden="true" />
        {invite.establishmentName} : l&apos;espace de {invite.ownerName} est prêt
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {invite.emailed ? `Un email avec ce lien est parti à ${invite.ownerEmail}. ` : `Aucun email n'est parti (envoi non configuré). `}
        Tu peux aussi lui transmettre ce lien toi-même : il y choisit son mot de passe (valable 7 jours, un seul usage).
      </p>
      <input
        readOnly
        value={invite.link}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Lien d'invitation"
        className="mt-3 w-full rounded-2xl border border-border bg-card px-4 py-2.5 font-mono text-xs outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={copy}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "Copié" : "Copier le lien"}
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={14} aria-hidden="true" />
            WhatsApp
          </a>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <a href={`mailto:${invite.ownerEmail}?subject=${encodeURIComponent("Ton espace MYRESTO")}&body=${encodeURIComponent(message)}`}>
            <Mail size={14} aria-hidden="true" />
            Email
          </a>
        </Button>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        )}
      </div>
    </div>
  );
}
