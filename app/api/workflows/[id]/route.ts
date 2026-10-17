import type { NextRequest } from "next/server";
import { badRequest, json, notFound, unauthorized } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import { deleteWorkflow, getWorkflow, updateWorkflow } from "@/lib/repo";
import { updateWorkflowSchema } from "@/lib/validation";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const workflow = await getWorkflow(userId, params.id);
  if (!workflow) return notFound("Workflow");
  return json({ workflow });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const parsed = updateWorkflowSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);

  const workflow = await updateWorkflow(userId, params.id, parsed.data);
  if (!workflow) return notFound("Workflow");
  return json({ workflow });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const ok = await deleteWorkflow(userId, params.id);
  if (!ok) return notFound("Workflow");
  return json({ ok: true });
}
