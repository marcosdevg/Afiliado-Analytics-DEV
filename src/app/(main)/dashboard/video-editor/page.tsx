"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Film, Upload, Download, Link2, Loader2, Wand2, Mic, Type, Scissors,
  Volume2, VolumeX, Play, Pause, Square, SkipBack, SkipForward, Trash2,
  Plus, Image as ImageIcon, Music, FileVideo, AlertCircle,
  Undo2, Redo2, Smile, SlidersHorizontal, Save, FolderOpen, ALargeSmall,
  Gauge, Sparkles, X,
} from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import type { MediaItem, ClipItem, Track, ElevenVoice, SubtitleStyle, TextStyle, VideoFilters, Transition, TransitionType, ProjectData } from "./_types";
import {
  SUBTITLE_TEMPLATES, TEXT_TEMPLATES, FILTER_PRESETS, STICKER_CATEGORIES,
  TRANSITION_TYPES, DEFAULT_FILTERS,
} from "./_types";
import { useHistory } from "./_hooks/useHistory";

// ─── ID generators ───
let clipIdCounter = 0;
const uid = () => `clip_${++clipIdCounter}_${Date.now()}`;
let mediaIdCounter = 0;
const mediaUid = () => `media_${++mediaIdCounter}_${Date.now()}`;

// ─── Utility fns ───
function getVideoDuration(blobUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(v.duration || 0);
    v.onerror = () => resolve(0);
    v.src = blobUrl;
  });
}

function getAudioDuration(blobUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(a.duration || 0);
    a.onerror = () => resolve(0);
    a.src = blobUrl;
  });
}

function generateVideoThumbnail(blobUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.onloadeddata = () => { v.currentTime = 1; };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = 160; c.height = 90;
      const ctx = c.getContext("2d");
      if (ctx) ctx.drawImage(v, 0, 0, 160, 90);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    v.onerror = () => resolve("");
    v.src = blobUrl;
  });
}

function buildCssFilter(f: VideoFilters): string {
  const p: string[] = [];
  if (f.brightness !== 1) p.push(`brightness(${f.brightness})`);
  if (f.contrast !== 1) p.push(`contrast(${f.contrast})`);
  if (f.saturation !== 1) p.push(`saturate(${f.saturation})`);
  if (f.hue !== 0) p.push(`hue-rotate(${f.hue}deg)`);
  if (f.blur > 0) p.push(`blur(${f.blur}px)`);
  if (f.grayscale > 0) p.push(`grayscale(${f.grayscale})`);
  if (f.sepia > 0) p.push(`sepia(${f.sepia})`);
  return p.join(" ") || "none";
}

