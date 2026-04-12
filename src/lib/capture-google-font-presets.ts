/**
 * Fontes Google (e sistema) partilhadas entre a página **Em branco** e a **secção promocional estilo Rosa**.
 * Cada preset tem stack CSS e URL `fonts.googleapis.com/css2` (exceto `system`).
 */

export const CAPTURE_GOOGLE_FONT_PRESETS = [
  "system",
  "inter",
  "dm_sans",
  "playfair",
  "space_grotesk",
  "poppins",
  "montserrat",
  "roboto",
  "open_sans",
  "lato",
  "merriweather",
  "nunito",
  "raleway",
  "source_sans_3",
] as const;

export type CaptureGoogleFontPreset = (typeof CAPTURE_GOOGLE_FONT_PRESETS)[number];

const PRESET_ALLOW = new Set<string>(CAPTURE_GOOGLE_FONT_PRESETS);

/** Nome da família na API Google Fonts (espaços → + na URL). */
const GOOGLE_FAMILY_API: Record<Exclude<CaptureGoogleFontPreset, "system">, string> = {
  inter: "Inter",
  dm_sans: "DM+Sans",
  playfair: "Playfair+Display",
  space_grotesk: "Space+Grotesk",
  poppins: "Poppins",
  montserrat: "Montserrat",
  roboto: "Roboto",
  open_sans: "Open+Sans",
  lato: "Lato",
  merriweather: "Merriweather",
  nunito: "Nunito",
  raleway: "Raleway",
  source_sans_3: "Source+Sans+3",
};

const FONT_STACK: Record<CaptureGoogleFontPreset, string> = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  inter: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  dm_sans: '"DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  playfair: '"Playfair Display", Georgia, "Times New Roman", serif',
  space_grotesk: '"Space Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  poppins: '"Poppins", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  montserrat: '"Montserrat", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  roboto: '"Roboto", system-ui, -apple-system, "Segoe UI", sans-serif',
  open_sans: '"Open Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  lato: '"Lato", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  merriweather: '"Merriweather", Georgia, "Times New Roman", serif',
  nunito: '"Nunito", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  raleway: '"Raleway", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  source_sans_3: '"Source Sans 3", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

const WGHT = "400;500;600;700";

function weightsForGoogleCss(preset: Exclude<CaptureGoogleFontPreset, "system">): string {
  /** Merriweather não expõe 500/600 nos estáticos clássicos; 400+700 cobre título e corpo. */
  if (preset === "merriweather") return "400;700";
  return WGHT;
}

export function captureFontCssStack(preset: CaptureGoogleFontPreset): string {
  return FONT_STACK[preset];
}

export function captureFontGoogleHref(preset: CaptureGoogleFontPreset): string | null {
  if (preset === "system") return null;
  const family = GOOGLE_FAMILY_API[preset];
  const w = weightsForGoogleCss(preset);
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${w}&display=swap`;
}

/** Aceita valores gravados na BD / camelCase legacy. */
export function normalizeCaptureFontPreset(v: unknown): CaptureGoogleFontPreset {
  let s = String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (s === "dmsans") s = "dm_sans";
  if (s === "spacegrotesk") s = "space_grotesk";
  if (s === "opensans") s = "open_sans";
  if (s === "sourcesans3" || s === "source_sans3") s = "source_sans_3";
  if (PRESET_ALLOW.has(s)) return s as CaptureGoogleFontPreset;
  return "system";
}

/** Opções para `MetaSearchablePicker` (value = id do preset). */
export const CAPTURE_FONT_PICKER_OPTIONS: {
  value: CaptureGoogleFontPreset;
  label: string;
  description?: string;
}[] = [
  { value: "system", label: "Sistema (padrão)", description: "Tipografia nativa do dispositivo." },
  { value: "inter", label: "Inter", description: "Google Fonts — neutra e muito legível." },
  { value: "dm_sans", label: "DM Sans", description: "Google Fonts — geométrica e limpa." },
  { value: "playfair", label: "Playfair Display", description: "Google Fonts — serif elegante." },
  { value: "space_grotesk", label: "Space Grotesk", description: "Google Fonts — display moderna." },
  { value: "poppins", label: "Poppins", description: "Google Fonts — redonda e amigável." },
  { value: "montserrat", label: "Montserrat", description: "Google Fonts — títulos fortes." },
  { value: "roboto", label: "Roboto", description: "Google Fonts — clássica Android/Material." },
  { value: "open_sans", label: "Open Sans", description: "Google Fonts — neutra amplamente usada." },
  { value: "lato", label: "Lato", description: "Google Fonts — humanista estável." },
  { value: "merriweather", label: "Merriweather", description: "Google Fonts — serif para leitura." },
  { value: "nunito", label: "Nunito", description: "Google Fonts — arredondada e suave." },
  { value: "raleway", label: "Raleway", description: "Google Fonts — elegante e fina." },
  { value: "source_sans_3", label: "Source Sans 3", description: "Google Fonts — UI Adobe/open source." },
];
