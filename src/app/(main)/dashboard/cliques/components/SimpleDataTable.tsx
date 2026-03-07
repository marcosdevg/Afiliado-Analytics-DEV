// Componente pode ser Server Component (sem "use client"), pois não usa estado/efeitos.

import type { ClicksBarData } from '@/types';

const formatNumber = (value: number) => value.toLocaleString('pt-BR');

interface SimpleDataTableProps {
  title: string;
  data?: ClicksBarData[];
}

export default function SimpleDataTable({ title, data = [] }: SimpleDataTableProps) {
  // Máximo calculado de forma robusta (lista pode não estar ordenada)
  const maxClicks = data.reduce((max, item) => Math.max(max, item.clicks), 0);

  const labelledById = 'table-title-' + title.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border h-full">
      <h3 id={labelledById} className="text-lg font-semibold text-text-primary font-heading mb-4">
        {title}
      </h3>

      <div className="overflow-y-auto h-[280px] pr-2">
        <table className="min-w-full table-fixed text-left" aria-labelledby={labelledById}>
          {/* Caption para acessibilidade (visualmente oculto) */}
          <caption className="sr-only">{title}</caption>

          {/* Cabeçalho sticky com sobreposição garantida */}
          <thead className="sticky top-0 bg-dark-card border-b-2 border-shopee-orange/30 z-10">
            <tr>
              <th scope="col" className="p-3 text-xs font-medium text-text-secondary uppercase tracking-wider w-2/5">
                Região
              </th>
              <th scope="col" className="p-3 text-xs font-medium text-text-secondary uppercase tracking-wider w-3/5">
                Cliques
              </th>
            </tr>
          </thead>

          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={2} className="p-3 text-sm text-text-secondary">
                  Nenhum dado disponível.
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const barWidth = maxClicks > 0 ? (item.clicks / maxClicks) * 100 : 0;

                // Ideal: usar item.id se existir; index é último recurso
                const key = item.name ? `${item.name}-${index}` : `row-${index}`;

                return (
                  <tr key={key}>
                    <td className="p-3 text-sm text-text-secondary font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                      {item.name}
                    </td>
                    <td className="p-3 text-sm font-semibold text-text-primary">
                      <div className="flex items-center gap-4">
                        {/* Barra com semântica de progressbar para leitores de tela */}
                        <div className="w-full bg-text-secondary/20 rounded-full h-2" aria-hidden="true">
                          <div
                            className="bg-shopee-orange h-2 rounded-full"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>

                        {/* Região acessível alternativa (opcional): 
                            Se preferir expor como progressbar real (não apenas decorativo),
                            troque o bloco acima por um único div com role="progressbar" */}
                        <div
                          role="progressbar"
                          aria-valuenow={item.clicks}
                          aria-valuemin={0}
                          aria-valuemax={Math.max(1, maxClicks)}
                          aria-label={`Cliques em ${item.name}`}
                          className="sr-only"
                        >
                          {formatNumber(item.clicks)}
                        </div>

                        <span className="min-w-[40px] text-right text-text-secondary">
                          {formatNumber(item.clicks)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
