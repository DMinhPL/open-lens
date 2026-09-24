import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/core/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, className }: StatCardProps) {
  return (
    <Card className={cn("stat-card", className)}>
      <CardHeader className="stat-card__header flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="stat-card__value text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
