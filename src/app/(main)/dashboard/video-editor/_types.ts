export type MediaType = "video" | "audio" | "image";

export type MediaItem = {
  id: string;
  name: string;
  type: MediaType;
  blobUrl: string;
  duration: number;
  thumbnail?: string;
  file?: File;
};

export type TextStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  bgColor: string;
  bgOpacity: number;
  bold: boolean;
  italic: boolean;
  shadow: boolean;
  alignment: "left" | "center" | "right";
};

export type VideoFilters = {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  grayscale: number;
  sepia: number;
};

export const DEFAULT_FILTERS: VideoFilters = {
  brightness: 1, contrast: 1, saturation: 1, hue: 0, blur: 0, grayscale: 0, sepia: 0,
};

export type TransitionType = "none" | "fade" | "slideLeft" | "slideRight" | "slideUp" | "slideDown" | "zoomIn" | "zoomOut" | "dissolve";

export type Transition = {
  type: TransitionType;
  duration: number;
};

export type SubtitleStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  bgColor: string;
  position: "bottom" | "center" | "top";
  bold: boolean;
  outline: boolean;
  uppercase?: boolean;
  bgOpacity?: number;
  outlineColor?: string;
  outlineWidth?: number;
};

export type ClipItem = {
  id: string;
  mediaId: string;
  name: string;
  type: MediaType | "subtitle" | "text" | "sticker";
  blobUrl: string;
  trackIndex: number;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  speed?: number;
  text?: string;
  subtitleStyle?: SubtitleStyle;
  textStyle?: TextStyle;
  stickerEmoji?: string;
  badgeText?: string;
  badgeBg?: string;
  badgeColor?: string;
  posX?: number;
  posY?: number;
  overlayWidth?: number;
  rotation?: number;
  filters?: VideoFilters;
  transition?: Transition;
};

export type Track = {
  id: string;
  type: "video" | "audio" | "subtitle" | "text" | "sticker";
  label: string;
  clips: ClipItem[];
  muted: boolean;
};

export type ElevenVoice = {
  voice_id: string;
  name: string;
  preview_url: string | null;
  labels: Record<string, string>;
};

export type ProjectData = {
  id: string;
  name: string;
  tracks: Track[];
  aspectRatio: string;
  settings: Record<string, unknown>;
  savedAt: string;
};

// --- Constants ---

export const SUBTITLE_TEMPLATES: { name: string; style: SubtitleStyle }[] = [
  { name: "Clássico", style: { fontFamily: "Arial", fontSize: 28, color: "#FFFFFF", bgColor: "rgba(0,0,0,0.7)", position: "bottom", bold: true, outline: false } },
  { name: "Neon", style: { fontFamily: "Impact", fontSize: 32, color: "#00FF88", bgColor: "transparent", position: "bottom", bold: true, outline: true } },
  { name: "CapCut Viral", style: { fontFamily: "Arial Black", fontSize: 36, color: "#FFFF00", bgColor: "rgba(0,0,0,0.5)", position: "center", bold: true, outline: true } },
  { name: "Minimalista", style: { fontFamily: "Helvetica", fontSize: 24, color: "#FFFFFF", bgColor: "transparent", position: "bottom", bold: false, outline: false } },
  { name: "Stories Shopee", style: { fontFamily: "Arial", fontSize: 30, color: "#FFFFFF", bgColor: "#EE4D2D", position: "bottom", bold: true, outline: false } },
  { name: "TikTok Bold", style: { fontFamily: "Arial Black", fontSize: 34, color: "#FFFFFF", bgColor: "transparent", position: "center", bold: true, outline: true } },
  { name: "Reels Rosa", style: { fontFamily: "Arial", fontSize: 30, color: "#FFFFFF", bgColor: "#E1306C", position: "bottom", bold: true, outline: false } },
  { name: "Fogo", style: { fontFamily: "Impact", fontSize: 36, color: "#FF4500", bgColor: "rgba(0,0,0,0.6)", position: "center", bold: true, outline: true } },
  { name: "Karaokê", style: { fontFamily: "Arial Black", fontSize: 32, color: "#00D4FF", bgColor: "rgba(0,0,0,0.8)", position: "bottom", bold: true, outline: false } },
  { name: "Luxo Dourado", style: { fontFamily: "Georgia", fontSize: 30, color: "#FFD700", bgColor: "rgba(0,0,0,0.5)", position: "center", bold: true, outline: true } },
  { name: "Gradiente Pop", style: { fontFamily: "Arial Black", fontSize: 34, color: "#FF6FD8", bgColor: "transparent", position: "center", bold: true, outline: true } },
  { name: "Caixa Branca", style: { fontFamily: "Helvetica", fontSize: 26, color: "#000000", bgColor: "#FFFFFF", position: "bottom", bold: true, outline: false } },
  { name: "Hacker", style: { fontFamily: "Courier New", fontSize: 26, color: "#00FF00", bgColor: "rgba(0,0,0,0.9)", position: "bottom", bold: false, outline: false } },
  { name: "Cinema", style: { fontFamily: "Georgia", fontSize: 28, color: "#F5F5DC", bgColor: "transparent", position: "bottom", bold: false, outline: true } },
  { name: "Urgência", style: { fontFamily: "Impact", fontSize: 38, color: "#FF0000", bgColor: "rgba(255,255,0,0.3)", position: "center", bold: true, outline: true } },
];

