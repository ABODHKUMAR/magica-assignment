// Shared domain types for the Py workflow builder.
// See task.md Section C.6 (node types) and Section G (data model).

export type NodeType = "request-inputs" | "crop-image" | "gemini" | "response";

/** Data-type of a handle, used for type-safe connections (task.md C.8). */
export type PortType = "text" | "image" | "number" | "video" | "audio" | "file" | "any";

export type PortDirection = "input" | "output";

export interface PortSpec {
  id: string;
  label: string;
  type: PortType;
  direction: PortDirection;
  required?: boolean;
  /** Target handle accepts more than one incoming edge (Vision, Response.result). */
  multi?: boolean;
}

/** A user-defined field on the Request-Inputs node. */
export interface RequestInputField {
  id: string;
  name: string;
  kind: "text_field" | "image_field";
  value: string; // text content, or uploaded image URL
}

export type NodeExecStatus =
  | "idle"
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

/** Per-node data stored inside a React Flow node. */
export interface WorkflowNodeData {
  type: NodeType;
  label: string;
  // Request-Inputs
  fields?: RequestInputField[];
  // Crop Image
  crop?: { inputImage: string; x: number; y: number; width: number; height: number };
  // Gemini
  gemini?: {
    model: string;
    prompt: string;
    systemPrompt: string;
    settings?: { temperature?: number; maxOutputTokens?: number };
  };
  // Runtime (not persisted meaningfully; recomputed on run)
  status?: NodeExecStatus;
  output?: unknown;
  error?: string | null;
  durationMs?: number;
  [key: string]: unknown;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
  deletable?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type RunScope = "full" | "partial" | "single";
export type RunStatus = "running" | "success" | "failed" | "partial";
