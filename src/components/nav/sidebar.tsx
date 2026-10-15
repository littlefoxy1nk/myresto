"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUP_LABELS, type NavGroup, type NavItem } from "@/lib/nav-items";
import { logout } from "@/lib/actions/auth-actions";
import { AvatarFigure } from "@/components/ui/avatar-figure";
import { BrandMark } from "@/components/nav/brand-mark";
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

  // Regroupe les items par rubrique en gardant l'ordre du menu ; une rubrique sans item visible disparaît.
  const groups: { key: NavGroup; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.key === item.group) last.items.push(item);
    else groups.push({ key: item.group, items: [item] });
  }

  return (
    <aside className="hidden w-[18rem] shrink-0 p-4 pr-0 md:block">
      <div className="sticky top-4 flex h-[calc(100dvh-2rem)] flex-col rounded-[28px] bg-sidebar p-3 text-sidebar-foreground shadow-pop">
        <div className="flex items-center gap-3 px-3 pb-3 pt-2">
          <BrandMark name={establishmentName} className="h-10 w-10 text-base" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight tracking-tight">{establishmentName}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/50">
              {isDemo ? (
                <span className="rounded-full bg-white/10 px-1.5 py-px text-[10px] font-semibold text-white/80">Démo</span>
              ) : (
                "Espace de gestion"
              )}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-1 pb-2 [scrollbar-width:none]">
          {groups.map((group) => {
            const label = NAV_GROUP_LABELS[group.key];
            return (
              <div key={group.key + group.items[0].href} className="space-y-0.5">
                {label && <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{label}</p>}
                {group.items.map((item) => {
                  const Icon = Icons[item.icon as keyof typeof Icons] as Icons.LucideIcon;
                  const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                  const badgeCount = badges?.[item.href] ?? 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium outline-none transition-all duration-150",
                        "focus-visible:ring-2 focus-visible:ring-white/60",
                        active
                          ? "bg-white text-[#17141f] shadow-[0_6px_18px_-8px_rgb(0_0_0/0.6)]"
                          : "text-white/65 hover:bg-white/[0.08] hover:text-white"
                      )}
                    >
                      {Icon && (
                        <Icon
                          size={18}
                          strokeWidth={active ? 2.3 : 1.9}
                          aria-hidden="true"
                          className={cn("transition-transform duration-150 group-hover:scale-110", active && "text-accent")}
                        />
                      )}
                      <span className="flex-1">{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-urgent px-1 text-[10px] font-semibold text-white">
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="mt-2 flex items-center gap-1 rounded-2xl bg-white/[0.07] p-2">
          {avatar && (
            <Link
              href="/parametres?tab=profil"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <AvatarFigure config={avatar} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-tight">{userName}</span>
                {userRole && <span className="block truncate text-[11px] text-white/50">{userRole}</span>}
              </span>
            </Link>
          )}
          <form action={logout}>
            <button
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/55 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Icons.LogOut size={17} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
