export type MediaAsset = {
  type: "image" | "video";
  src: string;
  durationInSeconds?: number;
};

export type CaptionWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export type VideoStyleId =
  | "showcase"
  | "storytelling"
  | "fastCuts"
  | "beforeAfter"
  | "reviewRapido"
  | "ugcStyle"
  | "flashSale"
  | "unboxing"
  /** Edições premium (transições cinematográficas, grade, movimento de câmera) */
  | "cinematicDark"
  | "viralEnergetic"
  | "luxuryGold"
  | "corporateModern"
  | "motivationalKinetic"
  | "glitchTech"
  | "emotionalStorytelling"
  /** springTiming + camadas flare/matte/glitch + card de abertura (máximo Remotion transitions) */
  | "masterDirector"
  /** letterbox scope + grade quente + flare âmbar */
  | "filmArc";

export type SubtitleTheme = {
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  bgColor: string;
  position: "top" | "center" | "bottom";
};

export type VideoInputProps = {
  style: VideoStyleId;
  media: MediaAsset[];
  voiceoverSrc: string | null;
  musicSrc: string | null;
  musicVolume: number;
  captions: CaptionWord[];
  subtitleTheme: SubtitleTheme;
  productName: string;
  /** Se true, mostra cartão com o nome do produto no início (estilos masterDirector / filmArc). */
  showProductNameIntro?: boolean;
  price: string;
  ctaText: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
};

export const SUBTITLE_THEMES: Record<string, SubtitleTheme> = {
  tiktokBold: {
    fontFamily: "Arial Black, sans-serif",
    fontSize: 52,
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 4,
    bgColor: "transparent",
    position: "center",
  },
  capcut: {
    fontFamily: "Arial Black, sans-serif",
    fontSize: 48,
    color: "#FFFF00",
    strokeColor: "#000000",
    strokeWidth: 3,
    bgColor: "rgba(0,0,0,0.5)",
    position: "bottom",
  },
  classico: {
    fontFamily: "Arial, sans-serif",
    fontSize: 40,
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 2,
    bgColor: "rgba(0,0,0,0.7)",
    position: "bottom",
  },
  shopeeOrange: {
    fontFamily: "Arial, sans-serif",
    fontSize: 44,
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 3,
    bgColor: "#EE4D2D",
    position: "bottom",
  },
  neon: {
    fontFamily: "Impact, sans-serif",
    fontSize: 50,
    color: "#00FF88",
    strokeColor: "#000000",
    strokeWidth: 4,
    bgColor: "transparent",
    position: "center",
  },
  hormozi: {
    fontFamily: "Impact, sans-serif",
    fontSize: 64,
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 6,
    bgColor: "transparent",
    position: "center",
  },
  karaoke: {
    fontFamily: "Arial Black, sans-serif",
    fontSize: 48,
    color: "#FFD700",
    strokeColor: "#000000",
    strokeWidth: 3,
    bgColor: "transparent",
    position: "bottom",
  },
  retro: {
    fontFamily: "Impact, sans-serif",
    fontSize: 50,
    color: "#FF69B4",
    strokeColor: "#4B0082",
    strokeWidth: 4,
    bgColor: "transparent",
    position: "center",
  },
  editorial: {
    fontFamily: "Georgia, serif",
    fontSize: 36,
    color: "#F0F0F0",
    strokeColor: "#000000",
    strokeWidth: 1,
    bgColor: "rgba(0,0,0,0.65)",
    position: "bottom",
  },
  fire: {
    fontFamily: "Impact, sans-serif",
    fontSize: 54,
    color: "#FF4500",
    strokeColor: "#8B0000",
    strokeWidth: 4,
    bgColor: "transparent",
    position: "center",
  },
  midnightBlue: {
    fontFamily: "Arial Black, sans-serif",
    fontSize: 46,
    color: "#E8F4FF",
    strokeColor: "#0A1628",
    strokeWidth: 3,
    bgColor: "rgba(15, 30, 60, 0.75)",
    position: "bottom",
  },
  roseGold: {
    fontFamily: "Georgia, serif",
    fontSize: 42,
    color: "#F5E6D3",
    strokeColor: "#5C4033",
    strokeWidth: 2,
    bgColor: "rgba(60, 40, 35, 0.55)",
    position: "center",
  },
  cyberPink: {
    fontFamily: "Impact, sans-serif",
    fontSize: 50,
    color: "#FF2E97",
    strokeColor: "#1A0A20",
    strokeWidth: 4,
    bgColor: "transparent",
    position: "center",
  },
  slatePro: {
    fontFamily: "system-ui, Segoe UI, sans-serif",
    fontSize: 38,
    color: "#F8FAFC",
    strokeColor: "#0F172A",
    strokeWidth: 2,
    bgColor: "rgba(15, 23, 42, 0.82)",
    position: "bottom",
  },
  amberViral: {
    fontFamily: "Arial Black, sans-serif",
    fontSize: 52,
    color: "#FBBF24",
    strokeColor: "#1C1917",
    strokeWidth: 4,
    bgColor: "rgba(0,0,0,0.35)",
    position: "center",
  },
};

export const VIDEO_STYLES: Record<VideoStyleId, { label: string; description: string }> = {
  showcase: {
    label: "Showcase Produto",
    description: "Imagens com zoom suave, preço animado, CTA no final",
  },
  storytelling: {
    label: "Storytelling",
    description: "Cenas em sequência com narração, legendas word-by-word",
  },
  fastCuts: {
    label: "Cortes Rápidos",
    description: "Imagens alternando rápido com texto grande e impacto",
  },
  beforeAfter: {
    label: "Antes & Depois",
    description: "Comparação lado a lado com transição wipe horizontal",
  },
  reviewRapido: {
    label: "Review Rápido",
    description: "Mix de mídias com overlay de estrelas e avaliação",
  },
  ugcStyle: {
    label: "UGC Orgânico",
    description: "Estilo casual com tremor de câmera e bordas arredondadas",
  },
  flashSale: {
    label: "Flash Sale",
    description: "Urgência com timer animado, cores vibrantes e shake",
  },
  unboxing: {
    label: "Unboxing Reveal",
    description: "Revelação misteriosa com blur, zoom dramático e suspense",
  },
  cinematicDark: {
    label: "Cinematic Dark",
    description: "Grade fria, vinheta, grain leve, transições suaves tipo trailer",
  },
  viralEnergetic: {
    label: "Viral Energetic",
    description: "Cortes rápidos, flash, saturação alta, impacto TikTok/Reels",
  },
  luxuryGold: {
    label: "Luxury Gold",
    description: "Tons quentes, brilho dourado sutil, movimento Ken Burns elegante",
  },
  corporateModern: {
    label: "Corporate Modern",
    description: "Limpo, estável, transições slide/flip discretas",
  },
  motivationalKinetic: {
    label: "Motivational Kinetic",
    description: "Zoom dinâmico, parallax leve, energia de discurso motivacional",
  },
  glitchTech: {
    label: "Glitch Tech",
    description: "RGB split ocasional, transições agressivas, vibe tech",
  },
  emotionalStorytelling: {
    label: "Emotional Storytelling",
    description: "Ritmo mais lento, vinheta suave, foco narrativo emocional",
  },
  masterDirector: {
    label: "Master Director Cut",
    description: "Transições com física spring, iris/clock, glitch, flare, impacto máximo",
  },
  filmArc: {
    label: "Film Arc Cinema",
    description: "Letterbox 2.39:1, tons quentes, flare dourado, movimento clássico",
  },
};
