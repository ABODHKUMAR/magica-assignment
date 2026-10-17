"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileJson,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import { api } from "@/lib/client";
import { relativeTime } from "@/lib/format";
import { buildSampleWorkflow, SAMPLE_WORKFLOW_NAME } from "@/lib/sample-workflow";
import { workflowExportSchema } from "@/lib/validation";
import type { WorkflowSummary } from "@/lib/repo";

export function Dashboard() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { workflows } = await api.listWorkflows();
      setWorkflows(workflows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createNew = async () => {
    setCreating(true);
    try {
      const { workflow } = await api.createWorkflow({ name: "Untitled Workflow" });
      router.push(`/workflow/${workflow.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
      setCreating(false);
    }
  };

  const createSample = async () => {
    setCreating(true);
    try {
      const { workflow } = await api.createWorkflow({
        name: SAMPLE_WORKFLOW_NAME,
        graph: buildSampleWorkflow(),
      });
      router.push(`/workflow/${workflow.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create sample");
      setCreating(false);
    }
  };

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = workflowExportSchema.safeParse(JSON.parse(text));
      if (!parsed.success) throw new Error("Invalid workflow file");
      const { workflow } = await api.importWorkflow(parsed.data);
      router.push(`/workflow/${workflow.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  };

  return (
    <div className="flex min-h-screen bg-canvasbg text-gray-900">
      {/* Left sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white px-3 py-4 md:flex">
        <div className="flex items-center gap-2 px-2 pb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <Workflow size={18} />
          </div>
          <span className="text-lg font-semibold">Py</span>
        </div>
        <nav className="space-y-1">
          <span className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium">
            <LayoutGrid size={16} /> Workflows
          </span>
        </nav>
        <div className="mt-auto px-2 text-xs text-gray-400">Signed in</div>
      </aside>

      {/* Main */}
      <main className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-5xl">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Workflows</h1>
              <p className="mt-1 text-sm text-gray-500">
                Create and manage your AI workflows.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImportFile(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={createSample}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              >
                <Sparkles size={16} /> Sample
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
              >
                <FileJson size={16} /> Import
              </button>
              <button
                onClick={createNew}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create New Workflow
              </button>
            </div>
          </header>

          {error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="mt-8">
            {workflows === null ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            ) : workflows.length === 0 ? (
              <EmptyState onCreate={createNew} />
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {workflows.map((w) => (
                  <WorkflowCard
                    key={w.id}
                    workflow={w}
                    onOpen={() => router.push(`/workflow/${w.id}`)}
                    onChanged={load}
                    onError={setError}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
        <Workflow size={22} />
      </div>
      <h2 className="mt-4 text-lg font-semibold">No workflows yet</h2>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        Create your first workflow to start building an AI pipeline on the canvas.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
      >
        <Plus size={16} /> Create New Workflow
      </button>
    </div>
  );
}

function WorkflowCard({
  workflow,
  onOpen,
  onChanged,
  onError,
}: {
  workflow: WorkflowSummary;
  onOpen: () => void;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(workflow.name);

  const rename = async () => {
    try {
      await api.updateWorkflow(workflow.id, { name: name.trim() || workflow.name });
      setRenaming(false);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Rename failed");
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${workflow.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteWorkflow(workflow.id);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <li className="group relative rounded-xl border border-gray-200 bg-white p-4 shadow-node transition hover:shadow-node-hover">
      <div className="flex items-start justify-between">
        <button onClick={onOpen} className="flex items-center gap-2 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Workflow size={18} />
          </span>
        </button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Actions"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => {
                    setRenaming(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <Pencil size={14} /> Rename
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    void remove();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {renaming ? (
        <div className="mt-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void rename();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={rename}
              className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-600"
            >
              Save
            </button>
            <button
              onClick={() => setRenaming(false)}
              className="rounded-md px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={onOpen} className="mt-3 block w-full text-left">
          <h3 className="truncate font-medium">{workflow.name}</h3>
          <p className="mt-1 text-xs text-gray-500">
            Edited {relativeTime(workflow.updatedAt)}
          </p>
        </button>
      )}

      {workflow.status === "running" && (
        <span className="absolute bottom-4 right-4 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          <Loader2 size={11} className="animate-spin" /> Running
        </span>
      )}
    </li>
  );
}
