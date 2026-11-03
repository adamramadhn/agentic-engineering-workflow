"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import {
  Bot, Copy, Check, Sparkles, RefreshCw, ArrowUp, ChevronDown,
  Plus, ConnectIcon, Folder, X, Users, Sliders,
} from "@/components/icons";
import { Button } from "@/components/ui/button-clean";
import { MatrixLoader, ThinkingState, ReasoningStream, StreamingText } from "./ask-ai-motion";
import { getDemoResponse, MarkdownRenderer } from "./ask-ai-content";
import "./ask-ai.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "thinking" | "streaming" | "done" | "stopped";
  phase?: number;
  steps?: string[];
  duration?: number;
}

const THINKING_PHASES = [
  "Reading your request",
  "Checking sample data",
  "Connecting the context",
  "Preparing your response",
];
const SUGGESTED_PROMPTS = [
  "Analyze MRR growth trends", "Check system health status",
  "Generate weekly report", "Summarize recent alerts",
];
const AGENTS = [
  { name: "Data analyst", icon: Sliders, detail: "Reviews the sample revenue and growth metrics." },
  { name: "Research", icon: ConnectIcon, detail: "Collects context from the local demo dataset." },
  { name: "Reporting", icon: Copy, detail: "Organizes the findings into a readable response." },
  { name: "Monitoring", icon: Users, detail: "Reviews the sample system health and alerts." },
];

function OrchestratorLabel({ caption }: { caption?: string }) {
  return (
    <div className="ask-ai-identity">
      <span className="ask-ai-avatar"><Bot className="size-3.5" /></span>
      <span className="ask-ai-name">Orchestrator</span>
      {caption && <span className="ask-ai-caption">{caption}</span>}
    </div>
  );
}

function Activity({ message }: { message: Message }) {
  const active = message.status === "thinking";
  const [expanded, setExpanded] = useState(true);
  // A completed run folds to the compact summary shown in the reference.
  const previousStatus = useRef(message.status);
  useEffect(() => {
    if (previousStatus.current === "thinking" && !active) setExpanded(false);
    previousStatus.current = message.status;
  }, [active, message.status]);

  return (
    <div className="ask-ai-activity">
      <Button
        variant="ghost" size="sm" className="ask-ai-activity-toggle"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded} aria-controls={`activity-${message.id}`}
        icon={<ChevronDown className={`size-3.5 ask-ai-chevron ${expanded ? "is-open" : ""}`} />}
      >
        {active ? `Working · ${message.duration ?? 0}s` : `${message.status === "stopped" ? "Stopped after" : "Worked for"} ${message.duration ?? 0}s`}
      </Button>
      <div className="ask-ai-activity-panel" data-open={expanded} inert={!expanded} id={`activity-${message.id}`}>
        <div>
          <ReasoningStream
            steps={message.steps ?? THINKING_PHASES}
            phase={message.phase ?? 0}
            complete={!active && message.status !== "stopped"}
            stopped={message.status === "stopped"}
          />
        </div>
      </div>
    </div>
  );
}

function MessageActions({ content, disabled, onRegenerate }: {
  content: string; disabled: boolean; onRegenerate: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState("idle"), 2000);
  };
  return (
    <div className="ask-ai-message-actions">
      <Button variant="ghost" size="sm" onClick={copy} icon={copyState === "copied" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}>
        {copyState === "copied" ? "Copied" : copyState === "error" ? "Couldn't copy" : "Copy"}
      </Button>
      <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={disabled} icon={<RefreshCw className="size-3.5" />}>Regenerate</Button>
    </div>
  );
}

