import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOOT_BASE ?? "http://localhost:3100";
const OUT = "images/_review";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

// Pre-warm Next.js route compilation so first-hit latency doesn't break waits.
async function warmup() {
  const ctx = await browser.newContext();
  const req = ctx.request;
  try {
    await req.get(`${BASE}/dashboard`, { timeout: 60000 });
    await req.get(`${BASE}/api/workflows`, { timeout: 60000 });
  } catch {}
  await ctx.close();
}

async function waitDashboardLoaded(page) {
  // Wait until the list resolves (empty state or at least one card), not just "Loading…".
  await Promise.race([
    page.getByText(/No workflows yet/i).waitFor({ timeout: 30000 }).catch(() => {}),
    page.locator("li.group").first().waitFor({ timeout: 30000 }).catch(() => {}),
  ]);
}

async function shoot(name, { width, height }, fn) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await fn(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log("saved", `${OUT}/${name}.png`);
  await ctx.close();
}

async function openSampleCanvas(page) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await waitDashboardLoaded(page);
  // Create the required sample workflow, then wait for the canvas.
  await page.getByRole("button", { name: /Sample/i }).click();
  await page.waitForURL(/\/workflow\//, { timeout: 60000 });
  await page.waitForSelector(".react-flow__node", { timeout: 60000 });
  await page.waitForTimeout(2500); // let fitView settle + edges render
}

await warmup();

// Desktop dashboard
await shoot("desktop-dashboard", { width: 1440, height: 900 }, async (page) => {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await waitDashboardLoaded(page);
  await page.waitForTimeout(500);
});

// Desktop canvas (sample workflow — compare to screenshot-13)
await shoot("desktop-canvas", { width: 1440, height: 900 }, openSampleCanvas);

// Desktop canvas with history panel open
await shoot("desktop-canvas-history", { width: 1440, height: 900 }, async (page) => {
  await openSampleCanvas(page);
  await page.getByRole("button", { name: /Toggle workflow history/i }).click();
  await page.waitForTimeout(800);
});

// Mobile canvas (responsive check)
await shoot("mobile-canvas", { width: 390, height: 844 }, openSampleCanvas);

// Mobile dashboard
await shoot("mobile-dashboard", { width: 390, height: 844 }, async (page) => {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await waitDashboardLoaded(page);
  await page.waitForTimeout(500);
});

await browser.close();
console.log("done");
