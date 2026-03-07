import type { ClicksBarData, ClicksByHourData } from "@/types";
import HorizontalBarChart from "./HorizontalBarChart";
import LineChart from "./LineChart";

interface TimeAnalysisProps {
  byDayOfWeek?: ClicksBarData[];
  byHour?: ClicksByHourData[];
}

export default function TimeAnalysis({ byDayOfWeek = [], byHour = [] }: TimeAnalysisProps) {
  return (
    <div className="flex flex-col gap-8">
      <LineChart
        title="Cliques por Hora do Dia"
        label="Cliques"
        data={byHour}
      />
      <HorizontalBarChart 
        title="Cliques por Dia da Semana"
        label="Cliques"
        data={byDayOfWeek}
      />
    </div>
  )
}
