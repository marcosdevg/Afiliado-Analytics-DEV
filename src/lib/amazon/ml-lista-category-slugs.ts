/**
 * Categorias da Amazon Brasil pra filtro de busca por categoria.
 *
 * Mantemos os nomes `ML_LISTA_CATEGORY_OPTIONS` / `MlListaCategoryOption` /
 * `isMlListaCategorySlug` apenas pra preservar o clone visual 1:1 da página
 * `minha-lista-ofertas-amazon` em relação à versão ML — refatorar pra
 * `AmazonListaCategoryOption` em todos os call sites seria churn enorme.
 */
export type MlListaCategoryOption = { slug: string; label: string };

export const ML_LISTA_CATEGORY_OPTIONS: MlListaCategoryOption[] = [
  { slug: "eletronicos", label: "Eletrônicos" },
  { slug: "celulares", label: "Celulares e telefones" },
  { slug: "informatica", label: "Informática" },
  { slug: "games", label: "Games" },
  { slug: "eletrodomesticos", label: "Eletrodomésticos" },
  { slug: "casa-cozinha", label: "Casa e cozinha" },
  { slug: "ferramentas", label: "Ferramentas" },
  { slug: "esportes", label: "Esportes e aventura" },
  { slug: "beleza", label: "Beleza" },
  { slug: "moda", label: "Moda" },
  { slug: "brinquedos", label: "Brinquedos" },
  { slug: "bebes", label: "Bebês" },
  { slug: "pet-shop", label: "Pet shop" },
  { slug: "saude", label: "Saúde e cuidados pessoais" },
  { slug: "livros", label: "Livros" },
  { slug: "automotivo", label: "Automotivo" },
];

const ALLOWED = new Set(ML_LISTA_CATEGORY_OPTIONS.map((o) => o.slug));
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isMlListaCategorySlug(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  if (!s || s.length > 96 || !SLUG_RE.test(s)) return false;
  return ALLOWED.has(s);
}
