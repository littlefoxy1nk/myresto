"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-bus";
import { createPost, removePostPhoto, updatePost, uploadPostPhoto } from "@/modules/marketing/server/actions";
import type { PostInput } from "@/modules/marketing/server/shared";
import { MARKETING_CHANNELS, MARKETING_CHANNEL_LABELS } from "@/modules/marketing/types";
import type { MarketingPostItem } from "@/modules/marketing/types";

function toDateInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toTimeInput(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function PostDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: MarketingPostItem | null;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [channel, setChannel] = useState<PostInput["channel"]>(editing?.channel ?? "instagram");
  const [scheduledDate, setScheduledDate] = useState(editing ? toDateInput(editing.scheduledFor) : "");
  const [scheduledTime, setScheduledTime] = useState(editing ? toTimeInput(editing.scheduledFor) : "18:00");
  const [status, setStatus] = useState<"draft" | "scheduled">(editing?.status === "scheduled" ? "scheduled" : "draft");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview]
  );

  const currentPhoto = photoPreview ?? (removePhoto ? null : (editing?.mediaUrl ?? null));
  const valid = !!title && !!content && !!scheduledDate && !!scheduledTime;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{editing ? "Modifier la publication" : "Nouvelle publication"}</DialogTitle>
        <DialogDescription>
          Préparez le contenu et sa date — vous publierez vous-même sur le réseau, puis viendrez le marquer comme
          publié ici.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setPending(true);
            setError(null);
            const input: PostInput = { title, content, channel, scheduledDate, scheduledTime, status };
            try {
              let postId: string;
              if (editing) {
                await updatePost(editing.id, input);
                postId = editing.id;
              } else {
                postId = await createPost(input);
              }
              if (removePhoto && !photo && editing?.mediaUrl) await removePostPhoto(postId);
              if (photo) {
                const formData = new FormData();
                formData.set("postId", postId);
                formData.set("file", photo);
                try {
                  await uploadPostPhoto(formData);
                } catch (uploadError) {
                  toast(
                    `Publication enregistrée, mais la photo n'a pas pu être ajoutée : ${uploadError instanceof Error ? uploadError.message : "erreur inconnue"}`,
                    "error"
                  );
                  onOpenChange(false);
                  return;
                }
              }
              toast(editing ? "Publication modifiée" : "Publication créée");
              onOpenChange(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Une erreur est survenue.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="post-title" className="text-sm font-medium">
              Titre
            </label>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Photo nouveau menu"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="post-content" className="text-sm font-medium">
              Texte de la publication
            </label>
            <textarea
              id="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Photo (optionnel)</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file && file.size > 5 * 1024 * 1024) {
                  setError("Photo trop lourde (5 Mo maximum).");
                  e.target.value = "";
                  return;
                }
                setError(null);
                setPhoto(file);
                if (file) setRemovePhoto(false);
              }}
            />
            {currentPhoto ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentPhoto} alt="Photo de la publication" className="h-20 w-20 rounded-xl border border-border object-cover" />
                <div className="flex flex-col items-start gap-1">
                  <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-medium text-accent hover:underline">
                    Changer la photo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto(null);
                      setRemovePhoto(true);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <X size={13} aria-hidden="true" />
                    Retirer
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ImagePlus size={16} aria-hidden="true" />
                Ajouter une photo
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="post-date" className="text-sm font-medium">
                Date
              </label>
              <input
                id="post-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="post-time" className="text-sm font-medium">
                Heure
              </label>
              <input
                id="post-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Réseau</span>
            <div className="grid grid-cols-4 gap-2">
              {MARKETING_CHANNELS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setChannel(c)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                    channel === c ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                  }`}
                >
                  {MARKETING_CHANNEL_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Statut</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus("draft")}
                className={`rounded-xl border px-2 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  status === "draft" ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                }`}
              >
                Brouillon
              </button>
              <button
                type="button"
                onClick={() => setStatus("scheduled")}
                className={`rounded-xl border px-2 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  status === "scheduled" ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-muted"
                }`}
              >
                Planifiée
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-urgent">{error}</p>}

          <Button type="submit" className="w-full" disabled={pending || !valid}>
            {pending ? "Enregistrement…" : editing ? "Enregistrer" : "Créer la publication"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
