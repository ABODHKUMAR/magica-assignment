"use client";

import { createContext, useContext } from "react";

export interface BuilderActions {
  runNode: (id: string) => void;
  isRunning: boolean;
}

const BuilderContext = createContext<BuilderActions | null>(null);

export const BuilderProvider = BuilderContext.Provider;

export function useBuilder(): BuilderActions {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder must be used within BuilderProvider");
  return ctx;
}
