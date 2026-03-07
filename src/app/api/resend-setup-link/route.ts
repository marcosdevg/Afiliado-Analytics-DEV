import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import * as SibApiV3Sdk from '@getbrevo/brevo'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function sendEmail(toEmail: string, toName: string, resetUrl: string) {
  const api = new SibApiV3Sdk.TransactionalEmailsApi()
  api.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY!)

  const year = new Date().getFullYear()

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinição de senha</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">

        <table width="100%" border="0" cellspacing="0" cellpadding="0"
          style="max-width:600px; background-color:#ffffff; border:1px solid #e0e0e0; border-radius:4px;">

          <tr>
            <td align="center" style="padding:40px 0 30px 0;">
              <div style="font-size:36px; line-height:1.2; font-weight:bold; letter-spacing:-1px; font-family:Arial, Helvetica, sans-serif;">
                <span style="color:#222222;">Afiliado </span><span style="color:#EE4D2D;">Analytics</span>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 20px 40px; text-align:center;">
              <h1 style="font-size:24px; color:#222222; margin:0 0 10px 0; font-weight:bold;">
                Crie sua nova senha
              </h1>
              <p style="font-size:16px; color:#555555; line-height:1.6; margin:0;">
                Recebemos uma solicitação para redefinir a senha da sua conta no Afiliado Analytics.
                Para continuar, clique no botão abaixo.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 40px;">
              <a href="${resetUrl}" target="_blank"
                 style="background-color:#EE4D2D; color:#ffffff; padding:15px 30px; text-decoration:none; border-radius:3px; font-weight:bold; font-size:16px; display:inline-block; border-bottom:3px solid #D03F1E;">
                Definir nova senha
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:10px 40px 0 40px; text-align:center;">
              <p style="font-size:14px; color:#666666; margin:0;">
                Se você não fez esta solicitação, pode ignorar este e-mail com segurança.
              </p>
              <p style="font-size:14px; color:#666666; margin:10px 0 0 0;">
                Dúvidas? <a href="https://mail.google.com/mail/u/2/#m_-5512097642330081165_" target="_blank"
                  style="color:#EE4D2D; text-decoration:none;">Visite nossa Central de Ajuda</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #eeeeee; height:1px; line-height:1px;">&nbsp;</div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 40px 26px 40px; text-align:center; font-size:12px; color:#888888;">
              <p style="margin:0;">
                Se você não solicitou a redefinição, nenhuma ação é necessária.
              </p>
            </td>
          </tr>

        </table>

        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px; margin-top:20px;">
          <tr>
            <td align="center" style="font-size:12px; color:#999999;">
              <p style="margin:0;">&copy; ${year} Afiliado Analytics. Todos os direitos reservados.</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`

  const email = new SibApiV3Sdk.SendSmtpEmail()
  email.sender = { name: 'Afiliado Analytics', email: 'nao-responda@afiliadoanalytics.com.br' }
  email.to = [{ email: toEmail, name: toName }]
  email.subject = 'Redefinição de senha do Afiliado Analytics'
  email.htmlContent = html

  await api.sendTransacEmail(email)
}

type Body = { email?: string; name?: string }

export async function POST(req: Request) {
  const supabase = admin()

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const email = body.email?.trim()
  const name = body.name?.trim() || 'Cliente'

  // Resposta neutra (anti-enumeração): não revele se existe ou não.
  if (!email) {
    return NextResponse.json({ ok: true })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  try {
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${baseUrl}/password-reset` },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      if (process.env.NODE_ENV === 'development') console.warn('generateLink falhou:', linkErr?.message)
      return NextResponse.json({ ok: true })
    }

    const actionLink = linkData.properties.action_link
    const u = new URL(actionLink)

    const tokenFromUrl = u.searchParams.get('token') || ''
    const type = u.searchParams.get('type') || ''

    if (!tokenFromUrl || type !== 'recovery') {
      if (process.env.NODE_ENV === 'development') console.warn('action_link inesperado:', actionLink)
      return NextResponse.json({ ok: true })
    }

    const resetUrl =
      `${baseUrl}/password-reset` +
      `?type=recovery` +
      `&token_hash=${encodeURIComponent(tokenFromUrl)}`

    if (process.env.NODE_ENV === 'development') console.log('RESET URL:', resetUrl)

    await sendEmail(email, name, resetUrl)
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.error('resend-setup-link falhou:', e)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
