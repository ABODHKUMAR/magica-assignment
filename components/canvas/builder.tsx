"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Clock,
  Download,
  Play,
  Plus,
  Redo2,
  Undo2,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { useCanvasStore } from "@/lib/store";
import type { RunRecord, WorkflowRecord } from "@/lib/repo";
import type { NodeExecStatus, NodeType, RunScope } from "@/lib/types";
import { BuilderProvider } from "./builder-context";
import { HistoryPanel } from "./history-panel";
import { NodePicker } from "./node-picker";
import { nodeTypes } from "./nodes";

export function Builder({ workflow }: { workflow: WorkflowRecord }) {
  return (
    <ReactFlowProvider>
      <BuilderInner workflow={workflow} />
    </ReactFlowProvider>
  );
}

function BuilderInner({ workflow }: { workflow: WorkflowRecord }) {
  const router = useRouter();
  const rf = useReactFlow();

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const isValidConnection = useCanvasStore((s) => s.isValidConnection);
  const load = useCanvasStore((s) => s.load);
  const getGraph = useCanvasStore((s) => s.getGraph);
  const addNodeOfType = useCanvasStore((s) => s.addNodeOfType);
  const setNodeStatus = useCanvasStore((s) => s.setNodeStatus);
  const resetStatuses = useCanvasStore((s) => s.resetStatuses);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const dirty = useCanvasStore((s) => s.dirty);
  const clearDirty = useCanvasStore((s) => s.clearDirty);
  const connError = useCanvasStore((s) => s.lastConnectionError);

  const [name, setName] = useState(workflow.name);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Load graph into the store on mount.
  useEffect(() => {
    load(workflow.graph);
  }, [load, workflow.graph]);

  // Connection errors → transient toast.
  useEffect(() => {
    if (connError) {
      setToast(connError);
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [connError]);

  // Debounced autosave (task.md Open Q #5: autosave).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await api.updateWorkflow(workflow.id, { graph: getGraph(), name });
        clearDirty();
      } catch {
        /* ignore transient save errors */
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dirty, nodes, edges, name, workflow.id, getGraph, clearDirty]);

  // Undo/redo keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const { runs } = await api.listRuns(workflow.id);
      setRuns(runs);
    } finally {
      setRunsLoading(false);
    }
  }, [workflow.id]);

  useEffect(() => {
    if (historyOpen) void loadRuns();
  }, [historyOpen, loadRuns]);

  // Run the graph server-side via streaming NDJSON so Gemini/Crop run with server
  // env vars, while per-node status events stream back for live pulsating glow.
  const runGraph = useCallback(
    async (scope: RunScope, targetNodeIds: string[]) => {
      if (isRunning) return;
      setIsRunning(true);
      const graph = getGraph();

      // Mark targets as pending immediately so glow begins.
      const targets =
        scope === "full" ? graph.nodes.map((n) => n.id) : targetNodeIds;
      targets.forEach((id) => setNodeStatus(id, "pending"));

      try {
        const res = await fetch(`/api/workflows/${workflow.id}/run/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, targetNodeIds, graph }),
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "Run failed" }));
          throw new Error((err as { error?: string }).error ?? "Run failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const event = JSON.parse(trimmed) as {
                type: string;
                nodeId?: string;
                status?: NodeExecStatus;
                output?: unknown;
                error?: string | null;
                durationMs?: number;
                message?: string;
              };

              if (event.type === "node" && event.nodeId && event.status) {
                setNodeStatus(event.nodeId, event.status, {
                  output: event.output,
                  error: event.error ?? null,
                  durationMs: event.durationMs,
                });
              } else if (event.type === "done") {
                if (historyOpen) void loadRuns();
              } else if (event.type === "error") {
                setToast(event.message ?? "Run failed");
              }
            } catch {
              // malformed line — skip
            }
          }
        }
      } catch (e) {
        setToast(e instanceof Error ? e.message : "Run failed");
        targets.forEach((id) => setNodeStatus(id, "idle"));
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning, getGraph, setNodeStatus, workflow.id, historyOpen, loadRuns],
  );

  const addNode = (type: NodeType) => {
    const center = rf.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    addNodeOfType(type, center);
    setPickerOpen(false);
  };

  const exportJson = async () => {
    const payload = { version: 1, name, graph: getGraph(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "workflow"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);

  return (
    <BuilderProvider
      value={{ runNode: (id) => void runGraph("single", [id]), isRunning }}
    >
      <div className="flex h-screen flex-col bg-canvasbg">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void api.updateWorkflow(workflow.id, { name }).catch(() => {})}
            className="rounded-lg px-2 py-1 text-sm font-semibold hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
          />

          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            <span className="hidden items-center gap-1 rounded-md bg-gray-50 px-2 py-1 sm:flex">
              Est <strong className="text-gray-700">0.01</strong> M
            </span>
            <span className="hidden items-center gap-1 rounded-md bg-gray-50 px-2 py-1 sm:flex">
              <Wallet size={12} /> Bal <strong className="text-gray-700">5085.54</strong> M
            </span>
            <button onClick={undo} className="rounded-md p-1.5 hover:bg-gray-100" title="Undo">
              <Undo2 size={15} />
            </button>
            <button onClick={redo} className="rounded-md p-1.5 hover:bg-gray-100" title="Redo">
              <Redo2 size={15} />
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={() => void runGraph("partial", selectedIds)}
                disabled={isRunning}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Run selected ({selectedIds.length})
              </button>
            )}
            <button
              onClick={() => void runGraph("full", [])}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              <Play size={14} /> {isRunning ? "Running…" : "Run"}
            </button>
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className={`rounded-lg border p-1.5 ${
                historyOpen ? "border-brand text-brand" : "border-gray-200 text-gray-500"
              } hover:bg-gray-50`}
              title="History"
            >
              <Clock size={16} />
            </button>
          </div>
        </header>

        {/* Canvas + history */}
        <div className="relative flex flex-1 overflow-hidden">
          <div className="relative flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              deleteKeyCode={["Backspace", "Delete"]}
              fitView
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} color="#d7d7db" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable className="!bottom-4 !right-4" />
            </ReactFlow>

            {/* Bottom-center floating toolbar */}
            <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-1.5 shadow-node">
              <button
                onClick={exportJson}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                title="Export JSON"
              >
                <Download size={16} />
              </button>
              <div className="h-5 w-px bg-gray-200" />
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="rounded-lg bg-brand p-2 text-white hover:bg-brand-600"
                title="Add node"
              >
                <Plus size={16} />
              </button>
            </div>

            {pickerOpen && <NodePicker onPick={addNode} onClose={() => setPickerOpen(false)} />}

            {toast && (
              <div className="absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
                {toast}
              </div>
            )}
          </div>

          {historyOpen && (
            <HistoryPanel runs={runs} loading={runsLoading} onClose={() => setHistoryOpen(false)} />
          )}
        </div>
      </div>
    </BuilderProvider>
  );
}
