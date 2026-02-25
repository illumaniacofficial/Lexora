import { useState, createContext, useContext, useCallback, lazy, Suspense } from "react";
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
import { Loader2 } from "lucide-react";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Projects = lazy(() => import("@/pages/Projects"));
const NewProject = lazy(() => import("@/pages/NewProject"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const TrendIntelligence = lazy(() => import("@/pages/TrendIntelligence"));
const Marketing = lazy(() => import("@/pages/Marketing"));
const Autopilot = lazy(() => import("@/pages/Autopilot"));
const Library = lazy(() => import("@/pages/Library"));
const Settings = lazy(() => import("@/pages/Settings"));
const Storefront = lazy(() => import("@/pages/Storefront"));
const NotFound = lazy(() => import("@/pages/not-found"));

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

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-purple-400/50" />
    </div>
  );
}

function AdminRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/new" component={NewProject} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/trends" component={TrendIntelligence} />
        <Route path="/marketing" component={Marketing} />
        <Route path="/autopilot" component={Autopilot} />
        <Route path="/settings" component={Settings} />
        <Route path="/library" component={Library} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
    return (
      <Suspense fallback={<PageLoader />}>
        <Storefront />
      </Suspense>
    );
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
                <title>Lexora</title>
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
