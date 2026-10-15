import { getCurrentContext } from "@/lib/current-context";
import { visibleNavItems } from "@/lib/nav-items";
import { getNotificationBellData } from "@/modules/myspace/server/queries";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { BrandMark } from "@/components/nav/brand-mark";
import { CommandPalette } from "@/components/nav/command-palette";
import { PageTransition } from "@/components/nav/page-transition";
import { AvatarFigure } from "@/components/ui/avatar-figure";
import { parseAvatar } from "@/lib/avatar";
import type { PaletteEntry } from "@/lib/palette-search";
import Link from "next/link";
import { NotificationBell } from "@/modules/myspace/components/notification-bell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentContext();
  const visibleItems = visibleNavItems(ctx.can, ctx.establishment.disabledModules);
  const { notifications, unreadCount } = await getNotificationBellData();
  const avatar = parseAvatar(ctx.user.avatarJson, ctx.user.id);
  const userName = `${ctx.user.firstName} ${ctx.user.lastName}`;

  // Palette ⌘K : les pages visibles + les deux actions de création les plus courantes.
  const has = (href: string) => visibleItems.some((i) => i.href === href);
  const paletteEntries: PaletteEntry[] = [
    ...(has("/reservations") && ctx.can("reservations.edit")
      ? [{ href: "/reservations/nouvelle", label: "Nouvelle réservation", icon: "CalendarPlus", hint: "Action", keywords: "creer ajouter resa table" }]
      : []),
    ...(has("/equipe") && ctx.can("staff.manage")
      ? [{ href: "/equipe/nouveau", label: "Nouvel employé", icon: "UserPlus", hint: "Action", keywords: "creer ajouter personnel" }]
      : []),
    ...visibleItems.map((i) => ({ href: i.href, label: i.label, icon: i.icon, hint: "Page" })),
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar
        items={visibleItems}
        establishmentName={ctx.establishment.name}
        userName={userName}
        userRole={ctx.membership.role.label}
        avatar={avatar}
        isDemo={ctx.establishment.isDemo}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-28 md:pb-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-background/60 px-4 py-3 backdrop-blur-xl md:px-8 md:py-4">
          <BrandMark name={ctx.establishment.name} className="h-9 w-9 text-sm md:hidden" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold md:hidden">{ctx.establishment.name}</p>
          <div className="md:mr-auto">
            <CommandPalette entries={paletteEntries} />
          </div>
          <NotificationBell initialNotifications={notifications} initialUnreadCount={unreadCount} />
          <Link
            href="/parametres?tab=profil"
            aria-label="Mon profil et mes réglages"
            className="rounded-full outline-none ring-2 ring-card transition-transform hover:scale-105 focus-visible:ring-accent"
          >
            <AvatarFigure config={avatar} size={38} />
          </Link>
        </header>
        <main className="min-w-0 flex-1 px-4 pb-8 pt-2 md:px-8 md:pt-2">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <BottomNav items={visibleItems} userName={userName} userRole={ctx.membership.role.label} avatar={avatar} />
    </div>
  );
}
