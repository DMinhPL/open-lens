import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { WorkPackage } from "@/core/domain/types";

export interface TicketFlowNodeData extends Record<string, unknown> {
  workPackage?: WorkPackage;
  external?: { id: number; title: string };
  childCount: number;
}

export type TicketFlowNode = Node<TicketFlowNodeData>;

const NODE_WIDTH = 240;
const NODE_HEIGHT = 84;

/**
 * Builds a React Flow node/edge graph from a flat, filtered `WorkPackage[]` and lays it out
 * top-to-bottom with dagre. A ticket whose `parentId` isn't present in `workPackages` (its
 * parent lives outside the current filtered set) gets a synthetic dashed "external" node —
 * OpenProject's `_links.parent` already gives us `{ id, title }` for it, no extra fetch needed.
 */
export function buildTicketFlow(workPackages: WorkPackage[]): { nodes: TicketFlowNode[]; edges: Edge[] } {
  const idSet = new Set(workPackages.map((wp) => wp.id));
  const childCounts = new Map<string, number>();
  const externalNodes = new Map<string, TicketFlowNode>();
  const edges: Edge[] = [];

  function edgeStyle(id: string, source: string, target: string): Edge {
    return { id, source, target, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } };
  }

  for (const wp of workPackages) {
    if (wp.parentId === undefined) continue;
    const childId = String(wp.id);

    if (idSet.has(wp.parentId)) {
      const parentId = String(wp.parentId);
      edges.push(edgeStyle(`${parentId}->${childId}`, parentId, childId));
      childCounts.set(parentId, (childCounts.get(parentId) ?? 0) + 1);
      continue;
    }

    const externalId = `external-${wp.parentId}`;
    if (!externalNodes.has(externalId)) {
      externalNodes.set(externalId, {
        id: externalId,
        type: "ticket",
        position: { x: 0, y: 0 },
        data: { external: { id: wp.parentId, title: wp.parentTitle ?? `#${wp.parentId}` }, childCount: 0 },
      });
    }
    edges.push(edgeStyle(`${externalId}->${childId}`, externalId, childId));
    externalNodes.get(externalId)!.data.childCount += 1;
  }

  const ticketNodes: TicketFlowNode[] = workPackages.map((wp) => ({
    id: String(wp.id),
    type: "ticket",
    position: { x: 0, y: 0 },
    data: { workPackage: wp, childCount: childCounts.get(String(wp.id)) ?? 0 },
  }));

  const nodes = [...ticketNodes, ...externalNodes.values()];
  return { nodes: layoutNodes(nodes, edges), edges };
}

function layoutNodes(nodes: TicketFlowNode[], edges: Edge[]): TicketFlowNode[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 80 });

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const { x, y } = graph.node(node.id);
    return { ...node, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } };
  });
}
