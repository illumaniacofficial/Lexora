import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChatConversation, ChatMessage, Project } from "@shared/schema";
import { Bot, BookOpen, Check, Copy, FileText, Loader2, MessageSquare, Plus, Send, Sparkles, Target, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MarkdownRendererDark } from "@/components/markdown-renderer";
import { cn } from "@/lib/utils";

interface LexoraCopilotProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  {
    label: "500-char Description",
    prompt: "Write a compelling book description in 500 characters or fewer. Preserve the project's current concept and tone.",
    icon: FileText,
  },
  {
    label: "Target Audience",
    prompt: "Define the ideal target audience for this book in 500 characters or fewer. Be specific about reader interests, age range when appropriate, and what draws them to this book.",
    icon: Target,
  },
  {
    label: "Tone & Style",
    prompt: "Define the tone and writing style for this book in a concise paragraph I can paste directly into a book-generation brief.",
    icon: Sparkles,
  },
  {
    label: "Key Themes",
    prompt: "List the key themes and topics this book should explore, then give me one concise paste-ready paragraph.",
    icon: BookOpen,
  },
  {
    label: "Things to Avoid",
    prompt: "Give me a concise paste-ready 'things to avoid' brief for this book: clichés, tonal mistakes, structural problems, and anything that would weaken the concept.",
    icon: X,
  },
  {
    label: "Book Blurb",
    prompt: "Write a strong back-cover style blurb for this book. Make it emotionally compelling and commercially readable without spoiling the ending.",
    icon: MessageSquare,
  },
];

