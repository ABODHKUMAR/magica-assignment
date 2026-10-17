// Auth helper. Uses Clerk when configured; otherwise returns a demo user so the
// app is runnable/testable locally without credentials (task.md Open Q #8).

import { auth } from "@clerk/nextjs/server";

export const hasClerk = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export const DEMO_USER_ID = "demo-user";

/** Resolve the current user id, or null if unauthenticated (with Clerk on). */
export async function getUserId(): Promise<string | null> {
  if (!hasClerk) return DEMO_USER_ID;
  const { userId } = auth();
  return userId;
}
