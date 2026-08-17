"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Panel } from "@/components/ui/panel";
import type { AIConversationMessage } from "@/lib/ai/schema";

interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  content: string;
  error?: boolean;
}

type AssistantPhase = "interpreting" | "analyzing" | "updating";

const phaseLabels: Record<AssistantPhase, string> = {
  interpreting: "Interpreting command…",
  analyzing: "Analyzing simulation data with Python…",
  updating: "Updating visualization…",
};

const suggestions = [
  "Where is the maximum value?",
  "Give me statistics for the current field.",
  "Plot the current field along X.",
  "Reset the visualization.",
];

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-2 mt-1 text-lg font-bold leading-tight text-[#16324a]">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-2 text-base font-bold leading-tight text-[#16324a]">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-2 text-sm font-bold text-[#16324a]">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-2 text-sm font-semibold text-[#294b63]">{children}</h4>,
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-[#16324a]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-[#73abc3] pl-3 text-[#567184]">{children}</blockquote>,
  code: ({ className, children, ...props }) => (
    <code className={`rounded bg-[#e6eef3] px-1.5 py-0.5 font-mono text-[0.9em] text-[#174b6d] ${className ?? ""}`} {...props}>{children}</code>
  ),
  pre: ({ children }) => <pre className="my-2 max-w-full overflow-x-auto rounded-lg border border-[#c6d5df] bg-[#eef3f6] p-3 text-xs leading-5 [&_code]:bg-transparent [&_code]:p-0">{children}</pre>,
  table: ({ children }) => <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-[#c6d5df]"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-[#eaf3f8] text-[#16324a]">{children}</thead>,
  th: ({ children }) => <th className="border-b border-r border-[#c6d5df] px-2.5 py-2 font-bold last:border-r-0">{children}</th>,
  td: ({ children }) => <td className="border-b border-r border-[#d7e2ea] px-2.5 py-2 align-top last:border-r-0">{children}</td>,
  a: ({ href, children }) => <a className="font-medium text-[#0b69a3] underline decoration-[#73abc3] underline-offset-2 hover:text-[#084d82]" href={href} rel="noopener noreferrer" target="_blank">{children}</a>,
  img: () => null,
  hr: () => <hr className="my-3 border-[#c6d5df]" />,
};

function MarkdownMessage({ content }: { content: string }) {
  return <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
}

export function AssistantPanel({
  disabled,
  onCommand,
}: {
  disabled: boolean;
  onCommand: (
    message: string,
    history: AIConversationMessage[],
    onPhase: (phase: AssistantPhase) => void,
  ) => Promise<string>;
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
  const [phase, setPhase] = useState<AssistantPhase>("interpreting");
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({ top: container.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, isSending, phase]);

  async function submit(message: string) {
    const value = message.trim();
    if (!value || disabled || isSending) return;
    const id = Date.now();
    setMessages((current) => [...current, { id, role: "user", content: value }]);
    setInput("");
    setIsSending(true);
    setPhase("interpreting");
    try {
      const history = messages.slice(-16).map(({ role, content }) => ({ role, content }));
      const response = await onCommand(value, history, setPhase);
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
      className="flex h-[560px] min-h-0 max-h-[560px] flex-col overflow-hidden"
      eyebrow="Structured actions"
      title="Simulation assistant"
    >
      <div ref={messagesRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite">
        {messages.map((message) => (
          <div className={`flex gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`} key={message.id}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${message.role === "user" ? "bg-[#dce8ef] text-[#24465f]" : "bg-[#dff3f7] text-[#0b7188]"}`}>
              {message.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </span>
            <div className={`max-w-[85%] overflow-hidden rounded-lg px-3 py-2 text-sm leading-6 ${
              message.role === "user"
                ? "whitespace-pre-wrap bg-[#0b5f9e] text-white shadow-sm"
                : message.error
                  ? "border border-[#e5b5ad] bg-[#fff2ef] text-[#9b3528]"
                  : "border border-[#d7e2ea] bg-[#f8fafc] text-[#294b63]"
            }`}>{message.role === "assistant" ? <MarkdownMessage content={message.content} /> : message.content}</div>
          </div>
        ))}
        {isSending && <p className="ml-10 animate-pulse text-xs font-medium text-[#0f7f8c]">{phaseLabels[phase]}</p>}
      </div>
      <div className="shrink-0 border-t border-[#d7e2ea] bg-[#fbfdfe] p-3">
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
