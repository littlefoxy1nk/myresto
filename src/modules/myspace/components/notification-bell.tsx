"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { markNotificationRead, markAllNotificationsRead, deleteNotification, clearReadNotifications } from "@/modules/myspace/server/actions";
import type { MyNotification } from "@/modules/myspace/types";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const SEVERITY_DOT: Record<MyNotification["severity"], string> = {
  urgent: "bg-urgent",
  important: "bg-important",
  watch: "bg-watch",
};

/// Point d'entrée unique aux notifications, visible sur toute page (voir
/// src/app/(app)/layout.tsx) — remplace l'ancien badge posé sur le seul lien "Mon
/// espace", qui n'affichait qu'un chiffre sans donner accès au contenu sans naviguer.
export function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: MyNotification[];
  initialUnreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function markOneRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(c - 1, 0));
    startTransition(() => markNotificationRead(id));
  }

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    startTransition(() => markAllNotificationsRead());
  }

  function deleteOne(id: string) {
    const target = items.find((n) => n.id === id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.isRead) setUnreadCount((c) => Math.max(c - 1, 0));
    startTransition(() => deleteNotification(id));
  }

  function clearRead() {
    setItems((prev) => prev.filter((n) => !n.isRead));
    startTransition(() => clearReadNotifications());
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card/70 text-foreground/80 shadow-sm outline-none backdrop-blur transition-all hover:bg-card hover:shadow-card focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-urgent px-1 text-[9px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="dialog-overlay absolute right-0 z-50 mt-3 w-80 max-w-[90vw] rounded-3xl border border-border/70 bg-card p-2 shadow-pop">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs font-medium text-accent hover:underline">
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Aucune notification pour le moment.</p>
            ) : (
              items.map((n) => {
                const content = (
                  <div className="flex min-w-0 flex-1 items-start gap-2 rounded-2xl p-2.5 hover:bg-muted">
                    <span
                      className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : SEVERITY_DOT[n.severity])}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm", n.isRead ? "text-muted-foreground" : "font-medium")}>{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatWhen(n.createdAt)}</p>
                    </div>
                  </div>
                );
                const main = n.linkHref ? (
                  <Link
                    href={n.linkHref}
                    className="min-w-0 flex-1"
                    onClick={() => {
                      setOpen(false);
                      if (!n.isRead) markOneRead(n.id);
                    }}
                  >
                    {content}
                  </Link>
                ) : (
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => !n.isRead && markOneRead(n.id)}>
                    {content}
                  </button>
                );
                return (
                  <div key={n.id} className="flex items-center gap-0.5">
                    {main}
                    <button
                      type="button"
                      onClick={() => deleteOne(n.id)}
                      aria-label="Supprimer cette notification"
                      title="Supprimer"
                      className="shrink-0 rounded-full p-2 text-muted-foreground outline-none transition-colors hover:bg-urgent-soft hover:text-urgent focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-2 pt-1.5">
            <Link href="/mon-espace" onClick={() => setOpen(false)} className="py-1.5 text-xs font-medium text-accent hover:underline">
              Voir tout
            </Link>
            {items.some((n) => n.isRead) && (
              <button type="button" onClick={clearRead} className="py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
                Effacer les lues
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
