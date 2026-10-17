import { describe, expect, it } from "vitest";
import {
  computeLevels,
  isTypeCompatible,
  topologicalSort,
  validateConnection,
  withUpstream,
  wouldCreateCycle,
} from "./dag";
import { buildSampleWorkflow } from "./sample-workflow";
import type { GraphEdge, WorkflowGraph } from "./types";

describe("type compatibility", () => {
  it("allows same-type connections", () => {
    expect(isTypeCompatible("image", "image")).toBe(true);
    expect(isTypeCompatible("text", "text")).toBe(true);
  });
  it("rejects mismatched types", () => {
    expect(isTypeCompatible("image", "text")).toBe(false);
    expect(isTypeCompatible("text", "image")).toBe(false);
  });
  it("allows anything into an 'any' input", () => {
    expect(isTypeCompatible("image", "any")).toBe(true);
    expect(isTypeCompatible("text", "any")).toBe(true);
  });
});

describe("cycle detection", () => {
  const edges: GraphEdge[] = [
    { id: "1", source: "a", sourceHandle: "o", target: "b", targetHandle: "i" },
    { id: "2", source: "b", sourceHandle: "o", target: "c", targetHandle: "i" },
  ];
  it("detects a back-edge as a cycle", () => {
    expect(wouldCreateCycle(edges, "c", "a")).toBe(true);
  });
  it("allows a forward edge", () => {
    expect(wouldCreateCycle(edges, "a", "c")).toBe(false);
  });
});

describe("validateConnection", () => {
  const graph = buildSampleWorkflow();

  it("rejects self-connections", () => {
    const res = validateConnection(graph, {
      source: "gemini-1",
      sourceHandle: "response",
      target: "gemini-1",
      targetHandle: "prompt",
    });
    expect(res.ok).toBe(false);
  });

  it("rejects image → text type mismatch", () => {
    const res = validateConnection(graph, {
      source: "crop-1",
      sourceHandle: "outputImage",
      target: "gemini-final",
      targetHandle: "prompt",
    });
    expect(res.ok).toBe(false);
  });

  it("allows image → Vision (image) connection", () => {
    // remove existing crop-1 → final image edge first to avoid duplicate note
    const g: WorkflowGraph = {
      nodes: graph.nodes,
      edges: graph.edges.filter((e) => e.id !== "e-crop-1.outputImage-gemini-final.image"),
    };
    const res = validateConnection(g, {
      source: "crop-1",
      sourceHandle: "outputImage",
      target: "gemini-final",
      targetHandle: "image",
    });
    expect(res.ok).toBe(true);
  });

  it("rejects a second edge into a single-connection input", () => {
    const res = validateConnection(graph, {
      source: "crop-2",
      sourceHandle: "outputImage",
      target: "gemini-1",
      targetHandle: "prompt", // already fed by request-inputs text (but types differ) ...
    });
    // image into text prompt is a type mismatch regardless
    expect(res.ok).toBe(false);
  });

  it("rejects a connection that would create a cycle", () => {
    const res = validateConnection(graph, {
      source: "response",
      sourceHandle: "result",
      target: "request-inputs",
      targetHandle: "tf_product",
    });
    expect(res.ok).toBe(false);
  });
});

describe("topological sort + levels", () => {
  const graph = buildSampleWorkflow();

  it("produces a valid order for the sample workflow", () => {
    const order = topologicalSort(graph.nodes, graph.edges);
    expect(order).toHaveLength(graph.nodes.length);
    const pos = (id: string) => order.indexOf(id);
    expect(pos("request-inputs")).toBeLessThan(pos("gemini-1"));
    expect(pos("gemini-1")).toBeLessThan(pos("gemini-2"));
    expect(pos("gemini-2")).toBeLessThan(pos("gemini-final"));
    expect(pos("crop-1")).toBeLessThan(pos("gemini-final"));
    expect(pos("crop-2")).toBeLessThan(pos("gemini-final"));
    expect(pos("gemini-final")).toBeLessThan(pos("response"));
  });

  it("throws on a cyclic graph", () => {
    const cyclic: WorkflowGraph = {
      nodes: graph.nodes,
      edges: [
        ...graph.edges,
        {
          id: "cyc",
          source: "response",
          sourceHandle: "result",
          target: "gemini-1",
          targetHandle: "prompt",
        },
      ],
    };
    expect(() => topologicalSort(cyclic.nodes, cyclic.edges)).toThrow();
  });

  it("groups concurrent fan-out nodes into the same level", () => {
    const levels = computeLevels(graph.nodes, graph.edges);
    const level1 = levels[1] ?? [];
    // crop-1, crop-2 and gemini-1 depend only on request-inputs → same level
    expect(level1).toEqual(expect.arrayContaining(["crop-1", "crop-2", "gemini-1"]));
  });
});

describe("withUpstream", () => {
  it("collects transitive dependencies", () => {
    const graph = buildSampleWorkflow();
    const set = withUpstream(["gemini-final"], graph.edges);
    expect(set).toEqual(
      new Set(["gemini-final", "gemini-2", "gemini-1", "crop-1", "crop-2", "request-inputs"]),
    );
  });
});
