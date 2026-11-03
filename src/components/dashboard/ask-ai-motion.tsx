"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check } from "@/components/icons";
import { MarkdownRenderer } from "./ask-ai-content";

// React adaptations of the four transitions.dev recipes in /transitions.
// Read tokens from the component scope so a theme or consumer can override them.
function token(element: HTMLElement, name: string, fallback: number) {
  const value = parseFloat(getComputedStyle(element).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

export function MatrixLoader() {
  return (
    <span className="t-matrix" aria-hidden="true">
      {Array.from({ length: 16 }, (_, index) => (
        <i key={index} style={{ "--matrix-delay": (index % 4) / 10 } as CSSProperties} />
      ))}
    </span>
  );
}

export function ThinkingState({ phases, phase }: { phases: string[]; phase: number }) {
  const label = phases[phase];
  const previous = phases[phase - 1];
  return (
    <span className="t-think">
      <span className="t-think-sizer" aria-hidden="true">{phases.reduce((longest, item) => item.length > longest.length ? item : longest, "")}</span>
      {previous && <span key={`${phase}-exit`} className="t-think-text is-exit" aria-hidden="true">{previous}</span>}
      <span key={phase} className="t-think-text is-enter" data-text={label}>{label}</span>
    </span>
  );
}

export function ReasoningStream({ steps, phase, complete, stopped }: {
  steps: string[]; phase: number; complete: boolean; stopped: boolean;
}) {
  const shown = complete ? steps.length : Math.min(phase + 1, steps.length);
  const viewport = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const element = scroll.current;
    const box = viewport.current;
    if (!element || !box) return;
    const lineHeight = element.firstElementChild?.getBoundingClientRect().height ?? 32;
    const lines = token(element, "--reason-lines", 2);
    const offset = complete || stopped ? 0 : Math.floor(Math.max(0, shown - 2) / lines) * lines * lineHeight;
    element.style.setProperty("--reason-offset", String(offset));
  }, [shown, complete, stopped]);
  return (
    <div className="t-reason" data-complete={complete || stopped}>
      <div className="t-reason-viewport" ref={viewport}>
        <ol className="t-reason-scroll" ref={scroll} aria-label="Demo activity steps">
          {steps.slice(0, shown).map((step, index) => (
            <li className="t-reason-step" key={step} data-active={!complete && !stopped && index === phase}>
              <span className="t-reason-dot" aria-hidden="true" />
              <span>{step}</span>
            </li>
          ))}
          {(complete || stopped) && (
            <li className="t-reason-step t-reason-ready">
              <span className="t-reason-check" aria-hidden="true">{complete ? <Check className="size-2.5" /> : <span>–</span>}</span>
              {complete ? "Ready" : "Stopped"}
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}

export function StreamingText({ id, content, onComplete, onProgress }: {
  id: string; content: string;
  onComplete: (id: string) => void;
  onProgress: (id: string, content: string) => void;
}) {
  const [displayed, setDisplayed] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const words = content.match(/\S+\s*/g) ?? [];
    const gap = token(element, "--stream-gap", 60);
    const fade = token(element, "--stream-fade", 350);
    let count = 0;
    let ending: ReturnType<typeof setTimeout> | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => {
      setDisplayed(content);
      onProgress(id, content);
      ending = setTimeout(() => onComplete(id), reduced.matches ? 0 : fade);
    };
    if (reduced.matches || !words.length) {
      finish();
      return () => clearTimeout(ending);
    }
    const interval = setInterval(() => {
      count++;
      const next = words.slice(0, count).join("");
      setDisplayed(next);
      onProgress(id, next);
      if (count >= words.length) {
        clearInterval(interval);
        finish();
      }
    }, gap);
    return () => { clearInterval(interval); clearTimeout(ending); };
  }, [id, content, onComplete, onProgress]);

  return (
    <div className="ask-ai-answer t-stream" ref={root}>
      <MarkdownRenderer content={displayed} streaming />
      <span className="ask-ai-stream-cursor" aria-hidden="true" />
      <span className="sr-only" role="status">Writing response</span>
    </div>
  );
}
