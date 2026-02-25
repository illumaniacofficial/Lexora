import { useState, createContext, useContext, useCallback } from "react";
import { Switch, Route, useRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { HelmetProvider, Helmet } from "react-helmet-async";
import AudioMiniPlayer, { type NarrationState } from "@/components/audio-mini-player";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import NewProject from "@/pages/NewProject";
import ProjectDetail from "@/pages/ProjectDetail";
import TrendIntelligence from "@/pages/TrendIntelligence";
import Marketing from "@/pages/Marketing";
import Autopilot from "@/pages/Autopilot";
import Library from "@/pages/Library";
import Storefront from "@/pages/Storefront";
import NotFound from "@/pages/not-found";

interface NarrationContextType {
  narrationState: NarrationState | null;
  setNarrationState: (state: NarrationState | null) => void;
  startNarration: (state: NarrationState) => void;
}

const NarrationContext = createContext<NarrationContextType>({
  narrationState: null,
  setNarrationState: () => {},
  startNarration: () => {},
});

export function useNarration() {
  return useContext(NarrationContext);
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/new" component={NewProject} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/trends" component={TrendIntelligence} />
      <Route path="/marketing" component={Marketing} />
      <Route path="/autopilot" component={Autopilot} />
      <Route path="/library" component={Library} />
      <Route component={NotFound} />
    </Switch>
  );
}

const sidebarStyle = {
  "--sidebar-width": "15rem",
  "--sidebar-width-icon": "3.5rem",
};

function AdminLayout() {
  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-6 h-12 border-b border-border/30 glass-panel shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="text-muted-foreground hover:text-purple-400 transition-colors" aria-label="Toggle sidebar" />
            <div className="flex items-center gap-3">
              <div className="h-1 w-8 rounded-full neon-glow opacity-60" />
              <span className="text-[10px] font-mono text-muted-foreground/40 tracking-widest">v3.0</span>
            </div>
          </header>
          <main className="flex-1 overflow-hidden aurora-bg">
            <AdminRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppRouter() {
  const [isStore] = useRoute("/store/:token");

  if (isStore) {
    return <Storefront />;
  }

  return <AdminLayout />;
}

function App() {
  const [narrationState, setNarrationState] = useState<NarrationState | null>(null);

  const startNarration = useCallback((state: NarrationState) => {
    setNarrationState(state);
  }, []);

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <NarrationContext.Provider value={{ narrationState, setNarrationState, startNarration }}>
              <Helmet>
                <title>BookForge Studio Supreme</title>
              </Helmet>
              <AppRouter />
              {narrationState && (
                <AudioMiniPlayer
                  narration={narrationState}
                  onClose={() => setNarrationState(null)}
                  onUpdateNarration={(updated) => setNarrationState(updated)}
                />
              )}
              <Toaster />
            </NarrationContext.Provider>
          </TooltipProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