export const TEXT_TEMPLATES: { name: string; style: TextStyle }[] = [
  { name: "Título Grande", style: { fontFamily: "Arial Black", fontSize: 48, color: "#FFFFFF", bgColor: "#000000", bgOpacity: 0, bold: true, italic: false, shadow: true, alignment: "center" } },
  { name: "CTA Shopee", style: { fontFamily: "Arial", fontSize: 28, color: "#FFFFFF", bgColor: "#EE4D2D", bgOpacity: 0.9, bold: true, italic: false, shadow: false, alignment: "center" } },
  { name: "Preço", style: { fontFamily: "Arial Black", fontSize: 40, color: "#00FF00", bgColor: "#000000", bgOpacity: 0.5, bold: true, italic: false, shadow: true, alignment: "center" } },
  { name: "Alerta", style: { fontFamily: "Impact", fontSize: 36, color: "#FF0000", bgColor: "#FFFF00", bgOpacity: 0.8, bold: true, italic: false, shadow: false, alignment: "center" } },
  { name: "Elegante", style: { fontFamily: "Georgia", fontSize: 32, color: "#FFD700", bgColor: "#000000", bgOpacity: 0.3, bold: false, italic: true, shadow: true, alignment: "center" } },
  { name: "Destaque", style: { fontFamily: "Arial", fontSize: 32, color: "#FFFFFF", bgColor: "#9B59B6", bgOpacity: 0.85, bold: true, italic: false, shadow: true, alignment: "center" } },
];

export const FILTER_PRESETS: { name: string; filters: VideoFilters }[] = [
  { name: "Original", filters: { brightness: 1, contrast: 1, saturation: 1, hue: 0, blur: 0, grayscale: 0, sepia: 0 } },
  { name: "Quente", filters: { brightness: 1.05, contrast: 1.1, saturation: 1.3, hue: 15, blur: 0, grayscale: 0, sepia: 0.1 } },
  { name: "Frio", filters: { brightness: 1.05, contrast: 1.1, saturation: 0.8, hue: 200, blur: 0, grayscale: 0, sepia: 0 } },
  { name: "P&B", filters: { brightness: 1, contrast: 1.1, saturation: 0, hue: 0, blur: 0, grayscale: 1, sepia: 0 } },
  { name: "Vintage", filters: { brightness: 0.95, contrast: 1.2, saturation: 0.6, hue: 20, blur: 0, grayscale: 0, sepia: 0.4 } },
  { name: "Alto Contraste", filters: { brightness: 1.1, contrast: 1.5, saturation: 1.2, hue: 0, blur: 0, grayscale: 0, sepia: 0 } },
];

export const STICKER_CATEGORIES: { name: string; stickers: { id: string; emoji?: string; label: string; badge?: boolean; bgColor?: string; textColor?: string }[] }[] = [
  {
    name: "Vendas",
    stickers: [
      { id: "s1", emoji: "🔥", label: "Fogo" }, { id: "s2", emoji: "⭐", label: "Estrela" },
      { id: "s3", emoji: "💰", label: "Dinheiro" }, { id: "s4", emoji: "🎯", label: "Alvo" },
      { id: "s5", emoji: "🚀", label: "Foguete" }, { id: "s6", emoji: "💎", label: "Diamante" },
      { id: "s7", emoji: "🏆", label: "Troféu" }, { id: "s8", emoji: "✅", label: "Check" },
      { id: "s9", emoji: "💯", label: "100" }, { id: "s10", emoji: "🎁", label: "Presente" },
    ],
  },
  {
    name: "Setas",
    stickers: [
      { id: "s11", emoji: "⬆️", label: "Cima" }, { id: "s12", emoji: "⬇️", label: "Baixo" },
      { id: "s13", emoji: "➡️", label: "Direita" }, { id: "s14", emoji: "⬅️", label: "Esquerda" },
      { id: "s15", emoji: "👆", label: "Dedo ↑" }, { id: "s16", emoji: "👇", label: "Dedo ↓" },
      { id: "s17", emoji: "👉", label: "Dedo →" }, { id: "s18", emoji: "👈", label: "Dedo ←" },
    ],
  },
  {
    name: "Reações",
    stickers: [
      { id: "s19", emoji: "❤️", label: "Coração" }, { id: "s20", emoji: "😍", label: "Apaixonado" },
      { id: "s21", emoji: "🤩", label: "Encantado" }, { id: "s22", emoji: "😱", label: "Chocado" },
      { id: "s23", emoji: "🤯", label: "Explodindo" }, { id: "s24", emoji: "😂", label: "Rindo" },
      { id: "s25", emoji: "👏", label: "Palmas" }, { id: "s26", emoji: "🙌", label: "Mãos" },
    ],
  },
  {
    name: "Badges",
    stickers: [
      { id: "b1", label: "FRETE GRÁTIS", badge: true, bgColor: "#00B900", textColor: "#FFFFFF" },
      { id: "b2", label: "OFERTA", badge: true, bgColor: "#FF0000", textColor: "#FFFFFF" },
      { id: "b3", label: "DESCONTO", badge: true, bgColor: "#EE4D2D", textColor: "#FFFFFF" },
      { id: "b4", label: "NOVO", badge: true, bgColor: "#0066FF", textColor: "#FFFFFF" },
      { id: "b5", label: "LIMITADO", badge: true, bgColor: "#FF6600", textColor: "#FFFFFF" },
      { id: "b6", label: "EXCLUSIVO", badge: true, bgColor: "#9B59B6", textColor: "#FFFFFF" },
    ],
  },
];

export const TRANSITION_TYPES: { type: TransitionType; label: string }[] = [
  { type: "none", label: "Nenhuma" },
  { type: "fade", label: "Fade" },
  { type: "slideLeft", label: "Slide ←" },
  { type: "slideRight", label: "Slide →" },
  { type: "slideUp", label: "Slide ↑" },
  { type: "slideDown", label: "Slide ↓" },
  { type: "zoomIn", label: "Zoom In" },
  { type: "zoomOut", label: "Zoom Out" },
  { type: "dissolve", label: "Dissolve" },
];
