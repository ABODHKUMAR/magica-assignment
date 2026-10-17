"use client";

import type { NodeProps } from "@xyflow/react";
import { Bot, Crop, FileInput, Loader2, Plus, Settings2, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { getInputPorts } from "@/lib/nodes";
import { makeField } from "@/lib/nodes";
import { useCanvasStore, type RFNode } from "@/lib/store";
import type { RequestInputField, WorkflowNodeData } from "@/lib/types";
import {
  InputRow,
  NodeShell,
  OutputPreview,
  OutputRow,
  useIsConnected,
} from "./node-parts";

// ---------------------------------------------------------------------------
// Request Inputs
// ---------------------------------------------------------------------------

/** Upload a file to /api/upload and return the CDN URL. */
async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
  return json.url;
}

function ImageFieldInput({
  field,
  onChange,
}: {
  field: RequestInputField;
  onChange: (value: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      // Reset so same file can be re-selected
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex gap-1">
        <input
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste image URL or upload ↑"
          className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] focus:border-brand focus:outline-none"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Upload image to Transloadit"
          className="flex items-center gap-0.5 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-500 hover:border-brand hover:text-brand disabled:opacity-50"
        >
          {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {uploadError && (
        <p className="mt-0.5 text-[10px] text-red-500">{uploadError}</p>
      )}
      {field.value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={field.value} alt="" className="mt-1 h-16 w-full rounded object-cover" />
      )}
    </div>
  );
}

function RequestInputsNode({ id, data }: NodeProps<RFNode>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [adding, setAdding] = useState(false);
  const fields = data.fields ?? [];

  const setFields = (next: RequestInputField[]) => updateNodeData(id, { fields: next });

  const addField = (kind: RequestInputField["kind"]) => {
    const count = fields.filter((f) => f.kind === kind).length + 1;
    setFields([...fields, makeField(kind, count)]);
    setAdding(false);
  };

  return (
    <NodeShell id={id} type="request-inputs" title="Request Inputs" icon={<FileInput size={14} />} status={data.status}>
      {fields.length === 0 && (
        <p className="text-[11px] text-gray-400">No fields. Add one with +.</p>
      )}
      {fields.map((f) => (
        <div key={f.id} className="rounded-lg border border-gray-100 p-2">
          <div className="mb-1 flex items-center justify-between">
            <input
              value={f.name}
              onChange={(e) =>
                setFields(fields.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)))
              }
              className="w-32 bg-transparent text-[11px] font-semibold text-gray-700 focus:outline-none"
            />
            <button
              onClick={() => setFields(fields.filter((x) => x.id !== f.id))}
              className="text-[10px] text-gray-400 hover:text-red-500"
            >
              remove
            </button>
          </div>

          {f.kind === "text_field" ? (
            <textarea
              value={f.value}
              onChange={(e) =>
                setFields(fields.map((x) => (x.id === f.id ? { ...x, value: e.target.value } : x)))
              }
              rows={2}
              placeholder="Enter text…"
              className="w-full resize-none rounded-md border border-gray-200 px-2 py-1 text-[11px] focus:border-brand focus:outline-none"
            />
          ) : (
            <ImageFieldInput
              field={f}
              onChange={(value) =>
                setFields(fields.map((x) => (x.id === f.id ? { ...x, value } : x)))
              }
            />
          )}

          {/* per-field output handle */}
          <OutputRow nodeId={id} portId={f.id} label="" type={f.kind === "image_field" ? "image" : "text"} />
        </div>
      ))}

      <div className="relative">
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 py-1.5 text-[11px] text-gray-500 hover:border-brand hover:text-brand"
        >
          <Plus size={12} /> Add field
        </button>
        {adding && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            <button
              onClick={() => addField("text_field")}
              className="block w-full px-3 py-2 text-left text-[11px] hover:bg-gray-50"
            >
              text_field
            </button>
            <button
              onClick={() => addField("image_field")}
              className="block w-full px-3 py-2 text-left text-[11px] hover:bg-gray-50"
            >
              image_field
            </button>
          </div>
        )}
      </div>
    </NodeShell>
  );
}

// ---------------------------------------------------------------------------
// Crop Image
// ---------------------------------------------------------------------------
function CropImageNode({ id, data }: NodeProps<RFNode>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const edges = useCanvasStore((s) => s.edges);
  const crop = data.crop ?? { inputImage: "", x: 0, y: 0, width: 100, height: 100 };
  const isConn = (portId: string) =>
    edges.some((e) => e.target === id && e.targetHandle === portId);
  const imageConnected = isConn("inputImage");

  const setCrop = (patch: Partial<typeof crop>) => updateNodeData(id, { crop: { ...crop, ...patch } });

  const sliders: Array<{ key: "x" | "y" | "width" | "height"; label: string }> = [
    { key: "x", label: "X Position (%)" },
    { key: "y", label: "Y Position (%)" },
    { key: "width", label: "Width (%)" },
    { key: "height", label: "Height (%)" },
  ];

  return (
    <NodeShell id={id} type="crop-image" title="Crop Image" icon={<Crop size={14} />} status={data.status}>
      <InputRow nodeId={id} portId="inputImage" label="Input Image" type="image" required>
        <input
          value={crop.inputImage}
          disabled={imageConnected}
          onChange={(e) => setCrop({ inputImage: e.target.value })}
          placeholder={imageConnected ? "Connected" : "Image URL"}
          className="w-full rounded-md border border-gray-200 px-2 py-1 text-[11px] focus:border-brand focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
        />
      </InputRow>

      {sliders.map(({ key, label }) => {
        const connected = isConn(key);
        return (
          <InputRow key={key} nodeId={id} portId={key} label={label} type="number">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={crop[key]}
                disabled={connected}
                onChange={(e) => setCrop({ [key]: Number(e.target.value) })}
                className="flex-1 accent-brand disabled:opacity-40"
              />
              <span className="w-8 text-right text-[11px] text-gray-500">{crop[key]}</span>
            </div>
          </InputRow>
        );
      })}

      <OutputRow nodeId={id} portId="outputImage" label="Output Image" type="image" />
      <OutputPreview output={data.output} />
    </NodeShell>
  );
}

