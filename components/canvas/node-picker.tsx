"use client";

import { Crop, Image as ImageIcon, Search, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { NodeType } from "@/lib/types";

interface PickerItem {
  type: NodeType;
  label: string;
  description: string;
  category: "Image" | "Video" | "Audio" | "Others";
  icon: React.ReactNode;
  functional: boolean;
}

const ITEMS: PickerItem[] = [
  {
    type: "crop-image",
    label: "Crop Image",
    description: "Crop an image with FFmpeg",
    category: "Image",
    icon: <Crop size={16} />,
    functional: true,
  },
  {
    type: "gemini",
    label: "Gemini 3.1 Pro",
    description: "Generate text with vision",
    category: "Others",
    icon: <Sparkles size={16} />,
    functional: true,
  },
];

const CATEGORIES = ["Recent", "Image", "Video", "Audio", "Others"] as const;

export function NodePicker({
  onPick,
  onClose,
}: {
  onPick: (type: NodeType) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("Recent");

  const results = useMemo(() => {
    let items = ITEMS;
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(
        (i) => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
      );
    } else if (cat !== "Recent") {
      items = items.filter((i) => i.category === cat);
    }
    return items;
  }, [query, cat]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-16 left-1/2 z-50 w-[420px] -translate-x-1/2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
          <Search size={15} className="text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes…"
            className="flex-1 text-sm focus:outline-none"
          />
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X size={15} />
          </button>
        </div>

        {!query && (
          <div className="flex gap-1 border-b border-gray-100 px-3 py-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  cat === c ? "bg-brand text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-72 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              {cat === "Recent" && !query
                ? "Search or pick a category. Functional: Crop Image, Gemini 3.1 Pro."
                : "No matching nodes."}
            </p>
          ) : (
            results.map((item) => (
              <button
                key={item.type}
                onClick={() => onPick(item.type)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  {item.icon}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block text-xs text-gray-500">{item.description}</span>
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                  Ready
                </span>
              </button>
            ))
          )}
          {/* Non-functional categories shown as disabled hints */}
          {!query && (cat === "Video" || cat === "Audio") && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
              <ImageIcon size={14} /> {cat} nodes are not part of this trial.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
