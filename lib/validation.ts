// Zod schemas for API payloads and workflow import/export (task.md G.2, D.7).

import { z } from "zod";

export const nodeTypeSchema = z.enum(["request-inputs", "crop-image", "gemini", "response"]);

export const requestInputFieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  kind: z.enum(["text_field", "image_field"]),
  value: z.string().default(""),
});

export const nodeDataSchema = z
  .object({
    type: nodeTypeSchema,
    label: z.string(),
    fields: z.array(requestInputFieldSchema).optional(),
    crop: z
      .object({
        inputImage: z.string().default(""),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        width: z.number().min(0).max(100),
        height: z.number().min(0).max(100),
      })
      .optional(),
    gemini: z
      .object({
        model: z.string(),
        prompt: z.string().default(""),
        systemPrompt: z.string().default(""),
        settings: z
          .object({
            temperature: z.number().optional(),
            maxOutputTokens: z.number().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .passthrough();

export const graphNodeSchema = z.object({
  id: z.string(),
  type: nodeTypeSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  data: nodeDataSchema,
  deletable: z.boolean().optional(),
});

export const graphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceHandle: z.string(),
  target: z.string(),
  targetHandle: z.string(),
});

export const workflowGraphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  graph: workflowGraphSchema.optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  graph: workflowGraphSchema.optional(),
  status: z.enum(["idle", "running"]).optional(),
});

export const runRequestSchema = z.object({
  scope: z.enum(["full", "partial", "single"]),
  targetNodeIds: z.array(z.string()).default([]),
  // The client sends the current (possibly unsaved) graph to execute.
  graph: workflowGraphSchema,
});

export const workflowExportSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  graph: workflowGraphSchema,
  exportedAt: z.string(),
});

export type WorkflowExport = z.infer<typeof workflowExportSchema>;
export type RunRequest = z.infer<typeof runRequestSchema>;
