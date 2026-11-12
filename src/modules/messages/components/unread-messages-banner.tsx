import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";
import { getUnreadMessageCount } from "@/modules/messages/server/queries";

/// Sur Aujourd'hui : une invitation discrète à lire les messages de l'équipe qu'on n'a pas encore ouverts.
export async function UnreadMessagesBanner() {
  const count = await getUnreadMessageCount();
  if (count === 0) return null;
  return (
    <Link
      href="/messages"
      className="flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft/60 px-4 py-3 outline-none transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="flex items-center gap-3 text-sm font-semibold">
        <MessageSquare size={17} className="text-accent" aria-hidden="true" />
        {count === 1 ? "1 nouveau message de l'équipe" : `${count} nouveaux messages de l'équipe`}
      </span>
      <ChevronRight size={16} className="text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