export function AskAIView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null);
  const [fileError, setFileError] = useState("");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const runRef = useRef<{ id: string; timer: ReturnType<typeof setInterval>; started: number } | null>(null);
  const processingRef = useRef(false);
  const streamRef = useRef({ id: "", content: "" });

  const clearRun = useCallback(() => {
    if (runRef.current) clearInterval(runRef.current.timer);
    runRef.current = null;
  }, []);
  useEffect(() => clearRun, [clearRun]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const scroller = scrollRef.current;
      if (scroller && followRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  const simulateResponse = useCallback((userText: string, context?: string, replaceId?: string) => {
    clearRun();
    const id = crypto.randomUUID();
    const started = Date.now();
    const steps = [...THINKING_PHASES];
    if (context) steps[1] = "Reading attached text context";
    streamRef.current = { id, content: "" };
    const assistant: Message = {
      id, role: "assistant", content: "", status: "thinking", phase: 0, steps, duration: 0,
    };
    setMessages(previous => replaceId
      ? previous.map(message => message.id === replaceId ? assistant : message)
      : [...previous, assistant]);
    const timer = setInterval(() => {
      const elapsed = Date.now() - started;
      const phase = Math.min(Math.floor(elapsed / 1600), steps.length - 1);
      const ready = elapsed >= steps.length * 1600;
      setMessages(previous => previous.map(message => message.id === id ? {
        ...message, phase, duration: Math.floor(elapsed / 1000),
        ...(ready ? {
          status: "streaming" as const,
          content: context
            ? `I've received your attached text as context. This demo doesn't analyze uploaded files yet; the response below uses sample data only.\n\n${getDemoResponse(userText)}`
            : getDemoResponse(userText),
        } : {}),
      } : message));
      if (ready) clearRun();
    }, 200);
    runRef.current = { id, timer, started };
  }, [clearRun]);

  const handleSend = useCallback((prompt?: string) => {
    const text = (prompt ?? input).trim();
    if (!text || processingRef.current) return;
    processingRef.current = true;
    followRef.current = true;
    setIsProcessing(true);
    setMessages(previous => [...previous, {
      id: crypto.randomUUID(), role: "user",
      content: attachment ? `${text}\n\n📎 ${attachment.name}` : text, status: "done",
    }]);
    setInput("");
    setAttachment(null);
    setFileError("");
    simulateResponse(text, attachment?.text);
  }, [input, attachment, simulateResponse]);

  const handleProgress = useCallback((id: string, content: string) => {
    streamRef.current = { id, content };
  }, []);

  const handleComplete = useCallback((id: string) => {
    setMessages(previous => previous.map(message => message.id === id ? { ...message, status: "done" } : message));
    processingRef.current = false;
    setIsProcessing(false);
    textareaRef.current?.focus();
  }, []);

  const handleStop = useCallback(() => {
    clearRun();
    setMessages(previous => previous.map(message => {
      if (message.status !== "thinking" && message.status !== "streaming") return message;
      return {
        ...message, status: "stopped",
        content: streamRef.current.id === message.id ? streamRef.current.content : "",
      };
    }));
    processingRef.current = false;
    setIsProcessing(false);
    textareaRef.current?.focus();
  }, [clearRun]);

  const handleRegenerate = (id: string) => {
    if (processingRef.current) return;
    const index = messages.findIndex(message => message.id === id);
    const user = messages.slice(0, index).findLast(message => message.role === "user");
    if (!user) return;
    processingRef.current = true;
    followRef.current = true;
    setIsProcessing(true);
    // Replace the selected response in place without removing later turns.
    simulateResponse(user.content, undefined, id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;
  return (
    <section className="ask-ai" aria-label="Ask AI conversation">
      <div
        className="ask-ai-scroll custom-scrollbar" ref={scrollRef}
        onScroll={() => {
          const element = scrollRef.current;
          if (element) followRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
        }}
      >
        <div className={`ask-ai-conversation ${isEmpty ? "is-empty" : ""}`} ref={contentRef}>
          {isEmpty ? (
            <div className="ask-ai-welcome">
              <span className="ask-ai-welcome-mark"><Bot className="size-6" /></span>
              <p className="ask-ai-eyebrow">YOUR WORK, CONNECTED</p>
              <h1>What should we work on?</h1>
              <p>One conversation. A little less busywork.</p>
              <div className="ask-ai-suggestions">
                {SUGGESTED_PROMPTS.map(prompt => (
                  <Button key={prompt} variant="ghost" size="sm" onClick={() => handleSend(prompt)}>{prompt}</Button>
                ))}
              </div>
            </div>
          ) : messages.map(message => message.role === "user" ? (
            <div className="ask-ai-user-row" key={message.id}>
              <div className="ask-ai-user-message">{message.content}</div>
            </div>
          ) : (
            <article className="ask-ai-assistant" key={message.id} aria-label="Orchestrator response" aria-busy={message.status === "thinking" || message.status === "streaming"}>
              <OrchestratorLabel />
              <Activity message={message} />
              {message.status === "thinking" && (
                <div className="ask-ai-thinking" role="status">
                  <MatrixLoader />
                  <ThinkingState phases={message.steps ?? THINKING_PHASES} phase={message.phase ?? 0} />
                </div>
              )}
              {message.status === "streaming" ? (
                <StreamingText id={message.id} content={message.content} onComplete={handleComplete} onProgress={handleProgress} />
              ) : message.content ? <div className="ask-ai-answer"><MarkdownRenderer content={message.content} /></div> : null}
              {message.status === "stopped" && <p className="ask-ai-stopped" role="status">Response stopped. You can send another message.</p>}
              {message.status === "done" && (
                <>
                  <div className="ask-ai-agents">
                    <p>Agents involved <span>· demo</span></p>
                    <div className="ask-ai-agent-chips">
                      {AGENTS.map(agent => (
                        <Button
                          key={agent.name} variant="ghost" size="sm"
                          icon={<agent.icon className="size-3.5" />}
                          aria-expanded={activeAgent === `${message.id}-${agent.name}`}
                          aria-controls={`agents-${message.id}`}
                          onClick={() => setActiveAgent(value => value === `${message.id}-${agent.name}` ? null : `${message.id}-${agent.name}`)}
                        >{agent.name}</Button>
                      ))}
                    </div>
                    <div id={`agents-${message.id}`}>
                      {AGENTS.filter(agent => activeAgent === `${message.id}-${agent.name}`).map(agent => <p className="ask-ai-agent-detail" key={agent.name}>{agent.detail} No live agent was run.</p>)}
                    </div>
                  </div>
                  <MessageActions content={message.content} disabled={isProcessing} onRegenerate={() => handleRegenerate(message.id)} />
                </>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="ask-ai-composer-area">
        <div className="ask-ai-composer-container">
          <OrchestratorLabel caption="Routes each request" />
          <div className="ask-ai-composer">
            <div className="ask-ai-input-box">
              {attachment && (
                <div className="ask-ai-attachment">
                  <Folder className="size-3.5" /><span>{attachment.name}</span>
                  <Button variant="ghost" size="sm" aria-label="Remove attachment" onClick={() => setAttachment(null)} icon={<X className="size-3" />} />
                </div>
              )}
              <textarea
                ref={textareaRef} value={input} rows={2}
                onChange={event => setInput(event.target.value)} onKeyDown={handleKeyDown}
                placeholder="Ask anything or add a file for context"
                aria-label="Message Orchestrator" aria-describedby="ask-ai-disclaimer"
              />
              <div className="ask-ai-toolbar">
                <div className="ask-ai-toolbar-left">
                  <Button variant="ghost" size="sm" aria-label="Attach a text file" title="Attach a text file (up to 100 KB)" onClick={() => fileRef.current?.click()} icon={<Plus className="size-4" />} />
                  <span className="ask-ai-context-label"><ConnectIcon className="size-3.5" /> Local context</span>
                </div>
                <div className="ask-ai-toolbar-right">
                  <span className="ask-ai-mode"><Sparkles className="size-3.5" /> Auto</span>
                  {isProcessing ? (
                    <Button variant="ghost" size="sm" className="ask-ai-send" aria-label="Stop response" onClick={handleStop} icon={<span className="ask-ai-stop-icon" />} />
                  ) : (
                    <Button variant="primary" size="sm" className="ask-ai-send" aria-label="Send message" disabled={!input.trim()} onClick={() => handleSend()} icon={<ArrowUp className="size-4" />} />
                  )}
                </div>
              </div>
            </div>
            <div className="ask-ai-composer-footer">
              <span><Folder className="size-3.5" /> {attachment ? "File added as context" : "Your workspace, in context"}</span>
              <span className="ask-ai-demo-tag">Demo workspace</span>
            </div>
          </div>
          <input
            type="file" ref={fileRef} className="sr-only" tabIndex={-1} accept=".txt,.md,.csv,.json"
            aria-label="Text context file"
            onChange={async event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > 100_000 || !/\.(txt|md|csv|json)$/i.test(file.name)) {
                setFileError("Choose a text, Markdown, CSV, or JSON file under 100 KB.");
                return;
              }
              try {
                const text = await file.text();
                setAttachment({ name: file.name, text });
                setFileError("");
                textareaRef.current?.focus();
              } catch { setFileError("That file couldn't be read. Please try again."); }
            }}
          />
          {fileError && <p className="ask-ai-file-error" role="alert">{fileError}</p>}
          <p className="ask-ai-disclaimer" id="ask-ai-disclaimer">Sample data only. Activity and agent states are simulated.</p>
        </div>
      </div>
    </section>
  );
}
