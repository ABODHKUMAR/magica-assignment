import type { NextRequest } from "next/server";
import { badRequest, json, unauthorized } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import { createWorkflow } from "@/lib/repo";
import { workflowExportSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const parsed = workflowExportSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);

  const workflow = await createWorkflow(userId, {
    name: `${parsed.data.name} (imported)`,
    graph: parsed.data.graph,
  });
  return json({ workflow }, { status: 201 });
}
