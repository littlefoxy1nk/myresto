"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Smartphone, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markConfirmationAsked } from "@/modules/reservations/server/confirmation";
import {
  buildMessageLinks,
  renderMessage,
  DEFAULT_TEMPLATES,
  KIND_LABEL,
  MESSAGE_VARIABLES,
  type MessageKind,
} from "@/modules/messaging/templates";

export type MessageRecipient = {
  id: string;
  customerName: string;
  partySize: number;
  time: string;
  phone: string | null;
  email: string | null;
  confirmationState: "none" | "asked" | "confirmed";
};

const STORAGE_KEY = (kind: MessageKind) => `myresto.message-template.${kind}`;

function loadTemplate(kind: MessageKind) {
  try {
    return window.localStorage.getItem(STORAGE_KEY(kind)) ?? DEFAULT_TEMPLATES[kind];
  } catch {
    return DEFAULT_TEMPLATES[kind];
  }
}

/// Prépare le message pour un ou plusieurs clients : modèle modifiable, destinataires cochables,
/// puis un bouton par canal (WhatsApp / SMS / email) qui ouvre le message déjà rédigé. L'envoi
/// reste un geste du responsable — aucun envoi automatique n'est branché.
export function MessageDialog({
  recipients,
  dateLabel,
  restaurantName,
  initialKind = "ask",
  onOpenChange,
}: {
  recipients: MessageRecipient[];
  dateLabel: string;
  restaurantName: string;
  initialKind?: MessageKind;
  onOpenChange: (open: boolean) => void;
}) {
  const [kind, setKind] = useState<MessageKind>(initialKind);
  const [template, setTemplate] = useState(() => loadTemplate(initialKind));
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        recipients
          .filter((r) => (r.phone || r.email) && (recipients.length === 1 || r.confirmationState === "none"))
          .map((r) => r.id)
      )
  );
  const [sent, setSent] = useState<Set<string>>(new Set());

  function selectKind(k: MessageKind) {
    setKind(k);
    setTemplate(loadTemplate(k));
  }

  function updateTemplate(value: string) {
    setTemplate(value);
    try {
      window.localStorage.setItem(STORAGE_KEY(kind), value);
    } catch {
      // le modèle modifié ne sera simplement pas mémorisé
    }
  }

  function textFor(r: MessageRecipient) {
    return renderMessage(template, {
      nom: r.customerName,
      personnes: r.partySize,
      heure: r.time,
      date: dateLabel,
      restaurant: restaurantName,
    });
  }

  const reachable = useMemo(() => recipients.filter((r) => r.phone || r.email), [recipients]);

  function markSent(r: MessageRecipient) {
    setSent((prev) => new Set(prev).add(r.id));
    if (kind === "ask") void markConfirmationAsked(r.id);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogTitle>Message aux clients</DialogTitle>
        <DialogDescription>
          Le message s&apos;ouvre déjà rédigé dans WhatsApp, SMS ou email : tu n&apos;as plus qu&apos;à envoyer.
        </DialogDescription>

        <div className="mt-4 flex gap-2" role="tablist">
          {(Object.keys(KIND_LABEL) as MessageKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => selectKind(k)}
              className={cn(
                "flex-1 rounded-xl border px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                kind === k ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
              )}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1.5">
          <label htmlFor="message-template" className="text-sm font-medium">
            Message (modifiable)
          </label>
          <textarea
            id="message-template"
            value={template}
            onChange={(e) => updateTemplate(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <p className="text-xs text-muted-foreground">
            Variables : {MESSAGE_VARIABLES.map((v) => `{${v}}`).join(" ")} ·{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => updateTemplate(DEFAULT_TEMPLATES[kind])}
            >
              rétablir le modèle
            </button>
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Destinataires ({[...selected].filter((id) => reachable.some((r) => r.id === id)).length}/{reachable.length})
            </p>
            {recipients.length > 1 && (
              <button
                type="button"
                className="text-xs text-accent underline-offset-2 hover:underline"
                onClick={() =>
                  setSelected(
                    selected.size >= reachable.length ? new Set() : new Set(reachable.map((r) => r.id))
                  )
                }
              >
                {selected.size >= reachable.length ? "Tout décocher" : "Tout cocher"}
              </button>
            )}
          </div>

          {recipients.map((r) => {
            const links = buildMessageLinks({
              phone: r.phone,
              email: r.email,
              text: textFor(r),
              subject: `Votre réservation — ${restaurantName}`,
            });
            const hasContact = !!(links.whatsapp || links.email);
            const isSelected = selected.has(r.id);
            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-xl border p-3",
                  isSelected && hasContact ? "border-accent/40 bg-accent-soft/20" : "border-border",
                  !hasContact && "opacity-60"
                )}
              >
                <div className="flex items-start gap-3">
                  {recipients.length > 1 && (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[var(--accent)]"
                      checked={isSelected && hasContact}
                      disabled={!hasContact}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(r.id);
                          else next.delete(r.id);
                          return next;
                        })
                      }
                      aria-label={`Envoyer à ${r.customerName}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium tabular-nums">{r.time}</span> · {r.customerName} · {r.partySize} pers.
                      {r.confirmationState === "confirmed" && <span className="ml-2 text-xs text-good">déjà confirmée</span>}
                      {r.confirmationState === "asked" && <span className="ml-2 text-xs text-important">déjà relancée</span>}
                    </p>
                    {!hasContact ? (
                      <p className="text-xs text-muted-foreground">Pas de téléphone ni d&apos;email enregistré.</p>
                    ) : (
                      isSelected && (
                        <>
                          <p className="mt-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">{textFor(r)}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {links.whatsapp && (
                              <ChannelLink href={links.whatsapp} onClick={() => markSent(r)} icon={<MessageCircle size={13} />} label="WhatsApp" external />
                            )}
                            {links.sms && (
                              <ChannelLink href={links.sms} onClick={() => markSent(r)} icon={<Smartphone size={13} />} label="SMS" />
                            )}
                            {links.email && (
                              <ChannelLink href={links.email} onClick={() => markSent(r)} icon={<Mail size={13} />} label="Email" />
                            )}
                            {sent.has(r.id) && <span className="text-xs text-good">Ouvert ✓</span>}
                          </div>
                        </>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Button variant="secondary" className="mt-4 w-full" onClick={() => onOpenChange(false)}>
          Fermer
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function ChannelLink({
  href,
  label,
  icon,
  external,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
  onClick: () => void;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-muted px-3 text-xs font-medium outline-none transition-colors hover:bg-border focus-visible:ring-2 focus-visible:ring-accent"
    >
      {icon}
      {label}
    </a>
  );
}
