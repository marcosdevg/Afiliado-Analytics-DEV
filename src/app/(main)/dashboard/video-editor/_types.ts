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

export type ClipItem = {
  id: string;
  mediaId: string;
  name: string;
  type: MediaType | "subtitle";
  blobUrl: string;
  trackIndex: number;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  text?: string;
  subtitleStyle?: SubtitleStyle;
};

export type Track = {
  id: string;
  type: "video" | "audio" | "subtitle";
  label: string;
  clips: ClipItem[];
  muted: boolean;
};

export type SubtitleStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  bgColor: string;
  position: "bottom" | "center" | "top";
  bold: boolean;
  outline: boolean;
  /** Exibir texto em MAIÚSCULAS */
  uppercase?: boolean;
  /** Opacidade do plano de fundo (0-1). Quando definido, combina com bgColor em hex. */
  bgOpacity?: number;
  /** Cor da borda/contorno da fonte (ex: #000000) */
  outlineColor?: string;
  /** Largura da borda em pixels */
  outlineWidth?: number;
};

export const SUBTITLE_TEMPLATES: { name: string; style: SubtitleStyle }[] = [
  {
    name: "Clássico",
    style: { fontFamily: "Arial", fontSize: 28, color: "#FFFFFF", bgColor: "rgba(0,0,0,0.7)", position: "bottom", bold: true, outline: false },
  },
  {
    name: "Neon",
    style: { fontFamily: "Impact", fontSize: 32, color: "#00FF88", bgColor: "transparent", position: "bottom", bold: true, outline: true },
  },
  {
    name: "CapCut Viral",
    style: { fontFamily: "Arial Black", fontSize: 36, color: "#FFFF00", bgColor: "rgba(0,0,0,0.5)", position: "center", bold: true, outline: true },
  },
  {
    name: "Minimalista",
    style: { fontFamily: "Helvetica", fontSize: 24, color: "#FFFFFF", bgColor: "transparent", position: "bottom", bold: false, outline: false },
  },
  {
    name: "Stories Shopee",
    style: { fontFamily: "Arial", fontSize: 30, color: "#FFFFFF", bgColor: "#EE4D2D", position: "bottom", bold: true, outline: false },
  },
  {
    name: "TikTok Bold",
    style: { fontFamily: "Arial Black", fontSize: 34, color: "#FFFFFF", bgColor: "transparent", position: "center", bold: true, outline: true },
  },
  {
    name: "Reels Rosa",
    style: { fontFamily: "Arial", fontSize: 30, color: "#FFFFFF", bgColor: "#E1306C", position: "bottom", bold: true, outline: false },
  },
  {
    name: "Fogo",
    style: { fontFamily: "Impact", fontSize: 36, color: "#FF4500", bgColor: "rgba(0,0,0,0.6)", position: "center", bold: true, outline: true },
  },
  {
    name: "Karaokê",
    style: { fontFamily: "Arial Black", fontSize: 32, color: "#00D4FF", bgColor: "rgba(0,0,0,0.8)", position: "bottom", bold: true, outline: false },
  },
  {
    name: "Luxo Dourado",
    style: { fontFamily: "Georgia", fontSize: 30, color: "#FFD700", bgColor: "rgba(0,0,0,0.5)", position: "center", bold: true, outline: true },
  },
  {
    name: "Gradiente Pop",
    style: { fontFamily: "Arial Black", fontSize: 34, color: "#FF6FD8", bgColor: "transparent", position: "center", bold: true, outline: true },
  },
  {
    name: "Caixa Branca",
    style: { fontFamily: "Helvetica", fontSize: 26, color: "#000000", bgColor: "#FFFFFF", position: "bottom", bold: true, outline: false },
  },
  {
    name: "Hacker",
    style: { fontFamily: "Courier New", fontSize: 26, color: "#00FF00", bgColor: "rgba(0,0,0,0.9)", position: "bottom", bold: false, outline: false },
  },
  {
    name: "Cinema",
    style: { fontFamily: "Georgia", fontSize: 28, color: "#F5F5DC", bgColor: "transparent", position: "bottom", bold: false, outline: true },
  },
  {
    name: "Urgência",
    style: { fontFamily: "Impact", fontSize: 38, color: "#FF0000", bgColor: "rgba(255,255,0,0.3)", position: "center", bold: true, outline: true },
  },
];

export type ElevenVoice = {
  voice_id: string;
  name: string;
  preview_url: string | null;
  labels: Record<string, string>;
};
