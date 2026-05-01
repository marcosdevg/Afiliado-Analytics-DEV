import { NextResponse } from "next/server";
import { gateAmazon } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

/**
 * POST { itemId? | listaId? | itemIds?: string[], amazonSessionToken? }
 *
 * Atualiza metadados (nome, imagem, preços) dos itens salvos em
 * `minha_lista_ofertas_amazon` puxando da Amazon.
 *
 * Hoje retorna `{ updated: 0, failed: 0, errors: [] }` com `pendingIntegration: true`
 * porque depende do scraping da PDP Amazon (cookie da extensão) ou da PA-API.
 * Quando a integração for plugada, troque o corpo desta rota pelo equivalente do
 * `mercadolivre/minha-lista-ofertas/refresh/route.ts` e use
 * `parseAmazonExtensionSessionToCookieHeader` em `lib/amazon/amazon-session-cookie.ts`.
 */
export async function POST(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;
    void (await req.json().catch(() => ({})));

    return NextResponse.json({
      data: {
        updated: 0,
        failed: 0,
        errors: [],
        pendingIntegration: true,
        message:
          "Atualização automática de metadados Amazon ainda não está conectada — edite os itens manualmente por enquanto.",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
