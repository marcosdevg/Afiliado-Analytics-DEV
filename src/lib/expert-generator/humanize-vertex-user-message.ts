/**
 * Mensagens amigáveis em PT para erros comuns do Vertex / Veo / Gemini no Gerador de Especialista.
 */
export function humanizeVertexUserFacingMessage(raw: string): string {
  const t = raw.trim();
  if (!t) return raw;

  if (/input image violates Vertex AI'?s usage guidelines/i.test(t)) {
    return "O Veo não conseguiu gerar vídeos porque a imagem de entrada viola as diretrizes de uso, ou tente novamente!";
  }
  if (/Veo could not generate videos/i.test(t) && /guidelines/i.test(t)) {
    return "O Veo não conseguiu gerar vídeos porque a imagem de entrada viola as diretrizes de uso, ou tente novamente!";
  }
  if (/This prompt contains words that violate Vertex AI'?s usage guidelines/i.test(t)) {
    return "O pedido contém termos que o Vertex AI bloqueou pelas diretrizes de segurança. Reformule o texto (evite marcas, preços agressivos ou palavras ambíguas) ou simplifique o prompt avançado.";
  }
  if (/prompt could not be submitted/i.test(t) && /guidelines/i.test(t)) {
    return "O pedido contém termos que o Vertex AI bloqueou pelas diretrizes de segurança. Reformule o texto (evite marcas, preços agressivos ou palavras ambíguas) ou simplifique o prompt avançado.";
  }

  return raw;
}
