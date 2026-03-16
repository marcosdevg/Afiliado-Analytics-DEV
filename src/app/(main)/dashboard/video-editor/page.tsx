"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Film, Upload, Download, Link2, Loader2, Wand2, Mic, Type, Scissors, Volume2, VolumeX, Play, Pause, Square, SkipBack, SkipForward, Trash2, Plus, Image as ImageIcon, Music, FileVideo, ChevronDown, AlertCircle } from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import type { MediaItem, ClipItem, Track, ElevenVoice, SubtitleStyle } from "./_types";
import { SUBTITLE_TEMPLATES } from "./_types";

let clipIdCounter = 0;
const uid = () => `clip_${++clipIdCounter}_${Date.now()}`;
let mediaIdCounter = 0;
const mediaUid = () => `media_${++mediaIdCounter}_${Date.now()}`;

function getVideoDuration(blobUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve(v.duration || 0); };
    v.onerror = () => { resolve(0); };
    v.src = blobUrl;
  });
}

function getAudioDuration(blobUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => { resolve(a.duration || 0); };
    a.onerror = () => { resolve(0); };
    a.src = blobUrl;
  });
}

function generateVideoThumbnail(blobUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.onloadeddata = () => {
      v.currentTime = 1;
    };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = 160;
      c.height = 90;
      const ctx = c.getContext("2d");
      if (ctx) ctx.drawImage(v, 0, 0, 160, 90);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    v.onerror = () => resolve("");
    v.src = blobUrl;
  });
}

const DEFAULT_TRACKS: Track[] = [
  { id: "track_video", type: "video", label: "Vídeo", clips: [], muted: false },
  { id: "track_audio1", type: "audio", label: "Áudio 1", clips: [], muted: false },
  { id: "track_audio2", type: "audio", label: "Áudio 2", clips: [], muted: false },
  { id: "track_sub", type: "subtitle", label: "Legendas", clips: [], muted: false },
];

