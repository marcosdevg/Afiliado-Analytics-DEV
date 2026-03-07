import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

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

    // 1 site por usuário
    const { data: site, error: siteErr } = await supabase.from("capture_sites").select("id").maybeSingle();
    if (siteErr) return NextResponse.json({ error: siteErr.message }, { status: 400 });
    if (!site) return NextResponse.json({ error: "Site não encontrado." }, { status: 404 });

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
