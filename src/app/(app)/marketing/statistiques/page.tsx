import { getCurrentContext } from "@/lib/current-context";
import { getMarketingPosts } from "@/modules/marketing/server/queries";
import { PostStatsRow } from "@/modules/marketing/components/post-stats-row";
import { channelStats, publishedPerMonth } from "@/modules/marketing/stats";
import { MARKETING_CHANNEL_LABELS } from "@/modules/marketing/types";
import { Card } from "@/components/ui/card";

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function dayOf(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function StatisticsPage() {
  const ctx = await getCurrentContext();
  const canManage = ctx.can("marketing.publish");
  const posts = await getMarketingPosts();

  const published = posts
    .filter((p) => p.status === "published")
    .map((p) => ({ post: p, date: dayOf(p.publishedAt ?? p.scheduledFor) }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const pendingCount = posts.filter((p) => p.status !== "published").length;

  const now = new Date();
  const perMonth = publishedPerMonth(published, 6, now);
  const maxCount = Math.max(1, ...perMonth.map((m) => m.count));
  const thisMonth = perMonth[perMonth.length - 1]?.count ?? 0;
  const byChannel = channelStats(
    published.map(({ post, date }) => ({ channel: post.channel, date, likes: post.likes, comments: post.comments, reach: post.reach }))
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Publiées</p>
          <p className="mt-1 text-xl font-semibold">{published.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Ce mois-ci</p>
          <p className="mt-1 text-xl font-semibold">{thisMonth}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">En attente</p>
          <p className="mt-1 text-xl font-semibold">{pendingCount}</p>
        </Card>
      </div>

      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">Publications par mois</h2>
        <div className="flex items-end gap-3" role="img" aria-label="Nombre de publications par mois sur 6 mois">
          {perMonth.map((m) => {
            const month = Number(m.key.slice(5, 7));
            return (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-xs font-medium tabular-nums">{m.count}</span>
                <div className="flex h-24 w-full items-end">
                  <div
                    className="w-full rounded-t-md"
                    style={{ height: `${(m.count / maxCount) * 100}%`, minHeight: m.count > 0 ? 4 : 0, background: "var(--accent)" }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{MONTHS[month - 1]}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">Par réseau</h2>
        {byChannel.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune publication publiée pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="border-b border-border py-1.5 font-medium">Réseau</th>
                  <th className="border-b border-border py-1.5 text-right font-medium">Publiées</th>
                  <th className="border-b border-border py-1.5 text-right font-medium">J&apos;aime</th>
                  <th className="border-b border-border py-1.5 text-right font-medium">Commentaires</th>
                  <th className="border-b border-border py-1.5 text-right font-medium">Portée</th>
                </tr>
              </thead>
              <tbody>
                {byChannel.map((c) => (
                  <tr key={c.channel} className="odd:bg-muted/40">
                    <td className="py-1.5 pl-1">{MARKETING_CHANNEL_LABELS[c.channel]}</td>
                    <td className="py-1.5 text-right tabular-nums">{c.published}</td>
                    <td className="py-1.5 text-right tabular-nums">{c.withResults > 0 ? c.likes : "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{c.withResults > 0 ? c.comments : "—"}</td>
                    <td className="py-1.5 pr-1 text-right tabular-nums">{c.withResults > 0 ? c.reach : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Les résultats sont ceux que tu saisis ci-dessous : ils ne sont pas récupérés des réseaux, et une publication sans résultat saisi n&apos;ajoute rien aux totaux.
        </p>
      </Card>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Résultats de chaque publication</h2>
        {published.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Les publications publiées apparaîtront ici pour y noter leurs résultats.</Card>
        ) : (
          published.map(({ post, date }) => (
            <Card key={post.id} className="space-y-2 p-4">
              <div>
                <p className="text-sm font-medium">{post.title}</p>
                <p className="text-xs text-muted-foreground">
                  {MARKETING_CHANNEL_LABELS[post.channel]} · {new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00`))}
                </p>
              </div>
              <PostStatsRow
                postId={post.id}
                initial={{ likes: post.likes, comments: post.comments, reach: post.reach }}
                canManage={canManage}
              />
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
