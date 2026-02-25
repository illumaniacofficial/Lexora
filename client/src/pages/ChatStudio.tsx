import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Helmet } from "react-helmet-async";
import {
  Plus, Send, Trash2, MessageSquare, Loader2, Bot, User, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatConversation, ChatMessage } from "@shared/schema";

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
          <pre key={`code-${i}`} className="bg-black/40 border border-white/10 rounded-lg p-4 overflow-x-auto my-3 text-[13px] font-mono text-purple-200">
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
      elements.push(<h3 key={i} className="text-base font-bold text-purple-200 mt-4 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-lg font-bold text-purple-100 mt-5 mb-2">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-xl font-bold text-white mt-5 mb-3">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2 my-0.5">
          <span className="text-purple-400 mt-0.5 shrink-0">•</span>
          <span className="text-muted-foreground">{formatInline(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.+)/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-2 ml-2 my-0.5">
            <span className="text-purple-400 font-mono text-sm mt-0.5 shrink-0 w-5 text-right">{match[1]}.</span>
            <span className="text-muted-foreground">{formatInline(match[2])}</span>
          </div>
        );
      }
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-muted-foreground my-1 leading-relaxed">{formatInline(line)}</p>);
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

export default function ChatStudio() {
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [], isLoading: convsLoading, error: convsError } = useQuery<ChatConversation[]>({
    queryKey: ["/api/chat/conversations"],
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
      const res = await apiRequest("POST", "/api/chat/conversations", { title: "New Conversation" });
      return res.json();
    },
    onSuccess: (conv: ChatConversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setActiveConvId(conv.id);
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

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sendMessage.isPending) return;

    if (!activeConvId) {
      const res = await apiRequest("POST", "/api/chat/conversations", { title: "New Conversation" });
      const conv: ChatConversation = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setActiveConvId(conv.id);
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

  return (
    <div className="flex h-full overflow-hidden" data-testid="page-chat-studio">
      <Helmet>
        <title>Chat Studio | Lexora</title>
        <meta name="description" content="Chat with AI to plan, structure, and write books step by step" />
      </Helmet>

      <div className="w-64 border-r border-border/30 flex flex-col bg-black/20 shrink-0">
        <div className="p-4 border-b border-border/30">
          <Button
            onClick={() => createConv.mutate()}
            disabled={createConv.isPending}
            className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="button-new-conversation"
          >
            <Plus className="h-4 w-4" />
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
                  "group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-[13px]",
                  activeConvId === conv.id
                    ? "bg-purple-500/10 text-purple-200 border border-purple-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03] border border-transparent"
                )}
                onClick={() => setActiveConvId(conv.id)}
                data-testid={`chat-conversation-${conv.id}`}
              >
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
              <div className="text-center py-8 text-muted-foreground/40 text-xs">
                No conversations yet
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeConvId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-lg px-6">
              <div className="relative mx-auto h-16 w-16 mb-6">
                <div className="absolute inset-0 rounded-2xl neon-glow opacity-40 blur-md" />
                <div className="relative h-16 w-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Bot className="h-8 w-8 text-purple-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Chat Studio</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Send a prompt, outline, or entire book structure and let AI generate your book step by step.
                Works with all genres — novels, sci-fi, horror, romance, erotica, non-fiction, and more.
              </p>
              <div className="grid grid-cols-2 gap-3 text-left">
                {[
                  { title: "Plan a Novel", desc: "Outline characters, plot arcs, and chapters" },
                  { title: "Write Chapters", desc: "Generate full chapters from your structure" },
                  { title: "World-Building", desc: "Create settings, lore, and backstories" },
                  { title: "Full Book Prompt", desc: "Send a complete structure to auto-generate" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-border/30 bg-white/[0.02] hover:bg-purple-500/5 hover:border-purple-500/20 transition-all cursor-pointer"
                    onClick={() => {
                      setInput(`Help me ${item.title.toLowerCase()}: `);
                      textareaRef.current?.focus();
                    }}
                    data-testid={`chat-suggestion-${i}`}
                  >
                    <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="max-w-3xl mx-auto space-y-4">
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
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                  data-testid={`chat-message-${msg.id}`}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mt-1">
                      <Bot className="h-4 w-4 text-purple-400" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-xl px-4 py-3 max-w-[85%]",
                      msg.role === "user"
                        ? "bg-purple-600/20 border border-purple-500/30 text-foreground"
                        : "bg-white/[0.03] border border-border/30 text-foreground"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownContent content={msg.content} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mt-1">
                      <User className="h-4 w-4 text-cyan-400" />
                    </div>
                  )}
                </div>
              ))}
              {sendMessage.isPending && (
                <div className="flex gap-3 justify-start">
                  <div className="shrink-0 h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mt-1">
                    <Bot className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="bg-white/[0.03] border border-border/30 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}

        <div className="border-t border-border/30 p-4 bg-black/20">
          <div className="max-w-3xl mx-auto flex gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your book idea, paste an outline, or ask for help..."
              className="flex-1 min-h-[48px] max-h-[200px] resize-none bg-white/[0.03] border-border/30 focus:border-purple-500/40 text-sm"
              rows={2}
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              className="self-end bg-purple-600 hover:bg-purple-700 text-white h-12 w-12 p-0"
              data-testid="button-send-message"
              aria-label="Send message"
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
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
