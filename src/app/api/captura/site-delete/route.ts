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

const BUCKET = "capture-logos";

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybe = err as Record<string, unknown>;
    const msg = maybe["message"];
    if (typeof msg === "string") return msg;
  }
  return fallback;
}

async function removeAllFromPrefix(admin: ReturnType<typeof supabaseAdmin>, prefix: string) {
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data: items, error: listErr } = await admin.storage
      .from(BUCKET)
      .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });

    if (listErr) throw listErr;
    if (!items || items.length === 0) break;

    const paths = items
      .filter((x) => x?.name && x.name !== ".emptyFolderPlaceholder")
      .map((x) => `${prefix}/${x.name}`);

    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
      if (rmErr) throw rmErr;
    }

    if (items.length < limit) break;
    offset += limit;
  }
}

export async function POST(req: NextRequest) {
  const { supabase: supaUser } = supabaseUser(req);
  const { data: authData } = await supaUser.auth.getUser();

  if (!authData?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Como é 1 site por usuário, pegamos o site do usuário logado
  const { data: site, error: siteErr } = await supaUser
    .from("capture_sites")
    .select("id")
    .maybeSingle();

  if (siteErr) return NextResponse.json({ error: siteErr.message }, { status: 400 });
  if (!site) return NextResponse.json({ error: "Site não encontrado." }, { status: 404 });

  const admin = supabaseAdmin();

  // ✅ Remove tudo da pasta do site no Storage (independente do nome do arquivo)
  const folderPrefix = `${authData.user.id}/${site.id}`;
  try {
    await removeAllFromPrefix(admin, folderPrefix);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(e, "Erro ao remover arquivos do Storage.") },
      { status: 400 }
    );
  }

  // Apaga a row
  const { error: delErr } = await admin.from("capture_sites").delete().eq("id", site.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
