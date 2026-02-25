import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, FolderOpen, TrendingUp, Megaphone, Bot, BookOpen, Zap, Sparkles,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "Trend Intelligence", url: "/trends", icon: TrendingUp },
  { title: "Marketing Suite", url: "/marketing", icon: Megaphone },
  { title: "Autopilot", url: "/autopilot", icon: Bot },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg premium-gradient shadow-md">
            <BookOpen className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-sidebar-foreground leading-none">BookForge</div>
            <div className="text-[11px] font-medium text-primary mt-0.5 leading-none flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" /> Studio Supreme
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60 px-3 mb-1">Platform</SidebarGroupLabel>
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
                      className={isActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}
                    >
                      <Link href={item.url}>
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        <span className="text-[13px]">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full premium-gradient-subtle border border-primary/10">
            <Zap className="h-3 w-3 text-primary" />
          </div>
          <div className="text-[11px] text-muted-foreground font-medium">
            AI-Powered Publishing
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
