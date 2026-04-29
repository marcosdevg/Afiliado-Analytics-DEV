/**
 * Dispara uma notificação de TESTE no webhook n8n
 * (`INFOPROD_NOTIFICATIONS_WEBHOOK_URL`, ou legado `STRIPE_WEBHOOK_NOTIFICACOES`)
 * simulando um payload vindo do fluxo de venda Mercado Pago. Destino é o próprio
 * WhatsApp da loja em ambos os casos (pra que o usuário valide em si mesmo).
 *
 *   POST /api/infoprodutor/test-notification
 *   Body: { tipoAcao: "vendedor" | "comprador" }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { gateInfoprodutor } from "@/lib/require-entitlements";
import { sendInfoprodNotification } from "@/lib/infoprod/send-whatsapp-seller";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const gate = await gateInfoprodutor();
    if (!gate.allowed) return gate.response;
    const supabase = await createClient();

    const body = await req.json().catch(() => ({}));
    const tipoAcao = body?.tipoAcao as "vendedor" | "comprador" | undefined;
    if (tipoAcao !== "vendedor" && tipoAcao !== "comprador") {
      return NextResponse.json(
        { error: 'tipoAcao inválido — use "vendedor" ou "comprador".' },
        { status: 400 },
      );
    }

    if (
      !process.env.INFOPROD_NOTIFICATIONS_WEBHOOK_URL &&
      !process.env.STRIPE_WEBHOOK_NOTIFICACOES
    ) {
      return NextResponse.json(
        {
          error:
            "INFOPROD_NOTIFICATIONS_WEBHOOK_URL não configurado no .env.local. Defina a URL do webhook n8n e reinicie o dev server.",
        },
        { status: 500 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("shipping_sender_whatsapp")
      .eq("id", gate.userId)
      .single();
    const sellerWa = (profile as { shipping_sender_whatsapp?: string | null } | null)?.shipping_sender_whatsapp ?? "";
    if (!sellerWa.trim()) {
      return NextResponse.json(
        { error: "WhatsApp da loja vazio — preencha em Configurações → Endereço do remetente." },
        { status: 400 },
      );
    }

  const orderShort = `TEST${Date.now().toString().slice(-6)}`;
  const mensagem =
    tipoAcao === "vendedor"
      ? [
          "🧪 *[TESTE — notificação de VENDEDOR]*",
          "",
          "🎉 *Nova venda!*",
          "",
          "🛒 *Produto:* Produto Exemplo",
          "💰 *Valor:* R$ 1,00",
          "",
          "👤 *Comprador:* Cliente Teste",
          "📧 teste@exemplo.com",
          "📱 +5579999062401",
          "",
          "🚚 Entrega: Correios",
          "📍 Rua Exemplo, 123 · Cidade/UF · CEP 00000-000",
          "",
          `🧾 Pedido #${orderShort}`,
        ].join("\n")
      : [
          "🧪 *[TESTE — notificação de COMPRADOR]*",
          "",
          "Olá Cliente! 🎉",
          "",
          "Obrigado pela compra de *Produto Exemplo*! Seu pagamento foi aprovado com sucesso.",
          "",
          "—",
          "🚚 Correios",
          `🧾 Pedido #${orderShort}`,
        ].join("\n");

    const result = await sendInfoprodNotification({
      userId: gate.userId,
      tipoAcao,
      numeroDestino: sellerWa,
      mensagem,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 500 });
    }
    return NextResponse.json({ ok: true, tipoAcao });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado no servidor";
    console.error("[test-notification] erro:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
