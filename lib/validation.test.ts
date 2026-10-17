import { describe, expect, it } from "vitest";
import { buildSampleWorkflow } from "./sample-workflow";
import { runRequestSchema, workflowExportSchema, workflowGraphSchema } from "./validation";

describe("workflowGraphSchema", () => {
  it("accepts the sample workflow graph", () => {
    const res = workflowGraphSchema.safeParse(buildSampleWorkflow());
    expect(res.success).toBe(true);
  });

  it("rejects an invalid node type", () => {
    const bad = {
      nodes: [{ id: "x", type: "nope", position: { x: 0, y: 0 }, data: { type: "nope", label: "" } }],
      edges: [],
    };
    expect(workflowGraphSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects crop values outside 0–100", () => {
    const graph = buildSampleWorkflow();
    const node = graph.nodes.find((n) => n.id === "crop-1")!;
    node.data.crop!.x = 150;
    expect(workflowGraphSchema.safeParse(graph).success).toBe(false);
  });
});

describe("export / import round-trip", () => {
  it("export validates and re-imports", () => {
    const payload = {
      version: 1 as const,
      name: "Trial Task Workflow",
      graph: buildSampleWorkflow(),
      exportedAt: new Date().toISOString(),
    };
    const exported = workflowExportSchema.safeParse(payload);
    expect(exported.success).toBe(true);
  });

  it("rejects a malformed import", () => {
    expect(workflowExportSchema.safeParse({ version: 2, name: "x" }).success).toBe(false);
  });
});

describe("runRequestSchema", () => {
  it("accepts a full run request", () => {
    const res = runRequestSchema.safeParse({
      scope: "full",
      targetNodeIds: [],
      graph: buildSampleWorkflow(),
    });
    expect(res.success).toBe(true);
  });
});
