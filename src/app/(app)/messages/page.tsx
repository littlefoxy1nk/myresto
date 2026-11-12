import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { getCurrentContext } from "@/lib/current-context";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageComposer } from "@/modules/messages/components/message-composer";
import { MessageList } from "@/modules/messages/components/message-list";
import { getMessages } from "@/modules/messages/server/queries";

export const metadata: Metadata = { title: "Messages" };

/// Les messages du responsable à son équipe : tout le monde les lit et répond « J'ai lu » ; qui gère l'équipe ou le planning
/// peut aussi en écrire et voir qui a lu.
export default async function MessagesPage() {
  const ctx = await getCurrentContext();
  const canPost = ctx.can("staff.manage") || ctx.can("schedule.edit");
  const items = await getMessages(canPost);

  return (
    <div className="stagger mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canPost ? "Écris à ton équipe : chacun reçoit une notification et peut répondre « J'ai lu »." : "Les messages de ton responsable."}
        </p>
      </div>

      {canPost && <MessageComposer />}

      {items.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Aucun message pour le moment"
          description={canPost ? "Ton premier message à l'équipe apparaîtra ici." : "Les messages de ton responsable apparaîtront ici."}
        />
      ) : (
        <MessageList items={items} canPost={canPost} />
      )}
    </div>
  );
}