// ---------------------------------------------------------------------------
// Gemini 3.1 Pro
// ---------------------------------------------------------------------------
// Free-tier models first; billing-required models below the divider label.
const GEMINI_MODELS = [
  "gemini-3.8-pro-preview",    // recommended (default)
  "gemini-3.8-flash",          // flash (free tier, low quota)
  "gemini-flash-latest",       // latest flash alias
  "gemini-3.1-pro-preview",    // pro preview
];

function GeminiNode({ id, data }: NodeProps<RFNode>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const g = data.gemini ?? { model: "gemini-3.8-pro-preview", prompt: "", systemPrompt: "" };
  const [showSettings, setShowSettings] = useState(false);
  const promptConnected = useIsConnected(id, "prompt");
  const sysConnected = useIsConnected(id, "systemPrompt");

  const setG = (patch: Partial<typeof g>) => updateNodeData(id, { gemini: { ...g, ...patch } });

  const extraPorts = getInputPorts({
    id,
    type: "gemini",
    position: { x: 0, y: 0 },
    data,
  }).filter((p) => ["image", "video", "audio", "file"].includes(p.id));

  return (
    <NodeShell
      id={id}
      type="gemini"
      title="Gemini 3.1 Pro"
      icon={<Sparkles size={14} />}
      status={data.status}
      headerExtra={
        <select
          value={g.model}
          onChange={(e) => setG({ model: e.target.value })}
          className="max-w-[92px] rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px] text-gray-600 focus:outline-none"
        >
          {GEMINI_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      }
    >
      <InputRow nodeId={id} portId="prompt" label="Prompt" type="text" required>
        <textarea
          value={g.prompt}
          disabled={promptConnected}
          onChange={(e) => setG({ prompt: e.target.value })}
          rows={2}
          placeholder={promptConnected ? "Connected" : "Enter prompt…"}
          className="w-full resize-none rounded-md border border-gray-200 px-2 py-1 text-[11px] focus:border-brand focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
        />
      </InputRow>

      <InputRow nodeId={id} portId="systemPrompt" label="System Prompt" type="text">
        <textarea
          value={g.systemPrompt}
          disabled={sysConnected}
          onChange={(e) => setG({ systemPrompt: e.target.value })}
          rows={2}
          placeholder={sysConnected ? "Connected" : "System instructions…"}
          className="w-full resize-none rounded-md border border-gray-200 px-2 py-1 text-[11px] focus:border-brand focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
        />
      </InputRow>

      {extraPorts.map((p) => (
        <InputRow key={p.id} nodeId={id} portId={p.id} label={p.label} type={p.type} />
      ))}

      <button
        onClick={() => setShowSettings((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"
      >
        <Settings2 size={12} /> Settings
      </button>
      {showSettings && (
        <div className="rounded-lg border border-gray-100 p-2">
          <label className="text-[10px] text-gray-500">Temperature: {g.settings?.temperature ?? 0.7}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={g.settings?.temperature ?? 0.7}
            onChange={(e) =>
              setG({ settings: { ...g.settings, temperature: Number(e.target.value) } })
            }
            className="w-full accent-brand"
          />
        </div>
      )}

      <OutputRow nodeId={id} portId="response" label="Response" type="text" />
      <OutputPreview output={data.output} />
    </NodeShell>
  );
}

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------
function ResponseNode({ id, data }: NodeProps<RFNode>) {
  const edges = useCanvasStore((s) => s.edges);
  const nodes = useCanvasStore((s) => s.nodes);
  const incoming = edges.filter((e) => e.target === id);

  return (
    <NodeShell id={id} type="response" title="Response" icon={<Bot size={14} />} status={data.status}>
      <InputRow nodeId={id} portId="result" label="result" type="any" required />
      {incoming.length === 0 ? (
        <p className="text-[11px] text-gray-400">Connect node outputs to collect a result.</p>
      ) : (
        <div className="space-y-1">
          {incoming.map((e) => {
            const src = nodes.find((n) => n.id === e.source);
            return (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-2 py-1 text-[11px]"
              >
                <span className="truncate text-gray-600">
                  {(src?.data as WorkflowNodeData | undefined)?.label ?? e.source}
                </span>
                <span className="text-[10px] text-gray-400">{e.sourceHandle}</span>
              </div>
            );
          })}
        </div>
      )}
      <OutputPreview output={data.output} />
    </NodeShell>
  );
}

export const nodeTypes = {
  "request-inputs": RequestInputsNode,
  "crop-image": CropImageNode,
  gemini: GeminiNode,
  response: ResponseNode,
};
