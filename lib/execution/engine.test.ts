import { describe, expect, it } from "vitest";
import { buildSampleWorkflow } from "../sample-workflow";
import { executeGraph, type NodeRunResult } from "./engine";

// No GOOGLE_GENERATIVE_AI_API_KEY in tests → Gemini uses the mock (instant).
// Use a small crop delay so timing assertions are fast but still separable.
const CROP_DELAY = 80;

function byId(results: NodeRunResult[]): Record<string, NodeRunResult> {
  return Object.fromEntries(results.map((r) => [r.nodeId, r]));
}

describe("executeGraph — sample workflow DAG timing (task.md F.3)", () => {
  it("runs the full workflow successfully", async () => {
    const graph = buildSampleWorkflow();
    const result = await executeGraph(graph, { scope: "full", cropDelayMs: CROP_DELAY });
    expect(result.status).toBe("success");
    expect(result.nodeResults).toHaveLength(graph.nodes.length);
  });

  it("fans out Crop#1, Crop#2 and Gemini#1 concurrently at ~T0", async () => {
    const graph = buildSampleWorkflow();
    const { nodeResults } = await executeGraph(graph, { scope: "full", cropDelayMs: CROP_DELAY });
    const r = byId(nodeResults);
    const t0 = r["request-inputs"]!.finishedAt;
    // All three start shortly after request-inputs resolves.
    expect(r["crop-1"]!.startedAt - t0).toBeLessThan(40);
    expect(r["crop-2"]!.startedAt - t0).toBeLessThan(40);
    expect(r["gemini-1"]!.startedAt - t0).toBeLessThan(40);
  });

  it("starts Gemini#2 right after Gemini#1 without waiting for the crops", async () => {
    const graph = buildSampleWorkflow();
    const { nodeResults } = await executeGraph(graph, { scope: "full", cropDelayMs: CROP_DELAY });
    const r = byId(nodeResults);
    expect(r["gemini-2"]!.startedAt).toBeGreaterThanOrEqual(r["gemini-1"]!.finishedAt);
    // Gemini#2 must begin before the (slow) crops finish.
    expect(r["gemini-2"]!.startedAt).toBeLessThan(r["crop-1"]!.finishedAt);
    expect(r["gemini-2"]!.startedAt).toBeLessThan(r["crop-2"]!.finishedAt);
  });

  it("starts Final Gemini only after both crops AND Gemini#2 complete", async () => {
    const graph = buildSampleWorkflow();
    const { nodeResults } = await executeGraph(graph, { scope: "full", cropDelayMs: CROP_DELAY });
    const r = byId(nodeResults);
    const final = r["gemini-final"]!.startedAt;
    expect(final).toBeGreaterThanOrEqual(r["crop-1"]!.finishedAt);
    expect(final).toBeGreaterThanOrEqual(r["crop-2"]!.finishedAt);
    expect(final).toBeGreaterThanOrEqual(r["gemini-2"]!.finishedAt);
  });

  it("collects final outputs into the Response node", async () => {
    const graph = buildSampleWorkflow();
    const { nodeResults } = await executeGraph(graph, { scope: "full", cropDelayMs: CROP_DELAY });
    const r = byId(nodeResults);
    expect(Array.isArray(r["response"]!.output)).toBe(true);
    // Response collects Final Gemini.response + Crop#2 output (2 incoming edges).
    expect((r["response"]!.output as unknown[]).length).toBe(2);
  });
});

describe("executeGraph — selective execution (task.md expected behavior #4)", () => {
  it("single run executes only the targeted node", async () => {
    const graph = buildSampleWorkflow();
    const { nodeResults } = await executeGraph(graph, {
      scope: "single",
      targetNodeIds: ["gemini-1"],
      cropDelayMs: CROP_DELAY,
    });
    expect(nodeResults.map((r) => r.nodeId)).toEqual(["gemini-1"]);
    expect(nodeResults[0]!.status).toBe("success");
  });

  it("multi-select run executes only the targeted nodes", async () => {
    const graph = buildSampleWorkflow();
    const { nodeResults } = await executeGraph(graph, {
      scope: "partial",
      targetNodeIds: ["crop-1", "crop-2"],
      cropDelayMs: CROP_DELAY,
    });
    expect(new Set(nodeResults.map((r) => r.nodeId))).toEqual(new Set(["crop-1", "crop-2"]));
  });
});
