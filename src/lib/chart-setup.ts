'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Registro único no cliente de escalas/elementos/plugins.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels
);

/**
 * Evita erro "Cannot read properties of null (reading 'getParsed')" no tooltip
 * quando o mouse está sobre o gráfico durante atualização/destruição dos dados.
 * Ver: https://github.com/chartjs/Chart.js/issues/11315
 */
ChartJS.register({
  id: 'tooltipNullGuard',
  beforeEvent(chart, args) {
    if (args.event.type !== 'mousemove' && args.event.type !== 'mouseout') return;
    try {
      const active = chart.getActiveElements?.() ?? [];
      for (const el of active) {
        if (!el) {
          chart.tooltip?.setActiveElements?.([]);
          return;
        }
        const meta = chart.getDatasetMeta?.(el.datasetIndex);
        if (!meta?.controller) {
          chart.tooltip?.setActiveElements?.([]);
          return;
        }
      }
    } catch {
      try {
        chart.tooltip?.setActiveElements?.([]);
      } catch {
        // ignore
      }
    }
  },
});
