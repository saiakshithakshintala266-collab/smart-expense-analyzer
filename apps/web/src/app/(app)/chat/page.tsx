"use client";

import { useEffect, useState, useRef } from "react";
import { MessageSquare, Send, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { chatApi } from "@/lib/api";
import { formatRelativeTime, cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await chatApi.sendMessage(text, conversationId);
      if (!conversationId) setConversationId(res.conversationId);

      const assistantMsg: Message = {
        id: res.messageId ?? crypto.randomUUID(),
        role: "assistant",
        content: res.answer,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      toast.error("Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setSending(false);
    }
  }

  function startNewChat() {
    setMessages([]);
    setConversationId(undefined);
    setInput("");
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="p-6 pb-0">
        <PageHeader
          title="AI Chat Assistant"
          description="Ask anything about your finances"
          icon={MessageSquare}
          actions={
            <button onClick={startNewChat} className="btn-ghost text-xs flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New chat
            </button>
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">AI Chat Assistant</p>
              <p className="text-xs text-muted-foreground mt-1">Ask anything about your finances</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {[
                "How much did I spend last month?",
                "What's my top spending category?",
                "Show me my recent transactions",
                "Any unusual spending patterns?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
              >
                <div className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary border border-border text-muted-foreground"
                )}>
                  {msg.role === "user" ? "U" : "AI"}
                </div>

                <div className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-secondary text-foreground rounded-tl-sm"
                )}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <p className={cn(
                    "text-xs mt-1 opacity-60",
                    msg.role === "user" ? "text-right" : "text-left"
                  )} suppressHydrationWarning>
                    {formatRelativeTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-secondary border border-border text-xs text-muted-foreground">
                  AI
                </div>
                <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="p-6 pt-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end rounded-xl border border-border bg-card p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about your finances..."
              rows={1}
              aria-label="Chat message input"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              aria-label="Send message"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50 transition-all hover:opacity-90"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}