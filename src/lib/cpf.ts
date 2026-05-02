/**
 * Helpers de CPF — usado no signup do trial pra evitar abuso.
 *
 * `normalizeCpf` tira tudo que não é dígito; `isValidCpf` aplica o
 * algoritmo oficial dos dígitos verificadores. NÃO basta o `normalizeCpf`
 * pra confiar — gerador de CPF aleatório de 11 dígitos passa nele.
 */

/**
 * Tira tudo que não é dígito. Retorna string só-dígitos com 11 chars
 * exatos, ou null se não tem 11 dígitos.
 */
export function normalizeCpf(input: string | null | undefined): string | null {
  if (input == null) return null;
  const digits = String(input).replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return digits;
}

/**
 * Valida CPF pelos dígitos verificadores oficiais (algoritmo módulo 11).
 *
 * Rejeita também sequências repetidas (`11111111111`, `00000000000`, …),
 * que tecnicamente passam no algoritmo mas são CPFs reservados/inválidos.
 */
export function isValidCpf(input: string | null | undefined): boolean {
  const cpf = normalizeCpf(input);
  if (!cpf) return false;

  // Sequências repetidas — ex.: "11111111111" — passam no módulo 11 mas
  // não são CPFs válidos no Brasil.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // 1º dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf[i], 10) * (10 - i);
  }
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;

  // 2º dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf[i], 10) * (11 - i);
  }
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  if (d2 !== parseInt(cpf[10], 10)) return false;

  return true;
}

/** Formata pra exibição: "12345678909" → "123.456.789-09". */
export function formatCpfDisplay(cpf: string): string {
  const n = normalizeCpf(cpf);
  if (!n) return cpf;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

/** Aplica máscara progressiva enquanto digita: usa só dígitos do input. */
export function applyCpfMask(input: string): string {
  const d = String(input).replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
