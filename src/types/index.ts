// src/types/index.ts
// Formato dos dados para o gráfico. 'label' pode ser hora, dia, ou mês.
export type TemporalChartData = {
  label: string;
  pedidos: number;
  concluidos: number;
  pendentes: number;
  cancelados: number; // <-- Adicionado
  nao_pagos: number;   // <-- Adicionado
  startDate?: Date;
  endDate?: Date;
}

// Formato dos dados para a tabela de Canais
export type ChannelData = {
  channel: string;
  orders: number;
  commission: number;
}

// Formato dos dados para a tabela de Sub_id
export type SubIdData = {
  subId: string;
  orders: number;
  commission: number;
}

// Formato dos dados para a tabela de Produtos
export type ProductData = {
  productName: string;
  qty: number;
  commission: number;
}

// Em /types/index.ts ou onde você define seus tipos

export interface CategoryNode {
  name: string;
  totalCommission: number;
  totalOrders: number;
  children?: CategoryNode[];
}


export interface TopCategoryData {
  category: string;
  commission: number;
}

// 👇 ADICIONE ESTE NOVO TIPO ABAIXO 👇
export interface AttributionData {
  direct: {
    orders: number;
    commission: number;
  };
  indirect: {
    orders: number;
    commission: number;
  };
}

// Formato para dados de gráficos de barras simples (ex: por referrer, por região)
export interface ClicksBarData {
  name: string;
  clicks: number;
}

// Formato para dados de gráfico de linha por hora
export interface ClicksByHourData {
  hour: string;
  clicks: number;
}

// Formato para a tabela-matriz de performance de campanhas
export interface CampaignPerformanceData {
  subId: string;
  [referrer: string]: number | string; // ex: { subId: 'promo', Instagram: 1500, Google: 800 }
}

export interface CheckoutPageProps  {
  searchParams: { [key: string]: string | string[] | undefined };
};

export interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export interface OrderSummaryProps {
  searchParams: { [key: string]: string | string[] | undefined };
};