"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { splitMobileNav, type NavItem } from "@/lib/nav-items";
import { logout } from "@/lib/actions/auth-actions";
import { AvatarFigure } from "@/components/ui/avatar-figure";
import type { AvatarConfig } from "@/lib/avatar";

export function BottomNav({
  items,
  badges,
  userName,
  userRole,
  avatar,
}: {
  items: NavItem[];
  badges?: Record<string, number>;
  userName?: string;
  userRole?: string;
  avatar?: AvatarConfig;
}) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { pinned, more } = splitMobileNav(items);
  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");
  const moreActive = more.some((i) => isActive(i.href));

  return (
    <>
      {/* Barre flottante : quatre onglets + « Plus ». L'onglet actif se déplie en pastille claire. */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-1 rounded-[26px] bg-sidebar/95 p-1.5 shadow-pop backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
      >
        {pinned.map((item) => {
          const Icon = Icons[item.icon as keyof typeof Icons] as Icons.LucideIcon;
          const active = isActive(item.href);
          const badgeCount = badges?.[item.href] ?? 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-[20px] py-2 text-[10px] font-semibold outline-none transition-all duration-200",
                "focus-visible:ring-2 focus-visible:ring-white/60",
                active ? "bg-white text-[#17141f]" : "text-white/60 active:bg-white/10"
              )}
            >
              <span className="relative">
                {Icon && <Icon size={20} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" className={active ? "text-accent" : undefined} />}
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
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Plus d'options"
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 rounded-[20px] py-2 text-[10px] font-semibold outline-none transition-all duration-200",
            "focus-visible:ring-2 focus-visible:ring-white/60",
            moreActive ? "bg-white text-[#17141f]" : "text-white/60 active:bg-white/10"
          )}
        >
          <Icons.LayoutGrid size={20} strokeWidth={moreActive ? 2.3 : 1.9} aria-hidden="true" className={moreActive ? "text-accent" : undefined} />
          <span>Plus</span>
        </button>
      </nav>

      <RadixDialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-[#14100d]/50 backdrop-blur-sm md:hidden" />
          <RadixDialog.Content
            className="sheet-up fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[32px] border-t border-border/70 bg-card p-5 pb-8 shadow-pop outline-none md:hidden"
            aria-describedby={undefined}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
            <RadixDialog.Title className="sr-only">Menu</RadixDialog.Title>

            {avatar && (
              <Link
                href="/parametres?tab=profil"
                onClick={() => setSheetOpen(false)}
                className="mb-5 flex items-center gap-3 rounded-2xl bg-muted p-3"
              >
                <AvatarFigure config={avatar} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{userName}</span>
                  {userRole && <span className="block truncate text-xs text-muted-foreground">{userRole}</span>}
                </span>
                <Icons.ChevronRight size={18} className="text-muted-foreground" aria-hidden="true" />
              </Link>
            )}

            <div className="grid grid-cols-3 gap-2.5">
              {more.map((item) => {
                const Icon = Icons[item.icon as keyof typeof Icons] as Icons.LucideIcon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl px-2 py-4 text-center text-xs font-semibold transition-colors",
                      active ? "bg-accent-soft text-accent" : "bg-muted text-foreground active:bg-border"
                    )}
                  >
                    {Icon && <Icon size={22} strokeWidth={1.9} aria-hidden="true" />}
                    <span className="leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Sur mobile, le menu latéral est caché : la déconnexion vit ici, accessible depuis toutes les pages. */}
            <form action={logout} className="mt-5">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-semibold text-muted-foreground outline-none transition-colors active:bg-muted focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icons.LogOut size={16} aria-hidden="true" />
                Se déconnecter
              </button>
            </form>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </>
  );
}
