"use client";

import { useCallback, useMemo, useState } from "react";
import type { VideoInputProps } from "../../remotion/types";

type SSEMessage =
  | { type: "phase"; phase: string; progress: number; subtitle?: string }
  | { type: "done"; url: string; size: number }
  | { type: "error"; message: string };

export type RemotionRenderState =
  | { status: "idle" }
  | { status: "invoking"; phase: string; progress: number; subtitle: string | null }
  | { status: "error"; error: string }
  | { status: "done"; url: string; size: number };

export function useRemotionSandboxRender() {
  const [state, setState] = useState<RemotionRenderState>({ status: "idle" });

  const startRender = useCallback(async (inputProps: VideoInputProps) => {
    setState({
      status: "invoking",
      phase: "Iniciando...",
      progress: 0,
      subtitle: null,
    });

    try {
      const response = await fetch("/api/remotion/render-mp4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputProps }),
      });

      if (!response.ok || !response.body) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(
          typeof errJson?.error === "string" ? errJson.error : "Falha ao iniciar render",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          const message = JSON.parse(json) as SSEMessage;

          switch (message.type) {
            case "phase":
              setState({
                status: "invoking",
                phase: message.phase,
                progress: message.progress,
                subtitle: message.subtitle ?? null,
              });
              break;
            case "done":
              setState({
                status: "done",
                url: message.url,
                size: message.size,
              });
              break;
            case "error":
              setState({ status: "error", error: message.message });
              break;
            default:
              break;
          }
        }
      }
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return useMemo(
    () => ({
      state,
      startRender,
      reset,
    }),
    [state, startRender, reset],
  );
}
