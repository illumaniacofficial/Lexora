import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-md mx-4 border-border/20 bg-card/30 glow-border">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 neon-glow-warm opacity-20 blur-2xl rounded-full" />
            <AlertCircle className="h-12 w-12 text-red-400/60 relative" />
          </div>
          <h1 className="text-3xl font-bold tracking-tighter mb-2">404</h1>
          <p className="text-[11px] font-mono text-muted-foreground/40 mb-6">Signal lost. Page not found.</p>
          <Link href="/">
            <Button className="neon-glow text-white border-0 font-mono text-[12px]">Return to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
