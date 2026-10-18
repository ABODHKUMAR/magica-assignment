"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

/**
 * Solid bezier edge with a small flowing dot travelling along it — matches the
 * Galaxy.ai reference (solid type-colored curves that feel "animated").
 * Color comes from the edge `style.stroke` set by the store (blue=image,
 * orange=text). task.md Open Q #1.
 */
export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const color = (style?.stroke as string) ?? "#94a3b8";

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ ...style, strokeWidth: 2 }} markerEnd={markerEnd} />
      <circle r={3} fill={color} className="py-edge-flow-dot">
        <animateMotion dur="2.4s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
}

export const edgeTypes = { flow: FlowEdge };
