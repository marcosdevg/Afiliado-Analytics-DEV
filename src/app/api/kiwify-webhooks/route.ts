// app/api/kiwify-webhooks/route.ts
import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import {
  resolveTierFromKiwifyIds,
  bestPlanTier,
  resolveAfiliadoCoinsFromKiwifyCheckout,
  normalizeKiwifyCheckoutSlug,
  isAfiliadoCoinsKiwifySubscriptionRow,
} from "@/lib/kiwify-plan-catalog"
import { respondAfiliadoCoinsKiwifyApproved, type KiwifyCoinsPayload } from "@/lib/kiwify-afiliado-coins-webhook"
import { sendKiwifySetupEmail } from "@/lib/kiwify-send-setup-email"
import type { PlanTier } from "@/lib/plan-entitlements"

// ---------- Supabase (service role) ---------
function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Env do Supabase ausentes")
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// ---------- Tipos do payload Kiwify ----------
type KiwifyCustomer = {
  email?: string
  full_name?: string
  first_name?: string
}
type KiwifyProduct = { product_id?: string | number; product_name?: string }
type KiwifyOrder = { id?: string | number }
type KiwifySubscription = {
  start_date?: string
  next_payment?: string
  status?: string
  customer_access?: {
    has_access?: boolean
    active_period?: boolean
    access_until?: string
  }
  plan?: {
    id?: string
    name?: string
    frequency?: string
    qty_charges?: number
  }
}
interface KiwifyWebhookPayload {
  webhook_event_type?: string
  event_id?: string | number
  id?: string | number
  order_id?: string | number
  subscription_id?: string | number
  checkout_link?: string
  Order?: KiwifyOrder
  Customer?: KiwifyCustomer
  Product?: KiwifyProduct
  Subscription?: KiwifySubscription
}

// ---------- Utils ----------
const iso = (s?: string | null) => {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(+d) ? null : d.toISOString()
}
const nowIso = () => new Date().toISOString()

