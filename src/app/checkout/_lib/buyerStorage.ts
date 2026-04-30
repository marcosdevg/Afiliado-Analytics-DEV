/** Dados do comprador persistidos localmente pra agilizar checkouts subsequentes.
 * Escopo: mesmo navegador/device.
 */

export type BuyerAddress = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

export type BuyerData = {
  email?: string
  /** WhatsApp no formato apenas dígitos, sem prefixo 55 — assim o componente
   * WhatsAppInputBR formata direto pra (XX) XXXXX-XXXX. */
  whatsapp?: string
  name?: string
  /** Telefone coletado no checkout (formato variado). */
  phone?: string
  address?: BuyerAddress
}

const STORAGE_KEY = 'aa-checkout-buyer'

export function loadBuyerData(): BuyerData {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as BuyerData) : {}
  } catch {
    return {}
  }
}

/** Merge parcial — só atualiza os campos fornecidos, preserva o resto. */
export function saveBuyerData(patch: BuyerData): void {
  if (typeof window === 'undefined') return
  try {
    const existing = loadBuyerData()
    const next: BuyerData = { ...existing, ...patch }
    // Merge recursivo do address pra não apagar campos não fornecidos
    if (patch.address) {
      next.address = { ...(existing.address ?? {}), ...patch.address }
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* localStorage cheio ou bloqueado — silêncio */
  }
}
