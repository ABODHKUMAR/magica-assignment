// Node registry: declares ports + defaults for each node type.
// See task.md Section C.6 / C.7.

import { nanoid } from "nanoid";
import type {
  GraphNode,
  NodeType,
  PortSpec,
  PortType,
  RequestInputField,
  WorkflowNodeData,
} from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-pro-preview";

/** Pre-placed, non-deletable singleton node types (task.md C.6). */
export const SINGLETON_TYPES: NodeType[] = ["request-inputs", "response"];

export interface NodeDefinition {
  type: NodeType;
  title: string;
  /** Static ports. Request-Inputs ports are dynamic (derived from fields). */
  inputs: PortSpec[];
  outputs: PortSpec[];
  deletable: boolean;
  duplicable: boolean;
  category: "input" | "image" | "llm" | "output";
}

export const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
  "request-inputs": {
    type: "request-inputs",
    title: "Request Inputs",
    inputs: [],
    outputs: [], // dynamic — one output per field
    deletable: false,
    duplicable: false,
    category: "input",
  },
  "crop-image": {
    type: "crop-image",
    title: "Crop Image",
    inputs: [
      { id: "inputImage", label: "Input Image", type: "image", direction: "input", required: true },
      { id: "x", label: "X Position (%)", type: "number", direction: "input" },
      { id: "y", label: "Y Position (%)", type: "number", direction: "input" },
      { id: "width", label: "Width (%)", type: "number", direction: "input" },
      { id: "height", label: "Height (%)", type: "number", direction: "input" },
    ],
    outputs: [{ id: "outputImage", label: "Output Image", type: "image", direction: "output" }],
    deletable: true,
    duplicable: true,
    category: "image",
  },
  gemini: {
    type: "gemini",
    title: "Gemini 3.1 Pro",
    inputs: [
      { id: "prompt", label: "Prompt", type: "text", direction: "input", required: true },
      { id: "systemPrompt", label: "System Prompt", type: "text", direction: "input" },
      { id: "image", label: "Image (Vision)", type: "image", direction: "input", multi: true },
      { id: "video", label: "Video", type: "video", direction: "input" },
      { id: "audio", label: "Audio", type: "audio", direction: "input" },
      { id: "file", label: "File", type: "file", direction: "input" },
    ],
    outputs: [{ id: "response", label: "Response", type: "text", direction: "output" }],
    deletable: true,
    duplicable: true,
    category: "llm",
  },
  response: {
    type: "response",
    title: "Response",
    inputs: [{ id: "result", label: "result", type: "any", direction: "input", multi: true }],
    outputs: [],
    deletable: false,
    duplicable: false,
    category: "output",
  },
};

/** Resolve the actual input ports for a node (Request-Inputs has none as inputs). */
export function getInputPorts(node: GraphNode): PortSpec[] {
  return NODE_DEFINITIONS[node.type].inputs;
}

/** Resolve the actual output ports for a node (Request-Inputs: one per field). */
export function getOutputPorts(node: GraphNode): PortSpec[] {
  if (node.type === "request-inputs") {
    const fields = node.data.fields ?? [];
    return fields.map((f) => ({
      id: f.id,
      label: f.name,
      type: (f.kind === "image_field" ? "image" : "text") as PortType,
      direction: "output" as const,
    }));
  }
  return NODE_DEFINITIONS[node.type].outputs;
}

export function findOutputPort(node: GraphNode, handleId: string): PortSpec | undefined {
  return getOutputPorts(node).find((p) => p.id === handleId);
}

export function findInputPort(node: GraphNode, handleId: string): PortSpec | undefined {
  return getInputPorts(node).find((p) => p.id === handleId);
}

export function makeField(kind: RequestInputField["kind"], index: number): RequestInputField {
  const base = kind === "image_field" ? "image_field" : "text_field";
  return {
    id: nanoid(8),
    name: index <= 1 ? base : `${base}_${index}`,
    kind,
    value: "",
  };
}

/** Build default data for a freshly created node. */
export function defaultNodeData(type: NodeType): WorkflowNodeData {
  switch (type) {
    case "request-inputs":
      return { type, label: "Request Inputs", fields: [], status: "idle" };
    case "crop-image":
      return {
        type,
        label: "Crop Image",
        crop: { inputImage: "", x: 0, y: 0, width: 100, height: 100 },
        status: "idle",
      };
    case "gemini":
      return {
        type,
        label: "Gemini 3.1 Pro",
        gemini: {
          model: DEFAULT_GEMINI_MODEL,
          prompt: "",
          systemPrompt: "",
          settings: { temperature: 0.7 },
        },
        status: "idle",
      };
    case "response":
      return { type, label: "Response", status: "idle" };
  }
}

export function createNode(type: NodeType, position: { x: number; y: number }): GraphNode {
  const def = NODE_DEFINITIONS[type];
  return {
    id: `${type}-${nanoid(6)}`,
    type,
    position,
    data: defaultNodeData(type),
    deletable: def.deletable,
  };
}

