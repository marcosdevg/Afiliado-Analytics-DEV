// app/api/admin/invite-affiliate/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import * as SibApiV3Sdk from "@getbrevo/brevo";

// Emails autorizados (você e seu sócio)
const AUTHORIZED_EMAILS = [
  "marcosgomes7455@gmail.com",
  "erik15branca@gmail.com"
];

function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Env do Supabase ausentes");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function sendInviteEmail(toEmail: string, toName: string, actionLink: string) {
  const api = new SibApiV3Sdk.TransactionalEmailsApi();
  api.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY!);
  
  const msg = new SibApiV3Sdk.SendSmtpEmail();
  msg.sender = { name: "Afiliado Analytics", email: "nao-responda@afiliadoanalytics.com.br" };
  msg.to = [{ email: toEmail, name: toName }];
  msg.subject = "Bem-vindo(a) ao Afiliado Analytics - Convite Especial";
  msg.htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite Especial - Afiliado Analytics</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px; background-color:#ffffff; border:1px solid #e0e0e0; border-radius:4px;">
          
          <tr>
            <td align="center" style="padding:40px 0 30px 0;">
              <div style="font-size:36px; line-height:1.2; font-weight:bold; letter-spacing:-1px; font-family:Arial, Helvetica, sans-serif;">
                <span style="color:#222222;">Afiliado </span><span style="color:#EE4D2D;">Analytics</span>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 20px 40px; text-align:center;">
              <h1 style="font-size:24px; color:#222222; margin:0 0 10px 0; font-weight:bold;">Convite Especial, ${toName}!</h1>
              <p style="font-size:16px; color:#555555; line-height:1.6; margin:0;">
                Você foi convidado(a) para fazer parte do <strong>Afiliado Analytics</strong> com acesso gratuito. 
                Clique no botão abaixo para criar sua senha e acessar a plataforma.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 40px;">
              <a href="${actionLink}" target="_blank"
                 style="background-color:#EE4D2D; color:#ffffff; padding:15px 30px; text-decoration:none; border-radius:3px; font-weight:bold; font-size:16px; display:inline-block; border-bottom:3px solid #D03F1E;">
                Criar Minha Senha
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 10px 40px; text-align:center;">
              <p style="font-size:14px; color:#666666; margin:0;">
                Após criar sua senha, você terá acesso total ao painel de métricas e ferramentas.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:10px 40px 30px 40px; text-align:center;">
              <p style="font-size:14px; color:#666666; margin:0 0 8px 0;">
                Se o botão não funcionar, use o link abaixo:
              </p>
              <p style="font-size:12px; color:#3366cc; word-break:break-all; margin:0;">
                <a href="${actionLink}" target="_blank" style="color:#3366cc; text-decoration:underline;">${actionLink}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #eeeeee; height:1px; line-height:1px;">&nbsp;</div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px 30px 40px; text-align:center; font-size:14px; color:#888888;">
              <p style="margin:0 0 10px 0;">Este link expira em 24 horas. Caso não tenha solicitado este acesso, ignore este e‑mail.</p>
              <p style="margin:0;">Dúvidas? <a href="mailto:suporte@afiliadoanalytics.com.br" target="_blank" style="color:#EE4D2D; text-decoration:none;">suporte@afiliadoanalytics.com.br</a></p>
            </td>
          </tr>

        </table>

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
</html>`;
  
  await api.sendTransacEmail(msg);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = admin();
    
    // Verificar autenticação do usuário
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Verificar se o email está na lista de autorizados
    if (!AUTHORIZED_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { name, email } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 400 });
    }

    // Verificar se já existe
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Este email já está cadastrado" }, { status: 400 });
    }

    // Criar usuário
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (createErr || !created?.user?.id) {
      return NextResponse.json(
        { error: `Falha ao criar usuário: ${createErr?.message || "desconhecido"}` },
        { status: 500 }
      );
    }

    const userId = created.user.id;

    // Criar profile com acesso vitalício
    const { error: profErr } = await supabase.from("profiles").insert([
      {
        id: userId,
        email,
        subscription_status: "active",
        plan_name: "Convite Especial - Acesso Gratuito",
        account_setup_pending: true,
        access_until: null, // Acesso vitalício
      },
    ]);

    if (profErr) {
      return NextResponse.json(
        { error: `Falha ao criar profile: ${profErr.message}` },
        { status: 500 }
      );
    }

    // Registrar convite na tabela de invited_affiliates
    await supabase.from("invited_affiliates").insert([
      {
        email,
        name,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
      },
    ]);

    // Gerar link de primeiro acesso
    const baseUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: "BASE_URL não configurada" },
        { status: 500 }
      );
    }

    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${baseUrl}/password-reset` },
    } as const);

    if (linkErr || !linkData?.properties?.action_link) {
      return NextResponse.json(
        { error: linkErr?.message || "Falha ao gerar link" },
        { status: 500 }
      );
    }

    // Enviar email
    await sendInviteEmail(email, name, linkData.properties.action_link);

    return NextResponse.json({ 
      success: true, 
      message: "Convite enviado com sucesso!" 
    });

  } catch (error: unknown) {
    console.error("Erro ao enviar convite:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
