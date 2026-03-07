/**
 * Vincula uma Página (que você já administra) ao negócio da conta de anúncios.
 * Assim a Página passa a poder ser usada em anúncios dessa conta (ex.: HGARDEN1).
 * POST /api/meta/business/claim-page
 * Body: { ad_account_id, page_id }
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("meta_access_token")
      .eq("id", user.id)
      .single();
    const token = profile?.meta_access_token?.trim();
    if (!token) {
      return NextResponse.json({ error: "Token do Meta não configurado." }, { status: 400 });
    }

    const body = await req.json();
    const ad_account_id = body?.ad_account_id?.trim();
    const page_id = body?.page_id?.trim();
    if (!ad_account_id || !page_id) {
      return NextResponse.json(
        { error: "ad_account_id e page_id são obrigatórios." },
        { status: 400 }
      );
    }

    const adAccountUrl = `${GRAPH_BASE}/${ad_account_id}?fields=business&access_token=${encodeURIComponent(token)}`;
    const adRes = await fetch(adAccountUrl);
    const adJson = (await adRes.json()) as {
      business?: { id: string };
      error?: { message: string };
    };
    if (adJson.error) throw new Error(adJson.error.message || "Erro ao obter negócio");
    const business_id = adJson.business?.id;
    if (!business_id) {
      return NextResponse.json(
        { error: "Esta conta de anúncios não está vinculada a um negócio (Business Manager). Só é possível vincular Páginas a contas de portfólio empresarial." },
        { status: 400 }
      );
    }

    const claimUrl = `${GRAPH_BASE}/${business_id}/owned_pages`;
    const claimParams = new URLSearchParams({
      access_token: token,
      page_id,
    });
    const claimRes = await fetch(claimUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: claimParams.toString(),
    });
    const claimJson = (await claimRes.json()) as {
      success?: boolean;
      error?: { message: string; code?: number };
    };
    if (claimJson.error) {
      throw new Error(claimJson.error.message || "Erro ao vincular Página");
    }
    if (!claimJson.success) {
      return NextResponse.json(
        { error: "Não foi possível vincular a Página. Confira se você é administrador da Página há mais de 7 dias e se tem permissão no negócio." },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, message: "Página vinculada ao negócio. Atualize a lista de Páginas." });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao vincular Página";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
