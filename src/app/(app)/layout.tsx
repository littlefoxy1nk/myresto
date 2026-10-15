import { getCurrentContext } from "@/lib/current-context";
import { visibleNavItems } from "@/lib/nav-items";
import { getNotificationBellData } from "@/modules/myspace/server/queries";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { AvatarFigure } from "@/components/ui/avatar-figure";
import { parseAvatar } from "@/lib/avatar";
import Link from "next/link";
import { NotificationBell } from "@/modules/myspace/components/notification-bell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentContext();
  const visibleItems = visibleNavItems(ctx.can, ctx.establishment.disabledModules);
  const { notifications, unreadCount } = await getNotificationBellData();
  const avatar = parseAvatar(ctx.user.avatarJson, ctx.user.id);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        items={visibleItems}
        establishmentName={ctx.establishment.name}
        userName={`${ctx.user.firstName} ${ctx.user.lastName}`}
        userRole={ctx.membership.role.label}
        avatar={avatar}
        isDemo={ctx.establishment.isDemo}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <div className="sticky top-0 z-30 flex items-center justify-end gap-3 border-b border-border bg-card px-4 py-2 md:px-8">
          <NotificationBell initialNotifications={notifications} initialUnreadCount={unreadCount} />
          <Link
            href="/parametres?tab=profil"
            aria-label="Mon profil et mes réglages"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <AvatarFigure config={avatar} size={34} />
          </Link>
        </div>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
      <BottomNav items={visibleItems} />
    </div>
  );
}
