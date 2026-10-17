import { redirect } from "next/navigation";
import { Builder } from "@/components/canvas/builder";
import { getUserId } from "@/lib/auth";
import { getWorkflow } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function WorkflowPage({ params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in");

  const workflow = await getWorkflow(userId, params.id);
  if (!workflow) redirect("/dashboard");

  return <Builder workflow={workflow} />;
}
