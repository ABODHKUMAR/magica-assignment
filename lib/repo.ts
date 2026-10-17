// Repository abstraction over persistence. Uses Prisma/PostgreSQL when
// DATABASE_URL is set (task.md requirement); otherwise an in-memory store so
// the app is demoable without a database. API routes depend only on this.

import { nanoid } from "nanoid";
import { hasDatabase, prisma } from "./db";
import type { NodeRunResult } from "./execution/engine";
import { buildBlankWorkflow } from "./sample-workflow";
import type { RunScope, RunStatus, WorkflowGraph } from "./types";

export interface WorkflowSummary {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  createdAt: string;
}

export interface WorkflowRecord extends WorkflowSummary {
  userId: string;
  graph: WorkflowGraph;
}

export interface RunRecord {
  id: string;
  workflowId: string;
  scope: RunScope;
  status: RunStatus;
  durationMs: number;
  startedAt: string;
  finishedAt: string | null;
  nodeRuns: NodeRunResult[];
}

// ---------------------------------------------------------------------------
// In-memory fallback (dev/demo without a database)
// ---------------------------------------------------------------------------
interface MemState {
  workflows: Map<string, WorkflowRecord>;
  runs: Map<string, RunRecord>;
}
const globalForMem = globalThis as unknown as { __pyMem?: MemState };
const mem: MemState =
  globalForMem.__pyMem ?? (globalForMem.__pyMem = { workflows: new Map(), runs: new Map() });

// ---------------------------------------------------------------------------
// Public repository API
// ---------------------------------------------------------------------------
export async function listWorkflows(userId: string): Promise<WorkflowSummary[]> {
  if (hasDatabase && prisma) {
    const rows = await prisma.workflow.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, status: true, updatedAt: true, createdAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      updatedAt: r.updatedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }));
  }
  return [...mem.workflows.values()]
    .filter((w) => w.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ graph: _graph, userId: _u, ...rest }) => rest);
}

export async function createWorkflow(
  userId: string,
  input: { name?: string; graph?: WorkflowGraph },
): Promise<WorkflowRecord> {
  const graph = input.graph ?? buildBlankWorkflow();
  const name = input.name ?? "Untitled Workflow";
  if (hasDatabase && prisma) {
    const row = await prisma.workflow.create({
      data: { userId, name, graph: graph as object },
    });
    return toRecord(row);
  }
  const now = new Date().toISOString();
  const rec: WorkflowRecord = {
    id: nanoid(12),
    userId,
    name,
    graph,
    status: "idle",
    createdAt: now,
    updatedAt: now,
  };
  mem.workflows.set(rec.id, rec);
  return rec;
}

export async function getWorkflow(userId: string, id: string): Promise<WorkflowRecord | null> {
  if (hasDatabase && prisma) {
    const row = await prisma.workflow.findFirst({ where: { id, userId } });
    return row ? toRecord(row) : null;
  }
  const rec = mem.workflows.get(id);
  return rec && rec.userId === userId ? rec : null;
}

export async function updateWorkflow(
  userId: string,
  id: string,
  patch: { name?: string; graph?: WorkflowGraph; status?: string },
): Promise<WorkflowRecord | null> {
  if (hasDatabase && prisma) {
    const existing = await prisma.workflow.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const row = await prisma.workflow.update({
      where: { id },
      data: {
        name: patch.name ?? undefined,
        graph: (patch.graph as object) ?? undefined,
        status: patch.status ?? undefined,
      },
    });
    return toRecord(row);
  }
  const rec = mem.workflows.get(id);
  if (!rec || rec.userId !== userId) return null;
  if (patch.name !== undefined) rec.name = patch.name;
  if (patch.graph !== undefined) rec.graph = patch.graph;
  if (patch.status !== undefined) rec.status = patch.status;
  rec.updatedAt = new Date().toISOString();
  return rec;
}

export async function deleteWorkflow(userId: string, id: string): Promise<boolean> {
  if (hasDatabase && prisma) {
    const existing = await prisma.workflow.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await prisma.workflow.delete({ where: { id } });
    return true;
  }
  const rec = mem.workflows.get(id);
  if (!rec || rec.userId !== userId) return false;
  mem.workflows.delete(id);
  return true;
}

export async function createRun(
  workflowId: string,
  data: {
    scope: RunScope;
    status: RunStatus;
    durationMs: number;
    nodeRuns: NodeRunResult[];
  },
): Promise<RunRecord> {
  const startedAt = new Date().toISOString();
  if (hasDatabase && prisma) {
    const row = await prisma.workflowRun.create({
      data: {
        workflowId,
        scope: data.scope,
        status: data.status,
        durationMs: data.durationMs,
        finishedAt: new Date(),
        nodeRuns: {
          create: data.nodeRuns.map((nr) => ({
            nodeId: nr.nodeId,
            nodeType: nr.nodeType,
            label: nr.label,
            status: nr.status,
            inputs: nr.inputs as object,
            output: (nr.output ?? null) as object,
            durationMs: nr.durationMs,
            error: nr.error,
            startedAt: new Date(nr.startedAt),
            finishedAt: new Date(nr.finishedAt),
          })),
        },
      },
      include: { nodeRuns: true },
    });
    return {
      id: row.id,
      workflowId: row.workflowId,
      scope: row.scope as RunScope,
      status: row.status as RunStatus,
      durationMs: row.durationMs,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      nodeRuns: data.nodeRuns,
    };
  }
  const rec: RunRecord = {
    id: nanoid(12),
    workflowId,
    scope: data.scope,
    status: data.status,
    durationMs: data.durationMs,
    startedAt,
    finishedAt: new Date().toISOString(),
    nodeRuns: data.nodeRuns,
  };
  mem.runs.set(rec.id, rec);
  return rec;
}

export async function listRuns(workflowId: string): Promise<RunRecord[]> {
  if (hasDatabase && prisma) {
    const rows = await prisma.workflowRun.findMany({
      where: { workflowId },
      orderBy: { startedAt: "desc" },
      include: { nodeRuns: true },
    });
    return rows.map((row) => ({
      id: row.id,
      workflowId: row.workflowId,
      scope: row.scope as RunScope,
      status: row.status as RunStatus,
      durationMs: row.durationMs,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      nodeRuns: row.nodeRuns.map((nr) => ({
        nodeId: nr.nodeId,
        nodeType: nr.nodeType,
        label: nr.label,
        status: nr.status as NodeRunResult["status"],
        inputs: (nr.inputs as Record<string, unknown>) ?? {},
        output: nr.output,
        error: nr.error,
        durationMs: nr.durationMs,
        startedAt: nr.startedAt?.getTime() ?? 0,
        finishedAt: nr.finishedAt?.getTime() ?? 0,
      })),
    }));
  }
  return [...mem.runs.values()]
    .filter((r) => r.workflowId === workflowId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function toRecord(row: {
  id: string;
  userId: string;
  name: string;
  graph: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): WorkflowRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    graph: row.graph as WorkflowGraph,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
