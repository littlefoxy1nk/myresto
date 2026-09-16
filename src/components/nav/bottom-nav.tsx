"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav-items";

export function BottomNav({ items, badges }: { items: NavItem[]; badges?: Record<string, number> }) {
  const pathname = usePathname();
  const visible = items.filter((i) => i.mobile);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur md:hidden">
      {visible.map((item) => {
        const Icon = Icons[item.icon as keyof typeof Icons] as Icons.LucideIcon;
        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
        const badgeCount = badges?.[item.href] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium outline-none",
              "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
              active ? "text-accent" : "text-muted-foreground"
            )}
          >
            <span className="relative">
              {Icon && <Icon size={20} strokeWidth={2} aria-hidden="true" />}
              {badgeCount > 0 && (
                <span className="absolute -right-1.5 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-urgent text-[8px] font-semibold text-white">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </span>
            <span className="whitespace-nowrap">{item.mobileLabel ?? item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
