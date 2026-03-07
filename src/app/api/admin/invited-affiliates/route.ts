// app/api/admin/invited-affiliates/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

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

export async function GET(req: NextRequest) {
  try {
    const supabase = admin();
    
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user || !AUTHORIZED_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("invited_affiliates")
      .select("*")
      .order("invited_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });

  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = admin();
    
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user || !AUTHORIZED_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 });
    }

    // 1. Buscar o profile para pegar o user_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!profile?.id) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const userId = profile.id;

    // 2. Excluir da tabela invited_affiliates
    await supabase
      .from("invited_affiliates")
      .delete()
      .eq("email", email);

    // 3. Excluir profile (CASCADE vai apagar relacionados)
    await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    // 4. Excluir usuário do Auth (isso invalida todas as sessões)
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error("Erro ao deletar do Auth:", deleteAuthError);
      return NextResponse.json(
        { error: `Erro ao excluir usuário do Auth: ${deleteAuthError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Afiliado excluído com sucesso" });

  } catch (error: unknown) {
    console.error("Erro na exclusão:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
