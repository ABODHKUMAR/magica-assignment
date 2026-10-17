/**
 * Server-only Transloadit utilities.
 * Handles HMAC-SHA384 signing, assembly creation, polling, upload, and crop.
 * See task.md Section G.3 / J.
 */
import crypto from "crypto";

const TRANSLOADIT_KEY = process.env.NEXT_PUBLIC_TRANSLOADIT_KEY ?? "";
const TRANSLOADIT_SECRET = process.env.TRANSLOADIT_SECRET ?? "";
const API = "https://api2.transloadit.com";

/** True when both key and secret are configured. */
export function hasTransloadit(): boolean {
  return !!(TRANSLOADIT_KEY && TRANSLOADIT_SECRET);
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

/** Format a Date to Transloadit's expected expires format: "YYYY/MM/DD HH:MM:SS+00:00" */
function formatExpires(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`
  );
}

function signParams(params: object): { paramsStr: string; signature: string } {
  const paramsStr = JSON.stringify(params);
  const hex = crypto
    .createHmac("sha384", TRANSLOADIT_SECRET)
    .update(paramsStr)
    .digest("hex");
  return { paramsStr, signature: `sha384:${hex}` };
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

interface TransloaditResult {
  ssl_url?: string;
  url: string;
}

interface TransloaditAssemblyResponse {
  ok: string;
  error?: string;
  message?: string;
  assembly_ssl_url?: string;
  assembly_url: string;
  results?: Record<string, TransloaditResult[]>;
}

/** Poll a Transloadit assembly until it completes. Returns CDN URL of the first result for `stepName`. */
async function pollAssembly(assemblyUrl: string, stepName: string): Promise<string> {
  const deadline = Date.now() + 120_000; // 2-minute timeout
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2_000));
    const res = await fetch(assemblyUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Transloadit poll failed: ${res.status}`);
    const data = (await res.json()) as TransloaditAssemblyResponse;

    if (data.ok === "ASSEMBLY_COMPLETED") {
      const result = data.results?.[stepName]?.[0];
      if (!result) throw new Error(`Transloadit: no result for step "${stepName}"`);
      return result.ssl_url ?? result.url;
    }
    if (data.ok?.includes("ERROR") || data.ok?.includes("ABORTED")) {
      throw new Error(
        `Transloadit assembly failed: ${data.ok} — ${data.message ?? data.error ?? ""}`,
      );
    }
    // Still executing — keep polling
  }
  throw new Error("Transloadit assembly timed out after 120s");
}

// ---------------------------------------------------------------------------
// Crop
// ---------------------------------------------------------------------------

/**
 * Crop an image using Transloadit's /image/resize robot.
 * x, y, width, height are 0-100 percentages.
 * The crop origin (x, y) is approximated by mapping to the nearest gravity.
 */
export async function cropImageViaTransloadit(
  imageUrl: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<string> {
  const params = {
    auth: {
      key: TRANSLOADIT_KEY,
      expires: formatExpires(new Date(Date.now() + 5 * 60 * 1000)),
    },
    steps: {
      // NOTE: ":original" is reserved for /upload/handle only.
      // The correct Transloadit robot for URL imports is /http/import.
      imported: {
        robot: "/http/import",
        url: imageUrl,
      },
      cropped: {
        robot: "/image/resize",
        use: "imported",
        width: `${width}%`,
        height: `${height}%`,
        resize_strategy: "crop",
        gravity: percentToGravity(x, y),
        result: true,
      },
    },
  };

  const { paramsStr, signature } = signParams(params);
  const form = new FormData();
  form.append("params", paramsStr);
  form.append("signature", signature);

  const createRes = await fetch(`${API}/assemblies`, { method: "POST", body: form });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Transloadit crop assembly failed: ${createRes.status} ${text}`);
  }

  const data = (await createRes.json()) as TransloaditAssemblyResponse;

  // Might complete synchronously (cached source)
  if (data.ok === "ASSEMBLY_COMPLETED") {
    const result = data.results?.["cropped"]?.[0];
    if (result) return result.ssl_url ?? result.url;
  }

  return await pollAssembly(data.assembly_ssl_url ?? data.assembly_url, "cropped");
}

/**
 * Map percentage position (x, y) to the nearest Transloadit gravity string.
 * Transloadit valid values: "center", "top", "bottom", "left", "right",
 * "top-left", "top-right", "bottom-left", "bottom-right".
 */
function percentToGravity(x: number, y: number): string {
  const col = x < 33 ? "left" : x > 66 ? "right" : "";
  const row = y < 33 ? "top" : y > 66 ? "bottom" : "";
  if (!row && !col) return "center";
  if (!col) return row;
  if (!row) return col;
  return `${row}-${col}`;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a raw file/blob to Transloadit and return the hosted CDN URL.
 * Used by the /api/upload route so the browser never sees the Transloadit secret.
 */
export async function uploadFileViaTransloadit(
  file: Blob,
  filename: string,
): Promise<string> {
  const params = {
    auth: {
      key: TRANSLOADIT_KEY,
      expires: formatExpires(new Date(Date.now() + 5 * 60 * 1000)),
    },
    steps: {
      // NOTE: /upload/handle REQUIRES the step to be named ":original".
      // result: true makes the uploaded file URL available in the response.
      ":original": { robot: "/upload/handle", result: true },
    },
  };

  const { paramsStr, signature } = signParams(params);
  const form = new FormData();
  form.append("params", paramsStr);
  form.append("signature", signature);
  form.append("file", file, filename);

  const res = await fetch(`${API}/assemblies`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Transloadit upload failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as TransloaditAssemblyResponse;

  if (data.ok === "ASSEMBLY_COMPLETED") {
    const result = data.results?.[":original"]?.[0];
    if (result) return result.ssl_url ?? result.url;
  }

  return await pollAssembly(data.assembly_ssl_url ?? data.assembly_url, ":original");
}
