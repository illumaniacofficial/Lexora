import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Helmet } from "react-helmet-async";
import {
  Plus, Send, Trash2, MessageSquare, Loader2, Bot, User, AlertCircle,
  PanelLeftOpen, PanelLeftClose, Sparkles, BookOpen, Globe, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatConversation, ChatMessage } from "@shared/schema";

interface ProjectOption { id: number; title: string; status: string }

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="bg-black/40 border border-white/10 rounded-lg p-3 md:p-4 overflow-x-auto my-3 text-[12px] md:text-[13px] font-mono text-purple-200">
            {codeLang && <div className="text-[10px] text-purple-400/60 font-mono uppercase mb-2">{codeLang}</div>}
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
        codeLang = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-sm md:text-base font-bold text-purple-200 mt-4 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-base md:text-lg font-bold text-purple-100 mt-5 mb-2">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-lg md:text-xl font-bold text-white mt-5 mb-3">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2 my-0.5">
          <span className="text-purple-400 mt-0.5 shrink-0">•</span>
          <span className="text-muted-foreground text-[13px]">{formatInline(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.+)/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-2 ml-2 my-0.5">
            <span className="text-purple-400 font-mono text-sm mt-0.5 shrink-0 w-5 text-right">{match[1]}.</span>
            <span className="text-muted-foreground text-[13px]">{formatInline(match[2])}</span>
          </div>
        );
      }
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-muted-foreground my-1 leading-relaxed text-[13px]">{formatInline(line)}</p>);
    }
  }

  return <div className="space-y-0">{elements}</div>;
}

function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-purple-300 text-[12px] font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start animate-fade-in-up">
      <div className="shrink-0 h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mt-1">
        <Bot className="h-4 w-4 text-purple-400" />
      </div>
      <div className="message-bubble-ai rounded-xl px-4 md:px-5 py-3 md:py-4">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

const suggestions = [
  { icon: BookOpen, title: "Plan a Novel", desc: "Outline characters, plot arcs, and chapters", prompt: "Help me plan a novel: " },
  { icon: Wand2, title: "Write Chapters", desc: "Generate full chapters from your structure", prompt: "Help me write chapters: " },
  { icon: Globe, title: "World-Building", desc: "Create settings, lore, and backstories", prompt: "Help me world-building: " },
  { icon: Sparkles, title: "Full Book Prompt", desc: "Send a complete structure to auto-generate", prompt: "Help me full book prompt: " },
];

const ACTIVE_CONV_KEY = "lexora.chat.activeConvId";
const DRAFT_KEY = "lexora.chat.draft";

