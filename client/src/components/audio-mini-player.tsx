import { useState, useRef, useEffect, useCallback } from "react";
import { X, Play, Pause, SkipForward, RotateCcw, Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
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

interface NarrationState {
  bookTitle: string;
  chapterTitle: string;
  chapterNumber: number;
  pageInChapter: number;
  totalPagesInChapter: number;
  text: string;
  voice: NarratorVoice;
  allPages: { chapterNumber: number; chapterTitle: string; pageInChapter: number; totalPagesInChapter: number; text: string }[];
  currentPageIndex: number;
}

interface AudioMiniPlayerProps {
  narration: NarrationState;
  onClose: () => void;
  onUpdateNarration: (narration: NarrationState) => void;
  onPlaybackStateChange?: (state: PlaybackState) => void;
  onControlsReady?: (controls: { togglePlay: () => void; nextPage: () => void; replay: () => void; close: () => void }) => void;
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
  const response = await apiRequest("POST", "/api/tts", { text: cleanText, voice });
  const data = await response.json();
  const dataUrl = `data:audio/mp3;base64,${data.audio}`;
  audioCache.set(key, dataUrl);
  if (audioCache.size > 20) {
    const firstKey = audioCache.keys().next().value;
    if (firstKey) audioCache.delete(firstKey);
  }
  return dataUrl;
}

export default function AudioMiniPlayer({ narration, onClose, onUpdateNarration, onPlaybackStateChange, onControlsReady }: AudioMiniPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const narrationRef = useRef(narration);
  const onUpdateRef = useRef(onUpdateNarration);

  useEffect(() => {
    onPlaybackStateChange?.({ isPlaying, isLoading, progress });
  }, [isPlaying, isLoading, progress]);

  useEffect(() => { narrationRef.current = narration; }, [narration]);
  useEffect(() => { onUpdateRef.current = onUpdateNarration; }, [onUpdateNarration]);

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

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audioData = await fetchAudioCached(text, voice);
      const audio = new Audio(audioData);
      audioRef.current = audio;

      const latest = narrationRef.current;
      prefetchNext(latest.currentPageIndex, voice, latest.allPages);

      const expectedIdx = narration.currentPageIndex;
      audio.onended = () => {
        setIsPlaying(false);
        setProgress(100);
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

      const updateProgress = () => {
        if (audio && audio.duration > 0) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
        if (!audio.paused) {
          animationRef.current = requestAnimationFrame(updateProgress);
        }
      };

      await audio.play();
      setIsPlaying(true);
      setIsLoading(false);
      animationRef.current = requestAnimationFrame(updateProgress);
    } catch (err) {
      console.error("TTS playback error:", err);
      setIsLoading(false);
    }
  }, [prefetchNext]);

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

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      const updateProgress = () => {
        if (audioRef.current && audioRef.current.duration > 0) {
          setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
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

  const hasNextPage = narration.currentPageIndex < narration.allPages.length - 1;

  return (
    <div className="fixed bottom-6 right-6 z-[200] w-80 rounded-2xl border border-purple-500/30 bg-card/95 backdrop-blur-xl shadow-[0_0_40px_rgba(147,51,234,0.15)] overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
      <div className="h-1 bg-border/20 relative">
        <div
          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Volume2 className="h-3 w-3 text-purple-400 shrink-0" />
              <span className="text-[9px] font-mono text-purple-400/60 uppercase tracking-[0.2em]">AI Narrator</span>
            </div>
            <p className="text-[12px] font-medium text-foreground truncate" data-testid="mini-player-title">{narration.bookTitle}</p>
            <p className="text-[10px] text-muted-foreground/50 font-mono truncate">
              Ch {narration.chapterNumber}: {narration.chapterTitle} — pg {narration.pageInChapter}/{narration.totalPagesInChapter}
            </p>
          </div>
          <Button
            size="icon" variant="ghost"
            onClick={handleClose}
            className="h-6 w-6 text-muted-foreground/40 hover:text-foreground shrink-0"
            data-testid="button-mini-player-close" aria-label="Close mini player"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button
            size="icon" variant="ghost"
            onClick={replay}
            disabled={isLoading}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            data-testid="button-mini-player-replay" aria-label="Replay page"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            onClick={isLoading ? undefined : togglePlay}
            disabled={isLoading}
            className={cn(
              "h-11 w-11 rounded-full transition-all",
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
            className="h-9 w-9 text-muted-foreground hover:text-foreground disabled:opacity-30"
            data-testid="button-mini-player-next" aria-label="Next page"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-2 flex items-center justify-center">
          <span className="text-[9px] font-mono text-muted-foreground/30">
            Voice: {VOICE_OPTIONS.find(v => v.value === narration.voice)?.label || narration.voice}
          </span>
        </div>
      </div>
    </div>
  );
}
