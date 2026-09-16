import { getCurrentContext } from "@/lib/current-context";
import { visibleNavItems } from "@/lib/nav-items";
import { getUnreadNotificationsCount } from "@/modules/myspace/server/queries";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentContext();
  const visibleItems = visibleNavItems(ctx.can);
  const unreadNotifications = await getUnreadNotificationsCount();
  const badges = unreadNotifications > 0 ? { "/mon-espace": unreadNotifications } : undefined;

  return (
    <div className="flex min-h-screen">
      <Sidebar
        items={visibleItems}
        establishmentName={ctx.establishment.name}
        userName={`${ctx.user.firstName} ${ctx.user.lastName}`}
        isDemo={ctx.establishment.isDemo}
        badges={badges}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
      <BottomNav items={visibleItems} badges={badges} />
    </div>
  );
}
