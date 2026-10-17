import { describe, expect, it, vi } from "vitest";
import { CROP_MIN_DELAY_MS, runCropImage, runGemini } from "./tasks";

describe("runCropImage", () => {
  it("defaults to the mandatory ≥30s delay before returning (task.md C.6)", async () => {
    vi.useFakeTimers();
    const promise = runCropImage({ inputImage: "https://x/y.png", x: 10, y: 10, width: 50, height: 50 });
    let settled = false;
    void promise.then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(CROP_MIN_DELAY_MS - 1);
    expect(settled).toBe(false); // not resolved before 30s

    await vi.advanceTimersByTimeAsync(2);
    const url = await promise;
    expect(settled).toBe(true);
    expect(url).toContain("crop=10,10,50,50");
    vi.useRealTimers();
  });

  it("honours an overridden (short) delay for tests", async () => {
    const url = await runCropImage(
      { inputImage: "https://x/y.png", x: 0, y: 0, width: 100, height: 100 },
      { delayMs: 5 },
    );
    expect(url).toContain("crop=0,0,100,100");
  });
});

describe("runGemini (mock fallback without API key)", () => {
  it("returns a copywriter-style description for the copywriter system prompt", async () => {
    const out = await runGemini({
      model: "gemini-1.5-pro",
      prompt: "headphones",
      systemPrompt: "You are a marketing copywriter. Write a one-paragraph product description.",
    });
    expect(out.toLowerCase()).toContain("headphones");
  });

  it("returns a tweet-length hook for the tweet system prompt", async () => {
    const out = await runGemini({
      model: "gemini-1.5-pro",
      prompt: "desc",
      systemPrompt: "Condense into a tweet-length hook",
    });
    expect(out.length).toBeLessThan(240);
  });
});
