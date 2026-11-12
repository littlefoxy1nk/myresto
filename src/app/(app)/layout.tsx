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
import { isPlatformAdminEmail } from "@/lib/platform-admin";
import { leaveAssistance } from "@/modules/admin/server/actions";
import { LifeBuoy } from "lucide-react";
import type { NavItem } from "@/lib/nav-items";
import type { PaletteEntry } from "@/lib/palette-search";
import Link from "next/link";
import { NotificationBell } from "@/modules/myspace/components/notification-bell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentContext();
  const isTeamMember = isPlatformAdminEmail(ctx.user.email);
  const teamItem: NavItem = { href: "/admin", label: "Équipe MYRESTO", mobileLabel: "Équipe", icon: "ShieldCheck", group: "compte", available: true };
  const baseItems = visibleNavItems(ctx.can, ctx.establishment.disabledModules)
    // En assistance, « Mon espace » (planning personnel, congés…) n'a pas de sens : la personne n'est pas de l'équipe du client.
    .filter((item) => !(ctx.assistance && item.href === "/mon-espace"));
  // L'espace équipe MYRESTO se place juste avant « Paramètres », qui reste le dernier.
  const visibleItems = isTeamMember ? [...baseItems.slice(0, -1), teamItem, ...baseItems.slice(-1)] : baseItems;
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
        <div className="sticky top-0 z-30">
        {ctx.assistance && (
          <div className="flex items-center justify-between gap-3 bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground md:px-8">
            <span className="flex min-w-0 items-center gap-2">
              <LifeBuoy size={16} aria-hidden="true" className="shrink-0" />
              <span className="truncate">Mode assistance · {ctx.establishment.name}</span>
            </span>
            <form action={leaveAssistance}>
              <button type="submit" className="rounded-full bg-accent-foreground/15 px-3 py-1 text-xs font-bold outline-none transition-colors hover:bg-accent-foreground/25 focus-visible:ring-2 focus-visible:ring-accent-foreground">
                Quitter
              </button>
            </form>
          </div>
        )}
        <header className="flex items-center gap-3 bg-background/60 px-4 py-3 backdrop-blur-xl md:px-8 md:py-4">
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
        </div>
        <main className="min-w-0 flex-1 px-4 pb-8 pt-2 md:px-8 md:pt-2">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <BottomNav items={visibleItems} userName={userName} userRole={ctx.membership.role.label} avatar={avatar} />
    </div>
  );
}
