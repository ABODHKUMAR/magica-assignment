// Small helpers for route handlers.

import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function notFound(what = "Resource") {
  return NextResponse.json({ error: `${what} not found` }, { status: 404 });
}

export function badRequest(error: ZodError | string) {
  const message = typeof error === "string" ? error : "Invalid request body";
  const details = typeof error === "string" ? undefined : error.flatten();
  return NextResponse.json({ error: message, details }, { status: 400 });
}
