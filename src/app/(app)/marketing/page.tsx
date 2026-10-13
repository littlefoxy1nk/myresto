import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/current-context";
import { getMarketingPosts } from "@/modules/marketing/server/queries";
import { PostsCalendarApp } from "@/modules/marketing/components/posts-calendar-app";

export default async function MarketingPage() {
  const ctx = await getCurrentContext();
  if (!ctx.can("marketing.view")) redirect("/aujourdhui");

  const posts = await getMarketingPosts();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Communication</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Préparez vos publications à l&apos;avance — MYRESTO organise le calendrier, vous publiez vous-même sur
          chaque réseau.
        </p>
      </div>

      <PostsCalendarApp posts={posts} canManage={ctx.can("marketing.publish")} />
    </div>
  );
}
