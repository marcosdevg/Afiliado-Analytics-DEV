'use client';

import { memo } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft } from 'lucide-react';
import type {
  ChartEvent,
  ActiveElement,
  ChartOptions,
  ChartData,
} from 'chart.js';
import type { TemporalChartData } from '@/types';
import { useChartColors } from '../../components/theme/useChartColors';

// Carrega o Bar somente no cliente (sem SSR).
const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), {
  ssr: false,
});

export type ChartView = 'hour' | 'week' | 'month';

type OrdersChartProps = {
  data: TemporalChartData[];
  view: ChartView;
  isPending?: boolean;
  setView: (view: ChartView) => void;
  isDrilledDown: boolean;
  onBackClick: () => void;
  onBarClick: (data: TemporalChartData) => void;
};

function OrdersChartComponent({
  data = [],
  view,
  isPending,
  setView,
  isDrilledDown,
  onBackClick,
  onBarClick,
}: OrdersChartProps) {
  const viewOptions: { id: ChartView; label: string }[] = [
    { id: 'hour', label: 'Por Hora' },
    { id: 'week', label: 'Por Semana' },
    { id: 'month', label: 'Por Mês' },
  ];

  const c = useChartColors();
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      datalabels: { display: false },
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        backgroundColor: c.tooltipBg,
        titleColor: c.tooltipTitle,
        titleFont: { weight: 'bold', size: 14 },
        bodyColor: c.tooltipBody,
        bodyFont: { size: 12 },
        padding: 12,
        borderColor: c.tooltipBorder,
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (tooltipItems) => (tooltipItems?.[0]?.label ?? ''),
          label: (context) => {
            const originalData = data[context.dataIndex];
            const concluidos = originalData?.concluidos ?? 0;
            const pendentes = originalData?.pendentes ?? 0;
            const totalEarning = concluidos + pendentes;
            return `Total de Pedidos: ${totalEarning}`;
          },
          afterLabel: (context) => {
            const originalData = data[context.dataIndex];
            if (!originalData) return '';
            return [
              '',
              `Concluídos: ${originalData.concluidos ?? 0}`,
              `Pendentes: ${originalData.pendentes ?? 0}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: c.grid },
        ticks: { color: c.textSecondary },
      },
      y: {
        grid: { color: c.grid },
        ticks: { color: c.textSecondary },
      },
    },
    onClick: (_: ChartEvent, elements: ActiveElement[]) => {
      if (elements.length > 0) {
        const elementIndex = elements[0].index;
        const clickedData = data[elementIndex];
        // Semana: 1º clique entra no drill-down diário; no diário, clique abre detalhe (pai decide).
        if (view === 'week' && onBarClick && clickedData) {
          onBarClick(clickedData);
        }
      }
    },
    onHover: (event: ChartEvent, chartElement: ActiveElement[]) => {
      const canvas = event.native?.target as HTMLCanvasElement;
      if (canvas) {
        canvas.style.cursor = chartElement[0] ? 'pointer' : 'default';
      }
    },
  };

  const chartData: ChartData<'bar'> = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        label: 'Pedidos (Concluídos + Pendentes)',
        data: data.map((d) => (d.concluidos ?? 0) + (d.pendentes ?? 0)),
        backgroundColor: '#EE4D2D',
        hoverBackgroundColor: '#F48A5A',
        borderRadius: 5,
        borderSkipped: false,
      },
    ],
  };

  return (
    <div
      className={`bg-dark-card p-6 rounded-lg border border-dark-border transition-opacity duration-300 ${
        isPending ? 'opacity-60' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <div className="flex items-center gap-4">
          {isDrilledDown && (
            <button
              onClick={onBackClick}
              title="Voltar para visão semanal"
              className="p-2 rounded-full hover:bg-dark-bg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-text-secondary" />
            </button>
          )}

          {/* ✅ título + subtítulo */}
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold text-text-primary font-heading leading-tight">
              {isDrilledDown ? 'Análise de Pedidos (Diário)' : 'Análise de Pedidos'}
            </h3>
            <p className="text-sm text-text-secondary mt-1">(Pendentes + Concluídos)</p>
          </div>
        </div>

        {!isDrilledDown && (
          <div className="flex items-center gap-1 bg-dark-bg p-1 rounded-md overflow-x-auto">
            {viewOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setView(option.id)}
                className={`px-3 py-1 text-sm font-semibold rounded transition-colors whitespace-nowrap ${
                  view === option.id
                    ? 'bg-shopee-orange text-text-primary'
                    : 'text-text-secondary hover:bg-dark-border'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative" style={{ height: '300px' }}>
        <Bar key={`orders-${view}-${data.length}`} options={options} data={chartData} />
      </div>
    </div>
  );
}

export default memo(OrdersChartComponent);
