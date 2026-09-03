"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav-items";

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const visible = items.filter((i) => i.mobile);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur md:hidden">
      {visible.map((item) => {
        const Icon = Icons[item.icon as keyof typeof Icons] as Icons.LucideIcon;
        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium outline-none",
              "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
              active ? "text-accent" : "text-muted-foreground"
            )}
          >
            {Icon && <Icon size={20} strokeWidth={2} aria-hidden="true" />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
