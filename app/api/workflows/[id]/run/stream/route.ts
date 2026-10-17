// Streaming execution endpoint: runs the DAG server-side (so GOOGLE_GENERATIVE_AI_API_KEY
// is available) and streams per-node status updates as NDJSON so the client can
// show live pulsating glow without needing secrets in the browser.
// task.md D.4 / G.3.

import type { NextRequest } from "next/server";
import { badRequest, notFound, unauthorized } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import { executeGraph, type NodeRunResult } from "@/lib/execution/engine";
import { createRun, getWorkflow, updateWorkflow } from "@/lib/repo";
import { runRequestSchema } from "@/lib/validation";

// Allow up to 120s (crops take 30s+ each; two run in parallel).
export const maxDuration = 120;

const enc = new TextEncoder();
function line(ctrl: ReadableStreamDefaultController, obj: unknown) {
  ctrl.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const workflow = await getWorkflow(userId, params.id);
  if (!workflow) return notFound("Workflow");

  const body = await req.json().catch(() => ({}));
  const parsed = runRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);

  const { scope, targetNodeIds, graph } = parsed.data;

  await updateWorkflow(userId, params.id, { status: "running", graph });

  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        const result = await executeGraph(graph, {
          scope,
          targetNodeIds,
          onNodeUpdate: (nodeId, status, res) => {
            line(ctrl, {
              type: "node",
              nodeId,
              status,
              output: (res as NodeRunResult | undefined)?.output ?? null,
              error: (res as NodeRunResult | undefined)?.error ?? null,
              durationMs: (res as NodeRunResult | undefined)?.durationMs ?? 0,
            });
          },
        });

        await updateWorkflow(userId, params.id, { status: "idle" });

        const run = await createRun(params.id, {
          scope,
          status: result.status,
          durationMs: result.durationMs,
          nodeRuns: result.nodeResults,
        });

        line(ctrl, { type: "done", status: result.status, durationMs: result.durationMs, runId: run.id });
      } catch (err) {
        line(ctrl, { type: "error", message: err instanceof Error ? err.message : String(err) });
        await updateWorkflow(userId, params.id, { status: "idle" }).catch(() => {});
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
