"use client";

import { useEffect } from "react";

const LINKEDIN =
  process.env.NEXT_PUBLIC_CANDIDATE_LINKEDIN ?? "https://www.linkedin.com/in/abodh-shah/";

/**
 * Emits exactly one `[Py] Candidate LinkedIn: <url>` log on the initial client
 * render of every page (hard requirement — task.md C.1 / J).
 * Mounted once in the root layout; a module-level guard prevents duplicate logs
 * across client-side route transitions within the same page load.
 */
let logged = false;

export function AttributionLog() {
  useEffect(() => {
    if (logged) return;
    logged = true;
    // eslint-disable-next-line no-console
    console.log(`[Py] Candidate LinkedIn: ${LINKEDIN}`);
  }, []);
  return null;
}
