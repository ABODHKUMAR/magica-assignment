import { defineConfig } from "@trigger.dev/sdk";

// The project ref is a non-secret identifier and must be available at config
// eval time (before .env loads), so it's set directly here. The actual secret
// (TRIGGER_SECRET_KEY) still comes from the environment.
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF || "proj_jnkniplnpqnzjigefpaq",
  dirs: ["./trigger"],
  maxDuration: 120,
});
