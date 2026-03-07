import type { ClicksBarData } from "@/types";
import HorizontalBarChart from "./HorizontalBarChart";
import SimpleDataTable from "./SimpleDataTable";

interface OriginAnalysisProps {
  byReferrer?: ClicksBarData[];
  byRegion?: ClicksBarData[];
}

export default function OriginAnalysis({ byReferrer = [], byRegion = [] }: OriginAnalysisProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <HorizontalBarChart 
        title="Fontes de Tráfego"
        label="Cliques"
        data={byReferrer}
      />
      <SimpleDataTable 
        title="Top 5 Regiões por Cliques"
        data={byRegion}
      />
    </div>
  )
}
