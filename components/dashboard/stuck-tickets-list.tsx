"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { AlertTriangle } from "lucide-react";
import type { WorkPackage } from "@/lib/types";

interface StuckTicketsListProps {
  tickets: WorkPackage[];
  onSelect: (ticketId: number) => void;
  maxItems?: number;
}

function daysIdle(updatedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000)));
}

export function StuckTicketsList({ tickets, onSelect, maxItems = 5 }: StuckTicketsListProps) {
  const visible = tickets.slice(0, maxItems);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="size-4 text-muted-foreground" />
          Stuck tickets
        </CardTitle>
      </CardHeader>
      <CardContent className="h-64 overflow-y-auto p-0">
        {visible.length === 0 ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">No stuck tickets 🎉</p>
        ) : (
          <div className="divide-y">
            {visible.map((wp) => (
              <div
                key={wp.id}
                role="link"
                tabIndex={0}
                aria-label={`Open ticket ${wp.subject} in OpenProject`}
                className="flex cursor-pointer items-center justify-between gap-3 px-6 py-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onSelect(wp.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(wp.id);
                  }
                }}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-medium" title={wp.subject}>
                    {wp.subject}
                  </span>
                  <StatusBadge status={wp.statusLabel ?? wp.status} />
                </div>
                <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                  {daysIdle(wp.updatedAt)}d idle
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
