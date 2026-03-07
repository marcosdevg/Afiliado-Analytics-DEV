import type { CategoryNode } from "@/types";
import TopCategoriesChart from "./TopCategoriesChart";
import NicheExplorerTable from "./NicheExplorerTable";

type TopCategoryData = {
  category: string;
  commission: number;
};

interface CategoryAnalysisProps {
  topCategoriesData?: TopCategoryData[];
  categoryTreeData?: CategoryNode[];
}

export default function CategoryAnalysis({
  topCategoriesData = [],
  categoryTreeData = [],
}: CategoryAnalysisProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div>
        <TopCategoriesChart data={topCategoriesData} />
      </div>
      <div>
        <NicheExplorerTable data={categoryTreeData} />
      </div>
    </div>
  );
}
