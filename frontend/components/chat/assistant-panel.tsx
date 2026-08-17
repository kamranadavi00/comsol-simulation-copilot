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
      action={<span className="flex items-center gap-1.5 rounded-full border border-teal-500/20 bg-teal-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-300"><Sparkles size={11} />kami</span>}
      className="flex min-h-[520px] flex-col overflow-hidden lg:h-full"
      eyebrow="Structured actions"
      title="Simulation assistant"
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message) => (
          <div className={`flex gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`} key={message.id}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${message.role === "user" ? "bg-slate-700 text-slate-200" : "bg-teal-400/15 text-teal-300"}`}>
              {message.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </span>
            <p className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-6 ${
              message.role === "user"
                ? "bg-slate-700 text-slate-100"
                : message.error
                  ? "border border-rose-500/30 bg-rose-500/10 text-rose-200"
                  : "border border-slate-800 bg-slate-950/50 text-slate-300"
            }`}>{message.content}</p>
          </div>
        ))}
        {isSending && <p className="ml-10 animate-pulse text-xs text-teal-400">Interpreting command…</p>}
      </div>
      <div className="border-t border-slate-800 p-3">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {suggestions.map((suggestion) => (
            <button className="shrink-0 rounded-full border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-400 hover:border-slate-500 hover:text-slate-200" disabled={disabled || isSending} key={suggestion} onClick={() => void submit(suggestion)} type="button">{suggestion}</button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="assistant-command">Simulation command</label>
          <input
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-500"
            disabled={disabled || isSending}
            id="assistant-command"
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about this simulation…"
            value={input}
          />
          <button aria-label="Send command" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal-400 text-slate-950 hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled || isSending || !input.trim()} type="submit"><Send size={17} /></button>
        </form>
        <p className="mt-2 text-[10px] leading-4 text-slate-600">AI selects actions only. Python calculates all scientific values.</p>
      </div>
    </Panel>
  );
}
