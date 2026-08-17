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
    <section className={`rounded-xl border border-[#d7e2ea] bg-white shadow-[0_1px_2px_rgba(22,50,74,0.04),0_8px_24px_rgba(40,76,102,0.05)] ${className}`}>
      <div className="flex min-h-14 flex-col items-stretch gap-3 border-b border-[#d7e2ea] bg-[#fbfdfe] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0f7f8c]">{eyebrow}</p>}
          <h2 className="text-sm font-semibold text-[#16324a]">{title}</h2>
        </div>
        {action && <div className="min-w-0 sm:ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}
