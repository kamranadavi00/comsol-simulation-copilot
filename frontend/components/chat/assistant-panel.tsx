"use client";

import { FormEvent, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";

import { Panel } from "@/components/ui/panel";

interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  content: string;
  error?: boolean;
}

const suggestions = [
  "Where is the maximum value?",
  "Give me statistics for the current field.",
  "Plot the current field along X.",
  "Reset the visualization.",
];

export function AssistantPanel({
  disabled,
  onCommand,
}: {
  disabled: boolean;
  onCommand: (message: string) => Promise<string>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "assistant",
      content: "I translate engineering requests into safe viewer controls and deterministic backend calculations.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function submit(message: string) {
    const value = message.trim();
    if (!value || disabled || isSending) return;
    const id = Date.now();
    setMessages((current) => [...current, { id, role: "user", content: value }]);
    setInput("");
    setIsSending(true);
    try {
      const response = await onCommand(value);
      setMessages((current) => [...current, { id: id + 1, role: "assistant", content: response }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: id + 1,
          role: "assistant",
          content: error instanceof Error ? error.message : "The assistant request failed.",
          error: true,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(input);
  }

  return (
    <Panel
      action={<span className="flex items-center gap-1.5 rounded-full border border-[#b9d8e5] bg-[#eaf6fa] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0b6f9f]"><Sparkles size={11} />kami</span>}
      className="flex min-h-[520px] flex-col overflow-hidden lg:h-full"
      eyebrow="Structured actions"
      title="Simulation assistant"
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message) => (
          <div className={`flex gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`} key={message.id}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${message.role === "user" ? "bg-[#dce8ef] text-[#24465f]" : "bg-[#dff3f7] text-[#0b7188]"}`}>
              {message.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </span>
            <p className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-6 ${
              message.role === "user"
                ? "bg-[#0b5f9e] text-white shadow-sm"
                : message.error
                  ? "border border-[#e5b5ad] bg-[#fff2ef] text-[#9b3528]"
                  : "border border-[#d7e2ea] bg-[#f8fafc] text-[#294b63]"
            }`}>{message.content}</p>
          </div>
        ))}
        {isSending && <p className="ml-10 animate-pulse text-xs text-[#0f7f8c]">Interpreting command…</p>}
      </div>
      <div className="border-t border-[#d7e2ea] bg-[#fbfdfe] p-3">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {suggestions.map((suggestion) => (
            <button className="shrink-0 rounded-full border border-[#c6d5df] bg-white px-2.5 py-1.5 text-[10px] text-[#567184] hover:border-[#73abc3] hover:bg-[#eef7fa] hover:text-[#0b5f9e]" disabled={disabled || isSending} key={suggestion} onClick={() => void submit(suggestion)} type="button">{suggestion}</button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="assistant-command">Simulation command</label>
          <input
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#b9cbd7] bg-white px-3 text-sm text-[#16324a] outline-none placeholder:text-[#8ca0ad] focus:border-[#0b8fb4] focus:ring-2 focus:ring-[#0b9fc2]/10"
            disabled={disabled || isSending}
            id="assistant-command"
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about this simulation…"
            value={input}
          />
          <button aria-label="Send command" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#0b5f9e] text-white shadow-sm hover:bg-[#084d82] focus-visible:ring-2 focus-visible:ring-[#0b9fc2] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled || isSending || !input.trim()} type="submit"><Send size={17} /></button>
        </form>
        <p className="mt-2 text-[10px] leading-4 text-[#7b919f]">AI selects actions only. Python calculates all scientific values.</p>
      </div>
    </Panel>
  );
}
