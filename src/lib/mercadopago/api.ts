/**
 * Wrappers HTTP da API REST do Mercado Pago. Todas as chamadas exigem o
 * `accessToken` do vendedor (do `profiles.mp_access_token`).
 *
 * Documentação:
 *   - Payments:    https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_id/get
 *   - Preferences: https://www.mercadopago.com.br/developers/pt/reference/preferences/_checkout_preferences/post
 */

import { MP_API_BASE } from "./config";

export type MpPaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export type MpPayment = {
  id: number;
  status: MpPaymentStatus;
  status_detail?: string;
  external_reference?: string | null;
  collector_id?: number;
  transaction_amount?: number;
  currency_id?: string;
  payer?: {
    id?: string | number;
    email?: string;
    first_name?: string | null;
    last_name?: string | null;
    phone?: { area_code?: string | null; number?: string | null };
    identification?: { type?: string; number?: string };
  };
  additional_info?: {
    items?: Array<{ id?: string; title?: string; quantity?: number; unit_price?: number }>;
    payer?: { first_name?: string; last_name?: string; phone?: { area_code?: string; number?: string } };
    shipments?: { receiver_address?: Record<string, unknown> };
  };
  metadata?: Record<string, unknown>;
  date_approved?: string | null;
  date_created?: string | null;
};

export type MpPreferenceItem = {
  id?: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: "BRL";
  description?: string;
  picture_url?: string;
  category_id?: string;
};

export type MpPreferenceInput = {
  items: MpPreferenceItem[];
  external_reference?: string;
  notification_url?: string;
  back_urls?: { success?: string; failure?: string; pending?: string };
  auto_return?: "approved" | "all";
  /** Se `false`, o pagamento NÃO é executado automaticamente — o pagador é
   *  enviado pro Bricks/Checkout Pro pra confirmar. Padrão recomendado: false. */
  binary_mode?: boolean;
  payer?: {
    name?: string;
    surname?: string;
    email?: string;
    phone?: { area_code?: string; number?: string };
    identification?: { type?: string; number?: string };
    address?: { zip_code?: string; street_name?: string; street_number?: string | number };
  };
  payment_methods?: {
    excluded_payment_methods?: Array<{ id: string }>;
    excluded_payment_types?: Array<{ id: string }>;
    installments?: number;
    default_installments?: number;
  };
  metadata?: Record<string, unknown>;
  statement_descriptor?: string;
  expires?: boolean;
  expiration_date_to?: string;
};

export type MpPreference = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
  client_id?: string;
  collector_id?: number;
  external_reference?: string | null;
  date_created?: string;
};

async function mpFetch<T>(
  path: string,
  init: RequestInit,
  accessToken: string,
): Promise<T> {
  const res = await fetch(`${MP_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  if (!res.ok) {
    const errMsg =
      (json as { message?: string; error?: string })?.message ||
      (json as { error?: string })?.error ||
      `HTTP ${res.status}`;
    throw new Error(`Mercado Pago: ${errMsg}`);
  }
  return json as T;
}

export function getMpPayment(paymentId: string | number, accessToken: string): Promise<MpPayment> {
  return mpFetch<MpPayment>(`/v1/payments/${paymentId}`, { method: "GET" }, accessToken);
}

/**
 * Lista pagamentos do collector autenticado (vendedor). Suporta filtros por
 * intervalo de data e por status. Retorna paginação básica.
 *
 * Doc: https://www.mercadopago.com.br/developers/pt/reference/payments_resources_v1/_payments_search/get
 */
export type MpPaymentsSearchInput = {
  /** ISO datetime — início do intervalo (date_created). */
  begin_date?: string;
  /** ISO datetime — fim do intervalo (date_created). Default = NOW. */
  end_date?: string;
  /** Filtro por status MP (approved, pending, rejected, cancelled, etc.). */
  status?: string;
  /** Filtra por `external_reference` exato (ex.: "infoprod:{uuid}"). */
  external_reference?: string;
  /** Tamanho da página (max 100 no MP). */
  limit?: number;
  /** Offset (paginação). */
  offset?: number;
  /** Ordenação. Default: date_created desc. */
  sort?: "date_created" | "date_approved" | "money_release_date";
  criteria?: "asc" | "desc";
};

export type MpPaymentsSearchResponse = {
  paging: { total: number; limit: number; offset: number };
  results: MpPayment[];
};

export function searchMpPayments(
  input: MpPaymentsSearchInput,
  accessToken: string,
): Promise<MpPaymentsSearchResponse> {
  const qs = new URLSearchParams();
  qs.set("range", "date_created");
  if (input.begin_date) qs.set("begin_date", input.begin_date);
  qs.set("end_date", input.end_date ?? new Date().toISOString());
  if (input.status) qs.set("status", input.status);
  if (input.external_reference) qs.set("external_reference", input.external_reference);
  qs.set("limit", String(Math.min(Math.max(1, input.limit ?? 50), 100)));
  qs.set("offset", String(Math.max(0, input.offset ?? 0)));
  qs.set("sort", input.sort ?? "date_created");
  qs.set("criteria", input.criteria ?? "desc");
  return mpFetch<MpPaymentsSearchResponse>(
    `/v1/payments/search?${qs.toString()}`,
    { method: "GET" },
    accessToken,
  );
}

export function createMpPreference(input: MpPreferenceInput, accessToken: string): Promise<MpPreference> {
  return mpFetch<MpPreference>(
    `/checkout/preferences`,
    { method: "POST", body: JSON.stringify(input) },
    accessToken,
  );
}

/**
 * Cria um pagamento. Usado pelo onSubmit do Payment Brick depois que o
 * comprador escolhe método e preenche os dados (cartão/Pix/boleto). O Brick
 * tokeniza cartão no client; aqui só recebemos o token e fazemos o cobrança
 * server-side.
 *
 * Doc: https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
 */
export type MpCreatePaymentInput = {
  transaction_amount: number;
  description?: string;
  payment_method_id: string;
  token?: string;
  installments?: number;
  issuer_id?: string;
  payer: {
    email: string;
    identification?: { type?: string; number?: string };
    first_name?: string;
    last_name?: string;
    phone?: { area_code?: string; number?: string };
  };
  external_reference?: string;
  notification_url?: string;
  metadata?: Record<string, unknown>;
  additional_info?: {
    items?: Array<{ id?: string; title?: string; quantity?: number; unit_price?: number }>;
    payer?: Record<string, unknown>;
    shipments?: { receiver_address?: Record<string, unknown> };
  };
  statement_descriptor?: string;
  binary_mode?: boolean;
};

export type MpPaymentResponse = MpPayment & {
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
  transaction_details?: {
    external_resource_url?: string; // boleto/PDF
  };
};

export async function createMpPayment(
  input: MpCreatePaymentInput,
  accessToken: string,
  /** Idempotency key — recomendado pela MP pra evitar duplicidade em retries. */
  idempotencyKey: string,
): Promise<MpPaymentResponse> {
  return mpFetch<MpPaymentResponse>(
    `/v1/payments`,
    {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "X-Idempotency-Key": idempotencyKey },
    },
    accessToken,
  );
}
