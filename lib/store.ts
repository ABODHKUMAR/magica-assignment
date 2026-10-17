// Zustand store for the workflow canvas: graph state, undo/redo, run status.
// task.md C.8 / D.

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import { create } from "zustand";
import { validateConnection } from "./dag";
import {
  createNode,
  findOutputPort,
  NODE_DEFINITIONS,
  SINGLETON_TYPES,
} from "./nodes";
import type {
  GraphEdge,
  GraphNode,
  NodeExecStatus,
  NodeType,
  PortType,
  WorkflowGraph,
  WorkflowNodeData,
} from "./types";

export type RFNode = Node<WorkflowNodeData>;

const EDGE_COLORS: Record<string, string> = {
  image: "#3b82f6", // blue
  text: "#f59e0b", // orange/amber
  number: "#94a3b8",
  video: "#8b5cf6",
  audio: "#10b981",
  file: "#64748b",
  any: "#f59e0b",
};

export function edgeColorForType(type: PortType): string {
  return EDGE_COLORS[type] ?? "#94a3b8";
}

function styledEdge(edge: Edge, nodes: RFNode[]): Edge {
  const src = nodes.find((n) => n.id === edge.source);
  const port = src ? findOutputPort(toGraphNode(src), edge.sourceHandle ?? "") : undefined;
  const color = edgeColorForType(port?.type ?? "any");
  return {
    ...edge,
    type: "default",
    className: "py-edge-animated",
    style: { stroke: color, strokeWidth: 2 },
  };
}

function toGraphNode(n: RFNode): GraphNode {
  return {
    id: n.id,
    type: n.data.type,
    position: n.position,
    data: n.data,
    deletable: n.deletable,
  };
}

function toRFNode(n: GraphNode): RFNode {
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    deletable: n.deletable ?? NODE_DEFINITIONS[n.type].deletable,
  };
}

export function graphToRF(graph: WorkflowGraph): { nodes: RFNode[]; edges: Edge[] } {
  const nodes = graph.nodes.map(toRFNode);
  const edges = graph.edges.map((e) =>
    styledEdge(
      { id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target, targetHandle: e.targetHandle },
      nodes,
    ),
  );
  return { nodes, edges };
}

export function rfToGraph(nodes: RFNode[], edges: Edge[]): WorkflowGraph {
  return {
    nodes: nodes.map(toGraphNode),
    edges: edges.map(
      (e): GraphEdge => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle ?? "",
        target: e.target,
        targetHandle: e.targetHandle ?? "",
      }),
    ),
  };
}

interface Snapshot {
  nodes: RFNode[];
  edges: Edge[];
}

interface CanvasState {
  nodes: RFNode[];
  edges: Edge[];
  past: Snapshot[];
  future: Snapshot[];
  dirty: boolean;
  lastConnectionError: string | null;

  load: (graph: WorkflowGraph) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;
  isValidConnection: (conn: Connection | Edge) => boolean;

  addNodeOfType: (type: NodeType, position: { x: number; y: number }) => void;
  duplicateNode: (id: string) => void;
  deleteNode: (id: string) => void;
  updateNodeData: (id: string, patch: Partial<WorkflowNodeData>) => void;

  setNodeStatus: (id: string, status: NodeExecStatus, extra?: Partial<WorkflowNodeData>) => void;
  resetStatuses: () => void;

  undo: () => void;
  redo: () => void;
  clearDirty: () => void;
  getGraph: () => WorkflowGraph;
}

