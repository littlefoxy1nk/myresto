"use client";

import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast-bus";
import { cn } from "@/lib/utils";
import { audienceLabel } from "@/modules/messages/audience";
import { deleteAnnouncement, markAllAnnouncementsRead, markAnnouncementRead } from "@/modules/messages/server/actions";
import type { MessageItem } from "@/modules/messages/server/queries";

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("fr-BE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function MessageList({ items, canPost }: { items: MessageItem[]; canPost: boolean }) {
  const [, startTransition] = useTransition();
  const [read, setRead] = useState<Set<string>>(new Set(items.filter((i) => i.read).map((i) => i.id)));
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const visible = items.filter((i) => !removed.has(i.id));
  const unread = visible.filter((i) => !read.has(i.id));

  function markRead(id: string) {
    setRead((prev) => new Set(prev).add(id));
    startTransition(() => markAnnouncementRead(id));
  }

  return (
    <div className="space-y-3">
      {unread.length > 1 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setRead(new Set(visible.map((i) => i.id)));
              startTransition(() => markAllAnnouncementsRead());
            }}
          >
            <Check size={14} aria-hidden="true" />
            Tout marquer comme lu
          </Button>
        </div>
      )}
      {visible.map((item) => {
        const isRead = read.has(item.id);
        return (
          <article
            key={item.id}
            className={cn("rounded-3xl border bg-card p-5 shadow-card transition-colors", isRead ? "border-border/70" : "border-accent/40 bg-accent-soft/30")}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                  {!isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Non lu" />}
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.authorName} · {formatWhen(item.createdAt)}
                </p>
              </div>
              <Badge variant="neutral">{audienceLabel(item.audience)}</Badge>
            </div>
            {item.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{item.body}</p>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {isRead ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-good">
                  <Check size={14} aria-hidden="true" />
                  Lu
                </span>
              ) : (
                <Button size="sm" onClick={() => markRead(item.id)}>
                  <Check size={14} aria-hidden="true" />
                  J&apos;ai lu
                </Button>
              )}
              {canPost && item.receipts && (
                <p className="text-xs text-muted-foreground">
                  Lu par <span className="font-semibold text-foreground">{item.receipts.readCount}</span> sur {item.receipts.total}
                  {item.receipts.pendingNames.length > 0 && <> · pas encore : {item.receipts.pendingNames.join(", ")}</>}
                </p>
              )}
              {canPost && (
                <button
                  type="button"
                  onClick={() => setConfirmId(item.id)}
                  aria-label="Supprimer ce message"
                  title="Supprimer"
                  className="rounded-full p-2 text-muted-foreground outline-none transition-colors hover:bg-urgent-soft hover:text-urgent focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          </article>
        );
      })}

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title="Supprimer ce message ?"
        description="Il disparaît pour toute l'équipe."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          const id = confirmId;
          if (!id) return;
          setRemoved((prev) => new Set(prev).add(id));
          try {
            await deleteAnnouncement(id);
            toast("Message supprimé");
          } catch (err) {
            setRemoved((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            toast(err instanceof Error ? err.message : "Impossible de supprimer.", "error");
          }
        }}
      />
    </div>
  );
}
