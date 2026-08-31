"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Plus, Trash2, UploadCloud } from "lucide-react";

const MAX_FILES = 6;

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function readableSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDropzone({
  onUpload,
  isLoading,
  compact = false,
}: {
  onUpload: (files: File[]) => Promise<boolean>;
  isLoading: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  function addFiles(files?: File[]) {
    if (!files?.length || isLoading) return;
    const csvFiles = files.filter((file) => file.name.toLowerCase().endsWith(".csv"));
    if (csvFiles.length !== files.length) {
      setSelectionError("Only CSV files can be uploaded.");
    } else {
      setSelectionError(null);
    }

    const known = new Set(selectedFiles.map(fileKey));
    const additions = csvFiles.filter((file) => !known.has(fileKey(file)));
    const combined = [...selectedFiles, ...additions];
    if (combined.length > MAX_FILES) {
      setSelectionError(`You can upload up to ${MAX_FILES} CSV files together.`);
    }
    setSelectedFiles(combined.slice(0, MAX_FILES));
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit() {
    if (!selectedFiles.length || isLoading) return;
    const uploaded = await onUpload(selectedFiles);
    if (uploaded) {
      setSelectedFiles([]);
      setSelectionError(null);
    }
  }

  return (
    <div
      className={`group relative rounded-xl border border-dashed transition ${
        compact ? "min-h-24 px-4 py-3" : "min-h-56 px-6 py-8"
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
        addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        ref={inputRef}
        accept=".csv,text/csv"
        className="sr-only"
        disabled={isLoading}
        multiple
        onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
        type="file"
      />

      <div className="flex min-h-full flex-col items-center justify-center gap-4">
        <button
          className="flex min-h-11 w-full items-center justify-center gap-3 text-left outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-[#0b9fc2] focus-visible:ring-offset-2"
          disabled={isLoading}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#b9d8e5] bg-[#eaf6fa] text-[#0b6f9f] transition group-hover:border-[#70b5cf]">
            {isLoading ? <UploadCloud className="animate-pulse" size={20} /> : selectedFiles.length ? <Plus size={20} /> : <FileSpreadsheet size={20} />}
          </span>
          <span>
            <span className="block text-sm font-semibold text-[#16324a]">
              {isLoading ? "Reconstructing simulation data…" : selectedFiles.length ? "Add more CSV files" : compact ? "Choose CSV or mesh files" : "Choose COMSOL results or mesh files"}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#567184]">
              Select up to six files at once, or add them one by one before uploading.
            </span>
          </span>
        </button>

        {selectedFiles.length > 0 && (
          <div className="w-full max-w-2xl rounded-lg border border-[#c9d9e2] bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#36566b]">
              <span>{selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} ready</span>
              <button
                className="rounded px-2 py-1 text-[#b24141] hover:bg-[#fff0f0]"
                disabled={isLoading}
                onClick={() => {
                  setSelectedFiles([]);
                  setSelectionError(null);
                }}
                type="button"
              >
                Clear all
              </button>
            </div>
            <ul className="max-h-36 space-y-1 overflow-y-auto">
              {selectedFiles.map((file) => (
                <li className="flex items-center gap-2 rounded-md bg-[#f5f9fb] px-2 py-1.5 text-xs" key={fileKey(file)}>
                  <FileSpreadsheet className="shrink-0 text-[#0b7bb5]" size={14} />
                  <span className="min-w-0 flex-1 truncate font-medium text-[#28485d]">{file.name}</span>
                  <span className="shrink-0 text-[#718897]">{readableSize(file.size)}</span>
                  <button
                    aria-label={`Remove ${file.name}`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded text-[#718897] hover:bg-[#ffecec] hover:text-[#b24141]"
                    disabled={isLoading}
                    onClick={() => setSelectedFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)))}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#087fab] px-4 text-sm font-semibold text-white transition hover:bg-[#066d94] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={() => void submit()}
              type="button"
            >
              <UploadCloud size={16} />
              Upload {selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} files together`}
            </button>
          </div>
        )}

        {selectionError && <p className="text-center text-xs font-medium text-[#b24141]">{selectionError}</p>}
      </div>
    </div>
  );
}
