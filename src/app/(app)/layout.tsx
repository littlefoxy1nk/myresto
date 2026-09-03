import { getCurrentContext } from "@/lib/current-context";
import { visibleNavItems } from "@/lib/nav-items";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentContext();
  const visibleItems = visibleNavItems(ctx.can);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        items={visibleItems}
        establishmentName={ctx.establishment.name}
        userName={`${ctx.user.firstName} ${ctx.user.lastName}`}
        isDemo={ctx.establishment.isDemo}
      />
      <div className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0">
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
      <BottomNav items={visibleItems} />
    </div>
  );
}
