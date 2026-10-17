// The required pre-built sample workflow (task.md Section K + screenshot 13).
// Deterministic ids so it can be seeded and asserted in tests.

import { DEFAULT_GEMINI_MODEL } from "./nodes";
import type { WorkflowGraph } from "./types";

export const SAMPLE_WORKFLOW_NAME = "Trial Task Workflow";

const TEXT_FIELD_ID = "tf_product";
const IMAGE_FIELD_ID = "if_product";

export function buildSampleWorkflow(): WorkflowGraph {
  const nodes: WorkflowGraph["nodes"] = [
    {
      id: "request-inputs",
      type: "request-inputs",
      position: { x: 0, y: 360 },
      deletable: false,
      data: {
        type: "request-inputs",
        label: "Request Inputs",
        status: "idle",
        fields: [
          {
            id: TEXT_FIELD_ID,
            name: "text_field",
            kind: "text_field",
            value:
              "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.",
          },
          { id: IMAGE_FIELD_ID, name: "image_field", kind: "image_field", value: "" },
        ],
      },
    },
    {
      id: "gemini-1",
      type: "gemini",
      position: { x: 300, y: 20 },
      deletable: true,
      data: {
        type: "gemini",
        label: "Gemini 3.1 Pro",
        status: "idle",
        gemini: {
          model: DEFAULT_GEMINI_MODEL,
          prompt: "",
          systemPrompt: "You are a marketing copywriter. Write a one-paragraph product description.",
          settings: { temperature: 0.7 },
        },
      },
    },
    {
      id: "gemini-2",
      type: "gemini",
      position: { x: 640, y: 80 },
      deletable: true,
      data: {
        type: "gemini",
        label: "Gemini 3.1 Pro",
        status: "idle",
        gemini: {
          model: DEFAULT_GEMINI_MODEL,
          prompt: "",
          systemPrompt:
            "Condense the following product description into a tweet-length hook (under 240 characters).",
          settings: { temperature: 0.7 },
        },
      },
    },
    {
      id: "crop-1",
      type: "crop-image",
      position: { x: 300, y: 360 },
      deletable: true,
      data: {
        type: "crop-image",
        label: "Crop Image",
        status: "idle",
        crop: { inputImage: "", x: 50, y: 50, width: 70, height: 70 },
      },
    },
    {
      id: "crop-2",
      type: "crop-image",
      position: { x: 300, y: 620 },
      deletable: true,
      data: {
        type: "crop-image",
        label: "Crop Image",
        status: "idle",
        crop: { inputImage: "", x: 50, y: 50, width: 100, height: 100 },
      },
    },
    {
      id: "gemini-final",
      type: "gemini",
      position: { x: 980, y: 320 },
      deletable: true,
      data: {
        type: "gemini",
        label: "Gemini 3.1 Pro",
        status: "idle",
        gemini: {
          model: DEFAULT_GEMINI_MODEL,
          prompt: "",
          systemPrompt:
            "You are a social media manager. Combine the tweet hook and the two product crops into a final marketing post.",
          settings: { temperature: 0.7 },
        },
      },
    },
    {
      id: "response",
      type: "response",
      position: { x: 1340, y: 440 },
      deletable: false,
      data: { type: "response", label: "Response", status: "idle" },
    },
  ];

  const edges: WorkflowGraph["edges"] = [
    e("request-inputs", TEXT_FIELD_ID, "gemini-1", "prompt"),
    e("request-inputs", IMAGE_FIELD_ID, "crop-1", "inputImage"),
    e("request-inputs", IMAGE_FIELD_ID, "crop-2", "inputImage"),
    e("gemini-1", "response", "gemini-2", "prompt"),
    e("gemini-2", "response", "gemini-final", "prompt"),
    e("crop-1", "outputImage", "gemini-final", "image"),
    e("crop-2", "outputImage", "gemini-final", "image"),
    e("gemini-final", "response", "response", "result"),
    e("crop-2", "outputImage", "response", "result"),
  ];

  return { nodes, edges };
}

function e(source: string, sourceHandle: string, target: string, targetHandle: string) {
  return {
    id: `e-${source}.${sourceHandle}-${target}.${targetHandle}`,
    source,
    sourceHandle,
    target,
    targetHandle,
  };
}

/** A blank workflow: just the two non-deletable singletons. */
export function buildBlankWorkflow(): WorkflowGraph {
  return {
    nodes: [
      {
        id: "request-inputs",
        type: "request-inputs",
        position: { x: 80, y: 240 },
        deletable: false,
        data: {
          type: "request-inputs",
          label: "Request Inputs",
          status: "idle",
          fields: [{ id: "tf_1", name: "text_field", kind: "text_field", value: "" }],
        },
      },
      {
        id: "response",
        type: "response",
        position: { x: 720, y: 280 },
        deletable: false,
        data: { type: "response", label: "Response", status: "idle" },
      },
    ],
    edges: [],
  };
}
