"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildMailtoLink,
  DEFAULT_WELCOME_BODY,
  DEFAULT_WELCOME_SUBJECT,
  MAIL_VARIABLES,
  renderMail,
  reviewBlock,
} from "@/modules/newsletter/mail";
import { markWelcomeMailSent } from "@/modules/newsletter/server/actions";
import type { NewsletterRecipient } from "@/modules/newsletter/server/queries";

const BODY_KEY = "myresto.welcome-mail.body";
const SUBJECT_KEY = "myresto.welcome-mail.subject";

function load(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // le texte modifié ne sera simplement pas mémorisé
  }
}

/// Premier mail aux clients abonnés : demande de date d'anniversaire et de GSM + liens d'avis.
/// Le mail s'ouvre déjà rédigé dans la messagerie du responsable, qui appuie sur envoyer —
/// aucun envoi automatique n'est branché.
export function WelcomeMailDialog({
  recipients,
  restaurantName,
  googleUrl,
  tripadvisorUrl,
  onOpenChange,
}: {
  recipients: NewsletterRecipient[];
  restaurantName: string;
  googleUrl: string | null;
  tripadvisorUrl: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [subject, setSubject] = useState(() => load(SUBJECT_KEY, DEFAULT_WELCOME_SUBJECT));
  const [body, setBody] = useState(() => load(BODY_KEY, DEFAULT_WELCOME_BODY));
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(recipients.filter((r) => !r.welcomeMailSent).map((r) => r.id))
  );
  const [opened, setOpened] = useState<Set<string>>(new Set());

  const noReviewLink = !googleUrl && !tripadvisorUrl;

  function render(template: string, r: NewsletterRecipient) {
    return renderMail(template, {
      prenom: r.firstName,
      nom: r.lastName,
      restaurant: restaurantName,
      avis: reviewBlock({ google: googleUrl, tripadvisor: tripadvisorUrl }),
      desinscription: `${window.location.origin}/desinscription/${r.unsubscribeToken}`,
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogTitle>Premier mail aux abonnés</DialogTitle>
        <DialogDescription>
          Chaque mail s&apos;ouvre déjà rédigé dans ta messagerie : tu n&apos;as plus qu&apos;à envoyer.
        </DialogDescription>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="mail-subject" className="text-sm font-medium">
              Objet
            </label>
            <input
              id="mail-subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                save(SUBJECT_KEY, e.target.value);
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="mail-body" className="text-sm font-medium">
              Message (modifiable)
            </label>
            <textarea
              id="mail-body"
              value={body}
              rows={11}
              onChange={(e) => {
                setBody(e.target.value);
                save(BODY_KEY, e.target.value);
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <p className="text-xs text-muted-foreground">
              Variables : {MAIL_VARIABLES.map((v) => `{${v}}`).join(" ")} ·{" "}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => {
                  setSubject(DEFAULT_WELCOME_SUBJECT);
                  setBody(DEFAULT_WELCOME_BODY);
                  save(SUBJECT_KEY, DEFAULT_WELCOME_SUBJECT);
                  save(BODY_KEY, DEFAULT_WELCOME_BODY);
                }}
              >
                rétablir le modèle
              </button>
            </p>
            {noReviewLink && (
              <p className="rounded-lg bg-important-soft px-3 py-2 text-xs text-important">
                Aucun lien d&apos;avis enregistré : le passage « avis » sera vide. Ajoute-les dans Paramètres → Avis clients.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">
            Destinataires ({[...selected].length}/{recipients.length})
          </p>
          {recipients.length === 0 && (
            <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              Aucun abonné pour le moment : ils apparaissent quand un client coche la case à la réservation en ligne.
            </p>
          )}
          {recipients.map((r) => {
            const isSelected = selected.has(r.id);
            return (
              <div
                key={r.id}
                className={cn("rounded-xl border p-3", isSelected ? "border-accent/40 bg-accent-soft/20" : "border-border")}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                    checked={isSelected}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(r.id);
                        else next.delete(r.id);
                        return next;
                      })
                    }
                    aria-label={`Écrire à ${r.firstName} ${r.lastName}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">
                        {r.firstName} {r.lastName}
                      </span>{" "}
                      <span className="text-muted-foreground">· {r.email}</span>
                      {r.welcomeMailSent && <span className="ml-2 text-xs text-good">déjà écrit</span>}
                    </p>
                    {isSelected && (
                      <div className="mt-2 flex items-center gap-2">
                        <a
                          href={buildMailtoLink({ to: r.email, subject: render(subject, r), body: render(body, r) })}
                          onClick={() => {
                            setOpened((prev) => new Set(prev).add(r.id));
                            void markWelcomeMailSent(r.id);
                          }}
                          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-muted px-3 text-xs font-medium outline-none transition-colors hover:bg-border focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Mail size={13} aria-hidden="true" />
                          Ouvrir dans ma messagerie
                        </a>
                        {opened.has(r.id) && <span className="text-xs text-good">Ouvert ✓</span>}
                      </div>
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