export default function ChatStudio() {
  const [activeConvId, setActiveConvId] = useState<number | null>(() => {
    const stored = localStorage.getItem(ACTIVE_CONV_KEY);
    return stored ? Number(stored) : null;
  });
  const [input, setInput] = useState(() => localStorage.getItem(DRAFT_KEY) || "");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [], isLoading: convsLoading, error: convsError } = useQuery<ChatConversation[]>({
    queryKey: ["/api/chat/conversations"],
  });

  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ["/api/projects"],
  });

  const { data: messages = [], isLoading: msgsLoading, error: msgsError } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/conversations", activeConvId, "messages"],
    enabled: !!activeConvId,
    queryFn: async () => {
      if (!activeConvId) return [];
      const res = await fetch(`/api/chat/conversations/${activeConvId}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
  });

  const createConv = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/chat/conversations", { title: "New Conversation", projectId: selectedProjectId });
      return res.json();
    },
    onSuccess: (conv: ChatConversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setActiveConvId(conv.id);
      setSidebarOpen(false);
    },
  });

  const deleteConv = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/chat/conversations/${id}`);
    },
    onSuccess: (_: unknown, id: number) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      if (activeConvId === id) setActiveConvId(null);
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!activeConvId) throw new Error("No conversation selected");
      const res = await apiRequest("POST", `/api/chat/conversations/${activeConvId}/messages`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations", activeConvId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  useEffect(() => {
    if (activeConvId) localStorage.setItem(ACTIVE_CONV_KEY, String(activeConvId));
    else localStorage.removeItem(ACTIVE_CONV_KEY);
  }, [activeConvId]);

  useEffect(() => {
    if (input) localStorage.setItem(DRAFT_KEY, input);
    else localStorage.removeItem(DRAFT_KEY);
  }, [input]);

  useEffect(() => {
    if (!convsLoading && activeConvId && !conversations.some(c => c.id === activeConvId)) {
      setActiveConvId(null);
    }
  }, [convsLoading, conversations, activeConvId]);

  useEffect(() => {
    if (!activeConvId) return;
    const active = conversations.find((conv) => conv.id === activeConvId);
    if (active) setSelectedProjectId(active.projectId ?? null);
  }, [activeConvId, conversations]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sendMessage.isPending) return;

    if (!activeConvId) {
      const res = await apiRequest("POST", "/api/chat/conversations", { title: "New Conversation", projectId: selectedProjectId });
      const conv: ChatConversation = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setActiveConvId(conv.id);
      setSidebarOpen(false);
      setInput("");
      setTimeout(async () => {
        const sendRes = await apiRequest("POST", `/api/chat/conversations/${conv.id}/messages`, { content: trimmed });
        await sendRes.json();
        queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations", conv.id, "messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      }, 100);
      return;
    }

    setInput("");
    sendMessage.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectConversation = (id: number) => {
    setActiveConvId(id);
    const conversation = conversations.find((item) => item.id === id);
    setSelectedProjectId(conversation?.projectId ?? null);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-full overflow-hidden relative" data-testid="page-chat-studio">
      <Helmet>
        <title>Scribe | Lexora</title>
        <meta name="description" content="Work with Scribe using project canon, continuity, and Book Genome context" />
      </Helmet>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={cn(
        "flex flex-col bg-black/40 border-r border-border/20 shrink-0 z-40 transition-transform duration-300",
        "fixed inset-y-0 left-0 w-72 md:w-64 md:relative md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-3 md:p-4 border-b border-border/20">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-[10px] font-mono font-bold text-purple-400/60 tracking-[0.15em] uppercase">Conversations</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-muted-foreground/60 hover:text-foreground p-1" aria-label="Close sidebar">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-2">
            <Select
              value={selectedProjectId ? String(selectedProjectId) : "general"}
              onValueChange={(value) => setSelectedProjectId(value === "general" ? null : Number(value))}
              disabled={!!activeConvId}
            >
              <SelectTrigger className="h-8 text-[10px] font-mono bg-card/30 border-border/25" data-testid="select-scribe-project">
                <SelectValue placeholder="General intake" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General intake</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>{project.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[8px] font-mono text-muted-foreground/30 mt-1 px-1">
              {activeConvId ? "Project is locked to this conversation." : "Link a project to give Scribe its canon and continuity."}
            </p>
          </div>
          <Button
            onClick={() => createConv.mutate()}
            disabled={createConv.isPending}
            className="w-full gap-2 neon-glow text-white border-0 hover:shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)] hover:scale-[1.02] transition-all duration-300 h-9 text-[13px]"
            data-testid="button-new-conversation"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {convsLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-purple-400/50" />
              </div>
            )}
            {convsError && (
              <div className="flex items-center gap-2 p-3 text-red-400 text-xs">
                <AlertCircle className="h-4 w-4" />
                Failed to load
              </div>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-300 text-[13px] relative",
                  activeConvId === conv.id
                    ? "bg-purple-500/10 text-purple-200 border border-purple-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-transparent hover:border-purple-500/10"
                )}
                onClick={() => selectConversation(conv.id)}
                data-testid={`chat-conversation-${conv.id}`}
              >
                {activeConvId === conv.id && <span className="nav-active-bar" />}
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{conv.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConv.mutate(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                  aria-label="Delete conversation"
                  data-testid={`button-delete-conversation-${conv.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {!convsLoading && conversations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground/40 text-xs font-mono">
                No conversations yet
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex items-center gap-3 px-3 py-2 md:px-4 md:py-2.5 border-b border-border/15 bg-black/20 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-muted-foreground/70 hover:text-foreground transition-colors"
            aria-label="Open conversations"
            data-testid="button-toggle-chat-sidebar"
          >
            <PanelLeftOpen className="h-4.5 w-4.5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate">
              {activeConvId ? conversations.find(c => c.id === activeConvId)?.title || "Scribe" : "Scribe"}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => createConv.mutate()}
            disabled={createConv.isPending}
            className="h-8 w-8 p-0 text-purple-400"
            data-testid="button-new-chat-mobile"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {!activeConvId ? (
          <div className="flex-1 flex items-center justify-center aurora-bg-animated overflow-y-auto">
            <div className="text-center max-w-lg px-4 md:px-6 py-8 animate-fade-in-up">
              <div className="relative mx-auto h-14 w-14 md:h-16 md:w-16 mb-5 md:mb-6">
                <div className="absolute inset-0 rounded-2xl neon-glow opacity-40 blur-md animate-pulse-glow" />
                <div className="relative h-full w-full rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Bot className="h-7 w-7 md:h-8 md:w-8 text-purple-400" />
                </div>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 md:mb-3"><span className="shimmer-text">Scribe</span></h2>
              <p className="text-muted-foreground text-[13px] md:text-sm leading-relaxed mb-5 md:mb-6">
                Link a project and Scribe will work from its Property, Book Genome, accepted chapters, series context, and continuity state.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3 text-left">
                {suggestions.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border border-border/20 bg-white/[0.02] hover:bg-purple-500/5 hover:border-purple-500/20 transition-all duration-300 cursor-pointer card-hover-lift animate-fade-in-up stagger-${i + 1}`}
                      onClick={() => {
                        setInput(item.prompt);
                        textareaRef.current?.focus();
                      }}
                      data-testid={`chat-suggestion-${i}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-3.5 w-3.5 text-purple-400/70" />
                        <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 ml-5.5">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-3 md:px-6 py-3 md:py-4">
            <div className="max-w-3xl mx-auto space-y-3 md:space-y-4">
              {msgsLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-400/50" />
                </div>
              )}
              {msgsError && (
                <div className="flex items-center justify-center py-12 text-center" data-testid="error-messages">
                  <p className="text-sm text-red-400/70">Failed to load messages. Try selecting the conversation again.</p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2 md:gap-3 animate-fade-in-up",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                  style={{ animationDelay: `${Math.min(idx * 0.05, 0.3)}s` }}
                  data-testid={`chat-message-${msg.id}`}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 h-7 w-7 md:h-8 md:w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mt-1">
                      <Bot className="h-3.5 w-3.5 md:h-4 md:w-4 text-purple-400" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2.5 md:px-4 md:py-3 max-w-[88%] md:max-w-[85%]",
                      msg.role === "user"
                        ? "message-bubble-user text-foreground"
                        : "message-bubble-ai text-foreground"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownContent content={msg.content} />
                    ) : (
                      <p className="text-[13px] md:text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 h-7 w-7 md:h-8 md:w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mt-1">
                      <User className="h-3.5 w-3.5 md:h-4 md:w-4 text-cyan-400" />
                    </div>
                  )}
                </div>
              ))}
              {sendMessage.isPending && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}

        <div className="border-t border-border/20 p-2.5 md:p-4 bg-black/30 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto flex gap-2 md:gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your book idea, paste an outline, or ask for help..."
              className="flex-1 min-h-[44px] md:min-h-[48px] max-h-[160px] md:max-h-[200px] resize-none bg-white/[0.03] border-border/20 focus:border-purple-500/40 text-[13px] md:text-sm transition-colors duration-300"
              rows={1}
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              className="self-end neon-glow text-white border-0 h-10 w-10 md:h-12 md:w-12 p-0 hover:shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)] hover:scale-105 transition-all duration-300"
              data-testid="button-send-message"
              aria-label="Send message"
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 md:h-5 md:w-5" />
              )}
            </Button>
          </div>
          {sendMessage.isError && (
            <div className="max-w-3xl mx-auto mt-2 text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Failed to send message. Try again.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