function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  try {
    return typeof error === "string" ? error : JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function deriveAccessUntil(sub?: KiwifySubscription): string | null {
  const byAccessUntil = iso(sub?.customer_access?.access_until)
  if (byAccessUntil) return byAccessUntil
  const byNext = iso(sub?.next_payment)
  if (byNext) return byNext
  const freq = (sub?.plan?.frequency || "").toLowerCase()
  const days =
    freq.includes("annual") || freq.includes("year")
      ? 365
      : freq.includes("quarter") || freq.includes("trim")
      ? 90
      : 30
  return addDays(new Date(), days)
}

async function recomputeProfileStatus(supabase: ReturnType<typeof admin>, email: string, userId: string | null) {
  const now = nowIso()
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("status, access_until, plan_id, product_id, checkout_url")
    .eq("email", email)

  // Compras de Afiliado Coins não são assinatura de plano — não entram no cálculo de tier.
  const planRows = (subs || []).filter(
    (s) => !isAfiliadoCoinsKiwifySubscriptionRow({ checkout_url: s.checkout_url, product_id: s.product_id })
  )

  const validSubs = planRows.filter((s) => {
    const au = s.access_until ? new Date(s.access_until).toISOString() : null
    const notRefunded = s.status !== "refunded"
    const notExpired = au ? au >= now : false
    const okStatus = s.status === "active" || s.status === "past_due" || s.status === "canceled"
    return notRefunded && notExpired && okStatus
  })

  const anyValid = validSubs.length > 0

  // Trial ativo sem assinatura Kiwify: não rebaixar nem cancelar até expirar o trial_access_until
  if (userId && !anyValid) {
    const { data: profTrial } = await supabase
      .from("profiles")
      .select("plan_tier, trial_access_until")
      .eq("id", userId)
      .maybeSingle();
    const until = profTrial?.trial_access_until ? new Date(profTrial.trial_access_until as string).getTime() : 0;
    if (profTrial?.plan_tier === "trial" && until > Date.now()) {
      await supabase.from("profiles").update({ subscription_status: "active" }).eq("id", userId);
      return;
    }
  }

  const maxAccess =
    planRows
      .map((s) => s.access_until)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null

  let planTier: PlanTier = "inicial"
  if (anyValid) {
    const tiers = validSubs.map((s) =>
      resolveTierFromKiwifyIds({
        checkoutLink: s.checkout_url,
        planId: s.plan_id,
        productId: s.product_id,
      })
    )
    planTier = bestPlanTier(tiers)
  }

  if (userId) {
    const { data: profSnap } = await supabase.from("profiles").select("plan_tier").eq("id", userId).maybeSingle()
    if (profSnap?.plan_tier === "staff") {
      planTier = "staff"
    }
    await supabase
      .from("profiles")
      .update({
        subscription_status: anyValid ? "active" : "canceled",
        access_until: anyValid ? maxAccess : null,
        plan_tier: planTier,
        ...(anyValid ? { trial_access_until: null } : {}),
      })
      .eq("id", userId)
  }
}

async function getCurrentEntitlementUntil(
  supabase: ReturnType<typeof admin>,
  email: string,
  excludeProviderSubId: string
): Promise<string | null> {
  const now = nowIso()

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("provider_subscription_id, status, access_until")
    .eq("email", email)

  const maxAccess =
    (subs || [])
      .filter((s) => {
        if (!s.access_until) return false
        if (s.provider_subscription_id === excludeProviderSubId) return false

        const au = new Date(s.access_until).toISOString()
        const notRefunded = s.status !== "refunded"
        const notExpired = au >= now
        const okStatus = s.status === "active" || s.status === "past_due" || s.status === "canceled"
        return notRefunded && notExpired && okStatus
      })
      .map((s) => new Date(s.access_until as string).toISOString())
      .sort()
      .slice(-1)[0] || null

  return maxAccess
}

// (MANTIDA, mas não usada)
async function maybeCarryOverTime(params: {
  supabase: ReturnType<typeof admin>
  email: string
  newSubId: string
  newAccessUntil: string | null
}) {
  const { supabase, email, newSubId, newAccessUntil } = params
  if (!newAccessUntil) return null

  const now = new Date()
  const { data: others } = await supabase
    .from("subscriptions")
    .select("provider_subscription_id, access_until, status, cancel_at_period_end, transferred_to")
    .eq("email", email)

  const candidates = (others || []).filter((s) => {
    if (!s.access_until) return false
    if (s.provider_subscription_id === newSubId) return false
    if (s.transferred_to) return false
    const au = new Date(s.access_until)
    const stillHasTime = au > now
    const eligibleStatus = s.status === "active" || s.status === "canceled" || s.status === "past_due"
    return stillHasTime && eligibleStatus && s.cancel_at_period_end
  })

  if (candidates.length === 0) return null

  const carryMs = Math.max(...candidates.map((s) => Math.max(0, new Date(s.access_until!).getTime() - now.getTime())))
  if (carryMs <= 0) return null

  const base = new Date(newAccessUntil)
  const extended = new Date(base.getTime() + carryMs).toISOString()

  const ids = candidates.map((c) => c.provider_subscription_id)
  await supabase.from("subscriptions").update({ transferred_to: newSubId }).in("provider_subscription_id", ids)

  return extended
}

// ---------- AJUSTES (apenas assinatura + payload wrapper) ----------
function getKiwifySecrets(): string[] {
  const raw = process.env.KIWIFY_WEBHOOK_SECRETS || process.env.KIWIFY_WEBHOOK_SECRET || ""
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function safeTimingEqualHex(aHex: string, bHex: string) {
  try {
    const a = Buffer.from(aHex, "hex")
    const b = Buffer.from(bHex, "hex")
    if (a.length === 0 || b.length === 0) return false
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

// ---------- Handler ----------
export async function POST(req: NextRequest) {
  const raw = await req.text()

  // 1) Parse (precisamos para: pegar signature do body e suportar payload vindo em { order: {...} })
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 })
  }

  // Mantém o comportamento: se vier algo que não seja objeto, só não encontra signature/order no body.
  const parsedObj: Record<string, unknown> = isRecord(parsed) ? parsed : {}

  // 2) Verificação HMAC (agora aceita: signature na query OU no body; e aceita múltiplos secrets)
  const signatureFromQuery = req.nextUrl.searchParams.get("signature")
  const signatureFromBody =
    typeof parsedObj.signature === "string" || typeof parsedObj.signature === "number"
      ? String(parsedObj.signature)
      : undefined
  const signature = String(signatureFromQuery || signatureFromBody || "").trim().toLowerCase()

  const secrets = getKiwifySecrets()
  if (!signature || secrets.length === 0) {
    return NextResponse.json({ error: "Configuração de segurança incompleta." }, { status: 400 })
  }

  const valid = secrets.some((secret) => {
    const digest = createHmac("sha1", secret).update(raw).digest("hex")
    return safeTimingEqualHex(digest, signature)
  })

  if (!valid) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 })
  }

  // 3) Payload: se vier no formato novo { order: {...} }, usamos order como "data" (sem mudar sua lógica)
  const payload = isRecord(parsedObj.order) ? parsedObj.order : parsedObj
  const data = payload as KiwifyWebhookPayload

  const supabase = admin()
  const rootEventType =
    isRecord(parsedObj) && typeof parsedObj.webhook_event_type === "string"
      ? parsedObj.webhook_event_type
      : ""
  const eventType = String(data.webhook_event_type || rootEventType || "")

  // Kiwify: painel/API usam `compra_aprovada`; payloads antigos às vezes vêm como `order_approved`.
  const isPurchaseApproved =
    eventType === "order_approved" || eventType === "compra_aprovada"
  const isSubscriptionRenewed = eventType === "subscription_renewed"

  // 4) (resto do seu código: INALTERADO)
  if (isPurchaseApproved || isSubscriptionRenewed) {
    const customer = data.Customer
    const product = data.Product
    if (!customer?.email) {
      return NextResponse.json({ error: "Email do cliente ausente." }, { status: 400 })
    }

    const email = String(customer.email)
    const fullName = String(customer.full_name || customer.first_name || "Cliente")

    const sub = data.Subscription
    const planNameFromSub = sub?.plan?.name?.trim()
    const planName = (planNameFromSub && planNameFromSub.length > 0 ? planNameFromSub : product?.product_name) || "Plano"

    const productId = String(product?.product_id || "")
    const providerSubId = data.subscription_id ? String(data.subscription_id) : `${data.order_id || ""}`
    const checkoutRaw =
      typeof data.checkout_link === "string" ? data.checkout_link.trim() : ""
    const checkoutLink = checkoutRaw
      ? normalizeKiwifyCheckoutSlug(checkoutRaw) || null
      : null

    const coinPackFromCheckout = resolveAfiliadoCoinsFromKiwifyCheckout(checkoutLink)
    if (isPurchaseApproved && coinPackFromCheckout > 0) {
      return respondAfiliadoCoinsKiwifyApproved(supabase, data as KiwifyCoinsPayload, eventType)
    }

    let accessUntil = deriveAccessUntil(sub)
    const frequency = sub?.plan?.frequency || null
    const planId = sub?.plan?.id || null

    // 4.1 Usuário/Profile
    const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle()

    let userId: string | null = existing?.id ?? null
    let isNewUser = false

    if (!userId) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })

      if (createErr || !created?.user?.id) {
        return NextResponse.json(
          { error: `Falha ao criar usuário no Auth: ${createErr?.message || "desconhecido"}` },
          { status: 500 }
        )
      }

      userId = created.user.id
      isNewUser = true

      const initialTier = resolveTierFromKiwifyIds({
        checkoutLink,
        planId,
        productId,
      })
      const { error: profErr } = await supabase.from("profiles").insert([
        {
          id: userId,
          email,
          subscription_status: "active",
          plan_name: planName,
          plan_tier: initialTier,
          account_setup_pending: true,
        },
      ])
      if (profErr) {
        return NextResponse.json({ error: `Falha ao inserir profile: ${profErr.message}` }, { status: 500 })
      }
    } else {
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ subscription_status: "active", plan_name: planName })
        .eq("id", userId)

      if (upErr) {
        return NextResponse.json({ error: `Falha ao atualizar profile: ${upErr.message}` }, { status: 500 })
      }
    }

    const { data: existingSubRow } = await supabase
      .from("subscriptions")
      .select("access_until")
      .eq("provider", "kiwify")
      .eq("provider_subscription_id", providerSubId)
      .maybeSingle()

    const previousAccessUntil = existingSubRow?.access_until

    // 4.2 Upsert assinatura
    const { error: upsertErr } = await supabase.from("subscriptions").upsert(
      [
        {
          provider: "kiwify",
          provider_subscription_id: providerSubId,
          product_id: productId || null,
          plan_id: planId || null,
          plan_name: planName,
          frequency: frequency || null,
          status: "active",
          cancel_at_period_end: false,
          access_until: accessUntil,
          email,
          user_id: userId,
          ...(checkoutLink ? { checkout_url: checkoutLink } : {}),
        },
      ],
      { onConflict: "provider,provider_subscription_id" }
    )
    if (upsertErr) {
      return NextResponse.json({ error: `Falha ao salvar assinatura: ${upsertErr.message}` }, { status: 500 })
    }

    // 4.3 Empilhar
    if (accessUntil) {
      const payloadAu = new Date(accessUntil).toISOString()
      const prevAuIso = previousAccessUntil ? new Date(previousAccessUntil).toISOString() : null
      const shouldStack = !existingSubRow || (prevAuIso && prevAuIso === payloadAu)

      if (shouldStack) {
        const currentEntitlementUntil = await getCurrentEntitlementUntil(supabase, email, providerSubId)

        const now = Date.now()
        const baseMs = Math.max(now, currentEntitlementUntil ? new Date(currentEntitlementUntil).getTime() : 0)

        const freq = (frequency || "").toLowerCase()
        const planDurationDays =
          freq.includes("annual") || freq.includes("year")
            ? 365
            : freq.includes("quarter") || freq.includes("trim")
              ? 90
              : 30

        const durationMs = planDurationDays * 24 * 60 * 60 * 1000
        const stacked = new Date(baseMs + durationMs).toISOString()

        if (stacked !== payloadAu) {
          accessUntil = stacked
          await supabase
            .from("subscriptions")
            .update({ access_until: stacked })
            .eq("provider", "kiwify")
            .eq("provider_subscription_id", providerSubId)
        }
      }
    }

    // 4.4 Recalcular agregado do profile
    await recomputeProfileStatus(supabase, email, userId!)

    // Compras com pack de coins saem antes (não tocam em subscriptions). Aqui só diagnóstico se slug desconhecido.
    const coinPack = resolveAfiliadoCoinsFromKiwifyCheckout(checkoutLink)
    const orderKeyRaw =
      data.order_id != null
        ? String(data.order_id)
        : data.Order && typeof data.Order === "object" && (data.Order as KiwifyOrder).id != null
          ? String((data.Order as KiwifyOrder).id)
          : data.id != null
            ? String(data.id)
            : ""
    const orderKey = orderKeyRaw.trim()

    const afiliadoCoinsPayload: {
      checkout_slug: string | null
      resolved_pack: number
      order_id: string | null
      credit_attempted: boolean
      credit_ok: boolean | null
      hint?: string
    } = {
      checkout_slug: checkoutLink,
      resolved_pack: coinPack,
      order_id: orderKey || null,
      credit_attempted: false,
      credit_ok: null,
    }

    if (checkoutLink && coinPack === 0) {
      afiliadoCoinsPayload.hint =
        "checkout_slug_not_in_catalog — adiciona KIWIFY_AFILIADO_COINS_MAP=slug:coins no deploy ou usa o link oficial do pack."
    } else if (!checkoutLink && coinPack === 0) {
      afiliadoCoinsPayload.hint =
        "no_checkout_link — típico de alguns eventos; compras de coins precisam de checkout_link no payload."
    }

    // 4.5 E-mail de primeiro acesso (apenas novos)
    if (isNewUser) {
      const rawBaseUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_BASE_URL
      if (!rawBaseUrl) {
        return NextResponse.json(
          { error: "BASE_URL (SITE_URL ou NEXT_PUBLIC_BASE_URL) não configurada." },
          { status: 500 }
        )
      }

      // ✅ normaliza para evitar //password-reset
      const baseUrl = rawBaseUrl.replace(/\/$/, "")

      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${baseUrl}/password-reset` },
      } as const)

      if (linkErr || !linkData?.properties?.action_link) {
        return NextResponse.json(
          { error: linkErr?.message || "Falha ao gerar link de definição de senha" },
          { status: 500 }
        )
      }

      // ✅ Converte action_link (Supabase) => resetUrl (seu app) com token_hash
      const actionLink = linkData.properties.action_link
      const u = new URL(actionLink)

      // preferir token/hash vindo de properties quando existir (fallback para token da URL)
      const tokenFromUrl = u.searchParams.get("token")
      const linkType = u.searchParams.get("type")

      // @ts-expect-error: defensivo (depende da versão)
      const tokenFromProps: string | undefined = linkData.properties?.hashed_token || linkData.properties?.hashedToken

      const tokenHash = tokenFromProps || tokenFromUrl

      if (!tokenHash || linkType !== "recovery") {
        return NextResponse.json({ error: "Link inválido gerado (recovery)." }, { status: 500 })
      }

      // ✅ Link final para a sua tela (SEM &email=...)
      const resetUrl =
        `${baseUrl}/password-reset` +
        `?type=recovery` +
        `&token_hash=${encodeURIComponent(tokenHash)}`

      if (process.env.NODE_ENV === "development") {
        console.log("KIWIFY SETUP RESET URL:", resetUrl)
        console.log("KIWIFY ACTION LINK:", actionLink)
      }

      try {
        await sendKiwifySetupEmail(email, fullName, resetUrl)
      } catch (e: unknown) {
        const warn = getErrorMessage(e)
        return NextResponse.json({
          ok: true,
          event: eventType,
          warn: `Usuário criado/profile gravado, mas falha ao enviar e-mail: ${warn}`,
          afiliado_coins: afiliadoCoinsPayload,
        })
      }
    }

    return NextResponse.json({
      ok: true,
      event: eventType,
      afiliado_coins: afiliadoCoinsPayload,
    })
  }

  if (eventType === "subscription_canceled") {
    const email = data?.Customer?.email as string | undefined
    if (email) {
      const providerSubId = data.subscription_id ? String(data.subscription_id) : `${data.order_id || ""}`
      await supabase
        .from("subscriptions")
        .update({ status: "canceled", cancel_at_period_end: true })
        .eq("provider", "kiwify")
        .eq("provider_subscription_id", providerSubId)

      const { data: prof } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle()
      await recomputeProfileStatus(supabase, email, prof?.id || null)
    }
    return NextResponse.json({ ok: true, event: eventType })
  }

  if (eventType === "subscription_late") {
    const email = data?.Customer?.email as string | undefined
    if (email) {
      const providerSubId = data.subscription_id ? String(data.subscription_id) : `${data.order_id || ""}`
      await supabase
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("provider", "kiwify")
        .eq("provider_subscription_id", providerSubId)

      const { data: prof } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle()
      await recomputeProfileStatus(supabase, email, prof?.id || null)
    }
    return NextResponse.json({ ok: true, event: eventType })
  }

  if (eventType === "order_refunded" || eventType === "compra_reembolsada") {
    const email = data?.Customer?.email as string | undefined
    if (email) {
      const providerSubId = data.subscription_id ? String(data.subscription_id) : `${data.order_id || ""}`
      await supabase
        .from("subscriptions")
        .update({
          status: "refunded",
          access_until: nowIso(),
          cancel_at_period_end: true,
        })
        .eq("provider", "kiwify")
        .eq("provider_subscription_id", providerSubId)

      const { data: prof } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle()
      await recomputeProfileStatus(supabase, email, prof?.id || null)
    }
    return NextResponse.json({ ok: true, event: eventType })
  }

  return NextResponse.json({ ok: true, event: eventType })
}
