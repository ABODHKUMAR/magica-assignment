// Seed the required sample workflow (task.md Section K) for a given user.
// Usage: SEED_USER_ID=<clerk-user-id> npm run db:seed
// Only runs when DATABASE_URL is configured.

import { PrismaClient } from "@prisma/client";
import { buildSampleWorkflow, SAMPLE_WORKFLOW_NAME } from "../lib/sample-workflow";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping seed (in-memory mode).");
    return;
  }
  const prisma = new PrismaClient();
  const userId = process.env.SEED_USER_ID ?? "demo-user";
  const existing = await prisma.workflow.findFirst({
    where: { userId, name: SAMPLE_WORKFLOW_NAME },
  });
  if (existing) {
    console.log("Sample workflow already exists:", existing.id);
    await prisma.$disconnect();
    return;
  }
  const wf = await prisma.workflow.create({
    data: { userId, name: SAMPLE_WORKFLOW_NAME, graph: buildSampleWorkflow() as object },
  });
  console.log("Created sample workflow:", wf.id);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