function snapshot(s: Pick<CanvasState, "nodes" | "edges">): Snapshot {
  return { nodes: s.nodes, edges: s.edges };
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  past: [],
  future: [],
  dirty: false,
  lastConnectionError: null,

  load: (graph) => {
    const { nodes, edges } = graphToRF(graph);
    set({ nodes, edges, past: [], future: [], dirty: false });
  },

  onNodesChange: (changes) => {
    // Block removal of non-deletable singletons.
    const filtered = changes.filter((c) => {
      if (c.type === "remove") {
        const node = get().nodes.find((n) => n.id === c.id);
        if (node && SINGLETON_TYPES.includes(node.data.type)) return false;
      }
      return true;
    });
    const structural = filtered.some((c) => c.type === "remove");
    set((s) => ({
      nodes: applyNodeChanges(filtered, s.nodes) as RFNode[],
      ...(structural ? { past: [...s.past, snapshot(s)], future: [], dirty: true } : {}),
    }));
  },

  onEdgesChange: (changes) => {
    const structural = changes.some((c) => c.type === "remove");
    set((s) => ({
      edges: applyEdgeChanges(changes, s.edges),
      ...(structural ? { past: [...s.past, snapshot(s)], future: [], dirty: true } : {}),
    }));
  },

  isValidConnection: (conn) => {
    const graph = get().getGraph();
    const res = validateConnection(graph, {
      source: conn.source ?? "",
      sourceHandle: conn.sourceHandle ?? "",
      target: conn.target ?? "",
      targetHandle: conn.targetHandle ?? "",
    });
    return res.ok;
  },

  onConnect: (conn) => {
    const graph = get().getGraph();
    const res = validateConnection(graph, {
      source: conn.source ?? "",
      sourceHandle: conn.sourceHandle ?? "",
      target: conn.target ?? "",
      targetHandle: conn.targetHandle ?? "",
    });
    if (!res.ok) {
      set({ lastConnectionError: res.reason ?? "Invalid connection" });
      return;
    }
    set((s) => {
      const newEdge = styledEdge(
        {
          id: `e-${nanoid(8)}`,
          source: conn.source!,
          sourceHandle: conn.sourceHandle ?? undefined,
          target: conn.target!,
          targetHandle: conn.targetHandle ?? undefined,
        },
        s.nodes,
      );
      return {
        edges: addEdge(newEdge, s.edges),
        past: [...s.past, snapshot(s)],
        future: [],
        dirty: true,
        lastConnectionError: null,
      };
    });
  },

  addNodeOfType: (type, position) => {
    const node = toRFNode(createNode(type, position));
    set((s) => ({
      nodes: [...s.nodes, node],
      past: [...s.past, snapshot(s)],
      future: [],
      dirty: true,
    }));
  },

  duplicateNode: (id) => {
    const src = get().nodes.find((n) => n.id === id);
    if (!src || !NODE_DEFINITIONS[src.data.type].duplicable) return;
    const copy: RFNode = {
      ...src,
      id: `${src.data.type}-${nanoid(6)}`,
      position: { x: src.position.x + 40, y: src.position.y + 40 },
      selected: false,
      data: structuredClone(src.data),
    };
    set((s) => ({
      nodes: [...s.nodes, copy],
      past: [...s.past, snapshot(s)],
      future: [],
      dirty: true,
    }));
  },

  deleteNode: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node || SINGLETON_TYPES.includes(node.data.type)) return;
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      past: [...s.past, snapshot(s)],
      future: [],
      dirty: true,
    }));
  },

  updateNodeData: (id, patch) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
      dirty: true,
    }));
  },

  setNodeStatus: (id, status, extra) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, status, ...extra } } : n,
      ),
    }));
  },

  resetStatuses: () => {
    set((s) => ({
      nodes: s.nodes.map((n) => ({
        ...n,
        data: { ...n.data, status: "idle", error: null },
      })),
    }));
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1]!;
    set((s) => ({
      nodes: prev.nodes,
      edges: prev.edges,
      past: past.slice(0, -1),
      future: [snapshot(s), ...s.future],
      dirty: true,
    }));
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;
    const next = future[0]!;
    set((s) => ({
      nodes: next.nodes,
      edges: next.edges,
      past: [...s.past, snapshot(s)],
      future: future.slice(1),
      dirty: true,
    }));
  },

  clearDirty: () => set({ dirty: false }),

  getGraph: () => rfToGraph(get().nodes, get().edges),
}));
