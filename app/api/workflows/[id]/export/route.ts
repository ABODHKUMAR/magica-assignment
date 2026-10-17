import type { NextRequest } from "next/server";
import { json, notFound, unauthorized } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import { getWorkflow } from "@/lib/repo";
import type { WorkflowExport } from "@/lib/validation";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const workflow = await getWorkflow(userId, params.id);
  if (!workflow) return notFound("Workflow");

  const payload: WorkflowExport = {
    version: 1,
    name: workflow.name,
    graph: workflow.graph,
    exportedAt: new Date().toISOString(),
  };
  return json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="${slug(workflow.name)}.json"`,
    },
  });
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workflow";
}
