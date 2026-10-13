import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { prisma } from "@/lib/prisma";
import { CommunicationNav } from "@/modules/marketing/components/communication-nav";

export default async function CommunicationLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentContext();
  if (!ctx.can("marketing.view")) redirect("/aujourdhui");

  const pendingCount = await prisma.marketingPost.count({
    where: { establishmentId: ctx.establishment.id, status: { in: ["draft", "scheduled"] } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Communication</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prépare tes publications à ta façon — tu publies toi-même sur chaque réseau, puis tu viens le noter ici.
        </p>
      </div>
      <CommunicationNav pendingCount={pendingCount} />
      {children}
    </div>
  );
}
