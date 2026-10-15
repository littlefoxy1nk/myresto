import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-10 w-72" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-6 p-6 lg:col-span-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-56" />
          </div>
          <div className="flex gap-10">
            <Skeleton className="h-16 w-20" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-48 rounded-full" />
              <Skeleton className="h-7 w-40 rounded-full" />
            </div>
          </div>
        </Card>
        <Card className="space-y-3 p-6">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-14 w-24" />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="space-y-3 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-56 w-full rounded-3xl" />
          </Card>
        ))}
      </div>
    </div>
  );
}
