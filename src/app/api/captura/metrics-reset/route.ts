import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { resolveCaptureSiteIdForUser } from "@/lib/captura-resolve-site";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Env ausente: ${name}`);
  return v;
}

function supabaseUser(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });

  return { supabase, res };
}

export async function POST(req: NextRequest) {
  try {
    const { supabase } = supabaseUser(req);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const siteIdFromClient = typeof body?.site_id === "string" ? body.site_id : undefined;
    const resolved = await resolveCaptureSiteIdForUser(supabase, siteIdFromClient);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }
    const site = { id: resolved.siteId };

    const { error: upErr } = await supabase
      .from("capture_sites")
      .update({
        view_count: 0,
        cta_click_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", site.id);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