export default function VideoEditorPage() {
  // Media library
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [tracks, setTracks] = useState<Track[]>(DEFAULT_TRACKS);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Playback
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalDuration, setTotalDuration] = useState(30);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const [activePreviewClip, setActivePreviewClip] = useState<ClipItem | null>(null);

  // UI panels
  const [activePanel, setActivePanel] = useState<"media" | "copy" | "tts" | "subtitle">("media");
  const [shopeeUrl, setShopeeUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [shopeeMedia, setShopeeMedia] = useState<{ url: string; type: "image" | "video"; label: string }[]>([]);
  const [shopeeProductName, setShopeeProductName] = useState("");
  const [importingMedia, setImportingMedia] = useState<string | null>(null);

  // Copy generation
  const [copyProductName, setCopyProductName] = useState("");
  const [copyStyle, setCopyStyle] = useState("vendas");
  const [generatedCopy, setGeneratedCopy] = useState("");
  const [generatingCopy, setGeneratingCopy] = useState(false);

  // TTS
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [ttsText, setTtsText] = useState("");
  const [generatingTts, setGeneratingTts] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(false);

  // Subtitle
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

  // FFmpeg
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Zoom
  const [pxPerSecond, setPxPerSecond] = useState(40);

  // Aspect ratio
  const ASPECT_RATIOS = [
    { label: "9:16 (Stories)", value: "9/16" },
    { label: "16:9 (YouTube)", value: "16/9" },
    { label: "4:3", value: "4/3" },
    { label: "1:1 (Feed)", value: "1/1" },
    { label: "3:4", value: "3/4" },
  ];
  const [aspectRatio, setAspectRatio] = useState("9/16");

  // Audio elements for synced playback
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // Auto-subtitle
  const [generatingSubtitles, setGeneratingSubtitles] = useState(false);

  // File input refs
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Compute total duration from clips
  useEffect(() => {
    let max = 10;
    tracks.forEach((t) => t.clips.forEach((c) => {
      const end = c.startTime + c.duration - c.trimStart - c.trimEnd;
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

  // Track which blob is currently loaded to avoid re-setting src every frame
  const currentVideoSrcRef = useRef<string>("");

  // Sync video/image element with currentTime
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const videoTrack = tracks.find((t) => t.type === "video");
    const activeClip = videoTrack?.clips.find(
      (c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration - c.trimStart - c.trimEnd
    ) ?? null;
    setActivePreviewClip(activeClip);

    if (activeClip && activeClip.type === "video") {
      if (currentVideoSrcRef.current !== activeClip.blobUrl) {
        vid.src = activeClip.blobUrl;
        currentVideoSrcRef.current = activeClip.blobUrl;
      }
      vid.muted = !!videoTrack?.muted;
      const clipTime = currentTime - activeClip.startTime + activeClip.trimStart;
      if (Math.abs(vid.currentTime - clipTime) > 0.5) {
        vid.currentTime = clipTime;
      }
      if (isPlaying && vid.paused) vid.play().catch(() => {});
      if (!isPlaying && !vid.paused) vid.pause();
    } else {
      if (!vid.paused) vid.pause();
      if (currentVideoSrcRef.current) {
        currentVideoSrcRef.current = "";
      }
    }
  }, [currentTime, isPlaying, tracks]);

  // Sync audio elements with currentTime (audio tracks playback)
  const activeAudioClipIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const audioTracks = tracks.filter((t) => t.type === "audio");
    const nowActive = new Set<string>();
    for (const track of audioTracks) {
      if (track.muted) continue;
      for (const clip of track.clips) {
        const effEnd = clip.startTime + clip.duration - clip.trimStart - clip.trimEnd;
        if (currentTime >= clip.startTime && currentTime < effEnd) {
          nowActive.add(clip.id);
          let el = audioRefs.current[clip.id];
          if (!el) {
            el = new Audio(clip.blobUrl);
            el.volume = clip.volume;
            audioRefs.current[clip.id] = el;
          }
          const clipTime = currentTime - clip.startTime + clip.trimStart;
          if (Math.abs(el.currentTime - clipTime) > 0.5) {
            el.currentTime = clipTime;
          }
          if (isPlaying && el.paused) el.play().catch(() => {});
          if (!isPlaying && !el.paused) el.pause();
        }
      }
    }
    // Pause audio elements that are no longer active
    for (const id of activeAudioClipIds.current) {
      if (!nowActive.has(id) && audioRefs.current[id]) {
        audioRefs.current[id].pause();
      }
    }
    activeAudioClipIds.current = nowActive;
  }, [currentTime, isPlaying, tracks]);

  // Load ElevenLabs voices
  const loadVoices = useCallback(async () => {
    if (voices.length > 0) return;
    setLoadingVoices(true);
    try {
      const res = await fetch("/api/video-editor/elevenlabs-voices");
      const data = await res.json();
      if (data.voices) setVoices(data.voices);
    } catch { /* ignore */ }
    finally { setLoadingVoices(false); }
  }, [voices.length]);

  // Import file handler
  const handleFileImport = useCallback(async (file: File, type: "video" | "audio" | "image") => {
    const blobUrl = URL.createObjectURL(file);
    let duration = 0;
    let thumbnail = "";
    if (type === "video") {
      duration = await getVideoDuration(blobUrl);
      thumbnail = await generateVideoThumbnail(blobUrl);
    } else if (type === "audio") {
      duration = await getAudioDuration(blobUrl);
    } else {
      duration = 5;
    }
    const item: MediaItem = {
      id: mediaUid(),
      name: file.name,
      type,
      blobUrl,
      duration,
      thumbnail,
      file,
    };
    setMediaItems((prev) => [...prev, item]);
    return item;
  }, []);

  // Search Shopee product via Puppeteer scraping
  const handleShopeeSearch = useCallback(async () => {
    if (!shopeeUrl.trim()) return;
    setDownloading(true);
    setDownloadError("");
    setShopeeMedia([]);
    setShopeeProductName("");
    try {
      const res = await fetch("/api/video-editor/download-shopee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: shopeeUrl, mode: "scrape" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro");

      const media: { url: string; type: "image" | "video"; label: string }[] = json?.media ?? [];
      if (media.length === 0) throw new Error("Nenhuma mídia encontrada nesta página");

      setShopeeMedia(media);
      setShopeeProductName(json?.productName ?? "");
      if (json?.productName) setCopyProductName(json.productName);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Erro ao buscar");
    } finally {
      setDownloading(false);
    }
  }, [shopeeUrl]);

  // Import a single media from Shopee results (proxy download via backend)
  const handleImportShopeeMedia = useCallback(async (mediaUrl: string, type: "image" | "video") => {
    setImportingMedia(mediaUrl);
    try {
      const res = await fetch("/api/video-editor/download-shopee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: mediaUrl, mode: "proxy" }),
      });
      if (!res.ok) throw new Error("Falha ao baixar");
      const mediaType = (res.headers.get("X-Media-Type") as "video" | "image") || type;
      const blob = await res.blob();
      const ext = mediaType === "video" ? "mp4" : "jpg";
      const file = new File([blob], `shopee_${Date.now()}.${ext}`, { type: blob.type || (mediaType === "video" ? "video/mp4" : "image/jpeg") });
      await handleFileImport(file, mediaType);
    } catch {
      setDownloadError("Não foi possível importar esta mídia.");
    } finally {
      setImportingMedia(null);
    }
  }, [handleFileImport]);

  // Generate copy
  const handleGenerateCopy = useCallback(async () => {
    if (!copyProductName.trim()) return;
    setGeneratingCopy(true);
    try {
      const res = await fetch("/api/video-editor/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: copyProductName, style: copyStyle }),
      });
      const data = await res.json();
      if (data.copy) {
        setGeneratedCopy(data.copy);
        setTtsText(data.copy);
      }
    } catch { /* ignore */ }
    finally { setGeneratingCopy(false); }
  }, [copyProductName, copyStyle]);

  // Generate TTS
  const handleGenerateTts = useCallback(async () => {
    if (!ttsText.trim() || !selectedVoiceId) return;
    setGeneratingTts(true);
    try {
      const res = await fetch("/api/video-editor/elevenlabs-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText, voiceId: selectedVoiceId }),
      });
      if (!res.ok) throw new Error("Erro TTS");
      const blob = await res.blob();
      const file = new File([blob], `tts_${Date.now()}.mp3`, { type: "audio/mpeg" });
      const item = await handleFileImport(file, "audio");
      // Auto-add to audio track 1
      const dur = item.duration || 10;
      const clip: ClipItem = {
        id: uid(), mediaId: item.id, name: item.name, type: "audio",
        blobUrl: item.blobUrl, trackIndex: 1, startTime: 0,
        duration: dur, trimStart: 0, trimEnd: 0, volume: 1,
      };
      setTracks((prev) => prev.map((t, i) => i === 1 ? { ...t, clips: [...t.clips, clip] } : t));
    } catch { /* ignore */ }
    finally { setGeneratingTts(false); }
  }, [ttsText, selectedVoiceId, handleFileImport]);

  // Add media to timeline
  const addToTimeline = useCallback((item: MediaItem) => {
    const trackIndex = item.type === "video" ? 0 : item.type === "audio" ? 1 : 0;
    const track = tracks[trackIndex];
    const lastEnd = track.clips.reduce((max, c) => Math.max(max, c.startTime + c.duration - c.trimStart - c.trimEnd), 0);
    const clip: ClipItem = {
      id: uid(),
      mediaId: item.id,
      name: item.name,
      type: item.type,
      blobUrl: item.blobUrl,
      trackIndex,
      startTime: lastEnd,
      duration: item.duration,
      trimStart: 0,
      trimEnd: 0,
      volume: 1,
    };
    setTracks((prev) => prev.map((t, i) => i === trackIndex ? { ...t, clips: [...t.clips, clip] } : t));
  }, [tracks]);

  // Auto-generate subtitles from audio track text (max N words per frame)
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
    for (let i = 0; i < words.length; i += subtitleMaxWords) {
      chunks.push(words.slice(i, i + subtitleMaxWords).join(" "));
    }
    if (chunks.length === 0) { setGeneratingSubtitles(false); return; }
    const totalChars = chunks.reduce((sum, c) => sum + c.length, 0);
    const baseStyle = SUBTITLE_TEMPLATES[subtitleTemplate]?.style;
    const style: SubtitleStyle = {
      ...baseStyle,
      fontSize: subtitleFontSize,
      position: subtitlePosition,
      color: subtitleFontColor,
      bgColor: subtitleBgColor,
      bgOpacity: subtitleBgOpacity,
      uppercase: subtitleUppercase,
      outlineColor: subtitleOutlineColor,
      outlineWidth: subtitleOutlineWidth,
    };
    const newClips: ClipItem[] = [];
    let timeOffset = audioStart;
    for (const chunk of chunks) {
      const dur = Math.max(0.4, (chunk.length / totalChars) * audioDuration);
      newClips.push({
        id: uid(), mediaId: "", name: chunk.slice(0, 30),
        type: "subtitle", blobUrl: "", trackIndex: 3,
        startTime: timeOffset, duration: dur,
        trimStart: 0, trimEnd: 0, volume: 1,
        text: chunk, subtitleStyle: style,
      });
      timeOffset += dur;
    }
    setTracks((prev) => prev.map((t, i) => i === 3 ? { ...t, clips: newClips } : t));
    setGeneratingSubtitles(false);
  }, [tracks, ttsText, generatedCopy, subtitleTemplate, subtitleFontSize, subtitlePosition, subtitleMaxWords, subtitleUppercase, subtitleFontColor, subtitleBgColor, subtitleBgOpacity, subtitleOutlineColor, subtitleOutlineWidth]);

  // Delete selected clip
  const deleteSelectedClip = useCallback(() => {
    if (!selectedClipId) return;
    setTracks((prev) =>
      prev.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== selectedClipId) }))
    );
    setSelectedClipId(null);
  }, [selectedClipId]);

  // Split only the selected clip (or the clip under playhead in its track)
  const splitAtPlayhead = useCallback(() => {
    if (!selectedClipId) return;
    setTracks((prev) => prev.map((track) => {
      const clipIdx = track.clips.findIndex((c) => c.id === selectedClipId);
      if (clipIdx === -1) return track;
      const c = track.clips[clipIdx];
      const effEnd = c.startTime + c.duration - c.trimStart - c.trimEnd;
      if (currentTime <= c.startTime || currentTime >= effEnd) return track;
      const splitPoint = currentTime - c.startTime;
      const clip1: ClipItem = { ...c, id: uid(), duration: splitPoint + c.trimStart, trimEnd: 0 };
      const clip2: ClipItem = {
        ...c, id: uid(), startTime: currentTime,
        trimStart: splitPoint + c.trimStart,
        duration: c.duration, trimEnd: c.trimEnd,
      };
      const newClips = [...track.clips];
      newClips.splice(clipIdx, 1, clip1, clip2);
      return { ...track, clips: newClips };
    }));
    setSelectedClipId(null);
  }, [currentTime, selectedClipId]);

  // FFmpeg singleton ref
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [exportError, setExportError] = useState("");

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current && ffmpegLoaded) return ffmpegRef.current;
    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => {
      setExportProgress(Math.round(Math.min(progress, 1) * 100));
    });
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegRef.current = ffmpeg;
    setFfmpegLoaded(true);
    return ffmpeg;
  }, [ffmpegLoaded]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportProgress(0);
    setExportError("");
    try {
      const ffmpeg = await loadFFmpeg();

      const videoTrack = tracks[0];
      if (!videoTrack?.clips.length) throw new Error("Nenhum clipe na faixa de vídeo. Adicione um vídeo ou imagem.");

      const firstClip = videoTrack.clips[0];
      if (!firstClip.blobUrl) throw new Error("Clipe sem mídia. Remova e importe novamente.");

      let response: Response;
      try {
        response = await fetch(firstClip.blobUrl);
      } catch {
        throw new Error("Não foi possível acessar o arquivo do clipe. Tente importar o vídeo novamente.");
      }
      if (!response.ok) throw new Error("Arquivo do clipe inacessível ou expirado.");
      const data = await response.arrayBuffer();

      const effectiveDur = Math.max(0.1, firstClip.duration - firstClip.trimStart - firstClip.trimEnd);
      const isImage = firstClip.type === "image";
      const ext = isImage ? (firstClip.blobUrl.toLowerCase().includes(".png") ? "png" : "jpg") : "mp4";
      const inputName = `input.${ext}`;
      await ffmpeg.writeFile(inputName, new Uint8Array(data));

      const audioClips = tracks.filter((t) => t.type === "audio" && !t.muted).flatMap((t) => t.clips);
      let args: string[];

      if (isImage) {
        args = ["-loop", "1", "-i", inputName, "-t", String(effectiveDur), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-pix_fmt", "yuv420p", "-r", "30"];
        if (audioClips.length > 0) {
          const audioRes = await fetch(audioClips[0].blobUrl);
          const audioData = await audioRes.arrayBuffer();
          await ffmpeg.writeFile("audio.mp3", new Uint8Array(audioData));
          args.push("-i", "audio.mp3", "-map", "0:v", "-map", "1:a", "-shortest");
        }
        args.push("-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", "output.mp4");
      } else {
        args = ["-i", inputName];
        if (firstClip.trimStart > 0) args.push("-ss", String(firstClip.trimStart));
        if (firstClip.trimEnd > 0) args.push("-t", String(effectiveDur));
        if (audioClips.length > 0) {
          const audioRes = await fetch(audioClips[0].blobUrl);
          const audioData = await audioRes.arrayBuffer();
          await ffmpeg.writeFile("audio.mp3", new Uint8Array(audioData));
          args.push("-i", "audio.mp3", "-map", "0:v", "-map", "1:a", "-shortest");
        }
        if (videoTrack.muted && audioClips.length === 0) args.push("-an");
        if (audioClips.length > 0) args.push("-c:a", "aac");
        args.push("-c:v", "libx264", "-preset", "fast", "-crf", "23", "output.mp4");
      }

      await ffmpeg.exec(args);

      const output = await ffmpeg.readFile("output.mp4");
      const blob = new Blob([output], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video_editado_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao exportar";
      setExportError(msg);
      console.error("Export error:", e);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [tracks, loadFFmpeg]);

  // Active subtitle at current time
  const activeSubtitle = tracks[3]?.clips.find(
    (c) => currentTime >= c.startTime && currentTime < c.startTime + (c.duration - c.trimStart - c.trimEnd)
  );

  // Format time
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${String(sec).padStart(2, "0")}.${ms}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[900px] gap-0">
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-dark-card border-b border-dark-border rounded-t-xl">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-shopee-orange" />
          <h1 className="text-lg font-bold text-text-primary">Editor de Vídeo</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={splitAtPlayhead}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dark-border text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/50 transition-colors"
            title="Cortar no playhead"
          >
            <Scissors className="h-3.5 w-3.5" /> Cortar
          </button>
          <button
            onClick={deleteSelectedClip}
            disabled={!selectedClipId}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-dark-border text-text-secondary hover:text-red-400 hover:border-red-400/50 disabled:opacity-30 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || tracks[0].clips.length === 0}
            className="flex items-center gap-1 px-4 py-1.5 text-xs rounded-lg bg-shopee-orange text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? `Exportando ${exportProgress}%` : "Exportar vídeo"}
          </button>
        </div>
      </div>

      {/* Main content: 40% ferramentas | 60% preview */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel: mídia, IA, Voz IA, Legendas */}
        <div className="w-[40%] min-w-0 flex-shrink-0 bg-dark-card border-r border-dark-border flex flex-col overflow-hidden">
          {/* Panel tabs */}
          <div className="flex border-b border-dark-border">
            {[
              { key: "media" as const, label: "Mídia", icon: <FileVideo className="h-3.5 w-3.5" /> },
              { key: "copy" as const, label: "IA", icon: <Wand2 className="h-3.5 w-3.5" /> },
              { key: "tts" as const, label: "Voz IA", icon: <Mic className="h-3.5 w-3.5" /> },
              { key: "subtitle" as const, label: "Legendas", icon: <Type className="h-3.5 w-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActivePanel(tab.key); if (tab.key === "tts") loadVoices(); }}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-2.5 text-xs font-medium transition-colors ${
                  activePanel === tab.key
                    ? "text-shopee-orange border-b-2 border-shopee-orange"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-shopee p-3 space-y-3">
            {/* MEDIA PANEL */}
            {activePanel === "media" && (
              <>
                {/* Shopee search */}
                <div className="space-y-2">
                  <label className="block text-xs text-text-secondary font-medium">Importar da Shopee</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shopeeUrl}
                      onChange={(e) => { setShopeeUrl(e.target.value); if (!e.target.value) { setShopeeMedia([]); setShopeeProductName(""); } }}
                      placeholder="Cole o link do produto Shopee"
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs focus:outline-none focus:border-shopee-orange"
                    />
                    <button
                      onClick={handleShopeeSearch}
                      disabled={downloading || !shopeeUrl.trim()}
                      className="px-3 py-1.5 rounded-lg bg-shopee-orange text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-text-secondary/80">
                    Cole o link do produto. O app abre a página automaticamente, extrai vídeos e imagens. Pode levar ~15s.
                  </p>
                  {downloadError && <p className="text-xs text-red-400 whitespace-pre-line">{downloadError}</p>}
                  {shopeeProductName && (
                    <p className="text-xs text-shopee-orange font-medium truncate">{shopeeProductName}</p>
                  )}
                  {shopeeMedia.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 text-[10px] text-text-secondary">
                        <span className="bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded">{shopeeMedia.filter((m) => m.type === "video").length} vídeos</span>
                        <span className="bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded">{shopeeMedia.filter((m) => m.type === "image").length} imagens</span>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {shopeeMedia.map((m, i) => (
                          <button
                            key={i}
                            onClick={() => handleImportShopeeMedia(m.url, m.type)}
                            disabled={importingMedia === m.url}
                            className={`relative group rounded border overflow-hidden hover:border-shopee-orange transition-colors aspect-square bg-dark-bg ${
                              m.type === "video" ? "border-blue-500/50" : "border-dark-border"
                            }`}
                          >
                            {m.type === "video" ? (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-blue-900/30">
                                <Play className="h-4 w-4 text-blue-300 mb-0.5" />
                                <span className="text-[8px] text-blue-300">MP4</span>
                              </div>
                            ) : (
                              <img
                                src={m.url}
                                alt={m.label}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            )}
                            {importingMedia === m.url ? (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                <Loader2 className="h-4 w-4 animate-spin text-shopee-orange" />
                              </div>
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Download className="h-4 w-4 text-white" />
                              </div>
                            )}
                            <span className="absolute bottom-0 left-0 right-0 text-[7px] text-white bg-black/70 px-0.5 py-0.5 truncate leading-tight">
                              {m.label}
                            </span>
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
                    <button onClick={() => videoInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-dashed border-dark-border text-text-secondary text-xs hover:border-shopee-orange hover:text-shopee-orange transition-colors">
                      <FileVideo className="h-3.5 w-3.5" /> Vídeo
                    </button>
                    <button onClick={() => audioInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-dashed border-dark-border text-text-secondary text-xs hover:border-shopee-orange hover:text-shopee-orange transition-colors">
                      <Music className="h-3.5 w-3.5" /> Áudio
                    </button>
                    <button onClick={() => imageInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-dashed border-dark-border text-text-secondary text-xs hover:border-shopee-orange hover:text-shopee-orange transition-colors">
                      <ImageIcon className="h-3.5 w-3.5" /> Imagem
                    </button>
                  </div>
                </div>

                {/* Media items list */}
                <div className="border-t border-dark-border pt-3">
                  <label className="block text-xs text-text-secondary font-medium mb-2">Biblioteca ({mediaItems.length})</label>
                  {mediaItems.length === 0 ? (
                    <p className="text-xs text-text-secondary/60 text-center py-4">Importe vídeos, áudios ou imagens para começar.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {mediaItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-2 rounded-lg border border-dark-border bg-dark-bg hover:border-shopee-orange/50 cursor-grab group transition-colors active:cursor-grabbing"
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData("text/media-id", item.id); e.dataTransfer.effectAllowed = "copy"; }}
                          onClick={() => addToTimeline(item)}
                          title="Arraste para a timeline ou clique para adicionar"
                        >
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt="" className="w-12 h-7 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-12 h-7 rounded bg-dark-card flex items-center justify-center flex-shrink-0">
                              {item.type === "audio" ? <Music className="h-3 w-3 text-text-secondary" /> : <ImageIcon className="h-3 w-3 text-text-secondary" />}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-text-primary truncate">{item.name}</p>
                            <p className="text-[10px] text-text-secondary">{item.duration > 0 ? `${item.duration.toFixed(1)}s` : item.type}</p>
                          </div>
                          <Plus className="h-3.5 w-3.5 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* COPY PANEL */}
            {activePanel === "copy" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary font-medium mb-1">Nome do produto</label>
                  <input
                    type="text"
                    value={copyProductName}
                    onChange={(e) => setCopyProductName(e.target.value)}
                    placeholder="Ex: Fone Bluetooth TWS"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs focus:outline-none focus:border-shopee-orange"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary font-medium mb-1">Estilo</label>
                  <select
                    value={copyStyle}
                    onChange={(e) => setCopyStyle(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs focus:outline-none focus:border-shopee-orange"
                  >
                    <option value="vendas">Venda persuasiva</option>
                    <option value="urgencia">Urgência / Escassez</option>
                    <option value="humor">Humor / Viral</option>
                  </select>
                </div>
                <button
                  onClick={handleGenerateCopy}
                  disabled={generatingCopy || !copyProductName.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-shopee-orange text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {generatingCopy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  Gerar Copy com IA
                </button>
                {generatedCopy && (
                  <div className="bg-dark-bg border border-dark-border rounded-lg p-3">
                    <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{generatedCopy}</p>
                    <button
                      onClick={() => { setTtsText(generatedCopy); setActivePanel("tts"); loadVoices(); }}
                      className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-shopee-orange text-white text-xs font-semibold hover:opacity-90"
                    >
                      <Mic className="h-3.5 w-3.5" /> Usar como texto para Voz IA
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TTS PANEL */}
            {activePanel === "tts" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-text-secondary font-medium mb-1">Texto para narração</label>
                  <textarea
                    value={ttsText}
                    onChange={(e) => setTtsText(e.target.value)}
                    placeholder="Cole ou digite o texto..."
                    rows={4}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs focus:outline-none focus:border-shopee-orange resize-y"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary font-medium mb-1">Voz</label>
                  {loadingVoices ? (
                    <p className="text-xs text-text-secondary flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Carregando vozes...</p>
                  ) : (
                    <select
                      value={selectedVoiceId}
                      onChange={(e) => setSelectedVoiceId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-xs focus:outline-none focus:border-shopee-orange"
                    >
                      <option value="">Selecione uma voz</option>
                      {voices.map((v) => (
                        <option key={v.voice_id} value={v.voice_id}>
                          {v.name} {v.labels?.accent ? `(${v.labels.accent})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  onClick={handleGenerateTts}
                  disabled={generatingTts || !ttsText.trim() || !selectedVoiceId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                  {generatingTts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
                  Gerar áudio com voz IA
                </button>
              </div>
            )}

            {/* SUBTITLE PANEL */}
            {activePanel === "subtitle" && (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-medium text-text-primary mb-2">Estilo base</p>
                  <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {SUBTITLE_TEMPLATES.map((tpl, i) => (
                      <button
                        key={tpl.name}
                        onClick={() => {
                          setSubtitleTemplate(i);
                          setSubtitleFontSize(tpl.style.fontSize);
                          setSubtitlePosition(tpl.style.position);
                          setSubtitleFontColor(tpl.style.color);
                          const bg = tpl.style.bgColor;
                          if (bg === "transparent") {
                            setSubtitleBgColor("#000000");
                            setSubtitleBgOpacity(0);
                          } else if (bg.startsWith("rgba")) {
                            const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                            if (m) setSubtitleBgColor(`#${Number(m[1]).toString(16).padStart(2,"0")}${Number(m[2]).toString(16).padStart(2,"0")}${Number(m[3]).toString(16).padStart(2,"0")}`);
                            const am = bg.match(/,\s*([\d.]+)\)/);
                            setSubtitleBgOpacity(am ? Number(am[1]) : 0.7);
                          } else {
                            setSubtitleBgColor(bg);
                            setSubtitleBgOpacity(1);
                          }
                          setSubtitleUppercase(!!tpl.style.uppercase);
                          setSubtitleOutlineColor(tpl.style.outlineColor ?? "#000000");
                          setSubtitleOutlineWidth(tpl.style.outlineWidth ?? 1);
                        }}
                        className={`px-1.5 py-1.5 rounded-md border text-[10px] text-center transition-all ${
                          subtitleTemplate === i
                            ? "border-shopee-orange bg-shopee-orange/15 text-shopee-orange ring-1 ring-shopee-orange/30"
                            : "border-dark-border/80 text-text-secondary hover:border-dark-border hover:bg-dark-bg/50"
                        }`}
                      >
                        <span className="block truncate" style={{ fontFamily: tpl.style.fontFamily, color: tpl.style.color, fontWeight: tpl.style.bold ? "bold" : "normal", WebkitTextStroke: tpl.style.outline ? "0.5px #000" : "none" }}>
                          {tpl.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-dark-bg/60 border border-dark-border/80 p-3 space-y-3">
                  <p className="text-[11px] font-medium text-text-primary">Layout</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-text-secondary/90 mb-0.5">Tamanho</label>
                      <input type="number" min={12} max={72} value={subtitleFontSize} onChange={(e) => setSubtitleFontSize(Number(e.target.value))} className="w-full px-2 py-1.5 rounded-md border border-dark-border bg-dark-card text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-shopee-orange/50 focus:border-shopee-orange/50" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-text-secondary/90 mb-0.5">Posição</label>
                      <select value={subtitlePosition} onChange={(e) => setSubtitlePosition(e.target.value as "bottom" | "center" | "top")} className="w-full px-2 py-1.5 rounded-md border border-dark-border bg-dark-card text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-shopee-orange/50">
                        <option value="bottom">Baixo</option>
                        <option value="center">Centro</option>
                        <option value="top">Topo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-text-secondary/90 mb-0.5">Máx. palavras</label>
                      <input type="number" min={1} max={10} value={subtitleMaxWords} onChange={(e) => setSubtitleMaxWords(Number(e.target.value))} className="w-full px-2 py-1.5 rounded-md border border-dark-border bg-dark-card text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-shopee-orange/50" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={subtitleUppercase} onChange={(e) => setSubtitleUppercase(e.target.checked)} className="rounded border-dark-border bg-dark-card text-shopee-orange focus:ring-shopee-orange/50" />
                    <span className="text-xs text-text-secondary">Exibir em MAIÚSCULAS</span>
                  </label>
                </div>

                <div className="rounded-lg bg-dark-bg/60 border border-dark-border/80 p-3 space-y-3">
                  <p className="text-[11px] font-medium text-text-primary">Cores</p>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-text-secondary/90 w-14">Texto</label>
                      <input type="color" value={subtitleFontColor} onChange={(e) => setSubtitleFontColor(e.target.value)} className="w-9 h-9 rounded-md border border-dark-border cursor-pointer p-0.5 bg-dark-card" title={subtitleFontColor} />
                      <input type="text" value={subtitleFontColor} onChange={(e) => setSubtitleFontColor(e.target.value)} className="w-16 px-1.5 py-1 rounded-md border border-dark-border bg-dark-card text-[10px] font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-shopee-orange/50" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-text-secondary/90 w-14">Fundo</label>
                      <input type="color" value={subtitleBgColor} onChange={(e) => setSubtitleBgColor(e.target.value)} className="w-9 h-9 rounded-md border border-dark-border cursor-pointer p-0.5 bg-dark-card" title={subtitleBgColor} />
                      <input type="text" value={subtitleBgColor} onChange={(e) => setSubtitleBgColor(e.target.value)} className="w-16 px-1.5 py-1 rounded-md border border-dark-border bg-dark-card text-[10px] font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-shopee-orange/50" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] text-text-secondary/90 shrink-0">Opacidade fundo</label>
                    <input type="range" min={0} max={100} value={Math.round(subtitleBgOpacity * 100)} onChange={(e) => setSubtitleBgOpacity(Number(e.target.value) / 100)} className="flex-1 h-1.5 rounded-full bg-dark-border accent-shopee-orange" />
                    <span className="text-[10px] text-text-secondary tabular-nums w-8">{Math.round(subtitleBgOpacity * 100)}%</span>
                  </div>
                </div>

                <div className="rounded-lg bg-dark-bg/60 border border-dark-border/80 p-3 space-y-3">
                  <p className="text-[11px] font-medium text-text-primary">Borda</p>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-text-secondary/90">Cor</label>
                      <input type="color" value={subtitleOutlineColor} onChange={(e) => setSubtitleOutlineColor(e.target.value)} className="w-9 h-9 rounded-md border border-dark-border cursor-pointer p-0.5 bg-dark-card" title={subtitleOutlineColor} />
                      <input type="text" value={subtitleOutlineColor} onChange={(e) => setSubtitleOutlineColor(e.target.value)} className="w-16 px-1.5 py-1 rounded-md border border-dark-border bg-dark-card text-[10px] font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-shopee-orange/50" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-text-secondary/90">Largura</label>
                      <input type="number" min={0} max={8} value={subtitleOutlineWidth} onChange={(e) => setSubtitleOutlineWidth(Number(e.target.value))} className="w-12 px-1.5 py-1 rounded-md border border-dark-border bg-dark-card text-text-primary text-xs text-center focus:outline-none focus:ring-1 focus:ring-shopee-orange/50" />
                      <span className="text-[10px] text-text-secondary/80">px</span>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <p className="text-[10px] text-text-secondary/80 mb-2">A partir do áudio na faixa Áudio 1 + texto da Copy/TTS.</p>
                  <button
                    onClick={handleAutoSubtitle}
                    disabled={generatingSubtitles || tracks[1]?.clips.length === 0 || (!ttsText.trim() && !generatedCopy.trim())}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                  >
                    {generatingSubtitles ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    Gerar Legenda Automática
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview panel — 60% */}
        <div className="w-[60%] min-w-0 flex-shrink-0 bg-dark-bg flex flex-col items-center justify-center p-4 overflow-hidden">
          {/* Aspect ratio selector */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-text-secondary">Proporção:</span>
            {ASPECT_RATIOS.map((ar) => (
              <button
                key={ar.value}
                onClick={() => setAspectRatio(ar.value)}
                className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                  aspectRatio === ar.value
                    ? "border-shopee-orange text-shopee-orange bg-shopee-orange/10"
                    : "border-dark-border text-text-secondary hover:border-shopee-orange/50"
                }`}
              >
                {ar.label}
              </button>
            ))}
          </div>
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio, maxWidth: aspectRatio === "9/16" || aspectRatio === "3/4" ? "280px" : "560px", width: "100%" }}>
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              style={{ display: activePreviewClip?.type === "image" ? "none" : "block" }}
              playsInline
            />
            {activePreviewClip?.type === "image" && activePreviewClip.blobUrl && (
              <img
                src={activePreviewClip.blobUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
            {/* Subtitle overlay */}
            {activeSubtitle?.text && activeSubtitle.subtitleStyle && (() => {
              const s = activeSubtitle.subtitleStyle;
              let bg = s.bgColor;
              if (s.bgOpacity != null) {
                if (s.bgOpacity === 0) bg = "transparent";
                else if (/^#[0-9A-Fa-f]{6}$/.test(s.bgColor)) {
                  const r = parseInt(s.bgColor.slice(1, 3), 16), g = parseInt(s.bgColor.slice(3, 5), 16), b = parseInt(s.bgColor.slice(5, 7), 16);
                  bg = `rgba(${r},${g},${b},${s.bgOpacity})`;
                }
              }
              const stroke = s.outline ? `${s.outlineWidth ?? 1}px ${s.outlineColor ?? "#000000"}` : "none";
              return (
                <div
                  className="absolute left-0 right-0 flex justify-center px-4"
                  style={{
                    top: s.position === "top" ? "8%" : s.position === "center" ? "45%" : undefined,
                    bottom: s.position === "bottom" ? "8%" : undefined,
                  }}
                >
                  <span
                    style={{
                      fontFamily: s.fontFamily,
                      fontSize: `${s.fontSize}px`,
                      color: s.color,
                      background: bg,
                      fontWeight: s.bold ? "bold" : "normal",
                      WebkitTextStroke: stroke,
                      textTransform: s.uppercase ? "uppercase" : "none",
                      padding: "4px 12px",
                      borderRadius: "6px",
                      textAlign: "center",
                      maxWidth: "90%",
                      wordBreak: "break-word",
                    }}
                  >
                    {activeSubtitle.text}
                  </span>
                </div>
              );
            })()}
            {tracks[0]?.clips.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-text-secondary/40">
                <Upload className="h-12 w-12 mb-2" />
                <p className="text-sm">Importe um vídeo para começar</p>
              </div>
            )}
          </div>
          {exportError && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 max-w-lg">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300">{exportError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Transport controls */}
      <div className="flex items-center gap-3 px-4 py-2 bg-dark-card border-t border-dark-border">
        <button onClick={() => setCurrentTime(0)} className="p-1 text-text-secondary hover:text-text-primary"><SkipBack className="h-4 w-4" /></button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-1.5 rounded-full bg-shopee-orange text-white hover:opacity-90"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={() => { setIsPlaying(false); setCurrentTime(0); }}
          className="p-1.5 rounded-full bg-red-600 text-white hover:opacity-90"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setCurrentTime(Math.min(currentTime + 5, totalDuration))} className="p-1 text-text-secondary hover:text-text-primary"><SkipForward className="h-4 w-4" /></button>
        <span className="text-xs text-text-secondary font-mono w-24">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-secondary">Zoom:</span>
          <input
            type="range"
            min={15}
            max={120}
            value={pxPerSecond}
            onChange={(e) => setPxPerSecond(Number(e.target.value))}
            className="w-20 accent-shopee-orange"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-dark-card border-t border-dark-border flex-shrink-0 overflow-hidden rounded-b-xl" style={{ height: "200px" }}>
        <div className="flex h-full">
          {/* Track labels */}
          <div className="w-24 flex-shrink-0 border-r border-dark-border flex flex-col">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-1 px-2 border-b border-dark-border"
                style={{ height: `${200 / tracks.length}px` }}
              >
                <button
                  onClick={() => setTracks((prev) => prev.map((t) => t.id === track.id ? { ...t, muted: !t.muted } : t))}
                  className={`p-0.5 rounded ${track.muted ? "text-red-400" : "text-text-secondary"}`}
                  title={track.muted ? "Desmutear" : "Mutar"}
                >
                  {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                </button>
                <span className="text-[10px] text-text-secondary truncate">{track.label}</span>
              </div>
            ))}
          </div>

          {/* Timeline scroll area */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-shopee relative">
            {/* Time ruler (click to seek) */}
            <div
              className="sticky top-0 h-5 border-b border-dark-border bg-dark-card z-10 relative cursor-pointer"
              style={{ width: `${totalDuration * pxPerSecond}px` }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
                setCurrentTime(Math.max(0, Math.min(x / pxPerSecond, totalDuration)));
              }}
            >
              {Array.from({ length: Math.ceil(totalDuration) }, (_, i) => (
                <span
                  key={i}
                  className="absolute text-[9px] text-text-secondary/50 top-1 pointer-events-none"
                  style={{ left: `${i * pxPerSecond}px` }}
                >
                  {i}s
                </span>
              ))}
            </div>

            {/* Tracks */}
            <div className="relative" style={{ width: `${totalDuration * pxPerSecond}px` }}>
              {tracks.map((track, trackIdx) => (
                <div
                  key={track.id}
                  className="relative border-b border-dark-border/50"
                  style={{ height: `${(200 - 20) / tracks.length}px` }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    setCurrentTime(Math.max(0, Math.min(x / pxPerSecond, totalDuration)));
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const rawDrop = Math.max(0, x / pxPerSecond);

                    const snapToEdge = (targetTrackClips: ClipItem[], clipDur: number, excludeId?: string) => {
                      const edges: number[] = [0];
                      targetTrackClips.forEach((c) => {
                        if (c.id === excludeId) return;
                        const effDur = c.duration - c.trimStart - c.trimEnd;
                        edges.push(c.startTime, c.startTime + effDur);
                      });
                      let best = rawDrop;
                      let bestDist = Infinity;
                      for (const edge of edges) {
                        const distStart = Math.abs(rawDrop - edge);
                        const distEnd = Math.abs(rawDrop + clipDur - edge);
                        if (distStart < bestDist) { bestDist = distStart; best = edge; }
                        if (distEnd < bestDist) { bestDist = distEnd; best = edge - clipDur; }
                      }
                      return Math.max(0, best);
                    };

                    const clipId = e.dataTransfer.getData("text/clip-id");
                    if (clipId) {
                      setTracks((prev) => {
                        let movedClip: ClipItem | null = null;
                        const cleaned = prev.map((t) => ({
                          ...t,
                          clips: t.clips.filter((c) => { if (c.id === clipId) { movedClip = c; return false; } return true; }),
                        }));
                        if (!movedClip) return prev;
                        const effDur = movedClip.duration - movedClip.trimStart - movedClip.trimEnd;
                        const targetClips = cleaned[trackIdx].clips;
                        const snapped = snapToEdge(targetClips, effDur, clipId);
                        const mc = { ...movedClip, startTime: snapped, trackIndex: trackIdx };
                        return cleaned.map((t, i) => i === trackIdx ? { ...t, clips: [...t.clips, mc] } : t);
                      });
                      return;
                    }

                    const mediaId = e.dataTransfer.getData("text/media-id");
                    const item = mediaItems.find((m) => m.id === mediaId);
                    if (!item) return;
                    if (track.type === "video" && item.type !== "video" && item.type !== "image") return;
                    if (track.type === "audio" && item.type !== "audio") return;
                    if (track.type === "subtitle") return;
                    const snapped = snapToEdge(track.clips, item.duration);
                    const clip: ClipItem = {
                      id: uid(), mediaId: item.id, name: item.name, type: item.type,
                      blobUrl: item.blobUrl, trackIndex: trackIdx, startTime: snapped,
                      duration: item.duration, trimStart: 0, trimEnd: 0, volume: 1,
                    };
                    setTracks((prev) => prev.map((t, i) => i === trackIdx ? { ...t, clips: [...t.clips, clip] } : t));
                  }}
                >
                  {track.clips.map((clip) => {
                    const effectiveDur = clip.duration - clip.trimStart - clip.trimEnd;
                    const left = clip.startTime * pxPerSecond;
                    const width = effectiveDur * pxPerSecond;
                    const isSelected = selectedClipId === clip.id;
                    const colors: Record<string, string> = {
                      video: "bg-blue-600/70 border-blue-400",
                      audio: "bg-emerald-600/70 border-emerald-400",
                      image: "bg-purple-600/70 border-purple-400",
                      subtitle: "bg-yellow-600/70 border-yellow-400",
                    };
                    return (
                      <div
                        key={clip.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("text/clip-id", clip.id);
                          e.dataTransfer.effectAllowed = "move";
                          setSelectedClipId(clip.id);
                        }}
                        className={`absolute top-1 bottom-1 rounded cursor-grab active:cursor-grabbing border transition-all ${colors[clip.type] ?? "bg-gray-600/70 border-gray-400"} ${isSelected ? "ring-2 ring-shopee-orange ring-offset-1 ring-offset-dark-card" : ""}`}
                        style={{ left: `${left}px`, width: `${Math.max(width, 8)}px` }}
                        onClick={(e) => { e.stopPropagation(); setSelectedClipId(clip.id); }}
                      >
                        <span className="text-[9px] text-white px-1 truncate block leading-tight mt-0.5 pointer-events-none">
                          {clip.type === "subtitle" ? clip.text?.slice(0, 20) : clip.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-shopee-orange z-20 pointer-events-none"
                style={{ left: `${currentTime * pxPerSecond}px` }}
              >
                <div className="w-3 h-3 bg-shopee-orange rounded-full -ml-[5px] -mt-1" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
