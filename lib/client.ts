// Browser-side API client. Thin wrappers over the route handlers.

import type { NodeRunResult } from "./execution/engine";
import type { RunRecord, WorkflowRecord, WorkflowSummary } from "./repo";
import type { RunScope, RunStatus, WorkflowGraph } from "./types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listWorkflows: () => req<{ workflows: WorkflowSummary[] }>("/api/workflows"),
  createWorkflow: (body: { name?: string; graph?: WorkflowGraph }) =>
    req<{ workflow: WorkflowRecord }>("/api/workflows", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getWorkflow: (id: string) => req<{ workflow: WorkflowRecord }>(`/api/workflows/${id}`),
  updateWorkflow: (id: string, body: { name?: string; graph?: WorkflowGraph; status?: string }) =>
    req<{ workflow: WorkflowRecord }>(`/api/workflows/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteWorkflow: (id: string) =>
    req<{ ok: boolean }>(`/api/workflows/${id}`, { method: "DELETE" }),
  runWorkflow: (
    id: string,
    body: { scope: RunScope; targetNodeIds: string[]; graph: WorkflowGraph },
  ) =>
    req<{ run: RunRecord }>(`/api/workflows/${id}/run`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listRuns: (id: string) => req<{ runs: RunRecord[] }>(`/api/workflows/${id}/runs`),
  persistRun: (
    id: string,
    body: { scope: RunScope; status: RunStatus; durationMs: number; nodeRuns: NodeRunResult[] },
  ) =>
    req<{ run: RunRecord }>(`/api/workflows/${id}/runs`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  importWorkflow: (payload: unknown) =>
    req<{ workflow: WorkflowRecord }>("/api/workflows/import", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
