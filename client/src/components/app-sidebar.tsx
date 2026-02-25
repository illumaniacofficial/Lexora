import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, FolderOpen, TrendingUp, Megaphone, Bot, Zap, Hexagon, Library, Share2, Volume2, Pause, Settings,
} from "lucide-react";
import { useNarration } from "@/App";
import { VOICE_OPTIONS } from "@/components/audio-mini-player";
import logoPath from "@assets/image_1772031076380.png";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "Trend Intel", url: "/trends", icon: TrendingUp },
  { title: "Marketing", url: "/marketing", icon: Megaphone },
  { title: "Library", url: "/library", icon: Library },
  { title: "Autopilot", url: "/autopilot", icon: Bot },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { narrationState } = useNarration();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border/40 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <div className="absolute inset-0 rounded-xl neon-glow opacity-80 blur-[2px]" />
            <img src={logoPath} alt="Lexora" className="relative h-10 w-10 rounded-xl object-cover drop-shadow-lg" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight shimmer-text leading-none">Lexora</div>
            <div className="text-[10px] font-mono font-medium text-purple-400/80 mt-1 leading-none tracking-widest uppercase">
              AI PUBLISHING
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
                      className={isActive
                        ? "bg-purple-500/10 text-purple-300 font-semibold border border-purple-500/20 glow-border"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03] border border-transparent"
                      }
                    >
                      <Link href={item.url}>
                        <item.icon className={`h-4 w-4 ${isActive ? "text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" : ""}`} />
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
              <div className="mx-2 p-3 rounded-xl border border-purple-500/20 bg-purple-500/5" data-testid="sidebar-now-playing">
                <p className="text-[11px] font-medium truncate text-purple-200">{narrationState.bookTitle}</p>
                <p className="text-[9px] font-mono text-muted-foreground/40 truncate mt-0.5">
                  Ch {narrationState.chapterNumber} · pg {narrationState.pageInChapter}/{narrationState.totalPagesInChapter}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_6px_rgba(168,85,247,0.6)]" />
                  <span className="text-[8px] font-mono text-purple-400/50 uppercase tracking-widest">
                    {VOICE_OPTIONS.find(v => v.value === narrationState.voice)?.label}
                  </span>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/30 px-4 py-3 space-y-2">
        <Link href="/library#invites">
          <button
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[11px] font-mono text-muted-foreground/50 hover:text-purple-300 hover:bg-purple-500/5 transition-all border border-transparent hover:border-purple-500/15"
            data-testid="button-sidebar-invites"
          >
            <Share2 className="h-3.5 w-3.5 text-purple-400/50" />
            <span className="tracking-wider uppercase">Share & Invites</span>
          </button>
        </Link>
        <div className="flex items-center gap-2.5 px-3">
          <Zap className="h-3 w-3 text-cyan-400/50" />
          <span className="text-[9px] font-mono text-muted-foreground/40 tracking-wider uppercase">
            v3.0
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
