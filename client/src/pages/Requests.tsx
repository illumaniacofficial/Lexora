import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lightbulb, Eye, EyeOff, Trash2, Hexagon, CheckCheck, Filter, AlertCircle, Inbox,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { VERTICAL_LABELS, VERTICAL_ICONS } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BookRequest } from "@shared/schema";

type FilterMode = "all" | "unread" | "read";

export default function Requests() {
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const { toast } = useToast();

  const { data: requests = [], isLoading, error } = useQuery<BookRequest[]>({
    queryKey: ["/api/book-requests"],
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/book-requests/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/book-requests"] });
    },
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/book-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/book-requests"] });
      toast({ title: "Request deleted" });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = requests.filter(r => !r.isRead);
      await Promise.all(unread.map(r => apiRequest("PATCH", `/api/book-requests/${r.id}/read`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/book-requests"] });
      toast({ title: "All requests marked as read" });
    },
  });

  const filtered = useMemo(() => {
    let result = [...requests].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (filterMode === "unread") result = result.filter(r => !r.isRead);
    if (filterMode === "read") result = result.filter(r => r.isRead);
    return result;
  }, [requests, filterMode]);

  const unreadCount = requests.filter(r => !r.isRead).length;

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center py-24 text-center" data-testid="error-state">
        <AlertCircle className="h-10 w-10 text-red-400/60 mb-4" />
        <p className="font-bold text-lg tracking-tight">Failed to load requests</p>
        <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-7 overflow-y-auto h-full aurora-bg-animated">
      <Helmet>
        <title>Reader Requests — Lexora</title>
        <meta name="description" content="View and manage reader book requests from your storefront." />
      </Helmet>

      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-2">
          <Hexagon className="h-3 w-3 text-amber-500/50" />
          <span className="text-[9px] font-mono font-bold text-amber-400/60 tracking-[0.2em] uppercase">REQUESTS</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tighter">Reader <span className="shimmer-text">Requests</span></h1>
            <p className="text-muted-foreground/50 text-[11px] font-mono mt-1 hidden sm:block">
              Book requests from your storefront readers
              {unreadCount > 0 && ` · ${unreadCount} unread`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="border-amber-500/20 text-amber-300 hover:bg-amber-500/10 font-mono text-[11px] h-8"
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Mark All Read
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 animate-fade-in-up stagger-2">
        <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
          <SelectTrigger className="w-36 h-9 bg-white/[0.03] border-border/20 text-[11px] font-mono" data-testid="select-filter-requests">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground/40" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="unread">Unread Only</SelectItem>
            <SelectItem value="read">Read Only</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/40">
          <span>{filtered.length} request{filtered.length !== 1 ? "s" : ""}</span>
          {filterMode !== "all" && (
            <span>({requests.length} total)</span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl bg-muted/20" />)}
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-border/20 bg-card/30 glass-card-premium">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="relative animate-float">
              <div className="absolute inset-0 neon-glow opacity-20 blur-2xl rounded-full scale-150" />
              <Inbox className="h-12 w-12 text-amber-500/30 relative" />
            </div>
            <p className="font-bold text-lg mt-5 tracking-tight">No requests yet</p>
            <p className="text-[11px] text-muted-foreground/40 font-mono mt-1 text-center max-w-sm">
              When readers submit book requests through your storefront, they'll appear here
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-border/20 bg-card/30 glass-card-premium">
          <CardContent className="flex flex-col items-center justify-center py-14">
            <EyeOff className="h-10 w-10 text-muted-foreground/20 animate-float" />
            <p className="font-bold mt-4 tracking-tight">No {filterMode} requests</p>
            <p className="text-[11px] text-muted-foreground/40 font-mono mt-1">Try changing the filter</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 animate-fade-in-up stagger-3">
          {filtered.map((req) => (
            <Card
              key={req.id}
              className={`transition-all duration-300 overflow-hidden ${
                req.isRead
                  ? "border-border/15 bg-card/30"
                  : "border-amber-500/20 bg-amber-500/[0.03] glass-card-premium"
              }`}
              data-testid={`request-card-${req.id}`}
            >
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{VERTICAL_ICONS[req.genre] || "📖"}</span>
                      <span className="font-bold text-sm tracking-tight">
                        {VERTICAL_LABELS[req.genre] || req.genre}
                      </span>
                      {!req.isRead && (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[9px] font-mono px-1.5 py-0">
                          NEW
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground/70 leading-relaxed mb-3">
                      {req.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-muted-foreground/40">
                      <span>by {req.readerName}</span>
                      <span>·</span>
                      <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                      <span>·</span>
                      <span className="text-purple-400/50">token: {req.inviteToken.slice(0, 8)}…</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!req.isRead && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => markRead.mutate(req.id)}
                        disabled={markRead.isPending}
                        className="h-8 w-8 text-amber-400/50 hover:text-amber-300 hover:bg-amber-500/10"
                        data-testid={`button-mark-read-${req.id}`}
                        aria-label="Mark as read"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteRequest.mutate(req.id)}
                      disabled={deleteRequest.isPending}
                      className="h-8 w-8 text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10"
                      data-testid={`button-delete-request-${req.id}`}
                      aria-label="Delete request"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
