"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { cn } from "@/lib/utils";
import { charStatus, composePostText, parseHashtags } from "@/modules/marketing/compose";
import { createPost } from "@/modules/marketing/server/actions";
import { MARKETING_CHANNELS, MARKETING_CHANNEL_LABELS } from "@/modules/marketing/types";
import type { EditorialLineItem, MarketingChannel } from "@/modules/marketing/types";

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";

const pill = (active: boolean) =>
  cn(
    "rounded-xl border px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
    active ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
  );

/// "Traitement de sujet" : on part d'un sujet et on écrit la publication en trois blocs (accroche, message,
/// appel à l'action). Le texte final n'est que l'assemblage de ce qui est tapé + les hashtags de la ligne
/// éditoriale — rien n'est généré. On l'enregistre dans « En attente ».
export function SubjectWorkshop({ lines }: { lines: EditorialLineItem[] }) {
  const router = useRouter();
  const [lineId, setLineId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [channel, setChannel] = useState<MarketingChannel>("instagram");
  const [hook, setHook] = useState("");
  const [message, setMessage] = useState("");
  const [cta, setCta] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [mediaNote, setMediaNote] = useState("");
  const [date, setDate] = useState(() => format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [time, setTime] = useState("18:00");
  const [status, setStatus] = useState<"draft" | "scheduled">("draft");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const line = lines.find((l) => l.id === lineId) ?? null;
  const finalText = useMemo(
    () => composePostText({ hook, message, cta, hashtags: parseHashtags(hashtags) }),
    [hook, message, cta, hashtags]
  );
  const status_ = charStatus(finalText, channel);
  const valid = subject.trim().length > 0 && finalText.trim().length > 0 && !!date && !!time;

  function chooseLine(id: string) {
    setLineId(id);
    const next = lines.find((l) => l.id === id);
    if (next) setHashtags(parseHashtags(next.hashtags).join(" "));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(finalText);
      toast("Texte copié");
    } catch {
      toast("Copie impossible : sélectionne le texte à la main.", "error");
    }
  }

  async function save() {
    if (!valid) return;
    setPending(true);
    setError(null);
    try {
      await createPost({
        title: subject.trim(),
        content: finalText,
        mediaNote: mediaNote.trim() || undefined,
        channel,
        scheduledDate: date,
        scheduledTime: time,
        status,
        subject: subject.trim(),
        editorialLineId: lineId || undefined,
      });
      toast("Ajoutée aux publications en attente");
      router.push("/marketing/en-attente");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Card className="space-y-4 p-5">
        <div className="space-y-1.5">
          <label htmlFor="ws-subject" className="text-sm font-medium">
            Sujet
          </label>
          <input
            id="ws-subject"
            value={subject}
            maxLength={120}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="ex : plat du jour — risotto aux cèpes"
            className={field}
            autoFocus
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="ws-line" className="text-sm font-medium">
              Ligne éditoriale
            </label>
            <select id="ws-line" value={lineId} onChange={(e) => chooseLine(e.target.value)} className={field}>
              <option value="">Aucune</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Réseau</span>
            <div className="grid grid-cols-2 gap-1.5">
              {MARKETING_CHANNELS.map((c) => (
                <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)} className={pill(channel === c)}>
                  {MARKETING_CHANNEL_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ws-hook" className="text-sm font-medium">
            1. L&apos;accroche
          </label>
          <input id="ws-hook" value={hook} onChange={(e) => setHook(e.target.value)} placeholder="La phrase qui donne envie de lire la suite" className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ws-message" className="text-sm font-medium">
            2. Le message
          </label>
          <textarea id="ws-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ce que tu veux dire sur le sujet" className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ws-cta" className="text-sm font-medium">
            3. L&apos;appel à l&apos;action
          </label>
          <input id="ws-cta" value={cta} onChange={(e) => setCta(e.target.value)} placeholder="ex : Réserve ta table via le lien en bio" className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ws-hashtags" className="text-sm font-medium">
            Hashtags et mentions
          </label>
          <input id="ws-hashtags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#resto #bruxelles" className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ws-media" className="text-sm font-medium">
            Visuel prévu (facultatif)
          </label>
          <input id="ws-media" value={mediaNote} onChange={(e) => setMediaNote(e.target.value)} placeholder="ex : photo du plat sur la table du fond" className={field} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="ws-date" className="text-sm font-medium">
              Date prévue
            </label>
            <input id="ws-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ws-time" className="text-sm font-medium">
              Heure
            </label>
            <input id="ws-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Statut</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" aria-pressed={status === "draft"} onClick={() => setStatus("draft")} className={pill(status === "draft")}>
                Brouillon
              </button>
              <button type="button" aria-pressed={status === "scheduled"} onClick={() => setStatus("scheduled")} className={pill(status === "scheduled")}>
                Planifiée
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {line && (
          <Card className="space-y-2 border-accent/30 bg-accent-soft/30 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Rappel · {line.name}</p>
            {line.tone && (
              <p>
                <span className="font-medium">Ton :</span> {line.tone}
              </p>
            )}
            {line.audience && (
              <p>
                <span className="font-medium">Public :</span> {line.audience}
              </p>
            )}
            {line.themes && (
              <p>
                <span className="font-medium">Thèmes :</span> {line.themes}
              </p>
            )}
            {line.avoid && (
              <p>
                <span className="font-medium">À éviter :</span> {line.avoid}
              </p>
            )}
          </Card>
        )}

        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Aperçu</p>
            <button type="button" onClick={copy} disabled={!finalText} className="flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-50">
              <Copy size={12} aria-hidden="true" />
              Copier
            </button>
          </div>
          {finalText ? (
            <p className="whitespace-pre-line rounded-xl bg-muted px-3 py-2.5 text-sm">{finalText}</p>
          ) : (
            <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">Le texte final apparaît ici, bloc après bloc.</p>
          )}
          <p className={cn("text-xs tabular-nums", status_.over ? "font-medium text-urgent" : "text-muted-foreground")} role="status">
            {status_.count} caractère{status_.count > 1 ? "s" : ""}
            {status_.limit !== null && ` / ${status_.limit} (${MARKETING_CHANNEL_LABELS[channel]})`}
            {status_.over && " — trop long pour ce réseau"}
          </p>
          {error && (
            <p className="text-sm text-urgent" role="alert">
              {error}
            </p>
          )}
          <Button className="w-full" onClick={save} disabled={!valid || pending}>
            {pending ? "Enregistrement…" : "Enregistrer dans En attente"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
