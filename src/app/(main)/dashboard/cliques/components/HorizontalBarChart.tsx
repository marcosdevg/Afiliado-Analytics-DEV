'use client';

import dynamic from 'next/dynamic';
import type { ChartOptions, TooltipItem } from 'chart.js';
import type { Context } from 'chartjs-plugin-datalabels';
import type { ClicksBarData } from '@/types';

// Carregar apenas no cliente para evitar SSR de canvas/libs que usam window.
const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), {
  ssr: false,
});

interface ChartProps {
  data?: ClicksBarData[];
  title: string;
  label: string;
}

const formatNumber = (value: number) => value.toLocaleString('pt-BR');

export default function HorizontalBarChart({ data = [], title, label }: ChartProps) {
  const maxDataValue = data.length > 0 ? Math.max(...data.map(d => d.clicks)) : 0;
  const threshold = maxDataValue > 0 ? maxDataValue * 0.7 : 0;

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: title,
        color: '#FFFFFF',
        font: {
          size: 18,
          weight: 600,
          family: 'Poppins, sans-serif',
        },
        padding: {
          bottom: 20,
        },
      },
      tooltip: {
        enabled: false,
        callbacks: {
          label: function (context: TooltipItem<'bar'>) {
            const value = typeof context.raw === 'number' ? context.raw : 0;
            return `${label}: ${formatNumber(value)}`;
          },
        },
      },
      datalabels: {
        anchor: 'end',
        formatter: (value: number) => formatNumber(value),
        font: {
          weight: 600,
          size: 14,
        },
        color: '#FFFFFF',
        align: (ctx: Context) => {
          const v = ctx.dataset.data[ctx.dataIndex] as number;
          return v > threshold ? 'start' : 'end';
        },
        offset: 8,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          display: false,
        },
        border: {
          display: false,
        },
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#E9E9E9',
          font: {
            size: 14,
          },
        },
        border: {
          display: false,
        },
      },
    },
  };

  const chartData = {
    labels: data.map(d => d.name),
    datasets: [
      {
        label: label,
        data: data.map(d => d.clicks),
        backgroundColor: '#EE4D2Dcc',
        hoverBackgroundColor: '#EE4D2D',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#EE4D2D',
      },
    ],
  };

  return (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border h-full">
      <div style={{ height: '300px' }}>
        <Bar key={`hbar-${data.length}-${title}`} options={options} data={chartData} />
      </div>
    </div>
  );
}
