"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionCard } from "./ActionCard";

function parseMessageParts(text: string): Array<{ type: "text"; content: string } | { type: "action"; content: string }> {
  const parts: Array<{ type: "text"; content: string } | { type: "action"; content: string }> = [];
  const segments = text.split(/\[ACTION\]\s*/i);
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (!s) continue;
    if (i > 0) {
      const endOfAction = s.indexOf("\n");
      const actionText = endOfAction >= 0 ? s.slice(0, endOfAction).trim() : s.trim();
      if (actionText) parts.push({ type: "action", content: actionText });
      const rest = endOfAction >= 0 ? s.slice(endOfAction).trim() : "";
      if (rest) parts.push({ type: "text", content: rest });
    } else {
      if (s.trim()) parts.push({ type: "text", content: s.trim() });
    }
  }
  return parts;
}

function extractText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p): p is { type: string; text: string } => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

function getToolDisplayText(
  part: { type?: string; state?: string; output?: unknown }
): string | null {
  if (part.state !== "output-available" || !part.output) return null;
  const out = part.output as Record<string, unknown>;
  if (typeof out.displayText === "string" && out.success !== false) return out.displayText;
  return null;
}

function renderMessageContent(
  parts: Array<{ type?: string; text?: string; state?: string; output?: unknown }> | undefined
) {
  if (!parts?.length) return null;
  const toolActions: string[] = [];
  const textParts: string[] = [];
  for (const p of parts) {
    if (p.type === "text" && typeof p.text === "string") {
      textParts.push(p.text);
    } else if (
      (p.type === "dynamic-tool" || (typeof p.type === "string" && p.type.startsWith("tool-"))) &&
      getToolDisplayText(p)
    ) {
      toolActions.push(getToolDisplayText(p)!);
    }
  }
  const text = textParts.join("");
  const parsed = parseMessageParts(text);
  return (
    <>
      {toolActions.map((desc, i) => (
        <ActionCard key={`tool-${i}`} description={desc} />
      ))}
      {parsed.map((p, i) =>
        p.type === "action" ? (
          <ActionCard key={i} description={p.content} />
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            {p.content}
          </p>
        )
      )}
    </>
  );
}

export function ChatClient() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const prevMessagesLength = useRef(0);
  const searchParams = useSearchParams();
  const promptFromUrl = searchParams.get("prompt");

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
    messages: [],
  });

  useEffect(() => {
    if (historyLoaded) return;
    fetch("/api/ai/messages", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { messages?: Array<{ id: string; role: string; parts: Array<{ type: string; text: string }> }> }) => {
        const msgs = data.messages ?? [];
        if (msgs.length > 0) {
          setMessages(
            msgs.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              parts: (m.parts ?? [{ type: "text", text: "" }]).map((p) => ({
                type: "text" as const,
                text: (p as { text?: string }).text ?? "",
              })),
            }))
          );
        }
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, [historyLoaded, setMessages]);

  useEffect(() => {
    if (messages.length > prevMessagesLength.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  const [input, setInput] = useState("");

  useEffect(() => {
    if (promptFromUrl && typeof promptFromUrl === "string") {
      setInput(decodeURIComponent(promptFromUrl));
    }
  }, [promptFromUrl]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    setInput("");
    sendMessage({ text: value });
  }

  const isStreaming = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-col gap-3">
          {messages.length === 0 && historyLoaded ? (
            <p className="text-sm text-zinc-500">
              Ask Alfred anything about your schedule, tasks, or priorities.
            </p>
          ) : (
            messages.map((message) => {
              const isUser = message.role === "user";
              const text = extractText(message.parts ?? []);

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                      isUser
                        ? "bg-zinc-800 text-zinc-100"
                        : "border border-zinc-800 bg-zinc-900/80 text-zinc-200"
                    }`}
                    style={!isUser ? { borderLeftColor: "rgba(108,99,255,0.4)", borderLeftWidth: 3 } : undefined}
                  >
                    {isUser ? text : renderMessageContent(message.parts)}
                  </div>
                </div>
              );
            })
          )}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-400">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse">●</span>
                <span className="animate-pulse">●</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form className="mt-4 flex gap-2" onSubmit={onSubmit}>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          title="Attach (coming soon)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
          className="h-11 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-4 text-sm placeholder:text-zinc-500 focus:border-[#6C63FF] focus:outline-none focus:ring-1 focus:ring-[#6C63FF] disabled:opacity-50"
          placeholder="Tell Alfred what you need..."
        />
        <Button type="submit" disabled={isStreaming}>
          Send
        </Button>
      </form>
    </div>
  );
}
