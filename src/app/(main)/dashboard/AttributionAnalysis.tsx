import type { AttributionData } from "@/types";
import { ArrowDownRight, ArrowRight } from "lucide-react";

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AttributionAnalysis({ data }: { data: AttributionData | null }) {
  if (!data) {
    return (
      <div className="bg-dark-card p-6 rounded-lg border border-dark-border text-center text-text-secondary">
        Calculando dados de atribuição...
      </div>
    );
  }

  const { direct, indirect } = data;
  const avgCommissionDirect = direct.orders > 0 ? direct.commission / direct.orders : 0;
  const avgCommissionIndirect = indirect.orders > 0 ? indirect.commission / indirect.orders : 0;

  return (
    <div className="bg-dark-card rounded-lg border border-dark-border p-6">
      <div className="border-b border-dark-border pb-4 mb-4">
        <h3 className="text-lg font-semibold text-text-primary font-heading">
          Origem da Performance: Direta vs. Indireta
        </h3>
        <p className="text-sm text-text-secondary mt-1">(Pendentes + Concluídos)</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-table-border-subtle">
        <table className="min-w-full table-auto text-left table-bordered">
          <caption className="sr-only">Comparação de métricas diretas e indiretas</caption>
          <thead className="bg-dark-bg border-b-2 border-shopee-orange/30">
            <tr>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider">
                Métrica
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider text-center">
                <div className="flex items-center justify-center gap-2">
                  <ArrowRight size={14} className="text-shopee-orange" />
                  <span>Direto</span>
                </div>
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider text-center">
                <div className="flex items-center justify-center gap-2">
                  <ArrowDownRight size={14} className="text-text-tertiary" />
                  <span>Indireto</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="table-row-border hover:bg-dark-bg/50 transition-colors">
              <td className="p-3 text-sm text-text-secondary font-medium">Nº de Pedidos</td>
              <td className="p-3 text-center text-sm font-semibold text-text-primary">
                {direct.orders.toLocaleString('pt-BR')}
              </td>
              <td className="p-3 text-center text-sm font-semibold text-text-primary">
                {indirect.orders.toLocaleString('pt-BR')}
              </td>
            </tr>
            <tr className="table-row-border hover:bg-dark-bg/50 transition-colors">
              <td className="p-3 text-sm text-text-secondary font-medium">Comissão Total</td>
              <td className="p-3 text-center text-sm font-semibold text-text-primary">
                {formatCurrency(direct.commission)}
              </td>
              <td className="p-3 text-center text-sm font-semibold text-text-primary">
                {formatCurrency(indirect.commission)}
              </td>
            </tr>
            <tr className="table-row-border hover:bg-dark-bg/50 transition-colors">
              <td className="p-3 text-sm text-text-secondary font-medium">Comissão p/ Pedido</td>
              <td className="p-3 text-center text-sm font-semibold text-text-primary">
                {formatCurrency(avgCommissionDirect)}
              </td>
              <td className="p-3 text-center text-sm font-semibold text-text-primary">
                {formatCurrency(avgCommissionIndirect)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <style jsx>{`
        /* Border sutil ao redor da tabela */
        .border-table-border-subtle {
          border-color: rgba(255, 255, 255, 0.05);
        }

        /* Borders horizontais e verticais sutis */
        .table-row-border {
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .table-bordered th,
        .table-bordered td {
          border-right: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Remove border direita da última coluna */
        .table-bordered th:last-child,
        .table-bordered td:last-child {
          border-right: none;
        }
      `}</style>
    </div>
  );
}
