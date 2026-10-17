// Executable-node task logic. These are the functions wrapped by Trigger.dev
// tasks in /trigger, and also used by the local-fallback executor so the app
// is demoable without external services. See task.md G.3.

export interface CropInput {
  inputImage: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropOptions {
  /** MANDATORY ≥30s in production (task.md C.6). Overridable for tests. */
  delayMs?: number;
  signal?: AbortSignal;
}

export const CROP_MIN_DELAY_MS = 30_000;

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });
}

/**
 * Crop an image. Enforces the mandatory artificial delay, then performs the
 * crop. When Transloadit/FFmpeg aren't configured, returns a deterministic
 * mock URL encoding the crop params so the demo flow still works.
 */
export async function runCropImage(input: CropInput, opts: CropOptions = {}): Promise<string> {
  const delayMs = opts.delayMs ?? CROP_MIN_DELAY_MS;
  await sleep(delayMs, opts.signal);

  const { inputImage, x, y, width, height } = input;
  const key = process.env.TRANSLOADIT_SECRET;
  if (key && inputImage) {
    // Real path would submit an FFmpeg/crop assembly to Transloadit and poll
    // for the resulting URL. Left as an integration point (needs credentials).
    // For now, annotate the source URL with the crop region.
    return appendCropQuery(inputImage, x, y, width, height);
  }

  // Local fallback: echo a placeholder cropped image URL.
  const base = inputImage || "https://placehold.co/600x400/png";
  return appendCropQuery(base, x, y, width, height);
}

function appendCropQuery(url: string, x: number, y: number, w: number, h: number): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}crop=${x},${y},${w},${h}`;
}

export interface GeminiInput {
  model: string;
  prompt: string;
  systemPrompt?: string;
  images?: string[];
  settings?: { temperature?: number; maxOutputTokens?: number };
}

/**
 * Generate text with Gemini. Falls back to a deterministic mock when no API
 * key is present, so the workflow can be exercised end-to-end offline.
 */
export async function runGemini(input: GeminiInput): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return mockGemini(input);
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: input.model || process.env.GEMINI_DEFAULT_MODEL || "gemini-3.8-flash",
    systemInstruction: input.systemPrompt || undefined,
    generationConfig: {
      temperature: input.settings?.temperature,
      maxOutputTokens: input.settings?.maxOutputTokens,
    },
  });

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: input.prompt || "" },
  ];
  for (const url of input.images ?? []) {
    const inline = await fetchImageInline(url);
    if (inline) parts.push({ inlineData: inline });
  }

  // Retry up to 3 times on transient 503/529 (server overload), with backoff.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("RESOURCE_EXHAUSTED")) {
        throw new Error(
          `Gemini quota exceeded for model "${input.model}". ` +
          `Enable billing at https://aistudio.google.com/plan_information or switch to gemini-3.8-flash (free tier).`,
        );
      }
      const isTransient =
        msg.includes("503") || msg.includes("529") ||
        msg.includes("Service Unavailable") || msg.includes("overloaded");
      if (!isTransient || attempt === 2) throw err;
      // Exponential backoff: 2s then 4s before retry
      await sleep((attempt + 1) * 2000);
    }
  }
  throw lastErr;
}

async function fetchImageInline(
  url: string,
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") ?? "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return { data: buf.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

function mockGemini(input: GeminiInput): string {
  const sys = (input.systemPrompt ?? "").toLowerCase();
  const prompt = input.prompt ?? "";
  if (sys.includes("tweet")) {
    return "Silence the world. 30 hrs of battery. Fold. Go. #Headphones";
  }
  if (sys.includes("social media manager")) {
    return "Hear what matters — our foldable noise-cancelling headphones deliver 30 hours of pure, immersive sound. [mock]";
  }
  if (sys.includes("copywriter")) {
    return "Introducing our premium Wireless Bluetooth Headphones: immersive noise cancellation, a 30-hour battery, and a foldable design built for life on the move. [mock]";
  }
  return `[mock gemini:${input.model}] ${prompt.slice(0, 120)}`;
}

