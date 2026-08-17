import type { ReactNode } from "react";

export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-[#0b151d] ${className}`}>
      <div className="flex min-h-14 flex-col items-stretch gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400">{eyebrow}</p>}
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        </div>
        {action && <div className="min-w-0 sm:ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}
