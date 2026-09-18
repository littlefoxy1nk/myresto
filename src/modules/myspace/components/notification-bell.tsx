"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { markNotificationRead, markAllNotificationsRead } from "@/modules/myspace/server/actions";
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-foreground/80 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-urgent px-1 text-[9px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border border-border bg-card p-2 shadow-lg">
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
                  <div className="flex items-start gap-2 rounded-xl p-2 hover:bg-muted">
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
                return n.linkHref ? (
                  <Link
                    key={n.id}
                    href={n.linkHref}
                    onClick={() => {
                      setOpen(false);
                      if (!n.isRead) markOneRead(n.id);
                    }}
                  >
                    {content}
                  </Link>
                ) : (
                  <button key={n.id} type="button" className="w-full text-left" onClick={() => !n.isRead && markOneRead(n.id)}>
                    {content}
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-border px-2 pt-1.5">
            <Link href="/mon-espace" onClick={() => setOpen(false)} className="block py-1.5 text-center text-xs font-medium text-accent hover:underline">
              Voir tout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
