import { NextResponse } from "next/server";
import { gateInfoprodutor } from "@/lib/require-entitlements";
import { cotarFrete } from "@/lib/frete/superfrete";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const gate = await gateInfoprodutor();
    if (!gate.allowed) return gate.response;

    const body = await req.json().catch(() => ({}));
    const options = await cotarFrete({
      cepOrigem: String(body.cepOrigem ?? ""),
      cepDestino: String(body.cepDestino ?? ""),
      pesoKg: Number(body.pesoKg ?? 0),
      alturaCm: Number(body.alturaCm ?? 0),
      larguraCm: Number(body.larguraCm ?? 0),
      comprimentoCm: Number(body.comprimentoCm ?? 0),
    });

    return NextResponse.json({ options });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao cotar frete";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
