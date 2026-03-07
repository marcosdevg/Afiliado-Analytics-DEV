// app/api/r/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectBot } from "../../../../lib/bot-detection"; // ✅ import do componente

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 🔒 Valida se a URL de destino é segura (só HTTP/HTTPS)
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ✅ HEAD request - Para previews do Instagram/Facebook (não grava clique)
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const domain = "a.afiliadoanalytics.com.br";

  const { data: link } = await supabase
    .from("links")
    .select("original_url, active, expires_at")
    .eq("domain", domain)
    .eq("slug", slug)
    .single();

  // Validações básicas
  if (!link || !link.active) {
    return new NextResponse(null, { status: 404 });
  }

  if (link.expires_at) {
    const expirationDate = new Date(link.expires_at);
    if (expirationDate < new Date()) {
      return new NextResponse(null, { status: 410 }); // Gone
    }
  }

  // Retorna OK sem gravar clique (apenas para preview)
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const domain = "a.afiliadoanalytics.com.br";

  // Buscar link
  const { data: link, error } = await supabase
    .from("links")
    .select("id, original_url, expires_at, active")
    .eq("domain", domain)
    .eq("slug", slug)
    .single();

  // Validações
  if (error || !link) {
    return NextResponse.redirect(
      new URL("https://www.afiliadoanalytics.com.br/404", request.url),
      307
    );
  }

  if (!link.active) {
    return NextResponse.redirect(
      new URL("https://www.afiliadoanalytics.com.br/link-inativo", request.url),
      307
    );
  }

  if (link.expires_at) {
    const expirationDate = new Date(link.expires_at);
    if (expirationDate < new Date()) {
      return NextResponse.redirect(
        new URL("https://www.afiliadoanalytics.com.br/link-expirado", request.url),
        307
      );
    }
  }

  // 🔒 Valida se a URL de destino é segura
  if (!isValidUrl(link.original_url)) {
    console.error("URL inválida detectada:", link.original_url);
    return NextResponse.redirect(
      new URL("https://www.afiliadoanalytics.com.br/404", request.url),
      307
    );
  }

  // Capturar dados
  const userAgent = request.headers.get("user-agent") || "";
  const referer = request.headers.get("referer") || "";

  // IP (pega o primeiro do x-forwarded-for)
  const xff = request.headers.get("x-forwarded-for") || "";
  const ipFromXff = xff.split(",")[0]?.trim();
  const ip = ipFromXff || request.headers.get("x-real-ip") || "";

  const isBot = detectBot(userAgent); // ✅ usando componente

  // Detectores específicos para in-app browsers
  const isInstagramAndroid = /Android.*Instagram/i.test(userAgent);
  const isFacebookAndroid = /Android.*(FB|FBAV|FBAN)/i.test(userAgent);
  const isWhatsAppGroup = /chat\.whatsapp\.com/i.test(link.original_url);

  // Registrar clique (sempre)
  try {
    const ipHash = ip ? await hashIP(ip) : null;

    const { error: clickErr } = await supabase.from("clicks").insert({
      link_id: link.id,
      user_agent: userAgent,
      referer,
      ip_hash: ipHash,
      is_bot: isBot,
    });

    // Se der erro, não interrompe o redirect (mas loga para debug)
    if (clickErr) {
      console.error("Falha ao inserir clique:", clickErr.message);
    }
  } catch (e) {
    console.error("Erro inesperado ao inserir clique:", e);
  }

  // IMPORTANTE:
  // Não incrementa mais click_count aqui.
  // O trigger no Postgres fará isso automaticamente quando is_bot = false.

  // Lógica específica para Instagram/Facebook Android + WhatsApp
  // Tenta forçar abertura no navegador externo (sair do in-app browser)
  if ((isInstagramAndroid || isFacebookAndroid) && isWhatsAppGroup) {
    const intentUrl = link.original_url.replace("https://", "");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=intent://${intentUrl}#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(
      link.original_url
    )};end;"><script>window.location.href="intent://${intentUrl}#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(
      link.original_url
    )};end;";</script></head><body></body></html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  }

  // 📊 Redirect padrão (com Cache-Control melhorado)
  return NextResponse.redirect(link.original_url, {
    status: 307,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
