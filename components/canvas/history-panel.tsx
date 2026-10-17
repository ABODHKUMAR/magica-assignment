"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { formatDuration, formatTimestamp } from "@/lib/format";
import type { RunRecord } from "@/lib/repo";

const STATUS_BADGE: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-700",
  running: "bg-blue-100 text-blue-700",
};

export function HistoryPanel({
  runs,
  loading,
  onClose,
}: {
  runs: RunRecord[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Clock size={15} /> Workflow History
        </h2>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-700">
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </div>
        ) : runs.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-gray-400">
            No runs yet. Execute the workflow to create a history entry.
          </p>
        ) : (
          <ul className="space-y-2">
            {runs.map((run, i) => (
              <RunRow key={run.id} run={run} index={runs.length - i} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function RunRow({ run, index }: { run: RunRecord; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border border-gray-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="flex-1">
          <span className="block text-xs font-semibold">
            Run #{index} — {formatTimestamp(run.startedAt)}
          </span>
          <span className="block text-[11px] capitalize text-gray-400">
            {run.scope} · {formatDuration(run.durationMs)}
          </span>
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
            STATUS_BADGE[run.status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {run.status}
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-3 py-2">
          {run.nodeRuns.map((nr) => (
            <div key={nr.nodeId} className="flex items-start gap-2 py-1 text-[11px]">
              <NodeStatusIcon status={nr.status} />
              <span className="w-24 shrink-0 truncate font-medium text-gray-700">
                {nr.label || nr.nodeType}
              </span>
              <span className="w-10 shrink-0 text-gray-400">{formatDuration(nr.durationMs)}</span>
              <span className="flex-1 truncate text-gray-500">
                {nr.error ? (
                  <span className="text-red-600">{nr.error}</span>
                ) : (
                  renderOutput(nr.output)
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

function NodeStatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 size={13} className="mt-0.5 text-emerald-500" />;
  if (status === "failed") return <XCircle size={13} className="mt-0.5 text-red-500" />;
  if (status === "running") return <Loader2 size={13} className="mt-0.5 animate-spin text-blue-500" />;
  return <span className="mt-0.5 inline-block h-3 w-3 rounded-full bg-gray-300" />;
}

function renderOutput(output: unknown): string {
  if (output === null || output === undefined) return "—";
  if (typeof output === "string") return output;
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}
