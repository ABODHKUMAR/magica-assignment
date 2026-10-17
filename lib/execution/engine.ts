// DAG execution engine. Fans each node out the instant its OWN direct
// dependencies finish — never blocking on unrelated siblings (task.md F.3).
// Executable nodes (crop, gemini) run their task logic; request-inputs and
// response are local-only.

import { directUpstream } from "../dag";
import { getInputPorts, getOutputPorts } from "../nodes";
import type { GraphNode, NodeExecStatus, RunScope, WorkflowGraph } from "../types";
import { dispatchCrop, dispatchGemini } from "./dispatch";

export interface NodeRunResult {
  nodeId: string;
  nodeType: string;
  label: string;
  status: NodeExecStatus;
  inputs: Record<string, unknown>;
  output: unknown;
  error: string | null;
  durationMs: number;
  startedAt: number;
  finishedAt: number;
}

export interface ExecuteOptions {
  scope: RunScope;
  targetNodeIds?: string[];
  /** Overrides the mandatory crop delay (used by tests). */
  cropDelayMs?: number;
  /** Called on every node status transition (for live glow + history). */
  onNodeUpdate?: (nodeId: string, status: NodeExecStatus, result?: Partial<NodeRunResult>) => void;
  /** Clock injection for deterministic tests. */
  now?: () => number;
}

export interface ExecuteResult {
  status: "success" | "failed" | "partial";
  nodeResults: NodeRunResult[];
  durationMs: number;
}

/** The primary output value a node produces, keyed by output handle id. */
function outputByHandle(node: GraphNode, primary: unknown): Record<string, unknown> {
  const ports = getOutputPorts(node);
  const map: Record<string, unknown> = {};
  if (node.type === "request-inputs") {
    for (const f of node.data.fields ?? []) map[f.id] = f.value;
    return map;
  }
  for (const p of ports) map[p.id] = primary;
  return map;
}

export async function executeGraph(
  graph: WorkflowGraph,
  opts: ExecuteOptions,
): Promise<ExecuteResult> {
  const now = opts.now ?? (() => Date.now());
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  // Determine the set of nodes to run.
  const runSet = new Set<string>(
    opts.scope === "full"
      ? graph.nodes.map((n) => n.id)
      : opts.targetNodeIds ?? [],
  );

  // Cached outputs available to nodes (per output-handle). Seed with any
  // previously-computed outputs on nodes OUTSIDE the run set so selective runs
  // can still read upstream values.
  const outputs = new Map<string, Record<string, unknown>>();
  for (const n of graph.nodes) {
    if (!runSet.has(n.id)) {
      if (n.type === "request-inputs") outputs.set(n.id, outputByHandle(n, undefined));
      else if (n.data.output !== undefined) outputs.set(n.id, outputByHandle(n, n.data.output));
    }
  }

  const results = new Map<string, NodeRunResult>();
  const promises = new Map<string, Promise<void>>();
  const runStart = now();

  const resolveInputs = (node: GraphNode): Record<string, unknown> => {
    const resolved: Record<string, unknown> = {};
    for (const port of getInputPorts(node)) {
      const incoming = graph.edges.filter(
        (e) => e.target === node.id && e.targetHandle === port.id,
      );
      if (incoming.length > 0) {
        const values = incoming.map((e) => outputs.get(e.source)?.[e.sourceHandle]);
        resolved[port.id] = port.multi ? values.filter((v) => v !== undefined) : values[0];
      } else {
        resolved[port.id] = manualValue(node, port.id);
      }
    }
    // Response node: collect every incoming edge into a labelled list.
    if (node.type === "response") {
      const collected = graph.edges
        .filter((e) => e.target === node.id)
        .map((e) => ({
          from: e.source,
          handle: e.sourceHandle,
          value: outputs.get(e.source)?.[e.sourceHandle],
        }));
      resolved["result"] = collected;
    }
    return resolved;
  };

  const runNode = (id: string): Promise<void> => {
    const existing = promises.get(id);
    if (existing) return existing;

    const p = (async () => {
      const node = nodeById.get(id);
      if (!node) return;

      // Wait ONLY for direct upstream deps that are themselves in the run set.
      const deps = directUpstream(graph.edges, id).filter((d) => runSet.has(d));
      await Promise.all(deps.map(runNode));

      // If a dependency failed/was skipped, skip this node.
      const blocked = deps.some((d) => {
        const r = results.get(d);
        return r && (r.status === "failed" || r.status === "skipped");
      });
      if (blocked) {
        const skipped = baseResult(node, now());
        skipped.status = "skipped";
        skipped.finishedAt = skipped.startedAt;
        results.set(id, skipped);
        opts.onNodeUpdate?.(id, "skipped", skipped);
        return;
      }

      const startedAt = now();
      opts.onNodeUpdate?.(id, "running", { startedAt });
      const inputs = resolveInputs(node);
      try {
        const primary = await executeNode(node, inputs, opts.cropDelayMs);
        outputs.set(id, outputByHandle(node, primary));
        const finishedAt = now();
        const res: NodeRunResult = {
          nodeId: id,
          nodeType: node.type,
          label: node.data.label,
          status: "success",
          inputs,
          output: primary,
          error: null,
          durationMs: finishedAt - startedAt,
          startedAt,
          finishedAt,
        };
        results.set(id, res);
        opts.onNodeUpdate?.(id, "success", res);
      } catch (err) {
        const finishedAt = now();
        const res: NodeRunResult = {
          nodeId: id,
          nodeType: node.type,
          label: node.data.label,
          status: "failed",
          inputs,
          output: null,
          error: err instanceof Error ? err.message : String(err),
          durationMs: finishedAt - startedAt,
          startedAt,
          finishedAt,
        };
        results.set(id, res);
        opts.onNodeUpdate?.(id, "failed", res);
      }
    })();

    promises.set(id, p);
    return p;
  };

  await Promise.all([...runSet].map(runNode));

  const nodeResults = [...results.values()].sort((a, b) => a.startedAt - b.startedAt);
  const anyFailed = nodeResults.some((r) => r.status === "failed" || r.status === "skipped");
  const allFailed = nodeResults.length > 0 && nodeResults.every((r) => r.status !== "success");
  const status: ExecuteResult["status"] = allFailed
    ? "failed"
    : anyFailed
      ? "partial"
      : "success";

  return { status, nodeResults, durationMs: now() - runStart };
}

