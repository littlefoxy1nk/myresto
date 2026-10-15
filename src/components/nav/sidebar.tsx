"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav-items";
import { logout } from "@/lib/actions/auth-actions";
import { Badge } from "@/components/ui/badge";
import { AvatarFigure } from "@/components/ui/avatar-figure";
import type { AvatarConfig } from "@/lib/avatar";

export function Sidebar({
  items,
  establishmentName,
  userName,
  userRole,
  avatar,
  isDemo,
  badges,
}: {
  items: NavItem[];
  establishmentName: string;
  userName: string;
  userRole?: string;
  avatar?: AvatarConfig;
  isDemo?: boolean;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground">
          {establishmentName.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{establishmentName}</p>
            {isDemo && <Badge variant="accent" className="shrink-0 px-1.5 py-0 text-[10px]">Démo</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{userName}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map((item) => {
          const Icon = Icons[item.icon as keyof typeof Icons] as Icons.LucideIcon;
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const badgeCount = badges?.[item.href] ?? 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground"
              )}
            >
              {Icon && <Icon size={17} strokeWidth={2} aria-hidden="true" />}
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-urgent px-1 text-[10px] font-semibold text-white">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4">
        {avatar && (
          <Link
            href="/parametres?tab=profil"
            className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent"
          >
            <AvatarFigure config={avatar} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{userName}</span>
              {userRole && <span className="block truncate text-xs text-muted-foreground">{userRole}</span>}
            </span>
          </Link>
        )}
        <form action={logout}>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card">
            <Icons.LogOut size={17} aria-hidden="true" />
            Se déconnecter
          </button>
        </form>
      </div>
    </aside>
  );
}
