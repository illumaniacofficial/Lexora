import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center" data-testid="error-boundary">
          <div className="relative mb-6">
            <div className="absolute inset-0 neon-glow-warm opacity-30 blur-3xl rounded-full scale-150" />
            <AlertCircle className="h-16 w-16 text-red-400 relative" />
          </div>
          <h1 className="text-2xl font-bold tracking-tighter mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground/60 max-w-md mb-6 font-mono">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="neon-glow text-white border-0"
            data-testid="button-reload"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
