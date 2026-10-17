import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import { createRun, getWorkflow, listRuns } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const workflow = await getWorkflow(userId, params.id);
  if (!workflow) return notFound("Workflow");
  const runs = await listRuns(params.id);
  return json({ runs });
}

// Persist a run executed client-side (so live per-node glow + staggered fan-out
// can be shown in the browser). task.md D.4 / C.9.
const persistRunSchema = z.object({
  scope: z.enum(["full", "partial", "single"]),
  status: z.enum(["running", "success", "failed", "partial"]),
  durationMs: z.number(),
  nodeRuns: z.array(
    z.object({
      nodeId: z.string(),
      nodeType: z.string(),
      label: z.string(),
      status: z.enum(["pending", "running", "success", "failed", "skipped"]),
      inputs: z.record(z.unknown()).default({}),
      output: z.unknown().optional(),
      error: z.string().nullable().default(null),
      durationMs: z.number().default(0),
      startedAt: z.number().default(0),
      finishedAt: z.number().default(0),
    }),
  ),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const workflow = await getWorkflow(userId, params.id);
  if (!workflow) return notFound("Workflow");

  const body = await req.json().catch(() => ({}));
  const parsed = persistRunSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);

  const run = await createRun(params.id, {
    scope: parsed.data.scope,
    status: parsed.data.status,
    durationMs: parsed.data.durationMs,
    nodeRuns: parsed.data.nodeRuns.map((nr) => ({ ...nr, output: nr.output ?? null })),
  });
  return json({ run }, { status: 201 });
}
