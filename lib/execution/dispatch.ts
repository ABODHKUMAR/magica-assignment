// Dispatch layer: routes executable-node work to Trigger.dev hosted tasks when
// configured, otherwise runs the same logic inline via the local executor.
// This satisfies task.md's "all node executions via Trigger.dev tasks" while
// keeping the app fully demoable offline. See task.md G.3.

import type { cropImageTask } from "@/trigger/crop-image";
import type { geminiGenerateTask } from "@/trigger/gemini-generate";
import { runCropImage, runGemini, type CropInput, type GeminiInput } from "./tasks";

/** True when Trigger.dev is configured for hosted execution. */
export function hasTrigger(): boolean {
  const key = process.env.TRIGGER_SECRET_KEY ?? "";
  const ref = process.env.TRIGGER_PROJECT_REF ?? "";
  return !!key && !!ref && ref !== "proj_placeholder";
}

/** Reject a pending task if the worker never picks it up within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${Math.round(ms / 1000)}s. ` +
            `Is the Trigger.dev worker running? Start it with: npx trigger.dev@latest dev`,
        ),
      );
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Crop an image. Dispatches to the Trigger.dev `crop-image` task when hosted
 * execution is enabled; otherwise runs locally. When `cropDelayMs` is provided
 * (tests), always use the local path for determinism.
 */
interface PolledRun {
  status: string;
  output?: unknown;
  error?: unknown;
}

export async function dispatchCrop(input: CropInput, cropDelayMs?: number): Promise<string> {
  if (hasTrigger() && cropDelayMs === undefined) {
    const { tasks, runs } = await import("@trigger.dev/sdk");
    const handle = await tasks.trigger<typeof cropImageTask>("crop-image", input);
    const run = (await withTimeout(
      runs.poll(handle.id, { pollIntervalMs: 1500 }),
      150_000, // crop sleeps 30s+ then crops; allow generous headroom
      "Trigger.dev crop-image task",
    )) as PolledRun;
    if (run.status !== "COMPLETED") {
      throw new Error(`Trigger.dev crop-image ${run.status}: ${runError(run)}`);
    }
    return (run.output as { outputImage: string }).outputImage;
  }
  return runCropImage(input, cropDelayMs !== undefined ? { delayMs: cropDelayMs } : undefined);
}

/**
 * Generate text with Gemini. Dispatches to the Trigger.dev `gemini-generate`
 * task when hosted execution is enabled; otherwise runs locally.
 */
export async function dispatchGemini(input: GeminiInput): Promise<string> {
  if (hasTrigger()) {
    const { tasks, runs } = await import("@trigger.dev/sdk");
    const handle = await tasks.trigger<typeof geminiGenerateTask>("gemini-generate", input);
    const run = (await withTimeout(
      runs.poll(handle.id, { pollIntervalMs: 1000 }),
      90_000,
      "Trigger.dev gemini-generate task",
    )) as PolledRun;
    if (run.status !== "COMPLETED") {
      throw new Error(`Trigger.dev gemini-generate ${run.status}: ${runError(run)}`);
    }
    return (run.output as { response: string }).response;
  }
  return runGemini(input);
}

function runError(run: PolledRun): string {
  if (!run.error) return "";
  if (run.error instanceof Error) return run.error.message;
  if (typeof run.error === "object" && run.error && "message" in run.error) {
    return String((run.error as { message: unknown }).message);
  }
  return String(run.error);
}
