export function sanitizeSlug(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatDateTimePtBR(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function isExpired(expiresAtIso: string | null) {
  if (!expiresAtIso) return false;
  return new Date(expiresAtIso).getTime() <= Date.now();
}

export function parseColorToRgb(
  input: string | null | undefined
): { r: number; g: number; b: number } {
  const fallback = { r: 37, g: 211, b: 102 }; // #25D366
  const s = (input || "").trim();
  if (!s) return fallback;

  if (s.startsWith("#") && s.length === 7) {
    const r = parseInt(s.slice(1, 3), 16);
    const g = parseInt(s.slice(3, 5), 16);
    const b = parseInt(s.slice(5, 7), 16);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return { r, g, b };
    return fallback;
  }

  const m = s.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (m) {
    const r = Math.min(255, Math.max(0, parseInt(m[1]!, 10)));
    const g = Math.min(255, Math.max(0, parseInt(m[2]!, 10)));
    const b = Math.min(255, Math.max(0, parseInt(m[3]!, 10)));
    return { r, g, b };
  }

  return fallback;
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
}
