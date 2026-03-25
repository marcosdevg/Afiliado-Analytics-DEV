import type { SupabaseClient } from "@supabase/supabase-js";

/** RLS restringe às linhas do usuário; sem site_id usa o site mais recente. */
export async function resolveCaptureSiteIdForUser(
  supabase: SupabaseClient,
  siteIdFromClient: string | undefined | null
): Promise<{ ok: true; siteId: string } | { ok: false; message: string; status: number }> {
  const trimmed = typeof siteIdFromClient === "string" ? siteIdFromClient.trim() : "";
  if (trimmed) {
    const { data, error } = await supabase.from("capture_sites").select("id").eq("id", trimmed).maybeSingle();
    if (error) return { ok: false, message: error.message, status: 400 };
    if (!data) return { ok: false, message: "Site não encontrado.", status: 404 };
    return { ok: true, siteId: data.id };
  }

  const { data, error } = await supabase
    .from("capture_sites")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, message: error.message, status: 400 };
  if (!data) return { ok: false, message: "Crie o site primeiro.", status: 400 };
  return { ok: true, siteId: data.id };
}
