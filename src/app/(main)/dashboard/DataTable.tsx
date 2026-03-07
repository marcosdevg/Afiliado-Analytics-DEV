"use client";

import { useState, useMemo, ReactNode, useId, useEffect, useRef } from "react";
import { Search } from "lucide-react";

type Column<T, K extends keyof T = keyof T> = {
  header: string;
  accessor: K;
  render?: (value: T[K], row: T) => ReactNode;
  align?: "left" | "center" | "right";
};

type DataTableProps<T> = {
  title: string;
  subtitle?: string;
  data: T[];
  columns: Array<Column<T, keyof T>>;
  searchableColumn?: keyof T;
  getRowKey?: (row: T, index: number) => string | number;
  forceHorizontalScroll?: boolean;
};

export default function DataTable<T extends Record<string, unknown>>({
  title,
  subtitle,
  data,
  columns,
  searchableColumn,
  getRowKey,
  forceHorizontalScroll = false,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleRows, setVisibleRows] = useState(10);
  const tableId = useId();
  const statusId = useId();

  // ── Scroll shadow (só ativo com forceHorizontalScroll) ──────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showRightShadow, setShowRightShadow] = useState(false);

  useEffect(() => {
    if (!forceHorizontalScroll) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const hasHorizontalScroll = container.scrollWidth > container.clientWidth;
      const scrollLeft = container.scrollLeft;
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      const isNearEnd = scrollLeft >= maxScrollLeft - 10;
      setShowRightShadow(hasHorizontalScroll && !isNearEnd);
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [forceHorizontalScroll, data]);
  // ─────────────────────────────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    if (!searchableColumn || !searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((row) => row[searchableColumn]?.toString().toLowerCase().includes(term));
  }, [data, searchTerm, searchableColumn]);

  const dataToShow = filteredData.slice(0, visibleRows);
  const canShowMore = visibleRows < filteredData.length;

  return (
    <div className="bg-dark-card p-4 sm:p-6 rounded-lg border border-dark-border flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <div className="flex flex-col items-center sm:items-start">
          <h3 className="text-lg font-semibold text-text-primary font-heading">{title}</h3>
          {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
        </div>

        {searchableColumn && (
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <input
              type="text"
              placeholder={`Buscar por ${
                columns.find((c) => c.accessor === searchableColumn)?.header || ""
              }...`}
              aria-label={`Buscar na tabela por ${
                columns.find((c) => c.accessor === searchableColumn)?.header || "coluna selecionada"
              }`}
              aria-controls={tableId}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 appearance-none rounded-md border border-dark-border bg-dark-bg py-2 pl-9 pr-3 text-text-primary placeholder-text-secondary/70 shadow-sm focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange sm:text-sm"
            />
          </div>
        )}
      </div>

      {/* Wrapper relativo para o fade funcionar com position absolute */}
      <div className="relative flex-grow">
        <div
          ref={scrollContainerRef}
          className={`h-full overflow-x-auto rounded-lg border border-table-border-subtle ${
            forceHorizontalScroll ? "scrollbar-custom" : ""
          }`}
        >
          <table
            id={tableId}
            className={`${
              forceHorizontalScroll ? "min-w-max" : "min-w-full"
            } w-full text-sm text-left table-auto table-bordered`}
          >
            <caption className="sr-only">{title}</caption>

            <thead className="text-xs text-text-secondary uppercase bg-dark-bg/50 border-b-2 border-shopee-orange/30">
              <tr>
                {columns.map((col, index) => {
                  const align = index === 0 ? (col.align ?? "left") : (col.align ?? "center");
                  const thAlignClass =
                    align === "right"
                      ? "text-right"
                      : align === "center"
                      ? "text-center"
                      : "text-left";

                  return (
                    <th
                      key={String(col.accessor)}
                      scope="col"
                      className={`px-3 sm:px-6 py-3 whitespace-nowrap ${thAlignClass}`}
                    >
                      {col.header}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody aria-live="polite" aria-atomic="true" id={statusId}>
              {dataToShow.map((row, rowIndex) => {
                const rowKey = getRowKey ? getRowKey(row, rowIndex) : rowIndex;

                return (
                  <tr key={rowKey} className="table-row-border hover:bg-dark-bg/50 transition-colors">
                    {columns.map((col, colIndex) => {
                      const value = row[col.accessor] as T[keyof T];
                      const cell = col.render ? col.render(value, row) : (value as ReactNode);

                      const align = colIndex === 0 ? (col.align ?? "left") : (col.align ?? "center");

                      const tdAlignClass =
                        align === "right"
                          ? "text-right"
                          : align === "center"
                          ? "text-center"
                          : "text-left";

                      const wrapClass = forceHorizontalScroll
                        ? "whitespace-nowrap"
                        : colIndex === 0
                        ? "whitespace-normal break-words"
                        : "whitespace-nowrap";

                      return (
                        <td
                          key={String(col.accessor)}
                          className={`px-3 sm:px-6 py-4 text-text-primary align-middle ${tdAlignClass} ${wrapClass}`}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {dataToShow.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="text-center py-8 text-text-secondary/60">
                    Nenhum resultado encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Fade gradiente à direita — aparece só quando há mais conteúdo */}
        {forceHorizontalScroll && showRightShadow && (
          <div
            className="absolute top-0 right-0 bottom-0 w-12 pointer-events-none z-30"
            style={{
              background:
                "linear-gradient(to left, rgba(24, 24, 27, 0.95) 0%, rgba(24, 24, 27, 0.6) 40%, rgba(24, 24, 27, 0.2) 70%, transparent 100%)",
            }}
          />
        )}
      </div>

      {canShowMore && (
        <div className="pt-4 border-t border-dark-border mt-4 text-center">
          <button
            onClick={() => setVisibleRows((prev) => prev + 10)}
            className="text-shopee-orange font-semibold text-sm hover:opacity-80 transition-opacity"
            aria-describedby={statusId}
          >
            Ver mais
          </button>
        </div>
      )}

      <style jsx>{`
        .border-table-border-subtle {
          border-color: rgba(255, 255, 255, 0.05);
        }
        .table-row-border {
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .table-bordered th,
        .table-bordered td {
          border-right: 1px solid rgba(255, 255, 255, 0.05);
        }
        .table-bordered th:last-child,
        .table-bordered td:last-child {
          border-right: none;
        }

        /* ── Scrollbar dark + laranja (só nas tabelas com scroll) ── */
        .scrollbar-custom {
          scrollbar-width: thin;
          scrollbar-color: #f97316 #18181b;
        }
        .scrollbar-custom::-webkit-scrollbar {
          height: 10px;
        }
        .scrollbar-custom::-webkit-scrollbar-track {
          background: #0f0f11;
          border-radius: 5px;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: #f97316;
          border-radius: 5px;
          border: 2px solid #18181b;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
          background: #ea580c;
        }

        /* ── Transições suaves ── */
        table {
          border-spacing: 0;
        }
        tbody td {
          transition: background-color 0.15s ease-in-out;
        }
      `}</style>
    </div>
  );
}
