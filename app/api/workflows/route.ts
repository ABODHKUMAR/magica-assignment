import type { NextRequest } from "next/server";
import { badRequest, json, unauthorized } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import { createWorkflow, listWorkflows } from "@/lib/repo";
import { createWorkflowSchema } from "@/lib/validation";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();
  const workflows = await listWorkflows(userId);
  return json({ workflows });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const parsed = createWorkflowSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);

  const workflow = await createWorkflow(userId, parsed.data);
  return json({ workflow }, { status: 201 });
}
