/**
 * Detalhes do pedido pra renderizar a página /checkout/sucesso (Mercado Pago).
 *
 *   GET ?slug=...&payment_id={id}
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getMpPayment } from "@/lib/mercadopago/api";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
};

type ProfileRow = {
  mp_access_token: string | null;
  shipping_sender_whatsapp: string | null;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get("slug") ?? "").trim();
    const mpPaymentId = (url.searchParams.get("payment_id") ?? "").trim();

    if (!slug || !mpPaymentId) {
      return NextResponse.json({ error: "slug e payment_id são obrigatórios" }, { status: 400 });
    }
    if (!/^\d+$/.test(mpPaymentId)) {
      return NextResponse.json({ error: "payment_id inválido" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: produto, error } = await supabase
      .from("produtos_infoprodutor")
      .select("id, user_id, name")
      .eq("public_slug", slug)
      .eq("provider", "mercadopago")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const row = produto as ProductRow;

    const { data: profile } = await supabase
      .from("profiles")
      .select("mp_access_token, shipping_sender_whatsapp")
      .eq("id", row.user_id)
      .maybeSingle();
    const prof = (profile as ProfileRow | null) ?? null;
    const sellerWhatsapp = prof?.shipping_sender_whatsapp?.trim() || null;

    const accessToken = prof?.mp_access_token?.trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Vendedor sem conta Mercado Pago" }, { status: 503 });
    }

    const payment = await getMpPayment(mpPaymentId, accessToken);

    // Valida que esse pagamento é desse produto (anti-spoof).
    const ref = String(payment.external_reference ?? "");
    if (ref !== `infoprod:${row.id}`) {
      return NextResponse.json({ error: "Pagamento não corresponde ao produto" }, { status: 403 });
    }

    const status = payment.status;
    const paid = status === "approved";
    const amount = typeof payment.transaction_amount === "number" ? payment.transaction_amount : 0;
    const meta = (payment.metadata ?? {}) as Record<string, unknown>;
    const deliveryMode = typeof meta.delivery_mode === "string" ? meta.delivery_mode : "";
    const shippingName = typeof meta.shipping_name === "string" ? meta.shipping_name : "";

    const buyerName = [
      payment.payer?.first_name ?? payment.additional_info?.payer?.first_name ?? "",
      payment.payer?.last_name ?? payment.additional_info?.payer?.last_name ?? "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || null;
    const buyerEmail = payment.payer?.email ?? null;
    const buyerPhone = (() => {
      const phone = payment.payer?.phone ?? payment.additional_info?.payer?.phone;
      if (!phone) return null;
      return `${phone.area_code ?? ""}${phone.number ?? ""}`.trim() || null;
    })();

    const recv = payment.additional_info?.shipments?.receiver_address as
      | { street_name?: string; street_number?: string; city_name?: string; state_name?: string; zip_code?: string }
      | undefined;
    const address = recv
      ? {
          line1: [recv.street_name, recv.street_number].filter(Boolean).join(", ") || null,
          line2: null as string | null,
          city: recv.city_name ?? null,
          state: recv.state_name ?? null,
          postalCode: recv.zip_code ?? null,
        }
      : null;

    return NextResponse.json({
      paid,
      status,
      amount,
      product: { name: row.name },
      delivery: { mode: deliveryMode || null, name: shippingName || null },
      buyer: { name: buyerName, email: buyerEmail, phone: buyerPhone },
      shippingAddress: address,
      sellerWhatsapp,
      orderShort: String(payment.id).slice(-10).toUpperCase(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
