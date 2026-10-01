import { useState, useEffect, createContext, useContext, useCallback, lazy, Suspense } from "react";
import { Switch, Route, useRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { HelmetProvider, Helmet } from "react-helmet-async";
import AudioMiniPlayer, { type NarrationState, type PlaybackState } from "@/components/audio-mini-player";
import { NotificationCenter } from "@/components/notification-center";
import LexoraCopilot from "@/components/lexora-copilot";
import { Bot } from "lucide-react";
import { Loader2 } from "lucide-react";
import Login from "@/pages/Login";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Projects = lazy(() => import("@/pages/Projects"));
const NewProject = lazy(() => import("@/pages/NewProject"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const TrendIntelligence = lazy(() => import("@/pages/TrendIntelligence"));
const ConceptLab = lazy(() => import("@/pages/ConceptLab"));
const Marketing = lazy(() => import("@/pages/Marketing"));
const Autopilot = lazy(() => import("@/pages/Autopilot"));
const Library = lazy(() => import("@/pages/Library"));
const Settings = lazy(() => import("@/pages/Settings"));
const ChatStudio = lazy(() => import("@/pages/ChatStudio"));
const Requests = lazy(() => import("@/pages/Requests"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Referrals = lazy(() => import("@/pages/Referrals"));
const Storefront = lazy(() => import("@/pages/Storefront"));
const NotFound = lazy(() => import("@/pages/not-found"));

interface PlaybackControls {
  togglePlay: () => void;
  nextPage: () => void;
  replay: () => void;
  close: () => void;
}

interface NarrationContextType {
  narrationState: NarrationState | null;
  setNarrationState: (state: NarrationState | null) => void;
  startNarration: (state: NarrationState) => void;
  playbackState: PlaybackState;
  playbackControls: PlaybackControls | null;
  setPlaybackState: (state: PlaybackState) => void;
  setPlaybackControls: (controls: PlaybackControls | null) => void;
  navigateToPageRequest: number | null;
  clearNavigateRequest: () => void;
  requestNavigateToPage: (globalPageIndex: number) => void;
  currentWordIndex: number;
  setCurrentWordIndex: (idx: number) => void;
}

const defaultPlayback: PlaybackState = { isPlaying: false, isLoading: false, progress: 0 };

const NarrationContext = createContext<NarrationContextType>({
  narrationState: null,
  setNarrationState: () => {},
  startNarration: () => {},
  playbackState: defaultPlayback,
  playbackControls: null,
  setPlaybackState: () => {},
  setPlaybackControls: () => {},
  navigateToPageRequest: null,
  clearNavigateRequest: () => {},
  requestNavigateToPage: () => {},
  currentWordIndex: -1,
  setCurrentWordIndex: () => {},
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
        <Route path="/concept-lab" component={ConceptLab} />
        <Route path="/trends" component={TrendIntelligence} />
        <Route path="/marketing" component={Marketing} />
        <Route path="/autopilot" component={Autopilot} />
        <Route path="/chat" component={ChatStudio} />
        <Route path="/settings" component={Settings} />
        <Route path="/library" component={Library} />
        <Route path="/requests" component={Requests} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/referrals" component={Referrals} />
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
  const [copilotOpen, setCopilotOpen] = useState(() => localStorage.getItem("lexora.copilot.open") === "true");

  useEffect(() => {
    localStorage.setItem("lexora.copilot.open", String(copilotOpen));
  }, [copilotOpen]);

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex min-w-0 flex-col flex-1 overflow-hidden">
          <header className="flex min-w-0 items-center justify-between px-3 sm:px-4 md:px-6 h-12 border-b border-border/30 glass-panel shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="text-muted-foreground hover:text-purple-400 transition-colors" aria-label="Toggle sidebar" />
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                size="sm"
                variant={copilotOpen ? "secondary" : "ghost"}
                onClick={() => setCopilotOpen((value) => !value)}
                className="h-8 gap-1.5 text-[9px] font-mono text-purple-300"
                data-testid="button-toggle-copilot"
                aria-label="Toggle Lexora Copilot"
              >
                <Bot className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copilot</span>
              </Button>
              <NotificationCenter />
              <div className="h-1 w-8 rounded-full neon-glow opacity-60" />
              <span className="text-[10px] font-mono text-muted-foreground/40 tracking-widest">v3.0</span>
            </div>
          </header>
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <main className="min-w-0 flex-1 overflow-hidden aurora-bg">
              <AdminRouter />
            </main>
            <LexoraCopilot open={copilotOpen} onClose={() => setCopilotOpen(false)} />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthGatedAdmin() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      .then(res => {
        setIsAuthenticated(res.ok);
        setAuthChecked(true);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setAuthChecked(true);
      });
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center aurora-bg">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400/50" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return <AdminLayout />;
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

  return <AuthGatedAdmin />;
}

function App() {
  const [narrationState, setNarrationState] = useState<NarrationState | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(defaultPlayback);
  const [playbackControls, setPlaybackControls] = useState<PlaybackControls | null>(null);
  const [navigateToPageRequest, setNavigateToPageRequest] = useState<number | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);

  const startNarration = useCallback((state: NarrationState) => {
    setNarrationState(state);
  }, []);

  const clearNavigateRequest = useCallback(() => {
    setNavigateToPageRequest(null);
  }, []);

  const requestNavigateToPage = useCallback((globalPageIndex: number) => {
    setNavigateToPageRequest(globalPageIndex);
  }, []);

  const handleTitleClick = useCallback((globalPageIndex: number | undefined) => {
    if (globalPageIndex !== undefined) {
      setNavigateToPageRequest(globalPageIndex);
    }
  }, []);

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <NarrationContext.Provider value={{ narrationState, setNarrationState, startNarration, playbackState, playbackControls, setPlaybackState, setPlaybackControls, navigateToPageRequest, clearNavigateRequest, requestNavigateToPage, currentWordIndex, setCurrentWordIndex }}>
              <Helmet>
                <title>Lexora</title>
              </Helmet>
              <AppRouter />
              {narrationState && (
                <AudioMiniPlayer
                  narration={narrationState}
                  onClose={() => { setNarrationState(null); setPlaybackControls(null); setPlaybackState(defaultPlayback); setCurrentWordIndex(-1); }}
                  onUpdateNarration={(updated) => setNarrationState(updated)}
                  onPlaybackStateChange={setPlaybackState}
                  onControlsReady={setPlaybackControls}
                  onTitleClick={handleTitleClick}
                  onWordIndexChange={setCurrentWordIndex}
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
