// Trigger.dev task: Crop Image (FFmpeg). Enforces the mandatory ≥30s delay.
// task.md C.6 / G.3. Deploys only when Trigger.dev is configured; the app
// otherwise falls back to the local executor (lib/execution/engine.ts).

import { task } from "@trigger.dev/sdk";
import { CROP_MIN_DELAY_MS, runCropImage, type CropInput } from "@/lib/execution/tasks";

export const cropImageTask = task({
  id: "crop-image",
  // Allow room for the mandatory artificial delay.
  maxDuration: 120,
  run: async (payload: CropInput) => {
    const url = await runCropImage(payload, { delayMs: CROP_MIN_DELAY_MS });
    return { outputImage: url };
  },
});
