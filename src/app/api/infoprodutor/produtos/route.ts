/**
 * CRUD dos produtos do Infoprodutor (catálogo "Meus Produtos").
 * Cada produto tem: nome, descrição, link de venda, imagem (URL pública do bucket
 * `infoprodutor-images`) e preço opcional. Tudo escopado por user_id via RLS.
 *
 * Providers suportados:
 *   - 'manual' (padrão): usuário informa o link de venda livremente.
 *   - 'mercadopago': pedidos pagos via Mercado Pago — Preference é criada por
 *     checkout (em /api/checkout/[subId]/mp-preference), não na criação do
 *     produto. Exige `mp_access_token` em profiles.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { gateInfoprodutor } from "@/lib/require-entitlements";
import {
  formatSenderAddressShort,
  type SenderSnapshot,
} from "@/lib/infoprod/infoprod-shared";
import { getAppPublicUrl } from "@/lib/app-url";
import { generateUniquePublicSlug } from "@/lib/infoprod/slug";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  link: string;
  price: number | string | null;
  price_old: number | string | null;
  provider: string | null;
  subid: string | null;
  allow_shipping: boolean | null;
  allow_pickup: boolean | null;
  allow_digital: boolean | null;
  allow_local_delivery: boolean | null;
  shipping_cost: number | string | null;
  local_delivery_cost: number | string | null;
  thank_you_message: string | null;
  peso_g: number | string | null;
  altura_cm: number | string | null;
  largura_cm: number | string | null;
  comprimento_cm: number | string | null;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
};

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  return Number.isFinite(Number(v)) ? Number(v) : null;
}

function mapProduto(r: Record<string, unknown>) {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    description: (r.description as string | null) ?? "",
    imageUrl: (r.image_url as string | null) ?? "",
    link: String(r.link ?? ""),
    price: numOrNull(r.price),
    priceOld: numOrNull(r.price_old),
    provider: (r.provider as string | null) ?? "manual",
    subid: (r.subid as string | null) ?? null,
    allowShipping: r.allow_shipping === null || r.allow_shipping === undefined ? true : Boolean(r.allow_shipping),
    allowPickup: Boolean(r.allow_pickup ?? false),
    allowDigital: Boolean(r.allow_digital ?? false),
    allowLocalDelivery: Boolean(r.allow_local_delivery ?? false),
    shippingCost: numOrNull(r.shipping_cost),
    localDeliveryCost: numOrNull(r.local_delivery_cost),
    thankYouMessage: (r.thank_you_message as string | null) ?? "",
    pesoG: numOrNull(r.peso_g),
    alturaCm: numOrNull(r.altura_cm),
    larguraCm: numOrNull(r.largura_cm),
    comprimentoCm: numOrNull(r.comprimento_cm),
    publicSlug: (r.public_slug as string | null) ?? null,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

const SELECT =
  "id, user_id, name, description, image_url, link, price, price_old, provider, subid, allow_shipping, allow_pickup, allow_digital, allow_local_delivery, shipping_cost, local_delivery_cost, thank_you_message, peso_g, altura_cm, largura_cm, comprimento_cm, public_slug, created_at, updated_at";

const SUBID_REGEX = /^[a-zA-Z0-9_\-.]+$/;

function normalizeSubid(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 64) : "";
}

export async function GET() {
  try {
    const gate = await gateInfoprodutor();
    if (!gate.allowed) return gate.response;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("produtos_infoprodutor")
      .select(SELECT)
      .eq("user_id", gate.userId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const produtos = (data ?? []).map((r) => mapProduto(r as Record<string, unknown>));

    return NextResponse.json({ data: produtos });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await gateInfoprodutor();
    if (!gate.allowed) return gate.response;
    const supabase = await createClient();

    const body = await req.json().catch(() => ({}));
    const providerRaw = String(body?.provider ?? "manual").trim().toLowerCase();
    if (providerRaw !== "manual" && providerRaw !== "mercadopago") {
      return NextResponse.json({ error: `Provider inválido: ${providerRaw}` }, { status: 400 });
    }
    const provider = providerRaw as "manual" | "mercadopago";

    const name = String(body?.name ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const imageUrl = String(body?.imageUrl ?? body?.image_url ?? "").trim();
    const priceRaw = body?.price;
    const price =
      priceRaw == null || priceRaw === ""
        ? null
        : Number.isFinite(Number(priceRaw))
          ? Number(priceRaw)
          : null;
    const priceOldRaw = body?.priceOld ?? body?.price_old;
    const price_old =
      priceOldRaw == null || priceOldRaw === ""
        ? null
        : Number.isFinite(Number(priceOldRaw))
          ? Number(priceOldRaw)
          : null;

    if (!name) return NextResponse.json({ error: "Título do produto é obrigatório." }, { status: 400 });

    if (provider === "mercadopago") {
      if (price == null || price <= 0) {
        return NextResponse.json({ error: "Preço é obrigatório (em BRL) para produtos Mercado Pago." }, { status: 400 });
      }

      // SubId é opcional, usado só pra rastreamento (cruzamento ATI × MP).
      const subid = normalizeSubid(body?.subid);
      if (subid && (subid.length < 2 || !SUBID_REGEX.test(subid))) {
        return NextResponse.json(
          { error: "SubId: use 2+ caracteres com apenas letras, números, hífen, ponto e underscore." },
          { status: 400 },
        );
      }

      // Confirma que o vendedor conectou MP em /configuracoes.
      const { data: profileMp } = await supabase
        .from("profiles")
        .select(
          "mp_access_token, shipping_sender_whatsapp, shipping_sender_street, shipping_sender_number, shipping_sender_complement, shipping_sender_neighborhood, shipping_sender_city, shipping_sender_uf",
        )
        .eq("id", gate.userId)
        .single();
      const profileMpRow = profileMp as {
        mp_access_token?: string | null;
        shipping_sender_whatsapp?: string | null;
        shipping_sender_street?: string | null;
        shipping_sender_number?: string | null;
        shipping_sender_complement?: string | null;
        shipping_sender_neighborhood?: string | null;
        shipping_sender_city?: string | null;
        shipping_sender_uf?: string | null;
      } | null;
      if (!profileMpRow?.mp_access_token?.trim()) {
        return NextResponse.json(
          { error: "Conecte sua conta Mercado Pago em Configurações antes de criar produtos." },
          { status: 400 },
        );
      }
      const senderSnapshot: SenderSnapshot = {
        street: profileMpRow?.shipping_sender_street ?? null,
        number: profileMpRow?.shipping_sender_number ?? null,
        complement: profileMpRow?.shipping_sender_complement ?? null,
        neighborhood: profileMpRow?.shipping_sender_neighborhood ?? null,
        city: profileMpRow?.shipping_sender_city ?? null,
        uf: profileMpRow?.shipping_sender_uf ?? null,
      };
      const senderAddress = formatSenderAddressShort(senderSnapshot);

      // Modo de entrega — mesmas regras do fluxo antigo.
      const allowDigital = body?.allowDigital === true;
      const allowLocalDelivery = allowDigital ? false : body?.allowLocalDelivery === true;
      const allowShipping = allowDigital || allowLocalDelivery ? false : body?.allowShipping !== false;
      const allowPickup = allowDigital ? false : body?.allowPickup === true;
      if (!allowShipping && !allowPickup && !allowDigital && !allowLocalDelivery) {
        return NextResponse.json({ error: "Marque ao menos uma opção de entrega." }, { status: 400 });
      }
      const shippingCostRaw = body?.shippingCost;
      const shippingCost =
        shippingCostRaw == null || shippingCostRaw === ""
          ? null
          : Number.isFinite(Number(shippingCostRaw))
            ? Math.max(0, Number(shippingCostRaw))
            : null;
      if (allowShipping && (shippingCost == null || shippingCost < 0)) {
        return NextResponse.json({ error: "Informe o valor do frete (use 0 para frete grátis)." }, { status: 400 });
      }
      const localDeliveryCostRaw = body?.localDeliveryCost;
      const localDeliveryCost =
        localDeliveryCostRaw == null || localDeliveryCostRaw === ""
          ? null
          : Number.isFinite(Number(localDeliveryCostRaw))
            ? Math.max(0, Number(localDeliveryCostRaw))
            : null;
      if (allowLocalDelivery && (localDeliveryCost == null || localDeliveryCost < 0)) {
        return NextResponse.json({ error: "Informe o valor da entrega em casa (use 0 para grátis)." }, { status: 400 });
      }
      if (allowPickup && !senderAddress) {
        return NextResponse.json(
          {
            error:
              "Preencha o endereço do remetente em Configurações antes de habilitar 'Retirada na loja' (é mostrado ao comprador no checkout).",
          },
          { status: 400 },
        );
      }

      const pesoGVal = Number.isFinite(Number(body?.pesoG)) && Number(body?.pesoG) > 0 ? Math.round(Number(body.pesoG)) : null;
      const alturaCmVal = Number.isFinite(Number(body?.alturaCm)) && Number(body?.alturaCm) > 0 ? Number(body.alturaCm) : null;
      const larguraCmVal = Number.isFinite(Number(body?.larguraCm)) && Number(body?.larguraCm) > 0 ? Number(body.larguraCm) : null;
      const comprimentoCmVal = Number.isFinite(Number(body?.comprimentoCm)) && Number(body?.comprimentoCm) > 0 ? Number(body.comprimentoCm) : null;

      // Slug + link interno (todo produto MP usa nosso checkout — Bricks vai aqui).
      const publicSlug = await generateUniquePublicSlug(supabase, name);
      const appUrl = getAppPublicUrl();
      if (!appUrl) {
        return NextResponse.json(
          { error: "NEXT_PUBLIC_APP_URL não configurada — necessária para gerar o link de checkout." },
          { status: 500 },
        );
      }
      const publicLink = `${appUrl}/checkout/${encodeURIComponent(publicSlug)}`;

      const { data, error } = await supabase
        .from("produtos_infoprodutor")
        .insert({
          user_id: gate.userId,
          name,
          description: description || null,
          image_url: imageUrl || null,
          link: publicLink,
          public_slug: publicSlug,
          price,
          price_old,
          provider: "mercadopago",
          subid: subid || null,
          allow_shipping: allowShipping,
          allow_pickup: allowPickup,
          allow_digital: allowDigital,
          allow_local_delivery: allowLocalDelivery,
          shipping_cost: allowShipping ? (shippingCost ?? 0) : null,
          local_delivery_cost: allowLocalDelivery ? (localDeliveryCost ?? 0) : null,
          thank_you_message:
            typeof body?.thankYouMessage === "string" && body.thankYouMessage.trim()
              ? body.thankYouMessage.trim()
              : null,
          peso_g: allowShipping ? pesoGVal : null,
          altura_cm: allowShipping ? alturaCmVal : null,
          largura_cm: allowShipping ? larguraCmVal : null,
          comprimento_cm: allowShipping ? comprimentoCmVal : null,
        })
        .select(SELECT)
        .single();

      if (error) {
        return NextResponse.json({ error: `Falha ao salvar produto: ${error.message}` }, { status: 500 });
      }

      return NextResponse.json({ data: mapProduto(data as unknown as Row) });
    }

    // provider === "manual"
    const link = String(body?.link ?? "").trim();
    if (!link) return NextResponse.json({ error: "Link do produto é obrigatório." }, { status: 400 });

    const manualSlug = await generateUniquePublicSlug(supabase, name);

    const { data, error } = await supabase
      .from("produtos_infoprodutor")
      .insert({
        user_id: gate.userId,
        name,
        description: description || null,
        image_url: imageUrl || null,
        link,
        price,
        price_old,
        provider: "manual",
        public_slug: manualSlug,
      })
      .select(SELECT)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: mapProduto(data as unknown as Row) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const gate = await gateInfoprodutor();
    if (!gate.allowed) return gate.response;
    const supabase = await createClient();

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const { data: current, error: loadError } = await supabase
      .from("produtos_infoprodutor")
      .select(SELECT)
      .eq("id", id)
      .eq("user_id", gate.userId)
      .maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!current) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const currentRow = current as unknown as Row;
    const isPaidProvider = currentRow.provider === "mercadopago";

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let newName: string | null = null;
    let newDescription: string | null | undefined = undefined;
    let newImageUrl: string | null | undefined = undefined;

    if (typeof body?.name === "string") {
      const n = body.name.trim();
      if (!n) return NextResponse.json({ error: "Título não pode ficar em branco" }, { status: 400 });
      patch.name = n;
      newName = n;
    }
    if (typeof body?.description === "string") {
      const d = body.description.trim() || null;
      patch.description = d;
      newDescription = d;
    }
    if (typeof body?.imageUrl === "string" || typeof body?.image_url === "string") {
      const v = String(body?.imageUrl ?? body?.image_url ?? "").trim();
      patch.image_url = v || null;
      newImageUrl = v || null;
    }

    if (isPaidProvider) {
      // Preço e link não podem ser alterados em produtos Mercado Pago via PATCH
      // (link é gerado a partir do public_slug; preço travado pra preservar
      // histórico de pedidos/checkouts em curso). Se precisar mudar, recrie.
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "price")) {
        return NextResponse.json(
          { error: "Não é possível alterar o preço deste produto. Remova e recrie se necessário." },
          { status: 400 },
        );
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "link")) {
        return NextResponse.json(
          { error: "O link de venda é gerado automaticamente e não pode ser editado." },
          { status: 400 },
        );
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "priceOld") || Object.prototype.hasOwnProperty.call(body ?? {}, "price_old")) {
        const p = body.priceOld ?? body.price_old;
        patch.price_old = p == null || p === "" ? null : Number.isFinite(Number(p)) ? Number(p) : null;
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "subid")) {
        const newSubid = normalizeSubid(body?.subid);
        if (newSubid && (newSubid.length < 2 || !SUBID_REGEX.test(newSubid))) {
          return NextResponse.json(
            { error: "SubId: use 2+ caracteres com apenas letras, números, hífen, ponto e underscore." },
            { status: 400 },
          );
        }
        if (newSubid !== currentRow.subid) {
          patch.subid = newSubid || null;
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(body ?? {}, "thankYouMessage") ||
        Object.prototype.hasOwnProperty.call(body ?? {}, "thank_you_message")
      ) {
        const raw = body?.thankYouMessage ?? body?.thank_you_message;
        const trimmed = typeof raw === "string" ? raw.trim() : "";
        patch.thank_you_message = trimmed || null;
      }

      // Mercado Pago não exige sincronizar produto/preço externo: o catálogo
      // vive 100% no nosso banco e a Preference é criada por checkout.
    } else {
      if (typeof body?.link === "string") {
        const l = body.link.trim();
        if (!l) return NextResponse.json({ error: "Link não pode ficar em branco" }, { status: 400 });
        patch.link = l;
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "price")) {
        const p = body.price;
        patch.price = p == null || p === "" ? null : Number.isFinite(Number(p)) ? Number(p) : null;
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "priceOld") || Object.prototype.hasOwnProperty.call(body ?? {}, "price_old")) {
        const p = body.priceOld ?? body.price_old;
        patch.price_old = p == null || p === "" ? null : Number.isFinite(Number(p)) ? Number(p) : null;
      }
    }

    const { data, error } = await supabase
      .from("produtos_infoprodutor")
      .update(patch)
      .eq("id", id)
      .eq("user_id", gate.userId)
      .select(SELECT)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    // Propaga o update para os snapshots em `minha_lista_ofertas_info` — assim os
    // itens copiados nas listas refletem as últimas mudanças do produto.
    const listaPatch: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(patch, "name")) listaPatch.product_name = patch.name;
    if (Object.prototype.hasOwnProperty.call(patch, "description")) listaPatch.description = patch.description;
    if (Object.prototype.hasOwnProperty.call(patch, "image_url")) listaPatch.image_url = patch.image_url;
    if (Object.prototype.hasOwnProperty.call(patch, "link")) listaPatch.link = patch.link;
    if (Object.prototype.hasOwnProperty.call(patch, "price")) listaPatch.price = patch.price;
    if (Object.prototype.hasOwnProperty.call(patch, "price_old")) listaPatch.price_old = patch.price_old;

    if (Object.keys(listaPatch).length > 0) {
      const { error: syncError } = await supabase
        .from("minha_lista_ofertas_info")
        .update(listaPatch)
        .eq("user_id", gate.userId)
        .eq("produto_id", id);
      if (syncError) {
        // Não trava a resposta — o produto já foi atualizado. Só loga.
        console.error("[produtos PATCH] falha sync listas:", syncError.message);
      }
    }

    return NextResponse.json({ data: mapProduto(data as unknown as Row) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await gateInfoprodutor();
    if (!gate.allowed) return gate.response;
    const supabase = await createClient();

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    // Apaga só do nosso banco — pagamentos no Mercado Pago vivem na conta do
    // vendedor independentes do produto local; histórico de vendas continua
    // acessível pelo painel do MP.
    const { error } = await supabase
      .from("produtos_infoprodutor")
      .delete()
      .eq("id", id)
      .eq("user_id", gate.userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
