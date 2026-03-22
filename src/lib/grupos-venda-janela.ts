/**
 * Janela de disparo em Grupos de Venda: duração máxima 14h (consecutivas, pode atravessar meia-noite).
 */

export const MAX_JANELA_MINUTOS = 14 * 60;

/** HH:MM ou HH:MM:SS → minutos desde 00:00 */
export function parseHorarioParaMinutos(h: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(h.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/**
 * Duração da janela em minutos (início → fim no relógio; se fim < início, atravessa meia-noite).
 */
export function janelaDuracaoMinutos(inicio: string, fim: string): number | null {
  const a = parseHorarioParaMinutos(inicio);
  const b = parseHorarioParaMinutos(fim);
  if (a === null || b === null) return null;
  if (b >= a) return b - a;
  return 24 * 60 - a + b;
}

/** null = OK; string = mensagem de erro para o usuário */
export function mensagemErroJanela(
  inicio: string | null | undefined,
  fim: string | null | undefined,
): string | null {
  const i = typeof inicio === "string" ? inicio.trim() : "";
  const f = typeof fim === "string" ? fim.trim() : "";
  if (!i || !f) return "Defina o horário de início e fim da janela.";
  const d = janelaDuracaoMinutos(i, f);
  if (d === null) return "Horários inválidos. Use o formato HH:MM.";
  if (d <= 0) return "A janela precisa ter duração maior que zero (início e fim não podem ser iguais).";
  if (d > MAX_JANELA_MINUTOS) return "A janela não pode ultrapassar 14 horas seguidas.";
  return null;
}
