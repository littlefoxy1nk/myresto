import { Card, CardContent } from "@/components/ui/card";
import * as Icons from "lucide-react";

export function ComingSoon({
  icon,
  title,
  description,
  phase,
}: {
  icon: keyof typeof Icons;
  title: string;
  description: string;
  phase: string;
}) {
  const Icon = Icons[icon] as Icons.LucideIcon;
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Icon size={24} />
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <Card className="mt-6 w-full">
        <CardContent className="py-3 text-xs text-muted-foreground">{phase}</CardContent>
      </Card>
    </div>
  );
}
