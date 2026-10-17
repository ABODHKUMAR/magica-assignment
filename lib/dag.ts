// DAG utilities: topological ordering, cycle detection, level grouping,
// and type-safe connection validation. Core grading criteria (task.md C.8, F.3).

import { findInputPort, findOutputPort } from "./nodes";
import type { GraphEdge, GraphNode, PortType, WorkflowGraph } from "./types";

/** Can an output of `from` connect into an input of `to`? */
export function isTypeCompatible(from: PortType, to: PortType): boolean {
  if (to === "any") return true; // Response.result accepts anything
  if (from === "any") return true;
  return from === to;
}

export interface ConnectionCandidate {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Validate a prospective connection: must be type-safe, not a self-loop,
 * and must not introduce a cycle (DAG-only).
 */
export function validateConnection(
  graph: WorkflowGraph,
  candidate: ConnectionCandidate,
): ValidationResult {
  const { source, sourceHandle, target, targetHandle } = candidate;

  if (source === target) return { ok: false, reason: "Cannot connect a node to itself" };

  const sourceNode = graph.nodes.find((n) => n.id === source);
  const targetNode = graph.nodes.find((n) => n.id === target);
  if (!sourceNode || !targetNode) return { ok: false, reason: "Unknown node" };

  const outPort = findOutputPort(sourceNode, sourceHandle);
  const inPort = findInputPort(targetNode, targetHandle);
  if (!outPort) return { ok: false, reason: "Unknown source handle" };
  if (!inPort) return { ok: false, reason: "Unknown target handle" };

  if (!isTypeCompatible(outPort.type, inPort.type)) {
    return { ok: false, reason: `Type mismatch: ${outPort.type} → ${inPort.type}` };
  }

  // Single-connection input handles reject a second edge.
  if (!inPort.multi) {
    const existing = graph.edges.some(
      (e) => e.target === target && e.targetHandle === targetHandle,
    );
    if (existing) return { ok: false, reason: "Input already connected" };
  }

  // Cycle check: adding source->target must keep the graph acyclic.
  if (wouldCreateCycle(graph.edges, source, target)) {
    return { ok: false, reason: "Connection would create a cycle" };
  }

  return { ok: true };
}

/** Does adding edge (from -> to) create a cycle? True if `from` is reachable from `to`. */
export function wouldCreateCycle(edges: GraphEdge[], from: string, to: string): boolean {
  if (from === to) return true;
  const adj = buildAdjacency(edges);
  const stack = [to];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === from) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adj.get(cur) ?? []) stack.push(next);
  }
  return false;
}

function buildAdjacency(edges: GraphEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  return adj;
}

/** Direct upstream node ids for a node (nodes feeding its inputs). */
export function directUpstream(edges: GraphEdge[], nodeId: string): string[] {
  return Array.from(
    new Set(edges.filter((e) => e.target === nodeId).map((e) => e.source)),
  );
}

/** Direct downstream node ids for a node. */
export function directDownstream(edges: GraphEdge[], nodeId: string): string[] {
  return Array.from(
    new Set(edges.filter((e) => e.source === nodeId).map((e) => e.target)),
  );
}

/**
 * Kahn topological sort over a subset of nodes. Throws if a cycle exists.
 * Returns node ids in a valid execution order.
 */
export function topologicalSort(nodes: GraphNode[], edges: GraphEdge[]): string[] {
  const ids = new Set(nodes.map((n) => n.id));
  const indegree = new Map<string, number>();
  for (const id of ids) indegree.set(id, 0);

  const relevant = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  for (const e of relevant) indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);

  const queue = [...ids].filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    order.push(cur);
    for (const e of relevant.filter((x) => x.source === cur)) {
      const d = (indegree.get(e.target) ?? 0) - 1;
      indegree.set(e.target, d);
      if (d === 0) queue.push(e.target);
    }
  }

  if (order.length !== ids.size) throw new Error("Graph contains a cycle");
  return order;
}

/**
 * Group nodes into DAG "levels" (layers). Nodes in the same level have no
 * dependency on each other and can execute concurrently (task.md F.3).
 * NOTE: levels are only for diagnostics/visualisation. The executor fans out
 * each node the instant its own direct dependencies finish — it does NOT wait
 * for a whole level (task.md: "must never block on unrelated siblings").
 */
export function computeLevels(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
  const order = topologicalSort(nodes, edges);
  const level = new Map<string, number>();
  for (const id of order) {
    const ups = directUpstream(edges, id).filter((u) => level.has(u));
    const lvl = ups.length === 0 ? 0 : Math.max(...ups.map((u) => level.get(u)!)) + 1;
    level.set(id, lvl);
  }
  const maxLevel = Math.max(0, ...level.values());
  const levels: string[][] = Array.from({ length: maxLevel + 1 }, () => []);
  for (const [id, lvl] of level) levels[lvl]!.push(id);
  return levels;
}

/**
 * Given a target set of nodes to run, compute the full set of nodes that must
 * execute (the targets plus all their transitive upstream dependencies).
 * Used by single / multi-select runs so required inputs are produced.
 */
export function withUpstream(
  targetIds: string[],
  edges: GraphEdge[],
): Set<string> {
  const result = new Set<string>(targetIds);
  const stack = [...targetIds];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const up of directUpstream(edges, cur)) {
      if (!result.has(up)) {
        result.add(up);
        stack.push(up);
      }
    }
  }
  return result;
}
