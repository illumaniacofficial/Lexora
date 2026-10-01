import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, FolderOpen, TrendingUp, Megaphone, Bot, Zap, Hexagon, Library, Share2, Volume2, Settings, MessageSquare,
  Play, Pause, SkipForward, RotateCcw, X, Loader2, Mic, LogOut, BarChart3, Sparkles,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useNarration } from "@/App";
import { VOICE_OPTIONS } from "@/components/audio-mini-player";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logoPath from "@assets/image_1772031076380.png";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "Concept Lab", url: "/concept-lab", icon: Sparkles },
  { title: "Trend Intel", url: "/trends", icon: TrendingUp },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Marketing", url: "/marketing", icon: Megaphone },
  { title: "Library", url: "/library", icon: Library },
  { title: "Scribe", url: "/chat", icon: MessageSquare },
  { title: "Autopilot", url: "/autopilot", icon: Bot },
  { title: "Settings", url: "/settings", icon: Settings },
];

function WaveformBars({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-end gap-[2px] h-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "w-[3px] rounded-full bg-gradient-to-t from-purple-500 to-cyan-400 transition-all",
            isPlaying ? `waveform-bar-${i}` : "h-[4px] opacity-40"
          )}
        />
      ))}
    </div>
  );
}

function ProgressRing({ progress, size = 36 }: { progress: number; size?: number }) {
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="absolute inset-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(270 50% 40% / 0.15)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#sidebar-progress-gradient)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-200"
      />
      <defs>
        <linearGradient id="sidebar-progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(270 100% 65%)" />
          <stop offset="100%" stopColor="hsl(190 100% 55%)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { narrationState, playbackState, playbackControls } = useNarration();
  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";

  const voiceLabel = narrationState ? VOICE_OPTIONS.find(v => v.value === narrationState.voice)?.label : "";
  const hasNextPage = narrationState ? narrationState.currentPageIndex < narrationState.allPages.length - 1 : false;
  const totalPages = narrationState?.allPages.length || 0;
  const currentPage = narrationState ? narrationState.currentPageIndex + 1 : 0;

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border/30 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center group">
            <div className="absolute inset-0 rounded-[14px] bg-[radial-gradient(circle_at_50%_35%,rgba(193,157,102,.16),rgba(143,74,94,.11)_48%,transparent_72%)] opacity-90 group-hover:opacity-100 transition-opacity duration-200" />
            <img src={logoPath} alt="Lexora" className="relative h-10 w-10 rounded-[14px] object-cover shadow-[0_12px_30px_-18px_rgba(193,157,102,.55)]" />
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-[-0.025em] text-[#f1e7dc] leading-none">Lexora</div>
            <div className="text-[10px] font-mono font-medium text-[#c19d66]/70 mt-1 leading-none tracking-widest uppercase">
              STORY STUDIO
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.2em] font-mono font-bold text-muted-foreground/40 px-3 mb-2">
            <Hexagon className="h-2.5 w-2.5 mr-1.5 inline" />
            NAVIGATION
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.url === "/" ? location === "/" : location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      className={cn(
                        "relative transition-all duration-300",
                        isActive
                          ? "bg-purple-500/10 text-purple-300 font-semibold border border-purple-500/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-transparent hover:border-purple-500/10"
                      )}
                    >
                      <Link href={item.url}>
                        {isActive && <span className="nav-active-bar" />}
                        <item.icon className={cn(
                          "h-4 w-4 transition-all duration-300",
                          isActive ? "text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" : ""
                        )} />
                        <span className="text-[13px] tracking-tight">{item.title}</span>
                        {isActive && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {narrationState && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.2em] font-mono font-bold text-purple-400/50 px-3 mb-2">
              <Volume2 className="h-2.5 w-2.5 mr-1.5 inline" />
              NOW PLAYING
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="mx-2 rounded-xl border border-purple-500/20 bg-gradient-to-b from-purple-500/[0.08] to-transparent overflow-hidden" data-testid="sidebar-now-playing">
                <div className="h-0.5 bg-border/10 relative">
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-300"
                    style={{ width: `${playbackState.progress}%` }}
                  />
                </div>

                <div className="p-3 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="relative flex items-center justify-center h-9 w-9 shrink-0 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <ProgressRing progress={playbackState.progress} size={36} />
                      <Mic className="h-3.5 w-3.5 text-purple-400 relative z-10" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold truncate text-purple-200 leading-tight">{narrationState.bookTitle}</p>
                      <p className="text-[9px] font-mono text-muted-foreground/50 truncate mt-0.5">
                        Ch {narrationState.chapterNumber}: {narrationState.chapterTitle}
                      </p>
                    </div>
                    <Button
                      size="icon" variant="ghost"
                      onClick={() => playbackControls?.close()}
                      className="h-5 w-5 text-muted-foreground/30 hover:text-red-400 shrink-0 -mt-0.5 -mr-1"
                      data-testid="button-sidebar-player-close" aria-label="Stop narration"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <WaveformBars isPlaying={playbackState.isPlaying} />
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => playbackControls?.replay()}
                        disabled={playbackState.isLoading}
                        className="h-7 w-7 text-muted-foreground/50 hover:text-purple-300 disabled:opacity-20"
                        data-testid="button-sidebar-replay" aria-label="Replay"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>

                      <Button
                        size="icon"
                        onClick={() => playbackControls?.togglePlay()}
                        disabled={playbackState.isLoading}
                        className={cn(
                          "h-8 w-8 rounded-full transition-all duration-300",
                          playbackState.isPlaying
                            ? "bg-purple-500 hover:bg-purple-600 text-white shadow-[0_0_16px_rgba(147,51,234,0.4)]"
                            : "bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30"
                        )}
                        data-testid="button-sidebar-play" aria-label={playbackState.isPlaying ? "Pause" : "Play"}
                      >
                        {playbackState.isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : playbackState.isPlaying ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5 ml-0.5" />
                        )}
                      </Button>

                      <Button
                        size="icon" variant="ghost"
                        onClick={() => playbackControls?.nextPage()}
                        disabled={!hasNextPage || playbackState.isLoading}
                        className="h-7 w-7 text-muted-foreground/50 hover:text-purple-300 disabled:opacity-20"
                        data-testid="button-sidebar-next" aria-label="Next page"
                      >
                        <SkipForward className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Volume2 className="h-2.5 w-2.5 text-purple-400/40" />
                      <span className="text-[8px] font-mono text-purple-400/40 uppercase tracking-widest">{voiceLabel}</span>
                    </div>
                    <span className="text-[8px] font-mono text-muted-foreground/30">
                      {currentPage}/{totalPages}
                    </span>
                  </div>
                </div>
              </div>
            </SidebarGroupContent>
            {isCollapsed && (
              <div className="flex justify-center py-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => playbackControls?.togglePlay()}
                      className="relative flex items-center justify-center h-9 w-9 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 transition-all duration-300"
                      data-testid="sidebar-now-playing-icon"
                      aria-label={playbackState.isPlaying ? "Pause narration" : "Play narration"}
                    >
                      <ProgressRing progress={playbackState.progress} size={36} />
                      {playbackState.isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 text-purple-400 animate-spin relative z-10" />
                      ) : playbackState.isPlaying ? (
                        <Pause className="h-3.5 w-3.5 text-purple-400 relative z-10" />
                      ) : (
                        <Play className="h-3.5 w-3.5 text-purple-400 ml-0.5 relative z-10" />
                      )}
                      {playbackState.isPlaying && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)] border border-background" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs max-w-[180px]">
                    <p className="font-medium truncate">{narrationState.bookTitle}</p>
                    <p className="text-muted-foreground">Ch {narrationState.chapterNumber} · pg {narrationState.pageInChapter}/{narrationState.totalPagesInChapter}</p>
                    <p className="text-muted-foreground/60 text-[10px] mt-0.5">{voiceLabel} · {Math.round(playbackState.progress)}%</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/20 px-4 py-3 space-y-2">
        <Link href="/library#invites">
          <button
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[11px] font-mono text-muted-foreground/50 hover:text-purple-300 hover:bg-purple-500/5 transition-all duration-300 border border-transparent hover:border-purple-500/15"
            data-testid="button-sidebar-invites"
          >
            <Share2 className="h-3.5 w-3.5 text-purple-400/50" />
            <span className="tracking-wider uppercase">Share & Invites</span>
          </button>
        </Link>
        <div className="flex items-center justify-between px-3">
          <div className="flex items-center gap-2.5">
            <Zap className="h-3 w-3 text-cyan-400/50" />
            <span className="text-[9px] font-mono text-muted-foreground/40 tracking-wider uppercase">v3.0</span>
          </div>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              window.location.reload();
            }}
            className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/40 hover:text-red-400 transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="h-3 w-3" />
            <span className="tracking-wider uppercase">Logout</span>
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
