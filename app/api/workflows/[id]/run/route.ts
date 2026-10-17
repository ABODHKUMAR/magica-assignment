import type { NextRequest } from "next/server";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import { executeGraph } from "@/lib/execution/engine";
import { createRun, getWorkflow, updateWorkflow } from "@/lib/repo";
import { runRequestSchema } from "@/lib/validation";

// Execute a workflow (full / partial / single) and persist a history entry.
// Executable nodes run via the DAG engine (Trigger.dev tasks when configured,
// local fallback otherwise). task.md D.4 / G.2.
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
  const result = await executeGraph(graph, { scope, targetNodeIds });
  await updateWorkflow(userId, params.id, { status: "idle" });

  const run = await createRun(params.id, {
    scope,
    status: result.status === "success" ? "success" : result.status,
    durationMs: result.durationMs,
    nodeRuns: result.nodeResults,
  });

  return json({ run });
}