function baseResult(node: GraphNode, t: number): NodeRunResult {
  return {
    nodeId: node.id,
    nodeType: node.type,
    label: node.data.label,
    status: "pending",
    inputs: {},
    output: null,
    error: null,
    durationMs: 0,
    startedAt: t,
    finishedAt: t,
  };
}

function manualValue(node: GraphNode, portId: string): unknown {
  switch (node.type) {
    case "crop-image": {
      const c = node.data.crop;
      if (!c) return undefined;
      if (portId === "inputImage") return c.inputImage;
      return (c as unknown as Record<string, number>)[portId];
    }
    case "gemini": {
      const g = node.data.gemini;
      if (!g) return undefined;
      if (portId === "prompt") return g.prompt;
      if (portId === "systemPrompt") return g.systemPrompt;
      return undefined;
    }
    default:
      return undefined;
  }
}

/** Execute a single node's task and return its primary output value. */
async function executeNode(
  node: GraphNode,
  inputs: Record<string, unknown>,
  cropDelayMs?: number,
): Promise<unknown> {
  switch (node.type) {
    case "request-inputs":
      return undefined; // outputs come straight from field values
    case "response":
      return inputs["result"]; // collected list
    case "crop-image": {
      const image = String(inputs["inputImage"] ?? node.data.crop?.inputImage ?? "");
      return dispatchCrop(
        {
          inputImage: image,
          x: num(inputs["x"], node.data.crop?.x ?? 0),
          y: num(inputs["y"], node.data.crop?.y ?? 0),
          width: num(inputs["width"], node.data.crop?.width ?? 100),
          height: num(inputs["height"], node.data.crop?.height ?? 100),
        },
        cropDelayMs,
      );
    }
    case "gemini": {
      const g = node.data.gemini;
      const images = Array.isArray(inputs["image"])
        ? (inputs["image"] as unknown[]).map(String)
        : inputs["image"]
          ? [String(inputs["image"])]
          : [];
      return dispatchGemini({
        model: g?.model ?? "gemini-3.8-pro-preview",
        prompt: String(inputs["prompt"] ?? g?.prompt ?? ""),
        systemPrompt: String(inputs["systemPrompt"] ?? g?.systemPrompt ?? ""),
        images,
        settings: g?.settings,
      });
    }
  }
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

