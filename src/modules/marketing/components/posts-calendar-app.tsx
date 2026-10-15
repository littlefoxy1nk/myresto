"use client";

import { useState } from "react";
import { Camera, Share2, Mail, MessageSquare, Plus, Pencil, Trash2, CheckCircle2, Download } from "lucide-react";
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
  return new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso)) +
    " · " +
    new Intl.DateTimeFormat("fr-BE", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function PostsCalendarApp({ posts, canManage }: { posts: MarketingPostItem[]; canManage: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingPostItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const upcoming = posts.filter((p) => p.status !== "published").sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const published = posts.filter((p) => p.status === "published").sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(post: MarketingPostItem) {
    setEditing(post);
    setDialogOpen(true);
  }
  async function handlePublish(id: string) {
    try {
      await markPostPublished(id);
      toast("Marquée comme publiée");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    }
  }
  function handleDeleteConfirm() {
    if (!deleteId) return;
    deletePost(deleteId)
      .then(() => toast("Publication supprimée"))
      .catch((err) => toast(err instanceof Error ? err.message : "Une erreur est survenue.", "error"));
    setDeleteId(null);
  }

  function renderPost(post: MarketingPostItem) {
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
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatWhen(post.scheduledFor)} · {MARKETING_CHANNEL_LABELS[post.channel]}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">{post.content}</p>
        </div>
        {post.mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.mediaUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover" />
        )}
        {post.mediaUrl && (
          <Button size="sm" variant="ghost" asChild>
            <a href={`${post.mediaUrl}?download=1`} aria-label="Télécharger la photo" title="Télécharger la photo">
              <Download size={14} aria-hidden="true" />
            </a>
          </Button>
        )}
        {canManage && (
          <div className="flex shrink-0 gap-1.5">
            {post.status !== "published" && (
              <>
                <Button size="sm" variant="outline" onClick={() => handlePublish(post.id)}>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Publiée
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(post)} aria-label="Modifier">
                  <Pencil size={14} aria-hidden="true" />
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" className="text-urgent hover:bg-urgent-soft" onClick={() => setDeleteId(post.id)} aria-label="Supprimer">
              <Trash2 size={14} aria-hidden="true" />
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Button onClick={openCreate}>
          <Plus size={15} aria-hidden="true" />
          Nouvelle publication
        </Button>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">À venir</h2>
        {upcoming.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucune publication prévue pour le moment.</Card>
        ) : (
          <div className="space-y-2">{upcoming.map(renderPost)}</div>
        )}
      </section>

      {published.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">Déjà publiées</h2>
          <div className="space-y-2">{published.map(renderPost)}</div>
        </section>
      )}

      {dialogOpen && <PostDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Supprimer cette publication ?"
        description="Cette action est définitive."
        confirmLabel="Supprimer"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
