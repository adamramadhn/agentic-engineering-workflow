"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Send,
  Bot,
  User,
  ArrowRight,
} from "@/components/icons";

interface AskAISheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  actions?: { label: string; action: () => void }[];
}

export function AskAISheet({ open, onOpenChange }: AskAISheetProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: "Ask about revenue, connected sources, or recent alerts. Responses use sample data.",
      timestamp: "Just now",
      actions: [
        {
          label: "Analyze MRR Growth",
          action: () => handleSendPrompt("Analyze MRR Growth"),
        },
        {
          label: "Check Stripe Health",
          action: () => handleSendPrompt("Check Stripe Health"),
        },
      ],
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendPrompt = (promptText?: string) => {
    const textToSend = promptText || input.trim();
    if (!textToSend) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
      timestamp: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    setTimeout(() => {
      let reply = "Here is a summary of the sample data:";
      if (textToSend.toLowerCase().includes("mrr") || textToSend.toLowerCase().includes("growth")) {
        reply = "MRR is $142,850, up 18.2% this month. Byteforge contributed $12,400 in expansion revenue. Churn is 0.8%.";
      } else if (textToSend.toLowerCase().includes("stripe") || textToSend.toLowerCase().includes("health")) {
        reply = "Stripe connection (Acct_•••4821) is fully healthy. Last synced 2 minutes ago with 1,204 invoices validated and 0 unexplained gaps.";
      } else {
        reply = `This demo supports revenue and Stripe connection summaries. Try asking about MRR growth or Stripe health.`;
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: reply,
        timestamp: "Just now",
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsLoading(false);
    }, 600);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[460px] p-0 flex flex-col bg-white dark:bg-[#121215] border-l border-neutral-200 dark:border-neutral-800"
      >
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <SheetTitle className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                Ask AI
              </SheetTitle>
              <SheetDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                Demo assistant · Sample data
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Suggested Quick Prompts */}
        <div className="px-5 py-2.5 bg-neutral-50/80 dark:bg-neutral-900/40 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-1.5 overflow-x-auto text-[11.5px] scrollbar-none">
          <span className="text-neutral-400 dark:text-neutral-500 flex items-center gap-1 shrink-0 font-medium">
            Try:
          </span>
          <button
            type="button"
            onClick={() => handleSendPrompt("Summarize 24h revenue")}
            className="rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#18181c] px-2.5 py-0.5 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap cursor-pointer shrink-0"
          >
            24h Revenue
          </button>
          <button
            type="button"
            onClick={() => handleSendPrompt("Check anomaly alerts")}
            className="rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#18181c] px-2.5 py-0.5 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap cursor-pointer shrink-0"
          >
            Check Alerts
          </button>
          <button
            type="button"
            onClick={() => handleSendPrompt("Validate Stripe tokens")}
            className="rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#18181c] px-2.5 py-0.5 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap cursor-pointer shrink-0"
          >
            Tokens
          </button>
        </div>

        {/* Chat Conversation Scroll Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 text-[13px] ${
                msg.sender === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                  msg.sender === "user"
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700"
                }`}
              >
                {msg.sender === "user" ? (
                  <User className="size-3.5" />
                ) : (
                  <Bot className="size-3.5 text-neutral-700 dark:text-neutral-300" />
                )}
              </div>

              <div
                className={`flex flex-col space-y-2 max-w-[82%] ${
                  msg.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`rounded-xl px-3.5 py-2.5 leading-relaxed text-[13px] ${
                    msg.sender === "user"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
                      : "bg-neutral-50 dark:bg-[#1a1a20] text-neutral-800 dark:text-neutral-100 border border-neutral-200/80 dark:border-neutral-800"
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>

                {msg.actions && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.actions.map((act) => (
                      <button
                        key={act.label}
                        type="button"
                        onClick={act.action}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#18181c] px-2 py-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors cursor-pointer"
                      >
                        <span>{act.label}</span>
                        <ArrowRight className="size-2.5 text-neutral-400" />
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 px-1">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center text-[12px] text-neutral-400 dark:text-neutral-500 italic py-1">
              <div className="size-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
                <MessageSquare className="size-3.5 text-neutral-400 animate-pulse" />
              </div>
              <span>Thinking…</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about transactions, MRR, or alerts..."
              className="h-10 text-[13px] bg-neutral-50 dark:bg-[#18181c] border-neutral-200 dark:border-neutral-800 rounded-lg focus-visible:ring-1 focus-visible:ring-neutral-400"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-10 w-10 shrink-0 bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 rounded-lg cursor-pointer"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
