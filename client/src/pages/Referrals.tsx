import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Share2, Hexagon, Plus, Copy, Trash2, MousePointerClick, ShoppingBag, DollarSign, AlertCircle, Link2 } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Referral } from "@shared/schema";

interface InviteToken {
  id: number;
  token: string;
  label: string;
  isActive: boolean;
}

function StatCard({ icon: Icon, label, value, glow }: { icon: any; label: string; value: string; glow: string }) {
  return (
    <Card className="border-border/20 bg-card/30 overflow-hidden">
      <CardContent className="pt-5 pb-5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${glow} shadow-lg mb-3`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <p className="text-2xl font-bold tracking-tight font-mono" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
        <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5 uppercase tracking-wider">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function Referrals() {
  const { toast } = useToast();
  const [newCode, setNewCode] = useState("");

  const { data: referrals = [], isLoading, error } = useQuery<Referral[]>({ queryKey: ["/api/referrals"] });
  const { data: invites = [] } = useQuery<InviteToken[]>({ queryKey: ["/api/invites"] });

  const activeInvite = invites.find(i => i.isActive) || invites[0];

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = newCode.trim() ? { code: newCode.trim() } : {};
      const res = await apiRequest("POST", "/api/referrals", body);
      return res.json();
    },
    onSuccess: () => {
      setNewCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
      toast({ title: "Referral link created" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create link", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/referrals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
      toast({ title: "Referral link deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  const buildLink = (code: string): string => {
    const base = window.location.origin;
    if (activeInvite) return `${base}/store/${activeInvite.token}?ref=${encodeURIComponent(code)}`;
    return `${base}/store/YOUR_INVITE_TOKEN?ref=${encodeURIComponent(code)}`;
  };

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(buildLink(code));
      toast({ title: "Link copied to clipboard" });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  const totalClicks = referrals.reduce((s, r) => s + (r.clicks || 0), 0);
  const totalConversions = referrals.reduce((s, r) => s + (r.conversions || 0), 0);
  const totalRewards = referrals.reduce((s, r) => s + (r.rewardAmount || 0), 0);
  const convRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0.0";

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-7 overflow-y-auto h-full">
      <Helmet>
        <title>Referral Program — Lexora</title>
        <meta name="description" content="Create trackable referral and affiliate links and monitor clicks, conversions, and rewards." />
      </Helmet>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Hexagon className="h-3 w-3 text-purple-500/50" />
          <span className="text-[9px] font-mono font-bold text-purple-400/60 tracking-[0.2em] uppercase">GROWTH</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tighter">Referral <span className="shimmer-text">Program</span></h1>
        <p className="text-muted-foreground/50 text-[11px] font-mono mt-1 hidden sm:block">Trackable affiliate links — clicks, conversions, and rewards (20% per sale)</p>
      </div>

      <div className="line-glow" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <StatCard icon={MousePointerClick} label="Total Clicks" value={totalClicks.toLocaleString()} glow="neon-glow" />
        <StatCard icon={ShoppingBag} label="Conversions" value={totalConversions.toLocaleString()} glow="neon-glow-nature" />
        <StatCard icon={Share2} label="Conv. Rate" value={`${convRate}%`} glow="neon-glow-cool" />
        <StatCard icon={DollarSign} label="Rewards" value={`$${totalRewards.toFixed(2)}`} glow="neon-glow-fire" />
      </div>

      <Card className="border-border/20 bg-card/30">
        <CardContent className="pt-5 pb-5">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Create a referral link</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="Custom code (optional, e.g. SUMMER25)"
              className="bg-card/50 border-border/30 font-mono text-sm"
              data-testid="input-referral-code"
            />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="neon-glow text-white border-0 font-mono text-[12px] shrink-0"
              data-testid="button-create-referral"
            >
              <Plus className="h-4 w-4 mr-1" /> Create Link
            </Button>
          </div>
          {!activeInvite && (
            <p className="text-[10px] font-mono text-amber-400/70 mt-2 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" /> No storefront invite found — create one in the Library to generate shareable links.
            </p>
          )}
        </CardContent>
      </Card>

      {error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="error-state">
          <AlertCircle className="h-10 w-10 text-red-400/60 mb-4" />
          <p className="font-bold text-lg tracking-tight">Failed to load referrals</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl bg-muted/20" />)}
        </div>
      ) : referrals.length === 0 ? (
        <Card className="border-border/20 bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="absolute inset-0 neon-glow opacity-20 blur-2xl rounded-full" />
              <Share2 className="h-12 w-12 text-purple-500/30 relative" />
            </div>
            <p className="font-bold text-lg mt-5 tracking-tight">No referral links yet</p>
            <p className="text-[11px] text-muted-foreground/40 font-mono mt-1 text-center max-w-sm">Create your first trackable link to start driving and attributing storefront traffic.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {referrals.map((r) => {
            const rate = (r.clicks || 0) > 0 ? (((r.conversions || 0) / r.clicks) * 100).toFixed(1) : "0.0";
            return (
              <Card key={r.id} className="border-border/20 bg-card/30 hover:border-purple-500/15 transition-all" data-testid={`referral-${r.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Link2 className="h-3.5 w-3.5 text-purple-400/60 shrink-0" />
                        <span className="font-mono font-bold text-sm tracking-tight" data-testid={`text-code-${r.id}`}>{r.code}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <code className="text-[10px] font-mono text-muted-foreground/40 truncate max-w-[260px] sm:max-w-md">{buildLink(r.code)}</code>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-center shrink-0">
                      <div>
                        <p className="text-sm font-bold font-mono text-purple-300" data-testid={`text-clicks-${r.id}`}>{(r.clicks || 0).toLocaleString()}</p>
                        <p className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-wider">Clicks</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold font-mono text-emerald-300" data-testid={`text-conversions-${r.id}`}>{(r.conversions || 0).toLocaleString()}</p>
                        <p className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-wider">Sales</p>
                      </div>
                      <div>
                        <Badge variant="outline" className="text-[9px] font-mono border-cyan-500/20 text-cyan-300">{rate}%</Badge>
                      </div>
                      <div>
                        <p className="text-sm font-bold font-mono text-amber-300" data-testid={`text-reward-${r.id}`}>${(r.rewardAmount || 0).toFixed(2)}</p>
                        <p className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-wider">Reward</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyLink(r.code)}
                        className="h-8 border-purple-500/20 text-purple-300 hover:bg-purple-500/10 font-mono text-[11px]"
                        data-testid={`button-copy-${r.id}`}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-red-500/20 text-red-400 hover:bg-red-500/10" data-testid={`button-delete-${r.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete referral link?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes "{r.code}" and its tracked stats. Existing shared links will stop working.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid={`button-cancel-delete-${r.id}`}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(r.id)} data-testid={`button-confirm-delete-${r.id}`}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
