"use client";

import { Handle, Position } from "@xyflow/react";
import { Copy, Play, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { edgeColorForType } from "@/lib/store";
import { useCanvasStore } from "@/lib/store";
import { NODE_DEFINITIONS } from "@/lib/nodes";
import type { NodeExecStatus, NodeType, PortType } from "@/lib/types";
import { useBuilder } from "./builder-context";

const STATUS_RING: Record<NodeExecStatus, string> = {
  idle: "ring-1 ring-gray-200",
  pending: "ring-1 ring-gray-300",
  running: "ring-2 ring-brand animate-pulse-glow",
  success: "ring-1 ring-emerald-300",
  failed: "ring-2 ring-red-400",
  skipped: "ring-1 ring-gray-300 opacity-60",
};

export function NodeShell({
  id,
  type,
  title,
  icon,
  status = "idle",
  children,
  headerExtra,
}: {
  id: string;
  type: NodeType;
  title: string;
  icon: ReactNode;
  status?: NodeExecStatus;
  children: ReactNode;
  headerExtra?: ReactNode;
}) {
  const def = NODE_DEFINITIONS[type];
  const { runNode, isRunning } = useBuilder();
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);

  return (
    <div
      className={`w-[268px] rounded-xl bg-white shadow-node ${STATUS_RING[status]}`}
      data-testid={`node-${id}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-600">
          {icon}
        </span>
        <span className="flex-1 truncate text-[13px] font-semibold">{title}</span>
        {headerExtra}
        <button
          onClick={() => runNode(id)}
          disabled={isRunning}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          title="Run this node"
        >
          <Play size={11} /> Run
        </button>
        {def.duplicable && (
          <button
            onClick={() => duplicateNode(id)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title="Duplicate"
          >
            <Copy size={13} />
          </button>
        )}
        {def.deletable && (
          <button
            onClick={() => deleteNode(id)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="space-y-2 px-3 py-3">{children}</div>
    </div>
  );
}

/** An input row with a type-colored target handle on the left edge. */
export function InputRow({
  nodeId,
  portId,
  label,
  type,
  required,
  children,
}: {
  nodeId: string;
  portId: string;
  label: string;
  type: PortType;
  required?: boolean;
  children?: ReactNode;
}) {
  const connected = useCanvasStore((s) =>
    s.edges.some((e) => e.target === nodeId && e.targetHandle === portId),
  );
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        id={portId}
        className="!h-2.5 !w-2.5 !border-2 !border-white"
        style={{ background: edgeColorForType(type), left: -13 }}
      />
      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-600">
        {label}
        {required && <span className="text-red-400">*</span>}
        {connected && <span className="text-[10px] text-brand">· connected</span>}
      </div>
      {children}
    </div>
  );
}

/** An output row with a type-colored source handle on the right edge. */
export function OutputRow({
  nodeId,
  portId,
  label,
  type,
}: {
  nodeId: string;
  portId: string;
  label: string;
  type: PortType;
}) {
  return (
    <div className="relative mt-1 flex items-center justify-end">
      <span className="text-[11px] font-medium text-gray-500">{label}</span>
      <Handle
        type="source"
        position={Position.Right}
        id={portId}
        className="!h-2.5 !w-2.5 !border-2 !border-white"
        style={{ background: edgeColorForType(type), right: -13 }}
      />
    </div>
  );
}

export function useIsConnected(nodeId: string, portId: string): boolean {
  return useCanvasStore((s) =>
    s.edges.some((e) => e.target === nodeId && e.targetHandle === portId),
  );
}

export function OutputPreview({ output }: { output: unknown }) {
  const text =
    output === undefined || output === null
      ? ""
      : typeof output === "string"
        ? output
        : JSON.stringify(output, null, 2);
  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2 text-[11px] text-gray-600">
      {text ? (
        <span className="line-clamp-4 whitespace-pre-wrap break-words">{text}</span>
      ) : (
        <span className="text-gray-400">No output yet</span>
      )}
    </div>
  );
}
