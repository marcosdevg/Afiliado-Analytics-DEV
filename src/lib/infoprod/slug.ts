import type { createClient } from "@/lib/supabase-server";

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function slugify(input: string): string {
  return (input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomSuffix(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  }
  return out;
}

/**
 * Gera um slug globalmente único pra checkout público.
 * Formato: `<nome-slugificado>-<6chars>`, ex.: `glyco-heal-a3k9x2`.
 * Tenta até 5 vezes em caso de colisão (extremamente improvável).
 */
export async function generateUniquePublicSlug(
  supabase: SupabaseLike,
  name: string,
): Promise<string> {
  const base = slugify(name) || "produto";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${randomSuffix(6)}`;
    const { data } = await supabase
      .from("produtos_infoprodutor")
      .select("id")
      .eq("public_slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  // Fallback final: sufixo mais longo pra garantir unicidade
  return `${base}-${randomSuffix(12)}`;
}
