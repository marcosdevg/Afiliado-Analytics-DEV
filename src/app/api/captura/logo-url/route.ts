import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Env ausente: ${name}`);
  return v;
}

function supabaseAdmin() {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}

function supabaseUser(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
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
    }
  );
  return { supabase, res };
}

export async function GET(req: NextRequest) {
  const { supabase: supaUser } = supabaseUser(req);
  const { data: authData } = await supaUser.auth.getUser();
  if (!authData?.user) return NextResponse.json({ url: null }, { status: 200 });

  const { data: site, error: siteErr } = await supaUser
    .from("capture_sites")
    .select("logopath")
    .maybeSingle();

  if (siteErr) return NextResponse.json({ url: null, error: siteErr.message }, { status: 400 });
  if (!site?.logopath) return NextResponse.json({ url: null }, { status: 200 });

  const admin = supabaseAdmin();
  const { data, error } = await admin.storage
    .from("capture-logos")
    .createSignedUrl(site.logopath, 60 * 10); // 10 min

  if (error) return NextResponse.json({ url: null, error: error.message }, { status: 400 });

  return NextResponse.json({ url: data.signedUrl }, { status: 200 });
}
