'use client';

import dynamic from 'next/dynamic';
import type { ChartOptions } from 'chart.js';

// Carrega o Bar somente no cliente (sem SSR).
const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), {
  ssr: false,
});

type TopCategoryData = {
  category: string;
  commission: number;
};

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TopCategoriesChart({ data = [] }: { data: TopCategoryData[] }) {
  const options: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      datalabels: { display: false },
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Top 5 Categorias (L1) por Comissão Líquida',
        color: '#FFFFFF',
        font: {
          size: 18,
          weight: 'bold',
          family: 'Poppins, sans-serif',
        },
        padding: {
          bottom: 20,
        },
      },
      tooltip: {
        backgroundColor: '#18181B',
        titleColor: '#FFFFFF',
        bodyColor: '#E9E9E9',
        borderColor: '#27272A',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: function (context) {
            const value = typeof context.raw === 'number' ? context.raw : 0;
            return `Comissão: ${formatCurrency(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(233, 233, 233, 0.1)' },
        ticks: { color: '#E9E9E9' },
        title: {
          display: true,
          text: 'Comissão Líquida (R$)',
          color: '#E9E9E9',
        },
      },
      y: {
        grid: { color: 'rgba(233, 233, 233, 0.1)' },
        ticks: { color: '#E9E9E9' },
      },
    },
  };

  const chartData = {
    labels: data.map((d) => d.category),
    datasets: [
      {
        label: 'Comissão Líquida',
        data: data.map((d) => d.commission),
        backgroundColor: '#EE4D2D',
        hoverBackgroundColor: '#F48A5A',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#EE4D2D',
      },
    ],
  };

  return (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border h-full">
      <div style={{ height: '350px' }}>
        <Bar key={`topcat-${data.length}`} options={options} data={chartData} />
      </div>
    </div>
  );
}
