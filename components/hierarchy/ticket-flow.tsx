"use client";

import { useMemo } from "react";
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildTicketFlow, type TicketFlowNodeData } from "@/lib/ticket-flow-layout";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { getTypeBadgeStyle } from "@/lib/type-colors";
import { cn } from "@/lib/utils";
import type { WorkPackage } from "@/lib/types";

interface TicketFlowProps {
  workPackages: WorkPackage[];
  onSelect: (ticketId: number) => void;
}

function TicketFlowNodeCard({ data }: Readonly<NodeProps>) {
  const nodeData = data as TicketFlowNodeData;

  if (nodeData.external) {
    return (
      <div className="w-60 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-muted-foreground shadow-sm">
        <Handle type="target" position={Position.Top} className="invisible" />
        <div className="truncate text-sm font-medium" title={nodeData.external.title}>
          {nodeData.external.title}
        </div>
        <div className="text-xs">External parent · #{nodeData.external.id}</div>
        <Handle type="source" position={Position.Bottom} className="invisible" />
      </div>
    );
  }

  const workPackage = nodeData.workPackage!;
  return (
    <div className="w-60 rounded-lg border bg-card px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Top} className="invisible" />
      <div className="truncate text-sm font-medium" title={workPackage.subject}>
        {workPackage.subject}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <Badge variant="outline" className={cn("text-[10px]", getTypeBadgeStyle(workPackage.type))}>
          {workPackage.type}
        </Badge>
        <StatusBadge status={workPackage.statusLabel ?? workPackage.status} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <PriorityBadge priority={workPackage.priority} />
        {nodeData.childCount > 0 && (
          <span>
            {nodeData.childCount} sub-ticket{nodeData.childCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="invisible" />
    </div>
  );
}

const NODE_TYPES = { ticket: TicketFlowNodeCard };

export function TicketFlow({ workPackages, onSelect }: Readonly<TicketFlowProps>) {
  const { nodes, edges } = useMemo(() => buildTicketFlow(workPackages), [workPackages]);

  if (nodes.length === 0) {
    return <p className="p-4 text-center text-sm text-muted-foreground">No tickets match the current filters.</p>;
  }

  return (
    <div className="h-[70vh] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={(_, node) => {
          const nodeData = node.data as TicketFlowNodeData;
          const ticketId = nodeData.workPackage?.id ?? nodeData.external?.id;
          if (ticketId !== undefined) onSelect(ticketId);
        }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls />
        <MiniMap pannable zoomable className="!bg-muted" />
      </ReactFlow>
    </div>
  );
}
