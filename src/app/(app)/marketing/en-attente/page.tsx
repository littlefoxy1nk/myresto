import { getCurrentContext } from "@/lib/current-context";
import { getMarketingPosts } from "@/modules/marketing/server/queries";
import { PostsList } from "@/modules/marketing/components/posts-list";

export default async function PendingPostsPage() {
  const ctx = await getCurrentContext();
  const posts = await getMarketingPosts();
  return <PostsList posts={posts} mode="pending" canManage={ctx.can("marketing.publish")} />;
}