function projectIdFromLocation(location: string): number | null {
  const match = location.match(/^\/projects\/(\d+)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export default function LexoraCopilot({ open, onOpen, onClose }: LexoraCopilotProps) {
  const [location] = useLocation();
  const projectId = projectIdFromLocation(location);
  const [input, setInput] = useState("");
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery<ChatConversation[]>({
    queryKey: ["/api/chat/conversations"],
    enabled: open,
  });
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: open,
  });

  const project = useMemo(
    () => projectId ? projects.find((item) => item.id === projectId) : undefined,
    [projectId, projects],
  );

  const scopedConversations = useMemo(
    () => conversations.filter((conversation) =>
      projectId ? conversation.projectId === projectId : conversation.projectId == null,
    ),
    [conversations, projectId],
  );

  useEffect(() => {
    if (!open) return;
    const key = `lexora.copilot.conversation.${projectId || "general"}`;
    const stored = Number(localStorage.getItem(key));
    const storedIsValid = stored > 0 && scopedConversations.some((conversation) => conversation.id === stored);
    if (storedIsValid) {
      setActiveConvId(stored);
      return;
    }
    setActiveConvId(scopedConversations[0]?.id ?? null);
  }, [open, projectId, scopedConversations]);

  useEffect(() => {
    if (!activeConvId) return;
    localStorage.setItem(`lexora.copilot.conversation.${projectId || "general"}`, String(activeConvId));
  }, [activeConvId, projectId]);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/conversations", activeConvId, "messages"],
    enabled: open && !!activeConvId,
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/chat/conversations", {
        title: project ? `Copilot · ${project.title}` : "Lexora Copilot",
        projectId,
      });
      return res.json() as Promise<ChatConversation>;
    },
    onSuccess: (conversation) => {
      setActiveConvId(conversation.id);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: number; content: string }) => {
      const res = await apiRequest("POST", `/api/chat/conversations/${conversationId}/messages`, { content });
      return res.json();
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations", variables.conversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
    },
  });

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending, open]);

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || sendMessage.isPending || createConversation.isPending) return;
    setInput("");

    let conversationId = activeConvId;
    if (!conversationId) {
      const res = await apiRequest("POST", "/api/chat/conversations", {
        title: project ? `Copilot · ${project.title}` : "Lexora Copilot",
        projectId,
      });
      const conversation = await res.json() as ChatConversation;
      conversationId = conversation.id;
      setActiveConvId(conversation.id);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
    }

    sendMessage.mutate({ conversationId, content: text });
  };

  const startFresh = () => {
    setActiveConvId(null);
    setInput("");
  };

  return (
    <>
      {!open && (
        <Button
          type="button"
          size="icon"
          onClick={onOpen}
          className="md:hidden fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full shadow-2xl border border-purple-400/25 bg-purple-600 hover:bg-purple-500 text-white neon-glow"
          aria-label="Open Lexora Copilot"
          data-testid="button-open-copilot-bubble"
        >
          <Bot className="h-5 w-5" />
        </Button>
      )}
      <aside
        className={cn(
          "absolute z-50 border border-border/25 bg-background/95 backdrop-blur-xl shadow-2xl transition-all duration-200 will-change-transform",
          "left-3 right-3 bottom-3 h-[min(78dvh,640px)] rounded-2xl md:left-auto md:top-0 md:bottom-0 md:right-0 md:h-auto md:w-[390px] md:rounded-none md:border-y-0 md:border-r-0",
          open
            ? "translate-y-0 opacity-100 pointer-events-auto md:translate-x-0"
            : "translate-y-[120%] opacity-0 pointer-events-none md:translate-y-0 md:translate-x-full",
        )}
        aria-hidden={!open}
        data-testid="lexora-copilot-panel"
      >
      <div className="h-full min-w-0 flex flex-col">
        <div className="shrink-0 border-b border-border/20 px-3 py-3 bg-black/20">
          <div className="flex items-start gap-2">
            <div className="h-8 w-8 rounded-lg border border-purple-500/25 bg-purple-500/10 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-semibold">Lexora Copilot</p>
                <Badge variant="outline" className="h-4 text-[7px] font-mono border-purple-500/20 text-purple-300">SCRIBE</Badge>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground/45 truncate mt-0.5">
                {project ? `Linked to ${project.title}` : "General creative chat"}
              </p>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={startFresh} title="New chat" data-testid="button-copilot-new-chat">
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClose} title="Close Copilot" data-testid="button-close-copilot">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pt-3 pb-1 [scrollbar-width:thin]">
            {QUICK_PROMPTS.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.label}
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 whitespace-nowrap text-[8px] font-mono border-border/20 hover:border-purple-500/30 hover:text-purple-200"
                  onClick={() => send(item.prompt)}
                  disabled={sendMessage.isPending || createConversation.isPending}
                  data-testid={`copilot-prompt-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-3 py-3">
          {!activeConvId && !messagesLoading ? (
            <div className="h-full min-h-[320px] flex items-center justify-center text-center px-5">
              <div>
                <Sparkles className="h-8 w-8 mx-auto text-purple-400/35" />
                <p className="text-[12px] font-semibold mt-3">{project ? "Ask about this book" : "Ask Lexora anything"}</p>
                <p className="text-[10px] leading-relaxed text-muted-foreground/45 mt-1.5">
                  {project
                    ? "Copilot already has the project's Property, Book Genome, outline, accepted chapters, and continuity context."
                    : "Use this for descriptions, titles, audiences, tone, blurbs, brainstorming, or book-development questions."}
                </p>
              </div>
            </div>
          ) : messagesLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-purple-400/50" /></div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "group relative max-w-[92%] rounded-xl px-3 py-2.5",
                    message.role === "user"
                      ? "bg-purple-500/15 border border-purple-500/20"
                      : "bg-card/45 border border-border/20",
                  )}>
                    {message.role === "assistant"
                      ? <MarkdownRendererDark content={message.content} />
                      : <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{message.content}</p>}
                    {message.role === "assistant" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 h-6 px-2 text-[8px] font-mono text-muted-foreground/45 hover:text-purple-200"
                        onClick={async () => {
                          await navigator.clipboard.writeText(message.content);
                          setCopiedMessageId(message.id);
                          window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? null : current), 1600);
                        }}
                        data-testid={`button-copy-copilot-message-${message.id}`}
                      >
                        {copiedMessageId === message.id ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedMessageId === message.id ? "Copied" : "Copy"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {sendMessage.isPending && (
                <div className="flex justify-start">
                  <div className="rounded-xl border border-border/20 bg-card/45 px-3 py-2.5 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                    <span className="text-[9px] font-mono text-muted-foreground/45">Scribe is thinking…</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        <div className="shrink-0 border-t border-border/20 p-3 bg-black/20">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder={project ? "Ask about this book…" : "Ask Lexora…"}
              rows={2}
              className="min-h-[46px] max-h-32 resize-none text-[11px] bg-white/[0.03] border-border/20 focus:border-purple-500/40"
              data-testid="input-copilot-message"
            />
            <Button
              size="icon"
              className="h-10 w-10 shrink-0 neon-glow"
              onClick={() => send()}
              disabled={!input.trim() || sendMessage.isPending || createConversation.isPending}
              data-testid="button-send-copilot-message"
            >
              {sendMessage.isPending || createConversation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[8px] font-mono text-muted-foreground/30 mt-2">
            Enter to send · Shift+Enter for a new line · conversations are saved
          </p>
        </div>
      </div>
      </aside>
    </>
  );
}
