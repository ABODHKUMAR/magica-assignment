// Trigger.dev task: Gemini text generation (with vision). task.md C.6 / G.3.

import { task } from "@trigger.dev/sdk";
import { runGemini, type GeminiInput } from "@/lib/execution/tasks";

export const geminiGenerateTask = task({
  id: "gemini-generate",
  maxDuration: 120,
  run: async (payload: GeminiInput) => {
    const text = await runGemini(payload);
    return { response: text };
  },
});
