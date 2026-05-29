import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Bell, Check, CheckCheck, Mail, Sparkles, TrendingUp, DollarSign, Bot, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@shared/schema";

function timeAgo(date: string | Date): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function kindIcon(kind: string) {
  switch (kind) {
    case "pipeline": return <Bot className="h-3.5 w-3.5 text-purple-400" />;
    case "trend": return <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />;
    case "sales": return <DollarSign className="h-3.5 w-3.5 text-emerald-400" />;
    default: return <Sparkles className="h-3.5 w-3.5 text-amber-400" />;
  }
}

export function NotificationCenter() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markRead = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const digest = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/notifications/digest");
      return res.json() as Promise<{ subject: string; body: string; count: number }>;
    },
    onSuccess: (data) => {
      const mailto = `mailto:?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.body)}`;
      window.location.href = mailto;
      toast({ title: "Digest ready", description: `${data.count} update${data.count === 1 ? "" : "s"} from the last 24h. Opening your email client.` });
    },
    onError: () => toast({ title: "Failed to build digest", variant: "destructive" }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-purple-400 hover:bg-purple-500/5 transition-colors"
          data-testid="button-notifications"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-500 text-white text-[8px] font-mono font-bold px-1 shadow-[0_0_8px_rgba(168,85,247,0.6)] border border-background"
              data-testid="badge-unread-notifications"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 border-border/30 bg-card/95 backdrop-blur-xl" data-testid="popover-notifications">
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-border/20">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-purple-400/70" />
            <span className="text-[12px] font-bold tracking-tight">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[9px] font-mono text-purple-400/70">{unreadCount} new</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon" variant="ghost"
              onClick={() => digest.mutate()}
              disabled={digest.isPending}
              className="h-6 w-6 text-muted-foreground/50 hover:text-cyan-400"
              data-testid="button-email-digest" aria-label="Email digest"
            >
              {digest.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
            </Button>
            {unreadCount > 0 && (
              <Button
                size="icon" variant="ghost"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="h-6 w-6 text-muted-foreground/50 hover:text-emerald-400"
                data-testid="button-mark-all-read" aria-label="Mark all as read"
              >
                <CheckCheck className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4" data-testid="empty-notifications">
              <Bell className="h-8 w-8 text-muted-foreground/20 mb-3" />
              <p className="text-[11px] font-mono text-muted-foreground/40">No notifications yet</p>
              <p className="text-[10px] font-mono text-muted-foreground/25 mt-1">Pipeline, trend, and sales events show here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/10">
              {notifications.map(n => {
                const inner = (
                  <div
                    className={`flex items-start gap-2.5 px-3.5 py-3 transition-colors hover:bg-white/[0.02] ${n.isRead ? "opacity-60" : ""}`}
                    data-testid={`notification-${n.id}`}
                  >
                    <div className="mt-0.5 shrink-0">{kindIcon(n.kind)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0 shadow-[0_0_6px_rgba(168,85,247,0.8)]" />}
                        <p className="text-[11px] font-semibold tracking-tight truncate">{n.title}</p>
                      </div>
                      {n.body && <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-snug line-clamp-2">{n.body}</p>}
                      <p className="text-[9px] font-mono text-muted-foreground/30 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead.mutate(n.id); }}
                        className="shrink-0 text-muted-foreground/30 hover:text-emerald-400 transition-colors"
                        data-testid={`button-read-${n.id}`} aria-label="Mark as read"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
                return n.link ? (
                  <Link
                    key={n.id} href={n.link}
                    onClick={() => { if (!n.isRead) markRead.mutate(n.id); setOpen(false); }}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
