// app/api/kiwify-webhooks/route.ts
import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import * as SibApiV3Sdk from "@getbrevo/brevo"
import { resolveTierFromKiwifyIds, bestPlanTier } from "@/lib/kiwify-plan-catalog"
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

// ---------- Email de setup ----------
async function sendSetupEmail(toEmail: string, toName: string, resetUrl: string) {
  const api = new SibApiV3Sdk.TransactionalEmailsApi()
  api.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY!)
  const msg = new SibApiV3Sdk.SendSmtpEmail()
  msg.sender = { name: "Afiliado Analytics", email: "nao-responda@afiliadoanalytics.com.br" }
  msg.to = [{ email: toEmail, name: toName }]
  msg.subject = "Bem-vindo(a) ao Afiliado Analytics"
  msg.htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Definir minha senha</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">


        <!-- Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px; background-color:#ffffff; border:1px solid #e0e0e0; border-radius:4px;">
          
          <!-- Logo/Brand -->
          <tr>
            <td align="center" style="padding:40px 0 30px 0;">
              <div style="font-size:36px; line-height:1.2; font-weight:bold; letter-spacing:-1px; font-family:Arial, Helvetica, sans-serif;">
                <span style="color:#222222;">Afiliado </span><span style="color:#EE4D2D;">Analytics</span>
              </div>
            </td>
          </tr>


          <!-- Título e intro -->
          <tr>
            <td style="padding:0 40px 20px 40px; text-align:center;">
              <h1 style="font-size:24px; color:#222222; margin:0 0 10px 0; font-weight:bold;">Bem‑vindo(a), ${toName}!</h1>
              <p style="font-size:16px; color:#555555; line-height:1.6; margin:0;">
                Sua assinatura está ativa e sua conta já foi criada com sucesso. Para começar, defina sua senha abaixo e acesse o painel.
              </p>
            </td>
          </tr>


          <!-- Botão -->
          <tr>
            <td align="center" style="padding:20px 40px;">
              <a href="${resetUrl}" target="_blank"
                 style="background-color:#EE4D2D; color:#ffffff; padding:15px 30px; text-decoration:none; border-radius:3px; font-weight:bold; font-size:16px; display:inline-block; border-bottom:3px solid #D03F1E;">
                Definir minha senha
              </a>
            </td>
          </tr>


          <!-- Observação pós-ação -->
          <tr>
            <td style="padding:0 40px 10px 40px; text-align:center;">
              <p style="font-size:14px; color:#666666; margin:0;">
                Depois de definir a senha, o acesso ao painel será imediato para acompanhar métricas.
              </p>
            </td>
          </tr>


          <!-- Fallback de link -->
          <tr>
            <td style="padding:10px 40px 30px 40px; text-align:center;">
              <p style="font-size:14px; color:#666666; margin:0 0 8px 0;">
                Se o botão não funcionar, clique no link abaixo:
              </p>
              <p style="font-size:12px; color:#3366cc; word-break:break-all; margin:0;">
                <a href="${resetUrl}" target="_blank" style="color:#3366cc; text-decoration:underline;">${resetUrl}</a>
              </p>
            </td>
          </tr>


          <!-- Divisor -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #eeeeee; height:1px; line-height:1px;">&nbsp;</div>
            </td>
          </tr>


          <!-- Avisos e suporte -->
          <tr>
            <td style="padding:20px 40px 30px 40px; text-align:center; font-size:14px; color:#888888;">
              <p style="margin:0 0 10px 0;">Este link expira em 24 horas por segurança. Caso não tenha solicitado a criação desta conta, ignore este e‑mail.</p>
              <p style="margin:0;">Dúvidas? <a href="mailto:suporte@afiliadoanalytics.com.br" target="_blank" style="color:#EE4D2D; text-decoration:none;">suporte@afiliadoanalytics.com.br</a></p>
            </td>
          </tr>


        </table>


        <!-- Rodapé -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px; margin-top:20px;">
          <tr>
            <td align="center" style="font-size:12px; color:#999999;">
              <p style="margin:0;">&copy; 2025 Afiliado Analytics. Todos os direitos reservados.</p>
            </td>
          </tr>
        </table>


      </td>
    </tr>
  </table>
</body>
</html>`
  await api.sendTransacEmail(msg)
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

  const validSubs = (subs || []).filter((s) => {
    const au = s.access_until ? new Date(s.access_until).toISOString() : null
    const notRefunded = s.status !== "refunded"
    const notExpired = au ? au >= now : false
    const okStatus = s.status === "active" || s.status === "past_due" || s.status === "canceled"
    return notRefunded && notExpired && okStatus
  })

  const anyValid = validSubs.length > 0

  const maxAccess =
    (subs || [])
      .map((s) => s.access_until)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null

  // Resolve plan_tier from active subscriptions
  let planTier: PlanTier = "padrao"
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
    await supabase
      .from("profiles")
      .update({
        subscription_status: anyValid ? "active" : "canceled",
        access_until: anyValid ? maxAccess : null,
        plan_tier: planTier,
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
  const eventType = String(data.webhook_event_type || "")

  // 4) (resto do seu código: INALTERADO)
  if (eventType === "order_approved" || eventType === "subscription_renewed") {
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
    const checkoutLink = typeof data.checkout_link === "string" ? data.checkout_link.trim() : null

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
        await sendSetupEmail(email, fullName, resetUrl)
      } catch (e: unknown) {
        const warn = getErrorMessage(e)
        return NextResponse.json({
          ok: true,
          event: eventType,
          warn: `Usuário criado/profile gravado, mas falha ao enviar e-mail: ${warn}`,
        })
      }
    }

    return NextResponse.json({ ok: true, event: eventType })
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
