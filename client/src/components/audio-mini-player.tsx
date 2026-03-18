import { useState, useRef, useEffect, useCallback } from "react";
import { X, Play, Pause, SkipForward, SkipBack, RotateCcw, Volume2, VolumeX, Loader2, Gauge, ChevronDown, ChevronUp, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { stripMarkdown } from "@/components/markdown-renderer";

export interface PlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
}

export type NarratorVoice = string;

export const DEFAULT_VOICE_ID = "qJemC2CfKzP2DljOYBYj";

export const VOICE_OPTIONS: { value: NarratorVoice; label: string; description: string }[] = [
  { value: "qJemC2CfKzP2DljOYBYj", label: "Sergio", description: "Professional author voice" },
  { value: "4MnJDVdLqUeSlssQcssu", label: "Sergio Instant", description: "Cloned author voice" },
  { value: "JBFqnCBsd6RMkjVDRZzb", label: "George", description: "Warm, captivating storyteller" },
  { value: "nPczCjzI2devNBz1zQrb", label: "Brian", description: "Deep, resonant & comforting" },
  { value: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", description: "Velvety actress" },
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", description: "Mature, reassuring & confident" },
  { value: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice", description: "Clear, engaging educator" },
  { value: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", description: "Steady broadcaster" },
];

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

interface NarrationState {
  bookTitle: string;
  chapterTitle: string;
  chapterNumber: number;
  pageInChapter: number;
  totalPagesInChapter: number;
  text: string;
  voice: NarratorVoice;
  allPages: { chapterNumber: number; chapterTitle: string; pageInChapter: number; totalPagesInChapter: number; text: string; globalPageIndex?: number }[];
  currentPageIndex: number;
}

interface AudioMiniPlayerProps {
  narration: NarrationState;
  onClose: () => void;
  onUpdateNarration: (narration: NarrationState) => void;
  onPlaybackStateChange?: (state: PlaybackState) => void;
  onControlsReady?: (controls: { togglePlay: () => void; nextPage: () => void; replay: () => void; close: () => void }) => void;
  onTitleClick?: (globalPageIndex: number | undefined) => void;
  onWordIndexChange?: (wordIndex: number) => void;
}

export type { NarrationState };

const audioCache = new Map<string, string>();
function cacheKey(text: string, voice: string): string {
  return `${voice}:${text.slice(0, 100)}:${text.length}`;
}

async function fetchAudioCached(text: string, voice: NarratorVoice): Promise<string> {
  const key = cacheKey(text, voice);
  const cached = audioCache.get(key);
  if (cached) return cached;
  const cleanText = stripMarkdown(text).slice(0, 4000);
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: cleanText, voice }),
  });
  if (!response.ok) {
    const errBody = await response.text().catch(() => "Unknown error");
    throw new Error(`TTS request failed (${response.status}): ${errBody}`);
  }
  const data = await response.json();
  if (!data.audio || typeof data.audio !== "string" || data.audio.length < 100) {
    throw new Error("Received empty or invalid audio data from server");
  }
  const dataUrl = `data:audio/mp3;base64,${data.audio}`;
  audioCache.set(key, dataUrl);
  if (audioCache.size > 20) {
    const firstKey = audioCache.keys().next().value;
    if (firstKey) audioCache.delete(firstKey);
  }
  return dataUrl;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioMiniPlayer({ narration, onClose, onUpdateNarration, onPlaybackStateChange, onControlsReady, onTitleClick, onWordIndexChange }: AudioMiniPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const narrationRef = useRef(narration);
  const onUpdateRef = useRef(onUpdateNarration);
  const onWordIndexChangeRef = useRef(onWordIndexChange);
  const wordCountRef = useRef(0);

  useEffect(() => {
    onPlaybackStateChange?.({ isPlaying, isLoading, progress });
  }, [isPlaying, isLoading, progress]);

  useEffect(() => { narrationRef.current = narration; }, [narration]);
  useEffect(() => { onUpdateRef.current = onUpdateNarration; }, [onUpdateNarration]);
  useEffect(() => { onWordIndexChangeRef.current = onWordIndexChange; }, [onWordIndexChange]);

  const prefetchNext = useCallback((currentIdx: number, voice: NarratorVoice, allPages: NarrationState["allPages"]) => {
    const nextIdx = currentIdx + 1;
    if (nextIdx < allPages.length) {
      fetchAudioCached(allPages[nextIdx].text, voice).catch(() => {});
    }
  }, []);

  const generateAndPlay = useCallback(async (text: string, voice: NarratorVoice) => {
    try {
      setIsLoading(true);
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const cleanText = stripMarkdown(text).slice(0, 4000);
      const words = cleanText.split(/\s+/).filter(Boolean);
      wordCountRef.current = words.length;
      onWordIndexChangeRef.current?.(-1);

      const audioData = await fetchAudioCached(text, voice);
      const audio = new Audio(audioData);
      audio.volume = isMuted ? 0 : volume;
      audio.playbackRate = speed;
      audioRef.current = audio;

      const latest = narrationRef.current;
      prefetchNext(latest.currentPageIndex, voice, latest.allPages);

      const expectedIdx = narration.currentPageIndex;
      audio.onended = () => {
        setIsPlaying(false);
        setProgress(100);
        onWordIndexChangeRef.current?.(words.length - 1);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        setTimeout(() => {
          const latest = narrationRef.current;
          if (latest.currentPageIndex !== expectedIdx) return;
          const nextIdx = latest.currentPageIndex + 1;
          if (nextIdx < latest.allPages.length) {
            const nextP = latest.allPages[nextIdx];
            onUpdateRef.current({
              ...latest,
              chapterNumber: nextP.chapterNumber,
              chapterTitle: nextP.chapterTitle,
              pageInChapter: nextP.pageInChapter,
              totalPagesInChapter: nextP.totalPagesInChapter,
              text: nextP.text,
              currentPageIndex: nextIdx,
            });
          }
        }, 400);
      };

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      const wc = words.length;
      const updateProgress = () => {
        if (audio && audio.duration > 0) {
          const pct = audio.currentTime / audio.duration;
          setProgress(pct * 100);
          setCurrentTime(audio.currentTime);
          setDuration(audio.duration);
          const wi = Math.min(Math.floor(pct * wc), wc - 1);
          onWordIndexChangeRef.current?.(wi);
        }
        if (!audio.paused) {
          animationRef.current = requestAnimationFrame(updateProgress);
        }
      };

      await audio.play();
      setIsPlaying(true);
      setIsLoading(false);
      animationRef.current = requestAnimationFrame(updateProgress);
    } catch (err: any) {
      console.error("TTS playback error:", err);
      setIsPlaying(false);
      setIsLoading(false);
      setProgress(0);
    }
  }, [prefetchNext, volume, isMuted, speed]);

  useEffect(() => {
    generateAndPlay(narration.text, narration.voice);
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [narration.text, narration.currentPageIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      const wc = wordCountRef.current;
      const updateProgress = () => {
        if (audioRef.current && audioRef.current.duration > 0) {
          const pct = audioRef.current.currentTime / audioRef.current.duration;
          setProgress(pct * 100);
          setCurrentTime(audioRef.current.currentTime);
          const wi = Math.min(Math.floor(pct * wc), wc - 1);
          onWordIndexChangeRef.current?.(wi);
        }
        if (audioRef.current && !audioRef.current.paused) {
          animationRef.current = requestAnimationFrame(updateProgress);
        }
      };
      animationRef.current = requestAnimationFrame(updateProgress);
    }
  }, [isPlaying]);

  const replay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
      setProgress(0);
      setCurrentTime(0);
    } else {
      generateAndPlay(narration.text, narration.voice);
    }
  }, [narration.text, narration.voice, generateAndPlay]);

  const nextPage = useCallback(() => {
    const nextIdx = narration.currentPageIndex + 1;
    if (nextIdx < narration.allPages.length) {
      const nextP = narration.allPages[nextIdx];
      onUpdateNarration({
        ...narration,
        chapterNumber: nextP.chapterNumber,
        chapterTitle: nextP.chapterTitle,
        pageInChapter: nextP.pageInChapter,
        totalPagesInChapter: nextP.totalPagesInChapter,
        text: nextP.text,
        currentPageIndex: nextIdx,
      });
    }
  }, [narration, onUpdateNarration]);

  const prevPage = useCallback(() => {
    const prevIdx = narration.currentPageIndex - 1;
    if (prevIdx >= 0) {
      const prevP = narration.allPages[prevIdx];
      onUpdateNarration({
        ...narration,
        chapterNumber: prevP.chapterNumber,
        chapterTitle: prevP.chapterTitle,
        pageInChapter: prevP.pageInChapter,
        totalPagesInChapter: prevP.totalPagesInChapter,
        text: prevP.text,
        currentPageIndex: prevIdx,
      });
    }
  }, [narration, onUpdateNarration]);

  const handleClose = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    onClose();
  }, [onClose]);

  useEffect(() => {
    onControlsReady?.({ togglePlay, nextPage, replay, close: handleClose });
  }, [togglePlay, nextPage, replay, handleClose]);

  const handleSeek = useCallback((value: number[]) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const pct = value[0];
    const newTime = (pct / 100) * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
    setProgress(pct);
    setCurrentTime(newTime);
  }, []);

  const hasNextPage = narration.currentPageIndex < narration.allPages.length - 1;
  const hasPrevPage = narration.currentPageIndex > 0;
  const totalPages = narration.allPages.length;
  const currentPageNum = narration.currentPageIndex + 1;

  const currentGlobalIdx = narration.allPages[narration.currentPageIndex]?.globalPageIndex;
  const isTitleClickable = !!onTitleClick && currentGlobalIdx !== undefined;

  const handleTitleClick = useCallback(() => {
    if (onTitleClick && currentGlobalIdx !== undefined) {
      onTitleClick(currentGlobalIdx);
    }
  }, [onTitleClick, currentGlobalIdx]);

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[200] rounded-full border border-purple-500/30 bg-card/95 backdrop-blur-xl shadow-[0_0_30px_rgba(147,51,234,0.15)] animate-in slide-in-from-bottom-3 duration-200" data-testid="audio-mini-player-minimized">
        <div className="flex items-center gap-1 pl-3 pr-1 py-1">
          <div className="relative w-2 h-2 mr-1 shrink-0">
            {isPlaying && <span className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-40" />}
            <span className={cn("block w-2 h-2 rounded-full", isPlaying ? "bg-purple-400" : "bg-muted-foreground/30")} />
          </div>
          <button
            onClick={handleTitleClick}
            className={cn(
              "text-[11px] font-medium truncate max-w-[140px]",
              isTitleClickable ? "text-foreground hover:text-purple-300 cursor-pointer transition-colors" : "text-foreground cursor-default"
            )}
            data-testid="mini-player-minimized-title"
          >
            {narration.bookTitle}
          </button>
          <span className="text-[8px] font-mono text-muted-foreground/30 mx-1">{currentPageNum}/{totalPages}</span>
          <Button
            size="icon"
            onClick={isLoading ? undefined : togglePlay}
            disabled={isLoading}
            className={cn(
              "h-8 w-8 rounded-full transition-all shrink-0",
              isPlaying
                ? "bg-purple-500 hover:bg-purple-600 text-white shadow-[0_0_12px_rgba(147,51,234,0.3)]"
                : "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30"
            )}
            data-testid="button-mini-player-play-minimized"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </Button>
          <Button
            size="icon" variant="ghost"
            onClick={() => setIsMinimized(false)}
            className="h-7 w-7 text-muted-foreground/40 hover:text-foreground shrink-0"
            data-testid="button-mini-player-expand" aria-label="Expand player"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon" variant="ghost"
            onClick={handleClose}
            className="h-7 w-7 text-muted-foreground/40 hover:text-foreground shrink-0"
            data-testid="button-mini-player-close-minimized" aria-label="Close"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[200] w-[340px] rounded-2xl border border-purple-500/30 bg-card/95 backdrop-blur-xl shadow-[0_0_40px_rgba(147,51,234,0.15)] overflow-hidden animate-in slide-in-from-bottom-5 duration-300" data-testid="audio-mini-player">
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Volume2 className="h-3 w-3 text-purple-400 shrink-0" />
              <span className="text-[9px] font-mono text-purple-400/60 uppercase tracking-[0.2em]">AI Narrator</span>
              <span className="text-[8px] font-mono text-muted-foreground/25 ml-auto">{currentPageNum}/{totalPages}</span>
            </div>
            <button
              onClick={handleTitleClick}
              className={cn(
                "text-[12px] font-medium truncate block w-full text-left",
                isTitleClickable ? "text-foreground hover:text-purple-300 cursor-pointer transition-colors" : "text-foreground cursor-default"
              )}
              data-testid="mini-player-title"
            >
              {narration.bookTitle}
            </button>
            <p className="text-[10px] text-muted-foreground/50 font-mono truncate">
              Ch {narration.chapterNumber}: {narration.chapterTitle} — pg {narration.pageInChapter}/{narration.totalPagesInChapter}
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              size="icon" variant="ghost"
              onClick={() => setIsMinimized(true)}
              className="h-6 w-6 text-muted-foreground/40 hover:text-foreground"
              data-testid="button-mini-player-minimize" aria-label="Minimize player"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon" variant="ghost"
              onClick={handleClose}
              className="h-6 w-6 text-muted-foreground/40 hover:text-foreground"
              data-testid="button-mini-player-close" aria-label="Close mini player"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 pb-1">
        <Slider
          value={[progress]}
          onValueChange={handleSeek}
          max={100}
          step={0.1}
          className="h-5 cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-purple-400 [&_[role=slider]]:bg-purple-400 [&_[role=slider]]:shadow-[0_0_8px_rgba(147,51,234,0.5)] [&_[data-orientation=horizontal]>span:first-child]:bg-gradient-to-r [&_[data-orientation=horizontal]>span:first-child]:from-purple-500 [&_[data-orientation=horizontal]>span:first-child]:to-cyan-400"
          data-testid="mini-player-seekbar"
        />
        <div className="flex justify-between mt-0.5 mb-2">
          <span className="text-[8px] font-mono text-muted-foreground/30">{formatTime(currentTime)}</span>
          <span className="text-[8px] font-mono text-muted-foreground/30">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="flex items-center justify-center gap-1.5">
          <Button
            size="icon" variant="ghost"
            onClick={prevPage}
            disabled={!hasPrevPage || isLoading}
            className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-20"
            data-testid="button-mini-player-prev" aria-label="Previous page"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="icon" variant="ghost"
            onClick={replay}
            disabled={isLoading}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            data-testid="button-mini-player-replay" aria-label="Replay page"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="icon"
            onClick={isLoading ? undefined : togglePlay}
            disabled={isLoading}
            className={cn(
              "h-12 w-12 rounded-full transition-all",
              isPlaying
                ? "bg-purple-500 hover:bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]"
                : "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30"
            )}
            data-testid="button-mini-player-play" aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>

          <Button
            size="icon" variant="ghost"
            onClick={nextPage}
            disabled={!hasNextPage || isLoading}
            className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-20"
            data-testid="button-mini-player-next" aria-label="Next page"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>

          <div className="relative">
            <Button
              size="icon" variant="ghost"
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              data-testid="button-mini-player-speed" aria-label="Playback speed"
            >
              <span className="text-[9px] font-mono font-bold">{speed}x</span>
            </Button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-1 bg-card/95 border border-border/30 rounded-lg shadow-xl backdrop-blur-lg py-1 min-w-[60px]">
                {SPEED_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSpeed(s); setShowSpeedMenu(false); }}
                    className={cn(
                      "w-full px-3 py-1 text-[10px] font-mono text-left hover:bg-white/[0.05] transition-colors",
                      speed === s ? "text-purple-400 font-bold" : "text-muted-foreground/60"
                    )}
                    data-testid={`speed-option-${s}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <Button
            size="icon" variant="ghost"
            onClick={() => setIsMuted(!isMuted)}
            className="h-6 w-6 text-muted-foreground/40 hover:text-foreground shrink-0"
            data-testid="button-mini-player-mute" aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            onValueChange={(v) => { setVolume(v[0] / 100); if (isMuted) setIsMuted(false); }}
            max={100}
            step={1}
            className="flex-1 h-4 [&_[role=slider]]:h-2.5 [&_[role=slider]]:w-2.5 [&_[role=slider]]:border-purple-400/50 [&_[role=slider]]:bg-purple-400/50"
            data-testid="mini-player-volume"
          />
          <span className="text-[8px] font-mono text-muted-foreground/25 w-5 text-right shrink-0">
            {VOICE_OPTIONS.find(v => v.value === narration.voice)?.label?.slice(0, 3) || "?"}
          </span>
        </div>
      </div>
    </div>
  );
}
