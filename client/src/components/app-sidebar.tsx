import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, FolderOpen, TrendingUp, Megaphone, Bot, BookOpen, Zap, Hexagon, Library,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "Trend Intel", url: "/trends", icon: TrendingUp },
  { title: "Marketing", url: "/marketing", icon: Megaphone },
  { title: "Library", url: "/library", icon: Library },
  { title: "Autopilot", url: "/autopilot", icon: Bot },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border/40 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <div className="absolute inset-0 rounded-xl neon-glow opacity-80 blur-[1px]" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl neon-glow">
              <BookOpen className="h-5 w-5 text-white drop-shadow-lg" />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight shimmer-text leading-none">BookForge</div>
            <div className="text-[10px] font-mono font-medium text-purple-400/80 mt-1 leading-none tracking-widest uppercase">
              STUDIO SUPREME
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
      </SidebarContent>

      <SidebarFooter className="border-t border-border/30 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Zap className="h-3.5 w-3.5 text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
          <span className="text-[10px] font-mono text-muted-foreground/60 tracking-wider uppercase">
            AI · PUBLISHING · 2026
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
