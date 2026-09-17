"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export function NotificationsList({ notifications }: { notifications: MyNotification[] }) {
  const [items, setItems] = useState(notifications);
  const [, startTransition] = useTransition();
  const unreadCount = items.filter((n) => !n.isRead).length;

  function markOneRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    startTransition(() => markNotificationRead(id));
  }

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    startTransition(() => markAllNotificationsRead());
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune notification pour le moment.</p>;
  }

  return (
    <div className="space-y-2">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={markAllRead}>
            Tout marquer comme lu
          </Button>
        </div>
      )}
      {items.map((n) => {
        const content = (
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm", n.isRead ? "text-muted-foreground" : "font-medium")}>{n.title}</p>
            {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground">{formatWhen(n.createdAt)}</p>
          </div>
        );
        return (
          <Card
            key={n.id}
            className={cn("flex items-start gap-3 p-3", !n.isRead && "border-accent/40 bg-accent-soft/30")}
          >
            {!n.isRead && <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[n.severity])} aria-hidden="true" />}
            {n.linkHref ? (
              <Link href={n.linkHref} onClick={() => !n.isRead && markOneRead(n.id)} className="min-w-0 flex-1">
                {content}
              </Link>
            ) : (
              content
            )}
            {!n.isRead && (
              <Button size="sm" variant="ghost" onClick={() => markOneRead(n.id)} className="shrink-0">
                Marquer lu
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
