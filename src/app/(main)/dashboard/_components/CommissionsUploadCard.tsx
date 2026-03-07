"use client";

import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

type Props = {
  fileName: string | null;
  isParsing: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function CommissionsUploadCard({ fileName, isParsing, onFileChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function openFilePicker() {
    inputRef.current?.click();
  }

  function handleDroppedFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    // Reaproveita sua função existente (que espera ChangeEvent<HTMLInputElement>)
    const fakeEvent = {
      target: { files },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    onFileChange(fakeEvent);
  }

  return (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
      <h2 className="text-lg font-semibold text-text-primary font-heading">Importar relatório</h2>

      {/* Dropzone menor + clique para abrir */}
      <div
        className={[
          "mt-4 flex justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors",
          isDragging ? "border-shopee-orange bg-dark-bg/40" : "border-slate-600 hover:border-shopee-orange",
        ].join(" ")}
        role="button"
        tabIndex={0}
        aria-label="Enviar relatório CSV (clique ou arraste e solte)"
        onClick={openFilePicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") openFilePicker();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          handleDroppedFiles(e.dataTransfer.files);
        }}
      >
        <div className="text-center">
          <UploadCloud className="mx-auto h-11 w-11 text-text-secondary/50" />

          <div className="mt-4">
            <span className="rounded-md font-semibold text-shopee-orange transition-opacity hover:opacity-80">
              {fileName || "Selecione o relatório de Comissões (.csv)"}
            </span>

            {/* input escondido (click abre o picker) */}
            <input
              ref={inputRef}
              id="commissions-upload"
              name="commissions-upload"
              type="file"
              className="sr-only"
              accept=".csv"
              onChange={onFileChange}
            />
          </div>

          {isParsing && <p className="text-sm text-yellow-400 mt-2">Processando arquivo...</p>}

          {fileName && !isParsing && (
            <p className="text-sm text-green-500 mt-2">{fileName} carregado! Análise acima.</p>
          )}

          <p className="text-xs text-text-secondary/80 mt-3">
            Você pode arrastar e soltar o arquivo aqui ou clicar para selecionar.
          </p>
        </div>
      </div>
    </div>
  );
}
