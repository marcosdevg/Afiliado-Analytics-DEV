"use client";

import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

type Props = {
  title: string;
  label: string; // texto principal clicável
  fileName?: string | null;
  loading?: boolean;
  loadingText?: string;
  successText?: string;

  accept?: string; // ex: ".csv"
  disabled?: boolean;

  onFilesSelected: (files: FileList) => void;
};

export default function ReportUploadCard({
  title,
  label,
  fileName = null,
  loading = false,
  loadingText = "Processando arquivo...",
  successText,
  accept = ".csv",
  disabled = false,
  onFilesSelected,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function openFilePicker() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function handleFiles(files: FileList | null) {
    if (disabled) return;
    if (!files || files.length === 0) return;
    onFilesSelected(files);
  }

  return (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
      <h2 className="text-lg font-semibold text-text-primary font-heading">{title}</h2>

      <div
        className={[
          "mt-4 flex justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors",
          disabled
            ? "border-slate-700 opacity-60 cursor-not-allowed"
            : isDragging
              ? "border-shopee-orange bg-dark-bg/40"
              : "border-slate-600 hover:border-shopee-orange",
        ].join(" ")}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={title}
        onClick={openFilePicker}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") openFilePicker();
        }}
        onDragEnter={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="text-center">
          <UploadCloud className="mx-auto h-11 w-11 text-text-secondary/50" />

          <div className="mt-4">
            <span className="rounded-md font-semibold text-shopee-orange transition-opacity hover:opacity-80">
              {fileName || label}
            </span>

            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept={accept}
              onChange={(e) => handleFiles(e.target.files)}
              disabled={disabled}
            />
          </div>

          {loading && <p className="text-sm text-yellow-400 mt-2">{loadingText}</p>}

          {!loading && fileName && (
            <p className="text-sm text-green-500 mt-2">
              {successText ?? `${fileName} carregado!`}
            </p>
          )}

          <p className="text-xs text-text-secondary/80 mt-3">
            Você pode arrastar e soltar o arquivo aqui ou clicar para selecionar.
          </p>
        </div>
      </div>
    </div>
  );
}
