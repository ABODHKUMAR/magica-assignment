/**
 * POST /api/upload
 * Accepts a multipart file, proxies it to Transloadit (server-side signed),
 * and returns the hosted CDN URL. The Transloadit secret never leaves the server.
 */
import { type NextRequest, NextResponse } from "next/server";
import { badRequest, unauthorized } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import { hasTransloadit, uploadFileViaTransloadit } from "@/lib/transloadit";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  if (!hasTransloadit()) {
    return badRequest(
      "Transloadit is not configured. Set NEXT_PUBLIC_TRANSLOADIT_KEY and TRANSLOADIT_SECRET in .env.",
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return badRequest("Failed to parse multipart form data");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return badRequest("No file provided");

  // Validate mime type (jpg/jpeg/png/webp/gif per task.md C.6)
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return badRequest(`Unsupported file type "${file.type}". Allowed: jpeg, png, webp, gif.`);
  }

  // 20 MB guard
  if (file.size > 20 * 1024 * 1024) {
    return badRequest("File too large. Maximum 20 MB.");
  }

  try {
    const url = await uploadFileViaTransloadit(file, file.name);
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
