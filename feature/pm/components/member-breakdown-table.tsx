"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { MemberWorkloadStat } from "@/core/domain/types";

interface MemberBreakdownTableProps {
  members: MemberWorkloadStat[];
  loading: boolean;
}

/**
 * Per-member rollup of a project's tasks/bugs — the Project Manager mode's equivalent of the
 * single-user Dashboard's "recent tickets" table, but one row per team member instead of one
 * row per ticket.
 */
export function MemberBreakdownTable({ members, loading }: MemberBreakdownTableProps) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-medium">Team breakdown</h2>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead className="text-right">Tasks</TableHead>
              <TableHead className="text-right">Bugs</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead className="text-right">Closed</TableHead>
              <TableHead className="text-right">Overdue</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No work packages found for this project.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={`${member.memberId}-${member.memberName}`}>
                  <TableCell className="font-medium">{member.memberName}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{member.taskCount}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{member.bugCount}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{member.openCount}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{member.closedCount}</TableCell>
                  <TableCell className="text-right">
                    {member.overdueCount > 0 ? (
                      <Badge
                        variant="secondary"
                        className="border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                      >
                        {member.overdueCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{member.totalCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
