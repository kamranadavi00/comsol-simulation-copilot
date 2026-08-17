"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";

export function UploadDropzone({
  onUpload,
  isLoading,
  compact = false,
}: {
  onUpload: (file: File) => Promise<void>;
  isLoading: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function accept(file?: File) {
    if (!file || isLoading) return;
    await onUpload(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      className={`group relative flex items-center justify-center rounded-xl border border-dashed transition ${
        compact ? "min-h-24 px-4 py-3" : "min-h-56 px-6 py-10"
      } ${isDragging ? "border-[#0b9fc2] bg-[#eaf8fb] shadow-[0_0_0_3px_rgba(11,159,194,0.1)]" : "border-[#a9bdca] bg-[#f8fbfd] hover:border-[#0b7bb5] hover:bg-[#f2f9fc]"}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget === event.target) setIsDragging(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        void accept(event.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        accept=".csv,text/csv"
        className="sr-only"
        disabled={isLoading}
        onChange={(event) => void accept(event.target.files?.[0])}
        type="file"
      />
      <button
        className="flex min-h-11 w-full items-center justify-center gap-3 text-left outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-[#0b9fc2] focus-visible:ring-offset-2"
        disabled={isLoading}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#b9d8e5] bg-[#eaf6fa] text-[#0b6f9f] transition group-hover:border-[#70b5cf]">
          {isLoading ? <UploadCloud className="animate-pulse" size={20} /> : <FileSpreadsheet size={20} />}
        </span>
        <span>
          <span className="block text-sm font-semibold text-[#16324a]">
            {isLoading ? "Processing simulation…" : compact ? "Load another CSV" : "Upload COMSOL results"}
          </span>
          <span className="mt-1 block text-xs leading-5 text-[#567184]">
            {compact ? "CSV · up to 50 MB" : "Drop a CSV here or browse · coordinates and fields are detected automatically"}
          </span>
        </span>
      </button>
    </div>
  );
}
