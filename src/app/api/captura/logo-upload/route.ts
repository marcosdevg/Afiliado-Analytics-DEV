import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { resolveCaptureSiteIdForUser } from "@/lib/captura-resolve-site";

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
    const { data: items, error: listErr } = await admin.storage.from(BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (listErr) {
      // Se falhar em listar, não arrisca apagar errado.
      throw listErr;
    }

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
  const { data: authData, error: authErr } = await supaUser.auth.getUser();

  if (authErr || !authData?.user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const siteIdField = form.get("site_id");
  const siteIdFromForm = typeof siteIdField === "string" ? siteIdField : undefined;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo em 'file'." }, { status: 400 });
  }

  // PNG or JPEG
  const isPng = file.type === "image/png";
  const isJpeg = file.type === "image/jpeg" || file.type === "image/jpg";

  if (!isPng && !isJpeg) {
    return NextResponse.json({ error: "Formato inválido. Envie apenas PNG ou JPEG." }, { status: 400 });
  }

  const maxBytes = 2 * 1024 * 1024; // Aumentar levemente para 2MB no server para segurança, embora o client vá comprimir para 1MB
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "Arquivo muito grande (máx 2MB)." }, { status: 400 });
  }

  const resolved = await resolveCaptureSiteIdForUser(supaUser, siteIdFromForm);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: resolved.status });
  }
  const site = { id: resolved.siteId };

  const admin = supabaseAdmin();

  // Pasta do site no bucket (vamos sempre limpar ela para não sobrar lixo antigo)
  const folderPrefix = `${authData.user.id}/${site.id}`;

  // ✅ Remove qualquer arquivo antigo dentro da pasta (resolve o acúmulo de vez)
  try {
    await removeAllFromPrefix(admin, folderPrefix);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(e, "Erro ao limpar logos antigas.") },
      { status: 400 }
    );
  }

  // Nome novo a cada upload (evita cache velho)
  const ts = Date.now();
  const ext = isPng ? "png" : "jpg";
  const path = `${folderPrefix}/logo-${ts}.${ext}`;

  // Upload sem sobrescrever
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "3600",
  });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  const nowIso = new Date().toISOString();

  const { error: dbErr } = await admin
    .from("capture_sites")
    .update({ logopath: path, updated_at: nowIso })
    .eq("id", site.id);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, path, updated_at: nowIso });
}
