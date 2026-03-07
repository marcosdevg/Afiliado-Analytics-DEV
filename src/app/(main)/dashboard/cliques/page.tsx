"use client";

import { useSupabase } from "@/app/components/auth/AuthProvider";
import { UploadCloud, CalendarDays, Replace, Fingerprint } from "lucide-react";
import Papa from "papaparse";
import { useState, useEffect, useMemo } from "react";
import { useSessionStorageState } from "@/app/hooks/useSessionStorageState";
import Tabs from "../Tabs";
import OriginAnalysis from "./components/OriginAnalysis";
import TimeAnalysis from "./components/TimeAnalysis";
import CampaignPerformanceTable from "./components/CampaignPerformanceTable";
import ReportUploadCard from "@/app/components/ui/ReportUploadCard";

import type {
  ClicksBarData,
  ClicksByHourData,
  CampaignPerformanceData,
} from "@/types";
import LoadingOverlay from "@/app/components/ui/LoadingOverlay";

interface ClickDataRow {
  "Tempo dos Cliques": string;
  "Referenciador": string;
  "Região dos Cliques": string;
  "Sub_id": string;
}

const formatNumber = (value: number) => value.toLocaleString("pt-BR");

export default function ClicksPage() {
  const context = useSupabase();
  const session = context?.session;

  const [rawData, setRawData] = useSessionStorageState<ClickDataRow[]>(
    "clicksRawData",
    []
  );
  const [fileName, setFileName] = useSessionStorageState<string | null>(
    "clicksFileName",
    null
  );

  const [isLoading, setIsLoading] = useState(false);
  const [reportDateRange, setReportDateRange] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const [totalClicks, setTotalClicks] = useState(0);
  const [clicksByReferrer, setClicksByReferrer] = useState<ClicksBarData[]>([]);
  const [clicksByRegion, setClicksByRegion] = useState<ClicksBarData[]>([]);
  const [clicksByDayOfWeek, setClicksByDayOfWeek] = useState<ClicksBarData[]>(
    []
  );
  const [clicksByHour, setClicksByHour] = useState<ClicksByHourData[]>([]);
  const [campaignPerformanceData, setCampaignPerformanceData] = useState<
    CampaignPerformanceData[]
  >([]);
  const [campaignHeaders, setCampaignHeaders] = useState<string[]>([]);

  useEffect(() => {
    if (rawData.length > 0) {
      setTotalClicks(rawData.length);

      let minDate: Date | null = null;
      let maxDate: Date | null = null;

      const referrerAgg: { [key: string]: number } = {};
      const regionAgg: { [key: string]: number } = {};
      const dayOfWeekAgg: { [key: number]: number } = {
        0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
      };
      const hourAgg: { [key: number]: number } = {};
      const campaignAgg: { [subId: string]: { [referrer: string]: number } } = {};
      const allReferrers = new Set<string>();

      rawData.forEach((row) => {
        const clickTimeStr = row["Tempo dos Cliques"];
        if (clickTimeStr) {
          const clickDate = new Date(clickTimeStr);
          if (!isNaN(clickDate.getTime())) {
            if (!minDate || clickDate < minDate) minDate = clickDate;
            if (!maxDate || clickDate > maxDate) maxDate = clickDate;
            const day = clickDate.getDay();
            dayOfWeekAgg[day] = (dayOfWeekAgg[day] || 0) + 1;
            const hour = clickDate.getHours();
            hourAgg[hour] = (hourAgg[hour] || 0) + 1;
          }
        }

        let referrer = (row["Referenciador"] || "").trim();
        if (referrer === "" || referrer === "-" || referrer === "----") {
          referrer = "Desconhecido";
        }

        let region = (row["Região dos Cliques"] || "").trim();
        if (region === "" || region === "-" || region === "----") {
          region = "Desconhecida";
        }

        let subId = (row["Sub_id"] || "").trim();
        if (subId === "" || subId === "-" || subId === "----") {
          subId = "----";
        } else {
          // Remove o sufixo "----" do final dos Sub_IDs
          subId = subId.replace(/----+$/, "").trim() || subId;
        }

        referrerAgg[referrer] = (referrerAgg[referrer] || 0) + 1;
        regionAgg[region] = (regionAgg[region] || 0) + 1;

        // Processa TODOS os sub_ids, incluindo "----"
        if (!campaignAgg[subId]) campaignAgg[subId] = {};
        campaignAgg[subId][referrer] = (campaignAgg[subId][referrer] || 0) + 1;
        allReferrers.add(referrer);
      });

      const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      const topReferrers = Object.entries(referrerAgg)
        .filter(([, clicks]) => clicks > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, clicks]) => ({ name, clicks }));
      const topRegions = Object.entries(regionAgg)
        .filter(([, clicks]) => clicks > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, clicks]) => ({ name, clicks }));
      const dayOfWeekData = Object.entries(dayOfWeekAgg)
        .map(([day, clicks]) => ({ name: dayNames[parseInt(day)], clicks }))
        .sort((a, b) => b.clicks - a.clicks);
      const hourData = Array.from({ length: 24 }, (_, i) => ({
        hour: `${i}h`,
        clicks: hourAgg[i] || 0
      }));

      // ===================================================================
      // NOVA LÓGICA: Ordenar plataformas por total de cliques (decrescente)
      // ===================================================================
      const referrerTotals: { [key: string]: number } = {};
      Object.values(campaignAgg).forEach((referrerCounts) => {
        Object.entries(referrerCounts).forEach(([ref, count]) => {
          referrerTotals[ref] = (referrerTotals[ref] || 0) + count;
        });
      });

      const sortedReferrers = Object.entries(referrerTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([ref]) => ref);

      // Criar headers com plataformas ordenadas + "Total" no final
      const newCampaignHeaders = ["Sub_id", ...sortedReferrers, "Total"];

      // Criar dados da campanha com total calculado
      const campaignData = Object.entries(campaignAgg).map(
        ([subId, referrerCounts]) => {
          const row: CampaignPerformanceData = { subId };
          let totalClicks = 0;

          sortedReferrers.forEach((ref) => {
            const clicks = referrerCounts[ref] || 0;
            row[ref] = clicks;
            totalClicks += clicks;
          });

          row["Total"] = totalClicks;
          return row;
        }
      );

      // ===================================================================
      // NOVA LÓGICA: Ordenar Sub_IDs por total de cliques (decrescente)
      // ===================================================================
      campaignData.sort((a, b) => {
        return (b.Total as number) - (a.Total as number);
      });

      setClicksByReferrer(topReferrers);
      setClicksByRegion(topRegions);
      setClicksByDayOfWeek(dayOfWeekData);
      setClicksByHour(hourData);
      setCampaignPerformanceData(campaignData);
      setCampaignHeaders(newCampaignHeaders);

      if (minDate !== null && maxDate !== null) {
        const options: Intl.DateTimeFormatOptions = {
          day: "2-digit", month: "2-digit", year: "numeric",
        };
        const formattedMinDate = ((minDate as unknown) as Date).toLocaleDateString("pt-BR", options);
        const formattedMaxDate = ((maxDate as unknown) as Date).toLocaleDateString("pt-BR", options);
        setReportDateRange(
          formattedMinDate === formattedMaxDate
            ? formattedMinDate
            : `Período de ${formattedMinDate} a ${formattedMaxDate}`
        );
      }
    } else {
      setTotalClicks(0);
      setClicksByReferrer([]);
      setClicksByRegion([]);
      setClicksByDayOfWeek([]);
      setClicksByHour([]);
      setCampaignPerformanceData([]);
      setCampaignHeaders([]);
      setReportDateRange(null);
    }
  }, [rawData]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setActiveTab(0);
      setFileName(file.name);
      setIsLoading(true);
      Papa.parse<ClickDataRow>(file, {
        worker: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setRawData(results.data);
          setIsLoading(false);
        },
        error: (error: Error) => {
          console.error("Erro ao ler o arquivo:", error.message);
          setIsLoading(false);
        },
      });
    }
  };

  const tabs = useMemo(
    () => [
      {
        label: "Origem dos Cliques",
        content: <OriginAnalysis byReferrer={clicksByReferrer} byRegion={clicksByRegion} />
      },
      {
        label: "Visão por Tempo",
        content: <TimeAnalysis byDayOfWeek={clicksByDayOfWeek} byHour={clicksByHour} />
      },
      {
        label: "Performance de Campanhas",
        content: <CampaignPerformanceTable data={campaignPerformanceData} headers={campaignHeaders} />
      },
    ],
    [clicksByReferrer, clicksByRegion, clicksByDayOfWeek, clicksByHour, campaignPerformanceData, campaignHeaders]
  );

  if (!session) {
    return <LoadingOverlay message="Carregando sessão..." />;
  }

  return (
    <>
      {isLoading && <LoadingOverlay message="Processando relatório..." />}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-text-primary font-heading whitespace-nowrap">
            Análise de Cliques
          </h1>
          {reportDateRange && (
            <div className="flex w-full sm:w-auto items-center justify-end gap-4 sm:gap-6">
              <div className="hidden md:flex items-center gap-2 text-text-secondary text-sm">
                <CalendarDays className="h-5 w-5" />
                <span className="whitespace-nowrap">{reportDateRange}</span>
              </div>
              <label
                htmlFor="clicks-upload-new"
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold border border-dark-border text-text-secondary rounded-md hover:border-shopee-orange hover:text-shopee-orange cursor-pointer transition-colors"
                title="Selecionar outro arquivo"
              >
                <Replace className="h-4 w-4" />
                <span className="whitespace-nowrap">Trocar Relatório</span>
                <input
                  id="clicks-upload-new"
                  name="clicks-upload-new"
                  type="file"
                  className="sr-only"
                  accept=".csv"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          )}
        </div>
        {rawData.length > 0 ? (
          <>
            <div className="bg-dark-card p-6 rounded-lg border border-dark-border flex flex-col items-center text-center mb-8">
              <div className="flex items-center gap-3">
                <Fingerprint className="h-5 w-5 text-shopee-orange" />
                <p className="text-sm text-text-secondary">Total de Cliques</p>
              </div>
              <p className="mt-2 text-4xl font-bold text-text-primary">
                {formatNumber(totalClicks)}
              </p>
            </div>
            <div className="mt-8">
              <Tabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>
          </>
        ) : (
          <div className="mt-8">
            <ReportUploadCard
              title="Importar Relatório de Cliques"
              label="Selecione o relatório de Cliques (.csv)"
              fileName={fileName}
              loading={isLoading}
              loadingText="Processando relatório..."
              accept=".csv"
              onFilesSelected={(files) => {
                handleFileChange({
                  target: { files },
                } as unknown as React.ChangeEvent<HTMLInputElement>);
              }}
            />
          </div>

        )}
      </div>
    </>
  );
}
