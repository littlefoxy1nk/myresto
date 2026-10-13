"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, Share2, Mail, MessageSquare, Plus, Pencil, Trash2, CheckCircle2, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast-bus";
import { PostDialog } from "@/modules/marketing/components/post-dialog";
import { deletePost, markPostPublished } from "@/modules/marketing/server/actions";
import { MARKETING_CHANNEL_LABELS } from "@/modules/marketing/types";
import type { MarketingPostItem, MarketingPostStatus } from "@/modules/marketing/types";

const CHANNEL_ICON = { instagram: Camera, facebook: Share2, email: Mail, sms: MessageSquare } as const;

const STATUS_LABEL: Record<MarketingPostStatus, string> = { draft: "Brouillon", scheduled: "Planifiée", published: "Publiée" };
const STATUS_VARIANT: Record<MarketingPostStatus, "neutral" | "watch" | "good"> = {
  draft: "neutral",
  scheduled: "watch",
  published: "good",
};

function formatWhen(iso: string): string {
  return (
    new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso)) +
    " · " +
    new Intl.DateTimeFormat("fr-BE", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
  );
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/// Liste des publications : "En attente" (brouillons et planifiées, avec les actions) ou "Publié"
/// (l'historique, en lecture seule à part la suppression).
export function PostsList({
  posts,
  mode,
  canManage,
}: {
  posts: MarketingPostItem[];
  mode: "pending" | "published";
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<MarketingPostItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const shown = posts
    .filter((p) => (mode === "pending" ? p.status !== "published" : p.status === "published"))
    .sort((a, b) =>
      mode === "pending"
        ? a.scheduledFor.localeCompare(b.scheduledFor)
        : (b.publishedAt ?? b.scheduledFor).localeCompare(a.publishedAt ?? a.scheduledFor)
    );

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Texte copié");
    } catch {
      toast("Copie impossible : sélectionne le texte à la main.", "error");
    }
  }

  async function publish(id: string) {
    try {
      await markPostPublished(id);
      toast("Marquée comme publiée");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    }
  }

  return (
    <div className="space-y-4">
      {mode === "pending" && canManage && (
        <Button asChild>
          <Link href="/marketing/sujet">
            <Plus size={15} aria-hidden="true" />
            Nouveau sujet
          </Link>
        </Button>
      )}

      {shown.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {mode === "pending"
            ? "Rien en attente. Pars d'un sujet dans « Traitement de sujet » pour préparer une publication."
            : "Aucune publication publiée pour le moment."}
        </Card>
      ) : (
        <div className="space-y-2">
          {shown.map((post) => {
            const Icon = CHANNEL_ICON[post.channel];
            return (
              <Card key={post.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{post.title}</p>
                    <Badge variant={STATUS_VARIANT[post.status]}>{STATUS_LABEL[post.status]}</Badge>
                    {post.editorialLineName && <Badge variant="neutral">{post.editorialLineName}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {mode === "published"
                      ? `Publiée le ${formatDay(post.publishedAt ?? post.scheduledFor)}`
                      : formatWhen(post.scheduledFor)}{" "}
                    · {MARKETING_CHANNEL_LABELS[post.channel]}
                  </p>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{post.content}</p>
                  {post.mediaNote && <p className="mt-1 text-xs italic text-muted-foreground">📎 {post.mediaNote}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => copy(post.content)} aria-label="Copier le texte">
                    <Copy size={14} aria-hidden="true" />
                  </Button>
                  {canManage && mode === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => publish(post.id)}>
                        <CheckCircle2 size={14} aria-hidden="true" />
                        Publiée
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(post)} aria-label="Modifier">
                        <Pencil size={14} aria-hidden="true" />
                      </Button>
                    </>
                  )}
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-urgent hover:bg-urgent-soft"
                      onClick={() => setDeleteId(post.id)}
                      aria-label="Supprimer"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && <PostDialog open onOpenChange={(o) => !o && setEditing(null)} editing={editing} />}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Supprimer cette publication ?"
        description="Cette action est définitive."
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (!deleteId) return;
          deletePost(deleteId)
            .then(() => toast("Publication supprimée"))
            .catch((err) => toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error"));
          setDeleteId(null);
        }}
      />
    </div>
  );
}