function getTransitionCss(t: Transition | undefined, progress: number): React.CSSProperties {
  if (!t || t.type === "none" || progress >= 1) return {};
  const p = Math.min(Math.max(progress, 0), 1);
  switch (t.type) {
    case "fade": return { opacity: p };
    case "slideLeft": return { transform: `translateX(${(1 - p) * 100}%)` };
    case "slideRight": return { transform: `translateX(${(p - 1) * 100}%)` };
    case "slideUp": return { transform: `translateY(${(1 - p) * 100}%)` };
    case "slideDown": return { transform: `translateY(${(p - 1) * 100}%)` };
    case "zoomIn": return { transform: `scale(${p})`, opacity: p };
    case "zoomOut": return { transform: `scale(${2 - p})`, opacity: p };
    case "dissolve": return { opacity: p, filter: `blur(${(1 - p) * 4}px)` };
    default: return {};
  }
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, "0")}.${ms}`;
}

const DEFAULT_TRACKS: Track[] = [
  { id: "track_video", type: "video", label: "Vídeo", clips: [], muted: false },
  { id: "track_audio1", type: "audio", label: "Áudio 1", clips: [], muted: false },
  { id: "track_audio2", type: "audio", label: "Áudio 2", clips: [], muted: false },
  { id: "track_sub", type: "subtitle", label: "Legendas", clips: [], muted: false },
  { id: "track_text", type: "text", label: "Texto", clips: [], muted: false },
  { id: "track_sticker", type: "sticker", label: "Stickers", clips: [], muted: false },
];

const LS_KEY = "video-editor-autosave";
const LS_PROJECTS = "video-editor-projects";

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════
export default function VideoEditorPage() {
  // ─── Media library ───
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const { state: tracks, setState: setTracks, push: pushTracks, commit: commitTracks, undo: undoTracks, redo: redoTracks, canUndo, canRedo } = useHistory<Track[]>(DEFAULT_TRACKS);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // ─── Playback ───
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalDuration, setTotalDuration] = useState(30);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const [activePreviewClip, setActivePreviewClip] = useState<ClipItem | null>(null);

  // ─── UI panels ───
  type PanelKey = "media" | "copy" | "tts" | "subtitle" | "text" | "stickers" | "filters";
  const [activePanel, setActivePanel] = useState<PanelKey>("media");
  const [shopeeUrl, setShopeeUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [shopeeMedia, setShopeeMedia] = useState<{ url: string; type: "image" | "video"; label: string }[]>([]);
  const [shopeeProductName, setShopeeProductName] = useState("");
  const [importingMedia, setImportingMedia] = useState<string | null>(null);

  // ─── Copy generation ───
  const [copyProductName, setCopyProductName] = useState("");
  const [copyStyle, setCopyStyle] = useState("vendas");
  const [generatedCopy, setGeneratedCopy] = useState("");
  const [generatingCopy, setGeneratingCopy] = useState(false);

  // ─── TTS ───
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [ttsText, setTtsText] = useState("");
  const [generatingTts, setGeneratingTts] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(false);

  // ─── Subtitle settings ───
  const [subtitleTemplate, setSubtitleTemplate] = useState(0);
  const [subtitleFontSize, setSubtitleFontSize] = useState(28);
  const [subtitlePosition, setSubtitlePosition] = useState<"bottom" | "center" | "top">("bottom");
  const [subtitleMaxWords, setSubtitleMaxWords] = useState(3);
  const [subtitleUppercase, setSubtitleUppercase] = useState(false);
  const [subtitleFontColor, setSubtitleFontColor] = useState("#FFFFFF");
  const [subtitleBgColor, setSubtitleBgColor] = useState("#000000");
  const [subtitleBgOpacity, setSubtitleBgOpacity] = useState(0.7);
  const [subtitleOutlineColor, setSubtitleOutlineColor] = useState("#000000");
  const [subtitleOutlineWidth, setSubtitleOutlineWidth] = useState(1);
  const [generatingSubtitles, setGeneratingSubtitles] = useState(false);

  // ─── Text overlay ───
  const [textInput, setTextInput] = useState("");
  const [textTemplate, setTextTemplate] = useState(0);

  // ─── Stickers ───
  const [stickerCategory, setStickerCategory] = useState(0);

  // ─── Filters ───
  const [clipFilters, setClipFilters] = useState<VideoFilters>({ ...DEFAULT_FILTERS });

  // ─── Transitions ───
  const [showTransitionPicker, setShowTransitionPicker] = useState<string | null>(null);

  // ─── Drag overlay in preview ───
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // ─── FFmpeg ───
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState("");
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  // ─── Zoom / Aspect ───
  const [pxPerSecond, setPxPerSecond] = useState(40);
  const ASPECT_RATIOS = [
    { label: "9:16", value: "9/16" }, { label: "16:9", value: "16/9" },
    { label: "4:3", value: "4/3" }, { label: "1:1", value: "1/1" }, { label: "3:4", value: "3/4" },
  ];
  const [aspectRatio, setAspectRatio] = useState("9/16");

  // ─── Save / Load ───
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [projectName, setProjectName] = useState("Meu Projeto");
  const [savedProjects, setSavedProjects] = useState<ProjectData[]>([]);

  // ─── Refs ───
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const currentVideoSrcRef = useRef<string>("");
  const trimSnapshotRef = useRef<Track[] | null>(null);

  // ─── Selected clip helper ───
  const selectedClip = tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId) ?? null;

  // ═══════════════════════════════════════════════════════════
  // Effects
  // ═══════════════════════════════════════════════════════════

  // Total duration
  useEffect(() => {
    let max = 10;
    tracks.forEach((t) => t.clips.forEach((c) => {
      const spd = c.speed || 1;
      const end = c.startTime + (c.duration - c.trimStart - c.trimEnd) / spd;
      if (end > max) max = end;
    }));
    setTotalDuration(Math.max(max + 5, 10));
  }, [tracks]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      setCurrentTime((prev) => {
        const next = prev + dt;
        if (next >= totalDuration) { setIsPlaying(false); return 0; }
        return next;
      });
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, totalDuration]);

  // Sync video element
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const videoTrack = tracks.find((t) => t.type === "video");
    const activeClip = videoTrack?.clips.find((c) => {
      const spd = c.speed || 1;
      const effDur = (c.duration - c.trimStart - c.trimEnd) / spd;
      return currentTime >= c.startTime && currentTime < c.startTime + effDur;
    }) ?? null;
    setActivePreviewClip(activeClip);

    if (activeClip && activeClip.type === "video") {
      if (currentVideoSrcRef.current !== activeClip.blobUrl) {
        vid.src = activeClip.blobUrl;
        currentVideoSrcRef.current = activeClip.blobUrl;
      }
      vid.muted = !!videoTrack?.muted;
      vid.playbackRate = activeClip.speed || 1;
      const clipTime = (currentTime - activeClip.startTime) * (activeClip.speed || 1) + activeClip.trimStart;
      if (Math.abs(vid.currentTime - clipTime) > 0.5) vid.currentTime = clipTime;
      if (isPlaying && vid.paused) vid.play().catch(() => {});
      if (!isPlaying && !vid.paused) vid.pause();
    } else {
      if (!vid.paused) vid.pause();
      if (currentVideoSrcRef.current) currentVideoSrcRef.current = "";
    }
  }, [currentTime, isPlaying, tracks]);

  // Sync audio elements
  const activeAudioClipIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const nowActive = new Set<string>();
    for (const track of tracks.filter((t) => t.type === "audio" && !t.muted)) {
      for (const clip of track.clips) {
        const spd = clip.speed || 1;
        const effEnd = clip.startTime + (clip.duration - clip.trimStart - clip.trimEnd) / spd;
        if (currentTime >= clip.startTime && currentTime < effEnd) {
          nowActive.add(clip.id);
          let el = audioRefs.current[clip.id];
          if (!el) { el = new Audio(clip.blobUrl); el.volume = clip.volume; audioRefs.current[clip.id] = el; }
          el.playbackRate = spd;
          const clipTime = (currentTime - clip.startTime) * spd + clip.trimStart;
          if (Math.abs(el.currentTime - clipTime) > 0.5) el.currentTime = clipTime;
          if (isPlaying && el.paused) el.play().catch(() => {});
          if (!isPlaying && !el.paused) el.pause();
        }
      }
    }
    Array.from(activeAudioClipIds.current).forEach((id) => {
      if (!nowActive.has(id) && audioRefs.current[id]) audioRefs.current[id].pause();
    });
    activeAudioClipIds.current = nowActive;
  }, [currentTime, isPlaying, tracks]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space") { e.preventDefault(); setIsPlaying((p) => !p); }
      else if (e.code === "Delete" || e.code === "Backspace") { if (selectedClipId) deleteSelectedClip(); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); setCurrentTime((t) => Math.max(0, t - 1)); }
      else if (e.code === "ArrowRight") { e.preventDefault(); setCurrentTime((t) => Math.min(t + 1, totalDuration)); }
      else if (e.code === "BracketLeft") { setPxPerSecond((p) => Math.max(15, p - 10)); }
      else if (e.code === "BracketRight") { setPxPerSecond((p) => Math.min(120, p + 10)); }
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !e.shiftKey) { e.preventDefault(); undoTracks(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && e.shiftKey) { e.preventDefault(); redoTracks(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") { e.preventDefault(); redoTracks(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") { e.preventDefault(); handleSaveProject(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === "KeyE") { e.preventDefault(); handleExport(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClipId, totalDuration]);

  // ─── Auto-save every 60s ───
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const data = JSON.stringify({ tracks: tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, blobUrl: "" })) })), aspectRatio, savedAt: new Date().toISOString() });
        localStorage.setItem(LS_KEY, data);
      } catch { /* quota */ }
    }, 60000);
    return () => clearInterval(id);
  }, [tracks, aspectRatio]);

  // ═══════════════════════════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════════════════════════

  const loadVoices = useCallback(async () => {
    if (voices.length > 0) return;
    setLoadingVoices(true);
    try { const res = await fetch("/api/video-editor/elevenlabs-voices"); const data = await res.json(); if (data.voices) setVoices(data.voices); } catch {}
    finally { setLoadingVoices(false); }
  }, [voices.length]);

  const handleFileImport = useCallback(async (file: File, type: "video" | "audio" | "image") => {
    const blobUrl = URL.createObjectURL(file);
    let duration = 0, thumbnail = "";
    if (type === "video") { duration = await getVideoDuration(blobUrl); thumbnail = await generateVideoThumbnail(blobUrl); }
    else if (type === "audio") { duration = await getAudioDuration(blobUrl); }
    else { duration = 5; }
    const item: MediaItem = { id: mediaUid(), name: file.name, type, blobUrl, duration, thumbnail, file };
    setMediaItems((prev) => [...prev, item]);
    return item;
  }, []);

  const handleShopeeSearch = useCallback(async () => {
    if (!shopeeUrl.trim()) return;
    setDownloading(true); setDownloadError(""); setShopeeMedia([]); setShopeeProductName("");
    try {
      const res = await fetch("/api/video-editor/download-shopee", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: shopeeUrl, mode: "scrape" }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro");
      const media: { url: string; type: "image" | "video"; label: string }[] = json?.media ?? [];
      if (media.length === 0) throw new Error("Nenhuma mídia encontrada");
      setShopeeMedia(media);
      setShopeeProductName(json?.productName ?? "");
      if (json?.productName) setCopyProductName(json.productName);
    } catch (e) { setDownloadError(e instanceof Error ? e.message : "Erro"); }
    finally { setDownloading(false); }
  }, [shopeeUrl]);

  const handleImportShopeeMedia = useCallback(async (mediaUrl: string, type: "image" | "video") => {
    setImportingMedia(mediaUrl);
    try {
      const res = await fetch("/api/video-editor/download-shopee", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: mediaUrl, mode: "proxy" }) });
      if (!res.ok) throw new Error("Falha");
      const mediaType = (res.headers.get("X-Media-Type") as "video" | "image") || type;
      const blob = await res.blob();
      const ext = mediaType === "video" ? "mp4" : "jpg";
      const file = new File([blob], `shopee_${Date.now()}.${ext}`, { type: blob.type || (mediaType === "video" ? "video/mp4" : "image/jpeg") });
      await handleFileImport(file, mediaType);
    } catch { setDownloadError("Não foi possível importar esta mídia."); }
    finally { setImportingMedia(null); }
  }, [handleFileImport]);

  const handleGenerateCopy = useCallback(async () => {
    if (!copyProductName.trim()) return;
    setGeneratingCopy(true);
    try {
      let videoDuration = 0;
      const vt = tracks[0];
      if (vt?.clips.length) { for (const c of vt.clips) { const end = c.startTime + (c.duration - c.trimStart - c.trimEnd) / (c.speed || 1); if (end > videoDuration) videoDuration = end; } }
      const res = await fetch("/api/video-editor/generate-copy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productName: copyProductName, style: copyStyle, videoDuration }) });
      const data = await res.json();
      if (data.copy) { setGeneratedCopy(data.copy); setTtsText(data.copy); }
    } catch {}
    finally { setGeneratingCopy(false); }
  }, [copyProductName, copyStyle, tracks]);

  const handleGenerateTts = useCallback(async () => {
    if (!ttsText.trim() || !selectedVoiceId) return;
    setGeneratingTts(true);
    try {
      const res = await fetch("/api/video-editor/elevenlabs-tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: ttsText, voiceId: selectedVoiceId }) });
      if (!res.ok) throw new Error("Erro TTS");
      const blob = await res.blob();
      const file = new File([blob], `tts_${Date.now()}.mp3`, { type: "audio/mpeg" });
      const item = await handleFileImport(file, "audio");
      const clip: ClipItem = { id: uid(), mediaId: item.id, name: item.name, type: "audio", blobUrl: item.blobUrl, trackIndex: 1, startTime: 0, duration: item.duration || 10, trimStart: 0, trimEnd: 0, volume: 1 };
      pushTracks(tracks.map((t, i) => i === 1 ? { ...t, clips: [...t.clips, clip] } : t));
    } catch {}
    finally { setGeneratingTts(false); }
  }, [ttsText, selectedVoiceId, handleFileImport, tracks, pushTracks]);

  const addToTimeline = useCallback((item: MediaItem) => {
    const trackIndex = item.type === "video" ? 0 : item.type === "audio" ? 1 : 0;
    const track = tracks[trackIndex];
    const lastEnd = track.clips.reduce((max, c) => Math.max(max, c.startTime + (c.duration - c.trimStart - c.trimEnd) / (c.speed || 1)), 0);
    const clip: ClipItem = { id: uid(), mediaId: item.id, name: item.name, type: item.type, blobUrl: item.blobUrl, trackIndex, startTime: lastEnd, duration: item.duration, trimStart: 0, trimEnd: 0, volume: 1 };
    pushTracks(tracks.map((t, i) => i === trackIndex ? { ...t, clips: [...t.clips, clip] } : t));
  }, [tracks, pushTracks]);

  // ─── Auto-subtitle ───
  const handleAutoSubtitle = useCallback(() => {
    const audioTrack = tracks[1];
    if (!audioTrack?.clips.length) return;
    const audioClip = audioTrack.clips[0];
    const text = ttsText.trim() || generatedCopy.trim();
    if (!text) return;
    setGeneratingSubtitles(true);
    const audioDuration = audioClip.duration - audioClip.trimStart - audioClip.trimEnd;
    const audioStart = audioClip.startTime;
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += subtitleMaxWords) chunks.push(words.slice(i, i + subtitleMaxWords).join(" "));
    if (!chunks.length) { setGeneratingSubtitles(false); return; }
    const totalChars = chunks.reduce((sum, c) => sum + c.length, 0);
    const baseStyle = SUBTITLE_TEMPLATES[subtitleTemplate]?.style;
    const style: SubtitleStyle = { ...baseStyle, fontSize: subtitleFontSize, position: subtitlePosition, color: subtitleFontColor, bgColor: subtitleBgColor, bgOpacity: subtitleBgOpacity, uppercase: subtitleUppercase, outlineColor: subtitleOutlineColor, outlineWidth: subtitleOutlineWidth };
    const newClips: ClipItem[] = [];
    let timeOffset = audioStart;
    for (const chunk of chunks) {
      const dur = Math.max(0.4, (chunk.length / totalChars) * audioDuration);
      newClips.push({ id: uid(), mediaId: "", name: chunk.slice(0, 30), type: "subtitle", blobUrl: "", trackIndex: 3, startTime: timeOffset, duration: dur, trimStart: 0, trimEnd: 0, volume: 1, text: chunk, subtitleStyle: style });
      timeOffset += dur;
    }
    pushTracks(tracks.map((t, i) => i === 3 ? { ...t, clips: newClips } : t));
    setGeneratingSubtitles(false);
  }, [tracks, pushTracks, ttsText, generatedCopy, subtitleTemplate, subtitleFontSize, subtitlePosition, subtitleMaxWords, subtitleUppercase, subtitleFontColor, subtitleBgColor, subtitleBgOpacity, subtitleOutlineColor, subtitleOutlineWidth]);

  // ─── Delete / Split ───
  const deleteSelectedClip = useCallback(() => {
    if (!selectedClipId) return;
    pushTracks(tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== selectedClipId) })));
    setSelectedClipId(null);
  }, [selectedClipId, tracks, pushTracks]);

  const splitAtPlayhead = useCallback(() => {
    if (!selectedClipId) return;
    const newTracks = tracks.map((track) => {
      const clipIdx = track.clips.findIndex((c) => c.id === selectedClipId);
      if (clipIdx === -1) return track;
      const c = track.clips[clipIdx];
      const spd = c.speed || 1;
      const effEnd = c.startTime + (c.duration - c.trimStart - c.trimEnd) / spd;
      if (currentTime <= c.startTime || currentTime >= effEnd) return track;
      const splitPoint = (currentTime - c.startTime) * spd;
      const clip1: ClipItem = { ...c, id: uid(), duration: splitPoint + c.trimStart, trimEnd: 0 };
      const clip2: ClipItem = { ...c, id: uid(), startTime: currentTime, trimStart: splitPoint + c.trimStart, duration: c.duration, trimEnd: c.trimEnd };
      const newClips = [...track.clips];
      newClips.splice(clipIdx, 1, clip1, clip2);
      return { ...track, clips: newClips };
    });
    pushTracks(newTracks);
    setSelectedClipId(null);
  }, [currentTime, selectedClipId, tracks, pushTracks]);

  // ─── Speed control ───
  const updateClipSpeed = useCallback((clipId: string, speed: number) => {
    pushTracks(tracks.map((t) => ({ ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, speed } : c) })));
  }, [tracks, pushTracks]);

  // ─── Filters ───
  const applyFiltersToClip = useCallback((clipId: string, filters: VideoFilters) => {
    pushTracks(tracks.map((t) => ({ ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, filters } : c) })));
  }, [tracks, pushTracks]);

  // ─── Text overlay ───
  const addTextToTimeline = useCallback((text: string, style: TextStyle) => {
    if (!text.trim()) return;
    const lastEnd = tracks[4].clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);
    const clip: ClipItem = { id: uid(), mediaId: "", name: text.slice(0, 20), type: "text", blobUrl: "", trackIndex: 4, startTime: lastEnd, duration: 5, trimStart: 0, trimEnd: 0, volume: 1, text, textStyle: style, posX: 50, posY: 50 };
    pushTracks(tracks.map((t, i) => i === 4 ? { ...t, clips: [...t.clips, clip] } : t));
  }, [tracks, pushTracks]);

  // ─── Stickers ───
  const addStickerToTimeline = useCallback((emoji?: string, badgeText?: string, badgeBg?: string, badgeColor?: string) => {
    const lastEnd = tracks[5].clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);
    const clip: ClipItem = { id: uid(), mediaId: "", name: emoji || badgeText || "sticker", type: "sticker", blobUrl: "", trackIndex: 5, startTime: lastEnd, duration: 5, trimStart: 0, trimEnd: 0, volume: 1, stickerEmoji: emoji, badgeText, badgeBg, badgeColor, posX: 50, posY: 30, overlayWidth: 15 };
    pushTracks(tracks.map((t, i) => i === 5 ? { ...t, clips: [...t.clips, clip] } : t));
  }, [tracks, pushTracks]);

  // ─── Transitions ───
  const setClipTransition = useCallback((clipId: string, transition: Transition) => {
    pushTracks(tracks.map((t) => ({ ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, transition } : c) })));
    setShowTransitionPicker(null);
  }, [tracks, pushTracks]);

  // ─── Drag overlay in preview ───
  const handleOverlayDrag = useCallback((e: React.MouseEvent, clipId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedOverlayId(clipId);
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    if (!clip) return;
    const startX = e.clientX, startY = e.clientY;
    const origX = clip.posX ?? 50, origY = clip.posY ?? 50;
    const snapshot = tracks;

    const onMove = (ev: MouseEvent) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      const nx = Math.max(0, Math.min(100, origX + dx));
      const ny = Math.max(0, Math.min(100, origY + dy));
      setTracks((prev) => prev.map((t) => ({ ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, posX: nx, posY: ny } : c) })));
    };
    const onUp = () => {
      commitTracks(snapshot);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [tracks, setTracks, commitTracks]);

  // ─── Resize overlay width ───
  const handleOverlayResize = useCallback((e: React.MouseEvent, clipId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    if (!clip) return;
    const startX = e.clientX;
    const origWidth = clip.overlayWidth ?? 90;
    const snapshot = tracks;

    const onMove = (ev: MouseEvent) => {
      const dx = ((ev.clientX - startX) / rect.width) * 200;
      const nw = Math.max(20, Math.min(100, origWidth + dx));
      setTracks((prev) => prev.map((t) => ({ ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, overlayWidth: nw } : c) })));
    };
    const onUp = () => {
      commitTracks(snapshot);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [tracks, setTracks, commitTracks]);

  // ─── Trim handles ───
  const handleTrimStart = useCallback((e: React.MouseEvent, clipId: string) => {
    e.stopPropagation(); e.preventDefault();
    const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    if (!clip) return;
    trimSnapshotRef.current = tracks;
    const startX = e.clientX;
    const origTrimStart = clip.trimStart;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dt = dx / pxPerSecond;
      const newTrimStart = Math.max(0, Math.min(origTrimStart + dt, clip.duration - clip.trimEnd - 0.5));
      setTracks((prev) => prev.map((t) => ({ ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, trimStart: newTrimStart, startTime: clip.startTime + (newTrimStart - origTrimStart) / (clip.speed || 1) } : c) })));
    };
    const onUp = () => {
      if (trimSnapshotRef.current) commitTracks(trimSnapshotRef.current);
      trimSnapshotRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [tracks, setTracks, commitTracks, pxPerSecond]);

  const handleTrimEnd = useCallback((e: React.MouseEvent, clipId: string) => {
    e.stopPropagation(); e.preventDefault();
    const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    if (!clip) return;
    trimSnapshotRef.current = tracks;
    const startX = e.clientX;
    const origTrimEnd = clip.trimEnd;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dt = -dx / pxPerSecond;
      const newTrimEnd = Math.max(0, Math.min(origTrimEnd + dt, clip.duration - clip.trimStart - 0.5));
      setTracks((prev) => prev.map((t) => ({ ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, trimEnd: newTrimEnd } : c) })));
    };
    const onUp = () => {
      if (trimSnapshotRef.current) commitTracks(trimSnapshotRef.current);
      trimSnapshotRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [tracks, setTracks, commitTracks, pxPerSecond]);

  // ─── Save / Load ───
  const handleSaveProject = useCallback(() => {
    const project: ProjectData = {
      id: `proj_${Date.now()}`,
      name: projectName,
      tracks: tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, blobUrl: "" })) })),
      aspectRatio,
      settings: { subtitleTemplate, subtitleFontSize, subtitlePosition, subtitleMaxWords, subtitleUppercase, subtitleFontColor, subtitleBgColor, subtitleBgOpacity, subtitleOutlineColor, subtitleOutlineWidth },
      savedAt: new Date().toISOString(),
    };
    try {
      const existing: ProjectData[] = JSON.parse(localStorage.getItem(LS_PROJECTS) || "[]");
      existing.unshift(project);
      localStorage.setItem(LS_PROJECTS, JSON.stringify(existing.slice(0, 20)));
      setSavedProjects(existing.slice(0, 20));
      setShowSaveModal(false);
    } catch { /* quota */ }
  }, [projectName, tracks, aspectRatio, subtitleTemplate, subtitleFontSize, subtitlePosition, subtitleMaxWords, subtitleUppercase, subtitleFontColor, subtitleBgColor, subtitleBgOpacity, subtitleOutlineColor, subtitleOutlineWidth]);

  const handleLoadProject = useCallback((project: ProjectData) => {
    pushTracks(project.tracks);
    setAspectRatio(project.aspectRatio);
    const s = project.settings as Record<string, number | string | boolean>;
    if (s.subtitleTemplate != null) setSubtitleTemplate(s.subtitleTemplate as number);
    if (s.subtitleFontSize != null) setSubtitleFontSize(s.subtitleFontSize as number);
    if (s.subtitlePosition) setSubtitlePosition(s.subtitlePosition as "bottom" | "center" | "top");
    if (s.subtitleMaxWords != null) setSubtitleMaxWords(s.subtitleMaxWords as number);
    if (s.subtitleUppercase != null) setSubtitleUppercase(s.subtitleUppercase as boolean);
    if (s.subtitleFontColor) setSubtitleFontColor(s.subtitleFontColor as string);
    if (s.subtitleBgColor) setSubtitleBgColor(s.subtitleBgColor as string);
    if (s.subtitleBgOpacity != null) setSubtitleBgOpacity(s.subtitleBgOpacity as number);
    if (s.subtitleOutlineColor) setSubtitleOutlineColor(s.subtitleOutlineColor as string);
    if (s.subtitleOutlineWidth != null) setSubtitleOutlineWidth(s.subtitleOutlineWidth as number);
    setProjectName(project.name);
    setShowSaveModal(false);
  }, [pushTracks]);

  const loadSavedProjects = useCallback(() => {
    try { setSavedProjects(JSON.parse(localStorage.getItem(LS_PROJECTS) || "[]")); } catch { setSavedProjects([]); }
  }, []);

  const handleDeleteProject = useCallback((id: string) => {
    try {
      const existing: ProjectData[] = JSON.parse(localStorage.getItem(LS_PROJECTS) || "[]");
      const filtered = existing.filter((p) => p.id !== id);
      localStorage.setItem(LS_PROJECTS, JSON.stringify(filtered));
      setSavedProjects(filtered);
    } catch {}
  }, []);

  // ─── FFmpeg Export ───
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current && ffmpegLoaded) return ffmpegRef.current;
    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => setExportProgress(Math.round(Math.min(progress, 1) * 100)));
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({ coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"), wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm") });
    ffmpegRef.current = ffmpeg;
    setFfmpegLoaded(true);
    return ffmpeg;
  }, [ffmpegLoaded]);

  const handleExport = useCallback(async () => {
    setExporting(true); setExportProgress(0); setExportError("");
    try {
      const ffmpeg = await loadFFmpeg();
      const videoTrack = tracks[0];
      if (!videoTrack?.clips.length) throw new Error("Nenhum clipe na faixa de vídeo.");
      const sortedClips = [...videoTrack.clips].sort((a, b) => a.startTime - b.startTime);

      // Write all video/image clips
      for (let i = 0; i < sortedClips.length; i++) {
        const clip = sortedClips[i];
        if (!clip.blobUrl) throw new Error(`Clipe ${i + 1} sem mídia.`);
        const res = await fetch(clip.blobUrl);
        const data = await res.arrayBuffer();
        const isImg = clip.type === "image";
        const ext = isImg ? "png" : "mp4";
        await ffmpeg.writeFile(`v${i}.${ext}`, new Uint8Array(data));
      }

      // Write audio
      const audioClips = tracks.filter((t) => t.type === "audio" && !t.muted).flatMap((t) => t.clips).filter((c) => c.blobUrl);
      let hasAudio = false;
      if (audioClips.length > 0) {
        const res = await fetch(audioClips[0].blobUrl);
        const data = await res.arrayBuffer();
        await ffmpeg.writeFile("audio.mp3", new Uint8Array(data));
        hasAudio = true;
      }

      let args: string[];

      if (sortedClips.length === 1) {
        const clip = sortedClips[0];
        const isImg = clip.type === "image";
        const spd = clip.speed || 1;
        const effDur = Math.max(0.1, (clip.duration - clip.trimStart - clip.trimEnd) / spd);
        const ext = isImg ? "png" : "mp4";

        if (isImg) {
          args = ["-loop", "1", "-i", `v0.${ext}`, "-t", String(effDur), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-pix_fmt", "yuv420p", "-r", "30"];
        } else {
          args = ["-i", `v0.${ext}`];
          if (clip.trimStart > 0) args.push("-ss", String(clip.trimStart));
          args.push("-t", String(effDur));
          if (spd !== 1) args.push("-filter:v", `setpts=PTS/${spd}`);
        }

        if (hasAudio) {
          args.push("-i", "audio.mp3", "-map", "0:v", "-map", "1:a", "-shortest");
        } else if (videoTrack.muted) { args.push("-an"); }

        // Subtitle burn-in using drawtext
        const subClips = tracks[3]?.clips.filter((c) => c.text) ?? [];
        if (subClips.length > 0) {
          const drawTexts = subClips.map((sc) => {
            const s = sc.subtitleStyle;
            const yPos = s?.position === "top" ? "h*0.08" : s?.position === "center" ? "(h-text_h)/2" : "h*0.88-text_h";
            const txt = sc.text!.replace(/'/g, "\u2019").replace(/:/g, "\\:");
            return `drawtext=text='${txt}':fontsize=${s?.fontSize ?? 28}:fontcolor=${s?.color ?? "white"}:x=(w-text_w)/2:y=${yPos}:enable='between(t,${sc.startTime.toFixed(2)},${(sc.startTime + sc.duration).toFixed(2)})'`;
          }).join(",");

          const existingVf = args.findIndex((a) => a === "-filter:v" || a === "-vf");
          if (existingVf !== -1) { args[existingVf + 1] += `,${drawTexts}`; }
          else { args.push("-vf", drawTexts); }
        }

        if (hasAudio) args.push("-c:a", "aac");
        args.push("-c:v", "libx264", "-preset", "fast", "-crf", "23", "output.mp4");
      } else {
        // Multi-clip: use concat
        const concatParts: string[] = [];
        for (let i = 0; i < sortedClips.length; i++) {
          const clip = sortedClips[i];
          const isImg = clip.type === "image";
          const spd = clip.speed || 1;
          const effDur = Math.max(0.1, (clip.duration - clip.trimStart - clip.trimEnd) / spd);
          const ext = isImg ? "png" : "mp4";

          if (isImg) {
            const tmpArgs = ["-loop", "1", "-i", `v${i}.${ext}`, "-t", String(effDur), "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1", "-pix_fmt", "yuv420p", "-r", "30", "-an", "-c:v", "libx264", "-preset", "fast", `seg${i}.mp4`];
            await ffmpeg.exec(tmpArgs);
          } else {
            const tmpArgs = ["-i", `v${i}.${ext}`];
            if (clip.trimStart > 0) tmpArgs.push("-ss", String(clip.trimStart));
            tmpArgs.push("-t", String(effDur));
            let vf = "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1";
            if (spd !== 1) vf += `,setpts=PTS/${spd}`;
            tmpArgs.push("-vf", vf, "-pix_fmt", "yuv420p", "-r", "30", "-an", "-c:v", "libx264", "-preset", "fast", `seg${i}.mp4`);
            await ffmpeg.exec(tmpArgs);
          }
          concatParts.push(`file 'seg${i}.mp4'`);
        }

        await ffmpeg.writeFile("concat.txt", concatParts.join("\n"));
        args = ["-f", "concat", "-safe", "0", "-i", "concat.txt"];

        if (hasAudio) { args.push("-i", "audio.mp3", "-map", "0:v", "-map", "1:a", "-shortest"); }
        else { args.push("-an"); }

        // Subtitle burn-in
        const subClips = tracks[3]?.clips.filter((c) => c.text) ?? [];
        if (subClips.length > 0) {
          const drawTexts = subClips.map((sc) => {
            const s = sc.subtitleStyle;
            const yPos = s?.position === "top" ? "h*0.08" : s?.position === "center" ? "(h-text_h)/2" : "h*0.88-text_h";
            const txt = sc.text!.replace(/'/g, "\u2019").replace(/:/g, "\\:");
            return `drawtext=text='${txt}':fontsize=${s?.fontSize ?? 28}:fontcolor=${s?.color ?? "white"}:x=(w-text_w)/2:y=${yPos}:enable='between(t,${sc.startTime.toFixed(2)},${(sc.startTime + sc.duration).toFixed(2)})'`;
          }).join(",");
          args.push("-vf", drawTexts);
        }

        if (hasAudio) args.push("-c:a", "aac");
        args.push("-c:v", "libx264", "-preset", "fast", "-crf", "23", "output.mp4");
      }

      await ffmpeg.exec(args);
      const output = await ffmpeg.readFile("output.mp4");
      const blob = new Blob([output as BlobPart], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `video_editado_${Date.now()}.mp4`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { setExportError(e instanceof Error ? e.message : "Erro ao exportar"); console.error("Export error:", e); }
    finally { setExporting(false); setExportProgress(0); }
  }, [tracks, loadFFmpeg]);

  // ═══════════════════════════════════════════════════════════
  // Computed values
  // ═══════════════════════════════════════════════════════════

  const activeSubtitle = tracks[3]?.clips.find((c) => currentTime >= c.startTime && currentTime < c.startTime + (c.duration - c.trimStart - c.trimEnd));
  const activeTexts = tracks[4]?.clips.filter((c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration) ?? [];
  const activeStickers = tracks[5]?.clips.filter((c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration) ?? [];
  const activeVideoClip = tracks[0]?.clips.find((c) => {
    const spd = c.speed || 1;
    return currentTime >= c.startTime && currentTime < c.startTime + (c.duration - c.trimStart - c.trimEnd) / spd;
  });
  const activeVideoFilters = activeVideoClip?.filters;
  const videoFilterCss = activeVideoFilters ? buildCssFilter(activeVideoFilters) : "none";

  // Transition progress for video
  let videoTransitionStyle: React.CSSProperties = {};
  if (activeVideoClip?.transition && activeVideoClip.transition.type !== "none") {
    const elapsed = currentTime - activeVideoClip.startTime;
    const progress = elapsed / activeVideoClip.transition.duration;
    if (progress < 1) videoTransitionStyle = getTransitionCss(activeVideoClip.transition, progress);
  }

  // ─── Snap helper for drops ───
  const snapToEdge = (targetClips: ClipItem[], clipDur: number, dropX: number, excludeId?: string) => {
    const edges: number[] = [0];
    targetClips.forEach((c) => {
      if (c.id === excludeId) return;
      const effDur = (c.duration - c.trimStart - c.trimEnd) / (c.speed || 1);
      edges.push(c.startTime, c.startTime + effDur);
    });
    let best = dropX, bestDist = Infinity;
    for (const edge of edges) {
      const d1 = Math.abs(dropX - edge);
      const d2 = Math.abs(dropX + clipDur - edge);
      if (d1 < bestDist) { bestDist = d1; best = edge; }
      if (d2 < bestDist) { bestDist = d2; best = edge - clipDur; }
    }
    return Math.max(0, best);
  };

  // Tab config
  const PANEL_TABS: { key: PanelKey; label: string; icon: React.ReactNode }[] = [
    { key: "media", label: "Mídia", icon: <FileVideo className="h-3.5 w-3.5" /> },
    { key: "copy", label: "IA", icon: <Wand2 className="h-3.5 w-3.5" /> },
    { key: "tts", label: "Voz IA", icon: <Mic className="h-3.5 w-3.5" /> },
    { key: "subtitle", label: "Legendas", icon: <Type className="h-3.5 w-3.5" /> },
    { key: "text", label: "Texto", icon: <ALargeSmall className="h-3.5 w-3.5" /> },
    // Hidden for now - will be improved later
    // { key: "stickers", label: "Stickers", icon: <Smile className="h-3.5 w-3.5" /> },
    // { key: "filters", label: "Filtros", icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
  ];

  // Track colors
  const CLIP_COLORS: Record<string, string> = {
    video: "bg-blue-600/70 border-blue-400", audio: "bg-emerald-600/70 border-emerald-400",
    image: "bg-purple-600/70 border-purple-400", subtitle: "bg-yellow-600/70 border-yellow-400",
    text: "bg-pink-600/70 border-pink-400", sticker: "bg-orange-600/70 border-orange-400",
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[900px] gap-0">
      {/* ─── TOOLBAR ─── */}
      <div className="flex items-center justify-between px-4 py-2 bg-dark-card border-b border-dark-border rounded-t-xl">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-shopee-orange" />
          <h1 className="text-lg font-bold text-text-primary">Editor de Vídeo</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={undoTracks} disabled={!canUndo} className="p-1.5 rounded-lg border border-dark-border text-text-secondary hover:text-shopee-orange disabled:opacity-30 transition-colors" title="Desfazer (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></button>
          <button onClick={redoTracks} disabled={!canRedo} className="p-1.5 rounded-lg border border-dark-border text-text-secondary hover:text-shopee-orange disabled:opacity-30 transition-colors" title="Refazer (Ctrl+Y)"><Redo2 className="h-3.5 w-3.5" /></button>
          <div className="w-px h-5 bg-dark-border mx-1" />
          <button onClick={splitAtPlayhead} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dark-border text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/50 transition-colors" title="Cortar (no playhead)"><Scissors className="h-3.5 w-3.5" /> Cortar</button>
          <button onClick={deleteSelectedClip} disabled={!selectedClipId} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dark-border text-text-secondary hover:text-red-400 hover:border-red-400/50 disabled:opacity-30 transition-colors"><Trash2 className="h-3.5 w-3.5" /> Excluir</button>
          {/* Speed control for selected video/audio clip */}
          {selectedClip && (selectedClip.type === "video" || selectedClip.type === "audio") && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-dark-border">
              <Gauge className="h-3 w-3 text-text-secondary" />
              <select value={selectedClip.speed || 1} onChange={(e) => updateClipSpeed(selectedClip.id, Number(e.target.value))} className="bg-transparent text-text-primary text-xs outline-none cursor-pointer">
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((s) => <option key={s} value={s}>{s}x</option>)}
              </select>
            </div>
          )}
          <div className="w-px h-5 bg-dark-border mx-1" />
          <button onClick={() => { setShowSaveModal(true); loadSavedProjects(); }} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dark-border text-text-secondary hover:text-shopee-orange transition-colors" title="Salvar/Carregar (Ctrl+S)"><Save className="h-3.5 w-3.5" /> Projeto</button>
          <button onClick={handleExport} disabled={exporting || tracks[0].clips.length === 0} className="flex items-center gap-1 px-4 py-1.5 text-xs rounded-lg bg-shopee-orange text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-colors">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? `Exportando ${exportProgress}%` : "Exportar"}
          </button>
        </div>
      </div>

      {/* ─── MAIN: Left Panel + Preview ─── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel */}
        <div className="w-[364px] min-w-0 flex-shrink-0 bg-dark-card border-r border-dark-border flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-dark-border">
            {PANEL_TABS.map((tab) => (
              <button key={tab.key} onClick={() => { setActivePanel(tab.key); if (tab.key === "tts") loadVoices(); }}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-medium transition-colors ${activePanel === tab.key ? "text-shopee-orange border-b-2 border-shopee-orange bg-shopee-orange/5" : "text-text-secondary hover:text-text-primary"}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-shopee p-3 space-y-3">
            {/* ═══ MEDIA PANEL ═══ */}
            {activePanel === "media" && (
              <>
                <div className="space-y-2">
                  <label className="block text-xs text-text-secondary font-medium">Importar da Shopee</label>
                  <div className="flex gap-2">
                    <input type="text" value={shopeeUrl} onChange={(e) => { setShopeeUrl(e.target.value); if (!e.target.value) { setShopeeMedia([]); setShopeeProductName(""); } }} placeholder="Cole o link do produto Shopee" className="flex-1 px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs focus:outline-none focus:border-shopee-orange" />
                    <button onClick={handleShopeeSearch} disabled={downloading || !shopeeUrl.trim()} className="px-3 py-1.5 rounded-lg bg-shopee-orange text-white text-xs font-medium hover:opacity-90 disabled:opacity-50">
                      {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {downloadError && <p className="text-xs text-red-400">{downloadError}</p>}
                  {shopeeProductName && <p className="text-xs text-shopee-orange font-medium truncate">{shopeeProductName}</p>}
                  {shopeeMedia.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 text-[10px] text-text-secondary">
                        <span className="bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded">{shopeeMedia.filter((m) => m.type === "video").length} vídeos</span>
                        <span className="bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded">{shopeeMedia.filter((m) => m.type === "image").length} imagens</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {shopeeMedia.map((m, i) => (
                          <button key={i} onClick={() => handleImportShopeeMedia(m.url, m.type)} disabled={importingMedia === m.url}
                            className={`relative group rounded border overflow-hidden hover:border-shopee-orange transition-colors aspect-square bg-dark-bg ${m.type === "video" ? "border-blue-500/50" : "border-dark-border"}`}
                          >
                            {m.type === "video" ? <div className="w-full h-full flex flex-col items-center justify-center bg-blue-900/30"><Play className="h-4 w-4 text-blue-300 mb-0.5" /><span className="text-[8px] text-blue-300">MP4</span></div>
                              : <img src={m.url} alt={m.label} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                            {importingMedia === m.url ? <div className="absolute inset-0 flex items-center justify-center bg-black/60"><Loader2 className="h-4 w-4 animate-spin text-shopee-orange" /></div>
                              : <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"><Download className="h-4 w-4 text-white" /></div>}
                            <span className="absolute bottom-0 left-0 right-0 text-[7px] text-white bg-black/70 px-0.5 py-0.5 truncate">{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t border-dark-border pt-3 space-y-2">
                  <label className="block text-xs text-text-secondary font-medium">Importar arquivo</label>
                  <div className="flex gap-2">
                    <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleFileImport(f, "video"); e.target.value = ""; }} />
                    <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleFileImport(f, "audio"); e.target.value = ""; }} />
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleFileImport(f, "image"); e.target.value = ""; }} />
                    <button onClick={() => videoInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-dashed border-dark-border text-text-secondary text-xs hover:border-shopee-orange hover:text-shopee-orange transition-colors"><FileVideo className="h-3.5 w-3.5" /> Vídeo</button>
                    <button onClick={() => audioInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-dashed border-dark-border text-text-secondary text-xs hover:border-shopee-orange hover:text-shopee-orange transition-colors"><Music className="h-3.5 w-3.5" /> Áudio</button>
                    <button onClick={() => imageInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-dashed border-dark-border text-text-secondary text-xs hover:border-shopee-orange hover:text-shopee-orange transition-colors"><ImageIcon className="h-3.5 w-3.5" /> Imagem</button>
                  </div>
                </div>

                <div className="border-t border-dark-border pt-3">
                  <label className="block text-xs text-text-secondary font-medium mb-2">Biblioteca ({mediaItems.length})</label>
                  {mediaItems.length === 0 ? <p className="text-xs text-text-secondary/60 text-center py-4">Importe para começar.</p> : (
                    <div className="space-y-1.5">
                      {mediaItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border border-dark-border bg-dark-bg hover:border-shopee-orange/50 cursor-grab group transition-colors active:cursor-grabbing"
                          draggable onDragStart={(e) => { e.dataTransfer.setData("text/media-id", item.id); e.dataTransfer.effectAllowed = "copy"; }} onClick={() => addToTimeline(item)} title="Arraste ou clique para adicionar"
                        >
                          {item.thumbnail ? <img src={item.thumbnail} alt="" className="w-12 h-7 rounded object-cover flex-shrink-0" /> : <div className="w-12 h-7 rounded bg-dark-card flex items-center justify-center flex-shrink-0">{item.type === "audio" ? <Music className="h-3 w-3 text-text-secondary" /> : <ImageIcon className="h-3 w-3 text-text-secondary" />}</div>}
                          <div className="min-w-0 flex-1"><p className="text-xs text-text-primary truncate">{item.name}</p><p className="text-[10px] text-text-secondary">{item.duration > 0 ? `${item.duration.toFixed(1)}s` : item.type}</p></div>
                          <Plus className="h-3.5 w-3.5 text-text-secondary opacity-0 group-hover:opacity-100" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══ COPY (IA) PANEL ═══ */}
            {activePanel === "copy" && (
              <div className="space-y-3">
                <div><label className="block text-xs text-text-secondary font-medium mb-1">Nome do produto</label><input type="text" value={copyProductName} onChange={(e) => setCopyProductName(e.target.value)} placeholder="Ex: Fone Bluetooth TWS" className="w-full px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs focus:outline-none focus:border-shopee-orange" /></div>
                <div><label className="block text-xs text-text-secondary font-medium mb-1">Estilo</label>
                  <select value={copyStyle} onChange={(e) => setCopyStyle(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs focus:outline-none focus:border-shopee-orange">
                    <option value="vendas">Venda persuasiva</option><option value="urgencia">Urgência / Escassez</option><option value="humor">Humor / Viral</option>
                  </select>
                </div>
                <button onClick={handleGenerateCopy} disabled={generatingCopy || !copyProductName.trim()} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-shopee-orange text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50">
                  {generatingCopy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Gerar Copy com IA
                </button>
                {generatedCopy && (
                  <div className="bg-dark-bg border border-dark-border rounded-lg p-3">
                    <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{generatedCopy}</p>
                    <button onClick={() => { setTtsText(generatedCopy); setActivePanel("tts"); loadVoices(); }} className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-shopee-orange text-white text-xs font-semibold hover:opacity-90">
                      <Mic className="h-3.5 w-3.5" /> Usar como texto para Voz IA
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ═══ TTS PANEL ═══ */}
            {activePanel === "tts" && (
              <div className="space-y-3">
                <div><label className="block text-xs text-text-secondary font-medium mb-1">Texto para narração</label><textarea value={ttsText} onChange={(e) => setTtsText(e.target.value)} placeholder="Cole ou digite o texto..." rows={4} className="w-full px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs focus:outline-none focus:border-shopee-orange resize-y" /></div>
                <div><label className="block text-xs text-text-secondary font-medium mb-1">Voz</label>
                  {loadingVoices ? <p className="text-xs text-text-secondary flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Carregando vozes...</p> : (
                    <select value={selectedVoiceId} onChange={(e) => setSelectedVoiceId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs focus:outline-none focus:border-shopee-orange">
                      <option value="">Selecione uma voz</option>
                      {voices.map((v) => <option key={v.voice_id} value={v.voice_id}>{v.name} {v.labels?.accent ? `(${v.labels.accent})` : ""}</option>)}
                    </select>
                  )}
                </div>
                <button onClick={handleGenerateTts} disabled={generatingTts || !ttsText.trim() || !selectedVoiceId} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50">
                  {generatingTts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />} Gerar áudio com voz IA
                </button>
              </div>
            )}

            {/* ═══ SUBTITLE PANEL ═══ */}
            {activePanel === "subtitle" && (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-medium text-text-primary mb-2">Estilo base</p>
                  <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {SUBTITLE_TEMPLATES.map((tpl, i) => (
                      <button key={tpl.name} onClick={() => { setSubtitleTemplate(i); setSubtitleFontSize(tpl.style.fontSize); setSubtitlePosition(tpl.style.position); setSubtitleFontColor(tpl.style.color);
                        const bg = tpl.style.bgColor;
                        if (bg === "transparent") { setSubtitleBgColor("#000000"); setSubtitleBgOpacity(0); }
                        else if (bg.startsWith("rgba")) { const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (m) setSubtitleBgColor(`#${Number(m[1]).toString(16).padStart(2,"0")}${Number(m[2]).toString(16).padStart(2,"0")}${Number(m[3]).toString(16).padStart(2,"0")}`); const am = bg.match(/,\s*([\d.]+)\)/); setSubtitleBgOpacity(am ? Number(am[1]) : 0.7); }
                        else { setSubtitleBgColor(bg); setSubtitleBgOpacity(1); }
                        setSubtitleUppercase(!!tpl.style.uppercase); setSubtitleOutlineColor(tpl.style.outlineColor ?? "#000000"); setSubtitleOutlineWidth(tpl.style.outlineWidth ?? 1);
                      }}
                        className={`px-1.5 py-1.5 rounded-md border text-[10px] text-center transition-all ${subtitleTemplate === i ? "border-shopee-orange bg-shopee-orange/15 text-shopee-orange ring-1 ring-shopee-orange/30" : "border-dark-border/80 text-text-secondary hover:border-dark-border hover:bg-dark-bg/50"}`}
                      >
                        <span className="block truncate" style={{ fontFamily: tpl.style.fontFamily, color: tpl.style.color, fontWeight: tpl.style.bold ? "bold" : "normal", WebkitTextStroke: tpl.style.outline ? "0.5px #000" : "none" }}>{tpl.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-1">
                  <p className="text-[10px] text-text-secondary/80 mb-2">Áudio da faixa 1 + texto Copy/TTS.</p>
                  <button onClick={handleAutoSubtitle} disabled={generatingSubtitles || tracks[1]?.clips.length === 0 || (!ttsText.trim() && !generatedCopy.trim())} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                    {generatingSubtitles ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Gerar Legenda Automática
                  </button>
                </div>
              </div>
            )}

            {/* ═══ TEXT OVERLAY PANEL ═══ */}
            {activePanel === "text" && (
              <div className="space-y-4">
                <p className="text-[11px] font-medium text-text-primary">Templates de Texto</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TEXT_TEMPLATES.map((tpl, i) => (
                    <button key={tpl.name} onClick={() => setTextTemplate(i)}
                      className={`p-2 rounded-lg border text-center transition-all ${textTemplate === i ? "border-shopee-orange bg-shopee-orange/10" : "border-dark-border hover:border-dark-border"}`}
                    >
                      <span className="block text-xs font-medium" style={{ color: tpl.style.color, fontFamily: tpl.style.fontFamily, fontWeight: tpl.style.bold ? "bold" : "normal", textShadow: tpl.style.shadow ? "1px 1px 3px rgba(0,0,0,0.8)" : "none" }}>{tpl.name}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs text-text-secondary font-medium mb-1">Texto</label>
                  <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Digite o texto..." rows={3} className="w-full px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs focus:outline-none focus:border-shopee-orange resize-y" />
                </div>
                <button onClick={() => { addTextToTimeline(textInput, TEXT_TEMPLATES[textTemplate].style); setTextInput(""); }} disabled={!textInput.trim()} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-pink-600 text-white text-xs font-semibold hover:bg-pink-500 disabled:opacity-50 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Adicionar Texto ao Vídeo
                </button>
                <p className="text-[10px] text-text-secondary/80">Arraste o texto no preview para posicionar.</p>
              </div>
            )}

            {/* ═══ STICKERS PANEL ═══ */}
            {activePanel === "stickers" && (
              <div className="space-y-4">
                <div className="flex gap-1.5 flex-wrap">
                  {STICKER_CATEGORIES.map((cat, i) => (
                    <button key={cat.name} onClick={() => setStickerCategory(i)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${stickerCategory === i ? "bg-shopee-orange text-white" : "bg-dark-bg text-text-secondary border border-dark-border hover:border-shopee-orange/50"}`}
                    >{cat.name}</button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {STICKER_CATEGORIES[stickerCategory]?.stickers.map((s) => (
                    <button key={s.id}
                      onClick={() => s.badge ? addStickerToTimeline(undefined, s.label, s.bgColor, s.textColor) : addStickerToTimeline(s.emoji)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg border border-dark-border hover:border-shopee-orange bg-dark-bg hover:bg-dark-bg/80 transition-colors"
                    >
                      {s.badge ? (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: s.bgColor, color: s.textColor }}>{s.label}</span>
                      ) : (
                        <span className="text-2xl">{s.emoji}</span>
                      )}
                      <span className="text-[8px] text-text-secondary truncate w-full text-center">{s.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-text-secondary/80">Clique para adicionar. Arraste no preview para posicionar.</p>
              </div>
            )}

            {/* ═══ FILTERS PANEL ═══ */}
            {activePanel === "filters" && (
              <div className="space-y-4">
                {!selectedClip || (selectedClip.type !== "video" && selectedClip.type !== "image") ? (
                  <p className="text-xs text-text-secondary text-center py-4">Selecione um clipe de vídeo/imagem na timeline para aplicar filtros.</p>
                ) : (
                  <>
                    <div>
                      <p className="text-[11px] font-medium text-text-primary mb-2">Presets</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {FILTER_PRESETS.map((fp) => (
                          <button key={fp.name} onClick={() => { setClipFilters({ ...fp.filters }); applyFiltersToClip(selectedClip.id, fp.filters); }}
                            className="px-2 py-1.5 rounded-md border border-dark-border text-[10px] text-text-secondary hover:border-shopee-orange hover:text-shopee-orange transition-colors"
                          >{fp.name}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-text-primary">Ajustes</p>
                      {([
                        { key: "brightness" as const, label: "Brilho", min: 0.5, max: 1.5, step: 0.05 },
                        { key: "contrast" as const, label: "Contraste", min: 0.5, max: 2, step: 0.05 },
                        { key: "saturation" as const, label: "Saturação", min: 0, max: 2, step: 0.05 },
                        { key: "hue" as const, label: "Matiz", min: 0, max: 360, step: 5 },
                        { key: "blur" as const, label: "Blur", min: 0, max: 10, step: 0.5 },
                        { key: "grayscale" as const, label: "P&B", min: 0, max: 1, step: 0.1 },
                        { key: "sepia" as const, label: "Sépia", min: 0, max: 1, step: 0.1 },
                      ] as const).map(({ key, label, min, max, step }) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-[10px] text-text-secondary w-16 shrink-0">{label}</span>
                          <input type="range" min={min} max={max} step={step} value={clipFilters[key]} onChange={(e) => { const v = Number(e.target.value); const f = { ...clipFilters, [key]: v }; setClipFilters(f); applyFiltersToClip(selectedClip.id, f); }} className="flex-1 accent-shopee-orange h-1.5" />
                          <span className="text-[10px] text-text-secondary w-8 text-right tabular-nums">{clipFilters[key].toFixed(key === "hue" ? 0 : 1)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ PREVIEW ═══ */}
        <div className="flex-1 min-w-0 bg-dark-bg flex flex-col items-center justify-center p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-text-secondary">Proporção:</span>
            {ASPECT_RATIOS.map((ar) => (
              <button key={ar.value} onClick={() => setAspectRatio(ar.value)}
                className={`px-2 py-1 text-[10px] rounded border transition-colors ${aspectRatio === ar.value ? "border-shopee-orange text-shopee-orange bg-shopee-orange/10" : "border-dark-border text-text-secondary hover:border-shopee-orange/50"}`}
              >{ar.label}</button>
            ))}
          </div>
          <div ref={previewRef} className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio, maxWidth: aspectRatio === "9/16" || aspectRatio === "3/4" ? "280px" : "560px", width: "100%" }}
            onClick={() => setSelectedOverlayId(null)}
          >
            {/* Video/Image with filters + transitions */}
            <div style={{ ...videoTransitionStyle, filter: videoFilterCss, width: "100%", height: "100%" }}>
              <video ref={videoRef} className="w-full h-full object-contain" style={{ display: activePreviewClip?.type === "image" ? "none" : "block" }} playsInline />
              {activePreviewClip?.type === "image" && activePreviewClip.blobUrl && <img src={activePreviewClip.blobUrl} alt="" className="absolute inset-0 w-full h-full object-contain" />}
            </div>

            {/* Subtitle overlay (draggable + resizable) */}
            {activeSubtitle?.text && activeSubtitle.subtitleStyle && (() => {
              const s = activeSubtitle.subtitleStyle;
              let bg = s.bgColor;
              if (s.bgOpacity != null) { if (s.bgOpacity === 0) bg = "transparent"; else if (/^#[0-9A-Fa-f]{6}$/.test(s.bgColor)) { const r = parseInt(s.bgColor.slice(1, 3), 16), g = parseInt(s.bgColor.slice(3, 5), 16), b = parseInt(s.bgColor.slice(5, 7), 16); bg = `rgba(${r},${g},${b},${s.bgOpacity})`; } }
              const hasDragPos = activeSubtitle.posX != null && activeSubtitle.posY != null;
              const defaultTop = s.position === "top" ? 8 : s.position === "center" ? 45 : 85;
              const subWidth = activeSubtitle.overlayWidth ?? 90;
              return (
                <div
                  className={`absolute cursor-move select-none flex justify-center ${selectedOverlayId === activeSubtitle.id ? "ring-2 ring-shopee-orange ring-offset-1 ring-offset-transparent rounded" : ""}`}
                  style={{
                    left: `${hasDragPos ? (activeSubtitle.posX ?? 50) : 50}%`,
                    top: hasDragPos ? `${activeSubtitle.posY ?? defaultTop}%` : (s.position === "bottom" ? undefined : `${defaultTop}%`),
                    bottom: !hasDragPos && s.position === "bottom" ? "8%" : undefined,
                    width: `${subWidth}%`,
                    transform: "translateX(-50%)",
                    zIndex: 9,
                  }}
                  onMouseDown={(e) => { if ((e.target as HTMLElement).dataset.resizeHandle) return; handleOverlayDrag(e, activeSubtitle.id); }}
                  onClick={(e) => { e.stopPropagation(); setSelectedOverlayId(activeSubtitle.id); }}
                >
                  <span style={{ fontFamily: s.fontFamily, fontSize: `${s.fontSize}px`, color: s.color, background: bg, fontWeight: s.bold ? "bold" : "normal", WebkitTextStroke: s.outline ? `${s.outlineWidth ?? 1}px ${s.outlineColor ?? "#000"}` : "none", textTransform: s.uppercase ? "uppercase" : "none", padding: "4px 12px", borderRadius: "6px", textAlign: "center", display: "block", width: "100%", wordBreak: "break-word" }}>{activeSubtitle.text}</span>
                  {/* Resize handle (right edge) */}
                  {selectedOverlayId === activeSubtitle.id && (
                    <div
                      data-resize-handle="true"
                      className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-8 bg-shopee-orange/80 rounded-full cursor-ew-resize hover:bg-shopee-orange"
                      onMouseDown={(e) => handleOverlayResize(e, activeSubtitle.id)}
                    />
                  )}
                </div>
              );
            })()}

            {/* Text overlays (draggable) */}
            {activeTexts.map((tc) => {
              const ts = tc.textStyle;
              if (!ts || !tc.text) return null;
              let bg = "transparent";
              if (ts.bgOpacity > 0 && ts.bgColor) { const r = parseInt(ts.bgColor.slice(1, 3), 16), g = parseInt(ts.bgColor.slice(3, 5), 16), b = parseInt(ts.bgColor.slice(5, 7), 16); bg = `rgba(${r},${g},${b},${ts.bgOpacity})`; }
              return (
                <div key={tc.id} className={`absolute cursor-move select-none ${selectedOverlayId === tc.id ? "ring-2 ring-shopee-orange ring-offset-1 ring-offset-transparent" : ""}`}
                  style={{ left: `${(tc.posX ?? 50) - 10}%`, top: `${(tc.posY ?? 50) - 5}%`, transform: tc.rotation ? `rotate(${tc.rotation}deg)` : undefined, zIndex: 10 }}
                  onMouseDown={(e) => handleOverlayDrag(e, tc.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedOverlayId(tc.id); }}
                >
                  <span style={{ fontFamily: ts.fontFamily, fontSize: `${ts.fontSize}px`, color: ts.color, background: bg, fontWeight: ts.bold ? "bold" : "normal", fontStyle: ts.italic ? "italic" : "normal", textShadow: ts.shadow ? "2px 2px 4px rgba(0,0,0,0.8)" : "none", textAlign: ts.alignment, padding: "4px 12px", borderRadius: "6px", whiteSpace: "nowrap" }}>{tc.text}</span>
                </div>
              );
            })}

            {/* Sticker overlays (draggable) */}
            {activeStickers.map((sc) => (
              <div key={sc.id} className={`absolute cursor-move select-none ${selectedOverlayId === sc.id ? "ring-2 ring-shopee-orange ring-offset-1 ring-offset-transparent" : ""}`}
                style={{ left: `${(sc.posX ?? 50) - 5}%`, top: `${(sc.posY ?? 30) - 5}%`, transform: sc.rotation ? `rotate(${sc.rotation}deg)` : undefined, zIndex: 11 }}
                onMouseDown={(e) => handleOverlayDrag(e, sc.id)}
                onClick={(e) => { e.stopPropagation(); setSelectedOverlayId(sc.id); }}
              >
                {sc.badgeText ? (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-md shadow-lg" style={{ background: sc.badgeBg || "#FF0000", color: sc.badgeColor || "#FFF" }}>{sc.badgeText}</span>
                ) : (
                  <span style={{ fontSize: `${sc.overlayWidth ? sc.overlayWidth * 2 : 40}px`, lineHeight: 1 }}>{sc.stickerEmoji}</span>
                )}
              </div>
            ))}

            {/* Empty state */}
            {tracks[0]?.clips.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-text-secondary/40">
                <Upload className="h-12 w-12 mb-2" /><p className="text-sm">Importe um vídeo para começar</p>
              </div>
            )}
          </div>
          {exportError && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 max-w-lg">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" /><p className="text-xs text-red-300">{exportError}</p>
            </div>
          )}
        </div>

        {/* ═══ RIGHT PANEL — Contextual Settings ═══ */}
        <div className="w-[364px] min-w-0 flex-shrink-0 bg-dark-card border-l border-dark-border flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-shopee p-3 space-y-3">

            {/* ── Subtitle settings (when subtitle tab active) ── */}
            {activePanel === "subtitle" && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Type className="h-3.5 w-3.5 text-shopee-orange" />
                  <p className="text-[11px] font-semibold text-text-primary">Configuração da Legenda</p>
                </div>

                <div className="rounded-lg bg-dark-bg/60 border border-dark-border/80 p-3 space-y-3">
                  <p className="text-[11px] font-medium text-text-primary">Layout</p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="block text-[10px] text-text-secondary/90 mb-0.5">Tamanho</label><input type="number" min={12} max={72} value={subtitleFontSize} onChange={(e) => setSubtitleFontSize(Number(e.target.value))} className="w-full px-2 py-1.5 rounded-md border border-dark-border bg-dark-card text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-shopee-orange/50" /></div>
                      <div><label className="block text-[10px] text-text-secondary/90 mb-0.5">Posição</label><select value={subtitlePosition} onChange={(e) => setSubtitlePosition(e.target.value as "bottom" | "center" | "top")} className="w-full px-2 py-1.5 rounded-md border border-dark-border bg-dark-card text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-shopee-orange/50"><option value="bottom">Baixo</option><option value="center">Centro</option><option value="top">Topo</option></select></div>
                    </div>
                    <div><label className="block text-[10px] text-text-secondary/90 mb-0.5">Máx. palavras</label><input type="number" min={1} max={10} value={subtitleMaxWords} onChange={(e) => setSubtitleMaxWords(Number(e.target.value))} className="w-full px-2 py-1.5 rounded-md border border-dark-border bg-dark-card text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-shopee-orange/50" /></div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={subtitleUppercase} onChange={(e) => setSubtitleUppercase(e.target.checked)} className="rounded border-dark-border bg-dark-card text-shopee-orange focus:ring-shopee-orange/50" /><span className="text-xs text-text-secondary">MAIÚSCULAS</span></label>
                </div>

                <div className="rounded-lg bg-dark-bg/60 border border-dark-border/80 p-3 space-y-3">
                  <p className="text-[11px] font-medium text-text-primary">Cores</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2"><input type="color" value={subtitleFontColor} onChange={(e) => setSubtitleFontColor(e.target.value)} className="w-7 h-7 rounded-md border border-dark-border cursor-pointer p-0.5 bg-dark-card" /><label className="text-[10px] text-text-secondary/90">Texto</label></div>
                    <div className="flex items-center gap-2"><input type="color" value={subtitleBgColor} onChange={(e) => setSubtitleBgColor(e.target.value)} className="w-7 h-7 rounded-md border border-dark-border cursor-pointer p-0.5 bg-dark-card" /><label className="text-[10px] text-text-secondary/90">Fundo</label></div>
                  </div>
                  <div className="flex items-center gap-2"><label className="text-[10px] text-text-secondary/90 shrink-0 w-14">Opacidade</label><input type="range" min={0} max={100} value={Math.round(subtitleBgOpacity * 100)} onChange={(e) => setSubtitleBgOpacity(Number(e.target.value) / 100)} className="flex-1 h-1.5 rounded-full bg-dark-border accent-shopee-orange" /><span className="text-[10px] text-text-secondary w-8 text-right">{Math.round(subtitleBgOpacity * 100)}%</span></div>
                </div>

                <div className="rounded-lg bg-dark-bg/60 border border-dark-border/80 p-3 space-y-3">
                  <p className="text-[11px] font-medium text-text-primary">Borda</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2"><input type="color" value={subtitleOutlineColor} onChange={(e) => setSubtitleOutlineColor(e.target.value)} className="w-7 h-7 rounded-md border border-dark-border cursor-pointer p-0.5 bg-dark-card" /><label className="text-[10px] text-text-secondary/90">Cor</label></div>
                    <div className="flex items-center gap-2"><label className="text-[10px] text-text-secondary/90">Largura</label><input type="number" min={0} max={8} value={subtitleOutlineWidth} onChange={(e) => setSubtitleOutlineWidth(Number(e.target.value))} className="w-12 px-1.5 py-1 rounded-md border border-dark-border bg-dark-card text-text-primary text-xs text-center focus:outline-none focus:ring-1 focus:ring-shopee-orange/50" /><span className="text-[10px] text-text-secondary/80">px</span></div>
                  </div>
                </div>
              </>
            )}

            {/* ── Clip properties (when a clip is selected and NOT in subtitle mode) ── */}
            {activePanel !== "subtitle" && selectedClip && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-shopee-orange" />
                  <p className="text-[11px] font-semibold text-text-primary">Propriedades do Clipe</p>
                </div>
                <div className="rounded-lg bg-dark-bg/60 border border-dark-border/80 p-3 space-y-2">
                  <p className="text-[10px] text-text-secondary truncate">{selectedClip.name || selectedClip.text?.slice(0, 30) || selectedClip.stickerEmoji || "Clipe"}</p>
                  <p className="text-[10px] text-text-secondary/70">Tipo: <span className="text-text-primary capitalize">{selectedClip.type}</span></p>
                  <p className="text-[10px] text-text-secondary/70">Duração: <span className="text-text-primary">{((selectedClip.duration - selectedClip.trimStart - selectedClip.trimEnd) / (selectedClip.speed || 1)).toFixed(1)}s</span></p>
                </div>

                {/* Speed control for video/audio */}
                {(selectedClip.type === "video" || selectedClip.type === "audio") && (
                  <div className="rounded-lg bg-dark-bg/60 border border-dark-border/80 p-3 space-y-2">
                    <p className="text-[11px] font-medium text-text-primary">Velocidade</p>
                    <div className="flex items-center gap-2">
                      <Gauge className="h-3 w-3 text-text-secondary" />
                      <select value={selectedClip.speed || 1} onChange={(e) => updateClipSpeed(selectedClip.id, Number(e.target.value))} className="flex-1 px-2 py-1.5 rounded-md border border-dark-border bg-dark-card text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-shopee-orange/50">
                        {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((s) => <option key={s} value={s}>{s}x</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Filters for video/image */}
                {(selectedClip.type === "video" || selectedClip.type === "image") && (
                  <div className="rounded-lg bg-dark-bg/60 border border-dark-border/80 p-3 space-y-3">
                    <p className="text-[11px] font-medium text-text-primary">Filtros</p>
                    <div className="grid grid-cols-3 gap-1">
                      {FILTER_PRESETS.map((fp) => (
                        <button key={fp.name} onClick={() => { setClipFilters({ ...fp.filters }); applyFiltersToClip(selectedClip.id, fp.filters); }}
                          className="px-1.5 py-1 rounded-md border border-dark-border text-[9px] text-text-secondary hover:border-shopee-orange hover:text-shopee-orange transition-colors"
                        >{fp.name}</button>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      {([
                        { key: "brightness" as const, label: "Brilho", min: 0.5, max: 1.5, step: 0.05 },
                        { key: "contrast" as const, label: "Contraste", min: 0.5, max: 2, step: 0.05 },
                        { key: "saturation" as const, label: "Saturação", min: 0, max: 2, step: 0.05 },
                        { key: "hue" as const, label: "Matiz", min: 0, max: 360, step: 5 },
                        { key: "blur" as const, label: "Blur", min: 0, max: 10, step: 0.5 },
                        { key: "grayscale" as const, label: "P&B", min: 0, max: 1, step: 0.1 },
                        { key: "sepia" as const, label: "Sépia", min: 0, max: 1, step: 0.1 },
                      ] as const).map(({ key, label, min, max, step }) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-[9px] text-text-secondary w-14 shrink-0">{label}</span>
                          <input type="range" min={min} max={max} step={step} value={clipFilters[key]} onChange={(e) => { const v = Number(e.target.value); const f = { ...clipFilters, [key]: v }; setClipFilters(f); applyFiltersToClip(selectedClip.id, f); }} className="flex-1 accent-shopee-orange h-1" />
                          <span className="text-[9px] text-text-secondary w-7 text-right tabular-nums">{clipFilters[key].toFixed(key === "hue" ? 0 : 1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transition for video clips */}
                {selectedClip.type === "video" && (
                  <div className="rounded-lg bg-dark-bg/60 border border-dark-border/80 p-3 space-y-2">
                    <p className="text-[11px] font-medium text-text-primary">Transição de entrada</p>
                    <div className="grid grid-cols-2 gap-1">
                      {TRANSITION_TYPES.map((tt) => (
                        <button key={tt.type} onClick={() => setClipTransition(selectedClip.id, { type: tt.type, duration: selectedClip.transition?.duration || 0.5 })}
                          className={`px-2 py-1 rounded-md text-[9px] border transition-colors ${selectedClip.transition?.type === tt.type ? "bg-shopee-orange/20 text-shopee-orange border-shopee-orange/50" : "border-dark-border text-text-secondary hover:border-shopee-orange/30"}`}
                        >{tt.label}</button>
                      ))}
                    </div>
                    {selectedClip.transition?.type && selectedClip.transition.type !== "none" && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[9px] text-text-secondary">Duração:</span>
                        <select value={selectedClip.transition?.duration || 0.5} onChange={(e) => setClipTransition(selectedClip.id, { type: selectedClip.transition?.type || "fade", duration: Number(e.target.value) })} className="flex-1 bg-dark-card border border-dark-border rounded-md text-[9px] text-text-primary px-1.5 py-1 outline-none focus:ring-1 focus:ring-shopee-orange/50">
                          {[0.3, 0.5, 0.8, 1, 1.5, 2].map((d) => <option key={d} value={d}>{d}s</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Empty state ── */}
            {activePanel !== "subtitle" && !selectedClip && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <SlidersHorizontal className="h-8 w-8 text-text-secondary/20 mb-3" />
                <p className="text-xs text-text-secondary/50">Selecione um clipe na timeline para ver as propriedades</p>
                <p className="text-[10px] text-text-secondary/30 mt-1">ou abra a aba Legendas para configurações de estilo</p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ─── TRANSPORT ─── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-dark-card border-t border-dark-border">
        <button onClick={() => setCurrentTime(0)} className="p-1 text-text-secondary hover:text-text-primary" title="Início"><SkipBack className="h-4 w-4" /></button>
        <button onClick={() => setIsPlaying(!isPlaying)} className="p-1.5 rounded-full bg-shopee-orange text-white hover:opacity-90" title="Play/Pause (Space)">
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button onClick={() => { setIsPlaying(false); setCurrentTime(0); }} className="p-1.5 rounded-full bg-red-600 text-white hover:opacity-90" title="Parar"><Square className="h-3.5 w-3.5" /></button>
        <button onClick={() => setCurrentTime(Math.min(currentTime + 5, totalDuration))} className="p-1 text-text-secondary hover:text-text-primary" title="Avançar 5s"><SkipForward className="h-4 w-4" /></button>
        <span className="text-xs text-text-secondary font-mono w-24">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-secondary">Zoom:</span>
          <input type="range" min={15} max={120} value={pxPerSecond} onChange={(e) => setPxPerSecond(Number(e.target.value))} className="w-20 accent-shopee-orange" title="[ e ] para zoom" />
        </div>
      </div>

      {/* ─── TIMELINE ─── */}
      <div className="bg-dark-card border-t border-dark-border flex-shrink-0 overflow-hidden rounded-b-xl" style={{ height: "240px" }}>
        <div className="flex h-full">
          {/* Track labels */}
          <div className="w-24 flex-shrink-0 border-r border-dark-border flex flex-col">
            {tracks.map((track) => (
              <div key={track.id} className="flex items-center gap-1 px-2 border-b border-dark-border" style={{ height: `${240 / tracks.length}px` }}>
                <button onClick={() => pushTracks(tracks.map((t) => t.id === track.id ? { ...t, muted: !t.muted } : t))} className={`p-0.5 rounded ${track.muted ? "text-red-400" : "text-text-secondary"}`} title={track.muted ? "Desmutear" : "Mutar"}>
                  {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                </button>
                <span className="text-[10px] text-text-secondary truncate">{track.label}</span>
              </div>
            ))}
          </div>

          {/* Scrollable timeline */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-shopee relative">
            {/* Ruler */}
            <div className="sticky top-0 h-5 border-b border-dark-border bg-dark-card z-10 relative cursor-pointer"
              style={{ width: `${totalDuration * pxPerSecond}px` }}
              onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left + e.currentTarget.scrollLeft; setCurrentTime(Math.max(0, Math.min(x / pxPerSecond, totalDuration))); }}
            >
              {Array.from({ length: Math.ceil(totalDuration) }, (_, i) => (
                <span key={i} className="absolute text-[9px] text-text-secondary/50 top-1 pointer-events-none" style={{ left: `${i * pxPerSecond}px` }}>{i}s</span>
              ))}
            </div>

            {/* Tracks */}
            <div className="relative" style={{ width: `${totalDuration * pxPerSecond}px` }}>
              {tracks.map((track, trackIdx) => {
                const trackH = (240 - 20) / tracks.length;
                return (
                  <div key={track.id} className="relative border-b border-dark-border/50" style={{ height: `${trackH}px` }}
                    onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setCurrentTime(Math.max(0, Math.min((e.clientX - rect.left) / pxPerSecond, totalDuration))); }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const rawDrop = Math.max(0, (e.clientX - rect.left) / pxPerSecond);
                      const clipId = e.dataTransfer.getData("text/clip-id");
                      if (clipId) {
                        let movedClip: ClipItem | undefined;
                        const cleaned = tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => { if (c.id === clipId) { movedClip = { ...c }; return false; } return true; }) }));
                        if (!movedClip) return;
                        const mc: ClipItem = movedClip;
                        const effDur = (mc.duration - mc.trimStart - mc.trimEnd) / (mc.speed || 1);
                        const snapped = snapToEdge(cleaned[trackIdx].clips, effDur, rawDrop, clipId);
                        pushTracks(cleaned.map((t, i) => i === trackIdx ? { ...t, clips: [...t.clips, { ...mc, startTime: snapped, trackIndex: trackIdx }] } : t));
                        return;
                      }
                      const mediaId = e.dataTransfer.getData("text/media-id");
                      const item = mediaItems.find((m) => m.id === mediaId);
                      if (!item) return;
                      if (track.type === "video" && item.type !== "video" && item.type !== "image") return;
                      if (track.type === "audio" && item.type !== "audio") return;
                      if (track.type === "subtitle" || track.type === "text" || track.type === "sticker") return;
                      const snapped = snapToEdge(track.clips, item.duration, rawDrop);
                      const clip: ClipItem = { id: uid(), mediaId: item.id, name: item.name, type: item.type, blobUrl: item.blobUrl, trackIndex: trackIdx, startTime: snapped, duration: item.duration, trimStart: 0, trimEnd: 0, volume: 1 };
                      pushTracks(tracks.map((t, i) => i === trackIdx ? { ...t, clips: [...t.clips, clip] } : t));
                    }}
                  >
                    {track.clips.map((clip, clipIdx) => {
                      const spd = clip.speed || 1;
                      const effectiveDur = (clip.duration - clip.trimStart - clip.trimEnd) / spd;
                      const left = clip.startTime * pxPerSecond;
                      const width = effectiveDur * pxPerSecond;
                      const isSelected = selectedClipId === clip.id;
                      const hasTransition = clip.transition && clip.transition.type !== "none";

                      return (
                        <div key={clip.id} className="group/clip absolute top-1 bottom-1" style={{ left: `${left}px`, width: `${Math.max(width, 8)}px` }}>
                          {/* Transition indicator */}
                          {hasTransition && (
                            <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-purple-500 rounded-sm rotate-45 z-10 flex items-center justify-center" title={`Transição: ${clip.transition!.type}`}>
                              <Sparkles className="h-1.5 w-1.5 text-white -rotate-45" />
                            </div>
                          )}

                          {/* Clip body */}
                          <div
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/clip-id", clip.id); e.dataTransfer.effectAllowed = "move"; setSelectedClipId(clip.id); }}
                            className={`h-full rounded cursor-grab active:cursor-grabbing border transition-all relative overflow-hidden ${CLIP_COLORS[clip.type] ?? "bg-gray-600/70 border-gray-400"} ${isSelected ? "ring-2 ring-shopee-orange ring-offset-1 ring-offset-dark-card" : ""}`}
                            onClick={(e) => { e.stopPropagation(); setSelectedClipId(clip.id); if (clip.filters) setClipFilters({ ...clip.filters }); }}
                            onDoubleClick={(e) => { e.stopPropagation(); if (track.type === "video") setShowTransitionPicker(clip.id); }}
                          >
                            {/* Trim handles */}
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-white/0 hover:bg-yellow-400/60 z-10 rounded-l" onMouseDown={(e) => handleTrimStart(e, clip.id)} />
                            <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-white/0 hover:bg-yellow-400/60 z-10 rounded-r" onMouseDown={(e) => handleTrimEnd(e, clip.id)} />

                            <span className="text-[9px] text-white px-2 truncate block leading-tight mt-0.5 pointer-events-none">
                              {clip.type === "subtitle" || clip.type === "text" ? clip.text?.slice(0, 20) : clip.type === "sticker" ? (clip.stickerEmoji || clip.badgeText) : clip.name}
                            </span>
                            {spd !== 1 && <span className="absolute bottom-0.5 right-1 text-[7px] text-white/70">{spd}x</span>}
                          </div>

                          {/* Transition picker popup */}
                          {showTransitionPicker === clip.id && (
                            <div className="absolute top-full left-0 mt-1 z-30 bg-dark-card border border-dark-border rounded-lg shadow-xl p-2 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                              <p className="text-[10px] text-text-secondary mb-1.5 font-medium">Transição de entrada</p>
                              {TRANSITION_TYPES.map((tt) => (
                                <button key={tt.type} onClick={() => setClipTransition(clip.id, { type: tt.type, duration: 0.5 })}
                                  className={`w-full text-left px-2 py-1 rounded text-[10px] transition-colors ${clip.transition?.type === tt.type ? "bg-shopee-orange/20 text-shopee-orange" : "text-text-secondary hover:bg-dark-bg"}`}
                                >{tt.label}</button>
                              ))}
                              <div className="mt-1.5 flex items-center gap-1">
                                <span className="text-[9px] text-text-secondary">Duração:</span>
                                <select value={clip.transition?.duration || 0.5} onChange={(e) => setClipTransition(clip.id, { type: clip.transition?.type || "fade", duration: Number(e.target.value) })} className="bg-dark-bg border border-dark-border rounded text-[9px] text-text-primary px-1 py-0.5 outline-none">
                                  {[0.3, 0.5, 0.8, 1, 1.5, 2].map((d) => <option key={d} value={d}>{d}s</option>)}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Playhead */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-shopee-orange z-20 pointer-events-none" style={{ left: `${currentTime * pxPerSecond}px` }}>
                <div className="w-3 h-3 bg-shopee-orange rounded-full -ml-[5px] -mt-1" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SAVE/LOAD MODAL ─── */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSaveModal(false)}>
          <div className="bg-dark-card border border-dark-border rounded-xl p-5 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2"><Save className="h-4 w-4 text-shopee-orange" /> Salvar / Carregar Projeto</h2>
              <button onClick={() => setShowSaveModal(false)} className="text-text-secondary hover:text-text-primary"><X className="h-4 w-4" /></button>
            </div>

            {/* Save */}
            <div className="mb-4 space-y-2">
              <label className="block text-xs text-text-secondary font-medium">Nome do projeto</label>
              <div className="flex gap-2">
                <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="flex-1 px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs focus:outline-none focus:border-shopee-orange" />
                <button onClick={handleSaveProject} className="px-4 py-1.5 rounded-lg bg-shopee-orange text-white text-xs font-semibold hover:opacity-90">Salvar</button>
              </div>
              <p className="text-[10px] text-text-secondary/60">Salva posições, estilos e configurações. Mídias precisam ser re-importadas ao carregar.</p>
            </div>

            {/* Load */}
            <div>
              <label className="block text-xs text-text-secondary font-medium mb-2">Projetos salvos</label>
              {savedProjects.length === 0 ? <p className="text-xs text-text-secondary/60 text-center py-4">Nenhum projeto salvo.</p> : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {savedProjects.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg border border-dark-border bg-dark-bg">
                      <div className="flex-1 min-w-0"><p className="text-xs text-text-primary truncate">{p.name}</p><p className="text-[10px] text-text-secondary">{new Date(p.savedAt).toLocaleString("pt-BR")}</p></div>
                      <button onClick={() => handleLoadProject(p)} className="px-2.5 py-1 rounded text-[10px] bg-emerald-600 text-white hover:bg-emerald-500"><FolderOpen className="h-3 w-3 inline mr-1" />Carregar</button>
                      <button onClick={() => handleDeleteProject(p.id)} className="px-2 py-1 rounded text-[10px] text-red-400 hover:bg-red-500/10"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
