import Link from "next/link";
import Stripe from "stripe";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

type Address = Stripe.Address;

type ShippingCollected = {
  name?: string | null;
  phone?: string | null;
  address?: Address | null;
};

function formatCep(cep: string | null | undefined): string {
  if (!cep) return "";
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return cep;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

type SenderProfile = {
  shipping_sender_name: string | null;
  shipping_sender_document: string | null;
  shipping_sender_phone: string | null;
  shipping_sender_cep: string | null;
  shipping_sender_street: string | null;
  shipping_sender_number: string | null;
  shipping_sender_complement: string | null;
  shipping_sender_neighborhood: string | null;
  shipping_sender_city: string | null;
  shipping_sender_uf: string | null;
};

function hasMinSender(s: SenderProfile | null): boolean {
  if (!s) return false;
  return !!(s.shipping_sender_name && s.shipping_sender_cep && s.shipping_sender_city && s.shipping_sender_uf);
}

type Props = { params: Promise<{ sessionId: string }> };

export default async function EtiquetaPage({ params }: Props) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "stripe_secret_key, shipping_sender_name, shipping_sender_document, shipping_sender_phone, shipping_sender_cep, shipping_sender_street, shipping_sender_number, shipping_sender_complement, shipping_sender_neighborhood, shipping_sender_city, shipping_sender_uf",
    )
    .eq("id", user.id)
    .single();

  const stripeKey = (profile as { stripe_secret_key?: string | null } | null)?.stripe_secret_key ?? "";
  const sender = profile as SenderProfile | null;

  if (!stripeKey) {
    return (
      <ErrorPage
        title="Stripe não conectado"
        message="Conecte sua conta Stripe em Configurações para imprimir etiquetas."
      />
    );
  }

  const stripe = new Stripe(stripeKey);
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (e) {
    return (
      <ErrorPage
        title="Pedido não encontrado"
        message={e instanceof Error ? e.message : "Não foi possível localizar este pedido na Stripe."}
      />
    );
  }

  // Valida que a sessão pertence a um produto nosso (defesa básica)
  const plink = typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id;
  const { data: produto } = plink
    ? await supabase
        .from("produtos_infoprodutor")
        .select("id, name, image_url")
        .eq("user_id", user.id)
        .eq("stripe_payment_link_id", plink)
        .maybeSingle()
    : { data: null };

  if (!produto) {
    return (
      <ErrorPage
        title="Pedido não autorizado"
        message="Este pedido não está vinculado a nenhum produto seu."
      />
    );
  }

  const anySession = session as Stripe.Checkout.Session & {
    shipping_details?: ShippingCollected | null;
    collected_information?: { shipping_details?: ShippingCollected | null } | null;
  };
  const shipping: ShippingCollected | null =
    anySession.collected_information?.shipping_details ?? anySession.shipping_details ?? null;

  if (!shipping?.address) {
    return (
      <ErrorPage
        title="Pedido sem endereço"
        message="Este pedido foi feito antes da coleta de endereço estar habilitada. Atualize o link de checkout do produto para receber endereço nos próximos pedidos."
      />
    );
  }

  if (!hasMinSender(sender)) {
    return (
      <ErrorPage
        title="Endereço do remetente incompleto"
        message="Preencha seu endereço de remetente antes de imprimir etiquetas."
        action={{ label: "Preencher em Configurações", href: "/configuracoes" }}
      />
    );
  }

  const receiverName = shipping.name ?? session.customer_details?.name ?? "";
  const receiverPhone = shipping.phone ?? session.customer_details?.phone ?? "";
  const addr = shipping.address;
  const receiverLine1 = [addr.line1, addr.line2].filter(Boolean).join(" — ");
  const receiverCityUf = [addr.city, addr.state].filter(Boolean).join("/");
  const receiverCep = formatCep(addr.postal_code);

  const senderLine = [
    sender!.shipping_sender_street,
    sender!.shipping_sender_number ? `nº ${sender!.shipping_sender_number}` : null,
    sender!.shipping_sender_complement,
  ]
    .filter(Boolean)
    .join(" ");
  const senderCityUf = [sender!.shipping_sender_city, sender!.shipping_sender_uf].filter(Boolean).join("/");

  const orderNumberShort = session.id.slice(-10).toUpperCase();
  const createdAt = new Date((session.created ?? 0) * 1000);
  const dateLabel = createdAt.toLocaleDateString("pt-BR");

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-black print:bg-white">
      <style>{`
        @media print {
          @page { size: A6 portrait; margin: 6mm; }
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      {/* Barra superior (não imprime) */}
      <div className="no-print bg-[#1c1c1f] border-b border-[#2c2c32] text-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-[#f0f0f2]">Etiqueta de envio</p>
            <p className="text-[10px] text-[#9a9aa2]">Pedido #{orderNumberShort} · {dateLabel}</p>
          </div>
          <PrintButton autoPrint={false} />
        </div>
      </div>

      {/* Etiqueta */}
      <div className="max-w-3xl mx-auto p-6 print:p-0 print:max-w-none">
        <div className="bg-white border-2 border-black rounded-md print:rounded-none overflow-hidden">
          {/* Remetente */}
          <div className="px-4 py-3 border-b-2 border-black">
            <p className="text-[9px] font-bold uppercase tracking-widest text-black/60">Remetente</p>
            <p className="text-sm font-bold mt-0.5">{sender!.shipping_sender_name}</p>
            {sender!.shipping_sender_document ? (
              <p className="text-[11px]">CPF/CNPJ: {sender!.shipping_sender_document}</p>
            ) : null}
            <p className="text-[11px] mt-1">{senderLine}</p>
            {sender!.shipping_sender_neighborhood ? (
              <p className="text-[11px]">{sender!.shipping_sender_neighborhood}</p>
            ) : null}
            <p className="text-[11px]">{senderCityUf}</p>
            <p className="text-[11px] font-semibold">CEP: {formatCep(sender!.shipping_sender_cep)}</p>
            {sender!.shipping_sender_phone ? (
              <p className="text-[11px]">Tel: {sender!.shipping_sender_phone}</p>
            ) : null}
          </div>

          {/* Destinatário */}
          <div className="px-4 py-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-black/60">Destinatário</p>
            <p className="text-2xl font-black uppercase mt-1 leading-tight">{receiverName || "—"}</p>
            <p className="text-[13px] mt-2 leading-relaxed">{receiverLine1}</p>
            <p className="text-[13px]">{receiverCityUf}</p>
            <div className="mt-3 inline-block border-2 border-black px-3 py-2 rounded">
              <span className="text-[10px] font-bold uppercase tracking-widest">CEP</span>
              <p className="text-2xl font-black tracking-widest leading-none mt-0.5">{receiverCep || "—"}</p>
            </div>
            {receiverPhone ? <p className="text-[12px] mt-2">Tel: {receiverPhone}</p> : null}
          </div>

          {/* Info do pedido */}
          <div className="px-4 py-2 border-t border-black/40 bg-black/5 text-[10px] flex flex-wrap gap-x-3 gap-y-0.5 justify-between">
            <span>
              <strong>Pedido:</strong> #{orderNumberShort}
            </span>
            <span>
              <strong>Data:</strong> {dateLabel}
            </span>
            <span>
              <strong>Valor:</strong> {formatBRL((session.amount_total ?? 0) / 100)}
            </span>
          </div>

          <div className="px-4 py-2 border-t border-black/20 text-[10px]">
            <strong>Produto:</strong> {produto.name}
          </div>
        </div>

        {/* Observação (não imprime) */}
        <div className="no-print mt-6 text-xs text-[#5a5a5a] max-w-xl">
          <p>
            Esta etiqueta segue o padrão de envio pelos Correios (balcão). Leve a encomenda, pague o frete no momento, e
            o rastreio (se houver) será fornecido pelo atendente. Para etiquetas com rastreio automático, seria
            necessário contrato com Correios ou integração Melhor Envio.
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorPage({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="min-h-screen bg-dark-bg text-text-primary flex items-center justify-center p-6">
      <div className="max-w-sm rounded-2xl border border-dark-border bg-dark-card p-6 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-text-secondary mt-2 leading-relaxed">{message}</p>
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <Link
            href="/dashboard/infoprodutor"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dark-border text-xs text-text-secondary hover:bg-dark-bg"
          >
            Voltar ao Infoprodutor
          </Link>
          {action ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-shopee-orange text-white text-xs font-semibold hover:opacity-90"
            >
              {action.label}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
