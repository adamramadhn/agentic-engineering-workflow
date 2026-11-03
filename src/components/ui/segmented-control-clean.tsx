"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export type SegmentOption<T extends string = string> = {
  value: T;
  label?: ReactNode;
  icon?: ReactNode;
  count?: number | string;
  badge?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  controls?: string;
};

export type SegmentedControlProps<T extends string = string> = {
  options: SegmentOption<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  size?: "sm" | "md" | "lg";
  variant?: "buttons" | "tray" | "underline";
  fullWidth?: boolean;
  kind?: "radio" | "tabs";
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
};

/** Segmented Control (Clean): quiet chips, a raised tray or sliding underline. */
export function SegmentedControl<T extends string = string>({
  options: rawOptions,
  value,
  defaultValue,
  onChange,
  size: sizeProp = "md",
  variant: variantProp = "buttons",
  fullWidth = false,
  kind = "radio",
  disabled = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  className,
}: SegmentedControlProps<T>) {
  const options = useMemo(() => {
    const seen = new Set<string>();
    return (Array.isArray(rawOptions) ? rawOptions : []).filter((option): option is SegmentOption<T> => {
      if (!option || option.value == null || seen.has(String(option.value))) return false;
      seen.add(String(option.value));
      return true;
    });
  }, [rawOptions]);
  const size = sizeProp === "sm" || sizeProp === "lg" ? sizeProp : "md";
  const variant = variantProp === "tray" || variantProp === "underline" ? variantProp : "buttons";
  const [inner, setInner] = useState<T | undefined>(() => defaultValue ?? options.find(option => !option.disabled)?.value);
  const current = value !== undefined ? value : inner;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const latest = useRef(current);
  const gliding = useRef(false);
  const glideTimer = useRef(0);
  const placed = useRef<T | undefined>(undefined);
  const press = useRef<{ id: number; touch: boolean; drag: boolean; x: number; moved: boolean } | null>(null);
  const activeIndex = options.findIndex(option => option.value === current);
  const tabbable = activeIndex >= 0 && !options[activeIndex].disabled ? activeIndex : options.findIndex(option => !option.disabled);
  const buttons = () => Array.from(track.current?.querySelectorAll<HTMLElement>(":scope > .ui-segc__opt") ?? []);
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => { latest.current = current; }, [current]);

  const select = (next: T) => {
    const option = options.find(item => item.value === next);
    if (!option || option.disabled || disabled || next === latest.current) return;
    latest.current = next;
    if (value === undefined) setInner(next);
    onChange?.(next);
  };

  const measure = () => {
    const elements = buttons();
    if (!elements.length || !track.current) return;
    const style = getComputedStyle(elements[0]);
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const widths = elements.map(button => (button.firstElementChild as HTMLElement).offsetWidth + padding);
    if (fullWidth) {
      track.current.style.setProperty("--ui-segc-min", `${Math.max(...widths)}px`);
      elements.forEach(button => { button.style.width = ""; });
    } else elements.forEach((button, index) => { button.style.width = `${widths[index]}px`; });
  };

  const place = (animate: boolean) => {
    const container = track.current;
    const indicator = pill.current;
    if (!container || !indicator) return;
    const button = container.querySelector<HTMLElement>(":scope > .ui-segc__opt[data-active]");
    if (!button?.offsetWidth) { indicator.style.opacity = "0"; return; }
    let x = button.offsetLeft;
    let width = button.offsetWidth;
    if (variant === "underline") {
      const content = button.firstElementChild as HTMLElement;
      x += content.offsetLeft;
      width = content.offsetWidth;
    }
    const instant = !indicator.dataset.ready || (!animate && !gliding.current);
    const previous = parseFloat(indicator.style.left) || 0;
    if (!instant && x !== previous) indicator.dataset.dir = x > previous ? "right" : "left";
    if (instant) indicator.style.transition = "none";
    indicator.style.opacity = "1";
    indicator.style.left = `${x}px`;
    indicator.style.right = `${container.clientWidth - x - width}px`;
    if (instant) {
      indicator.dataset.ready = "1";
      void indicator.offsetWidth;
      indicator.style.transition = "";
    }
  };

  const fades = () => {
    const element = scroller.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    const rtl = getComputedStyle(element).direction === "rtl";
    const offset = rtl ? max + element.scrollLeft : element.scrollLeft;
    root.current?.toggleAttribute("data-overflow", max > 1);
    element.style.setProperty("--ui-segc-fade-l", offset > 1 ? "24px" : "0px");
    element.style.setProperty("--ui-segc-fade-r", offset < max - 1 ? "24px" : "0px");
  };

  const reveal = (smooth: boolean) => {
    const element = scroller.current;
    const button = track.current?.querySelector<HTMLElement>(":scope > .ui-segc__opt[data-active]");
    if (!element || !button || element.scrollWidth <= element.clientWidth + 1) return;
    const viewport = element.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    element.scrollBy({ left: rect.left + rect.width / 2 - viewport.left - viewport.width / 2, behavior: smooth && !reducedMotion() ? "smooth" : "instant" });
  };

  useLayoutEffect(() => {
    const container = track.current;
    const scroll = scroller.current;
    if (!container || !scroll) return;
    let disposed = false;
    const sync = () => { if (!disposed) { measure(); place(false); fades(); } };
    sync();
    const ready = requestAnimationFrame(() => root.current?.setAttribute("data-ready", ""));
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    });
    observer.observe(scroll);
    observer.observe(container);
    container.querySelectorAll(".ui-segc__opt, .ui-segc__content").forEach(element => observer.observe(element));
    document.fonts?.ready.then(sync);
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); cancelAnimationFrame(ready); };
    // ResizeObserver tracks content changes as well as the container.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length, fullWidth, variant, size]);

  useLayoutEffect(() => {
    if (placed.current === current) return;
    const first = placed.current === undefined;
    placed.current = current;
    if (!first) {
      gliding.current = true;
      clearTimeout(glideTimer.current);
      glideTimer.current = window.setTimeout(() => { gliding.current = false; }, 240);
    }
    place(!first);
    reveal(!first);
    if (!first && track.current?.contains(document.activeElement)) buttons()[activeIndex]?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
  useEffect(() => () => clearTimeout(glideTimer.current), []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = options.filter(option => !option.disabled);
    if (!enabled.length || disabled) return;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const previousKeys = kind === "radio" ? [rtl ? "ArrowRight" : "ArrowLeft", "ArrowUp"] : [rtl ? "ArrowRight" : "ArrowLeft"];
    const nextKeys = kind === "radio" ? [rtl ? "ArrowLeft" : "ArrowRight", "ArrowDown"] : [rtl ? "ArrowLeft" : "ArrowRight"];
    const at = enabled.findIndex(option => option.value === latest.current);
    let target: SegmentOption<T> | undefined;
    if (previousKeys.includes(event.key)) target = enabled[(at - 1 + enabled.length) % enabled.length];
    else if (nextKeys.includes(event.key)) target = enabled[(at + 1) % enabled.length];
    else if (event.key === "Home") target = enabled[0];
    else if (event.key === "End") target = enabled[enabled.length - 1];
    if (!target) return;
    event.preventDefault();
    select(target.value);
    buttons()[options.indexOf(target)]?.focus();
  };

  const optionAt = (clientX: number) => {
    let best = -1;
    let distance = Infinity;
    buttons().forEach((button, index) => {
      const rect = button.getBoundingClientRect();
      const next = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
      if (next < distance) { distance = next; best = index; }
    });
    return options[best];
  };
  const endPress = () => { press.current = null; root.current?.removeAttribute("data-pressed"); };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    const option = optionAt(event.clientX);
    if (!option || option.disabled) return;
    const touch = event.pointerType === "touch";
    const drag = !touch || (option.value === latest.current && !root.current?.hasAttribute("data-overflow"));
    press.current = { id: event.pointerId, touch, drag, x: event.clientX, moved: false };
    if (drag) root.current?.setAttribute("data-pressed", "");
    if (!touch) {
      select(option.value);
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
    }
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = press.current;
    if (!state || state.id !== event.pointerId) return;
    if (!state.moved && Math.abs(event.clientX - state.x) < (state.touch ? 8 : 3)) return;
    state.moved = true;
    if (!state.drag) return;
    const option = optionAt(event.clientX);
    if (option && !option.disabled) select(option.value);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = press.current;
    if (!state || state.id !== event.pointerId) return;
    if (state.touch && !state.moved) {
      const option = optionAt(event.clientX);
      if (option) select(option.value);
    }
    endPress();
  };
  const isTabs = kind === "tabs";

  return (
    <div ref={root} className={["ui-segc", className].filter(Boolean).join(" ")} data-size={size} data-variant={variant} data-full={fullWidth || undefined} data-disabled={disabled || undefined}>
      <style href="ui-segmented-control-clean" precedence="default">{css}</style>
      <div ref={scroller} className="ui-segc__scroller" onScroll={fades}>
        <div ref={track} className="ui-segc__track" role={isTabs ? "tablist" : "radiogroup"} aria-label={ariaLabel} aria-labelledby={ariaLabelledby} aria-disabled={disabled || undefined} aria-orientation={isTabs ? "horizontal" : undefined} onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={endPress} onLostPointerCapture={endPress}>
          <span ref={pill} className="ui-segc__pill" aria-hidden="true" />
          {options.map((option, index) => {
            const active = index === activeIndex;
            const label = option.label ?? (option.icon ? null : String(option.value));
            const count = countText(option.count);
            return (
              <button key={String(option.value)} id={option.controls ? `${option.controls}-tab` : `${id}-${index}`} type="button" className="ui-segc__opt" role={isTabs ? "tab" : "radio"} aria-checked={isTabs ? undefined : active} aria-selected={isTabs ? active : undefined} aria-controls={isTabs ? option.controls : undefined} aria-label={option.ariaLabel} data-active={active || undefined} disabled={option.disabled || disabled} tabIndex={index === tabbable ? 0 : -1} onClick={event => { if (event.detail === 0) select(option.value); }}>
                <span className="ui-segc__content">
                  {option.icon && <span className="ui-segc__icon" onErrorCapture={event => { (event.target as HTMLElement).style.visibility = "hidden"; }}>{option.icon}</span>}
                  {label != null && <span className="ui-segc__label" dir="auto">{label}</span>}
                  {count != null && count !== "" && <span key={String(count)} className="ui-segc__count">{count}</span>}
                  {option.badge != null && <span className="ui-segc__badge">{option.badge}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const countText = (count: number | string | undefined) => typeof count === "number" ? Number.isFinite(count) ? count.toLocaleString("en-US") : null : count;

const css = /* css */ `
@property --ui-segc-min { syntax: "<length>"; inherits: true; initial-value: 0px; }
@property --ui-segc-fade-l { syntax: "<length>"; inherits: false; initial-value: 0px; }
@property --ui-segc-fade-r { syntax: "<length>"; inherits: false; initial-value: 0px; }
.ui-segc {
  --ui-segc-ink: rgba(0,0,0,.88); --ui-segc-text: rgba(0,0,0,.61); --ui-segc-hover-text: rgba(0,0,0,.75);
  --ui-segc-line: rgba(0,0,0,.06); --ui-segc-wash: rgba(0,0,0,.03); --ui-segc-fill: rgba(0,0,0,.06);
  --ui-segc-track: rgba(0,0,0,.04); --ui-segc-card: #fff;
  --ui-segc-card-shadow: 0 0 0 .5px rgba(0,0,0,.06),0 1px 1px -1px rgba(0,0,0,.1),0 1px 2px rgba(0,0,0,.05);
  --ui-segc-accent: rgba(0,96,226,.765); --ui-segc-accent-soft: rgba(0,96,226,.08); --ui-segc-focus: rgba(0,96,226,.35);
  --ui-segc-ease: cubic-bezier(.25,.9,.3,1); --ui-segc-h: 28px; --ui-segc-px: 10px; --ui-segc-fs: 13px;
  --ui-segc-lh: 20px; --ui-segc-icon: 16px; --ui-segc-gap: 8px; --ui-segc-pad: 2px; --ui-segc-ring: 3px;
  box-sizing: border-box; display: inline-flex; max-width: 100%; min-width: 0; vertical-align: middle; border-radius: 8px;
  font-family: inherit; font-size: var(--ui-segc-fs); font-weight: 500; line-height: var(--ui-segc-lh); color: var(--ui-segc-text);
}
.ui-segc[data-size="sm"] { --ui-segc-h: 24px; --ui-segc-px: 8px; --ui-segc-fs: 12px; --ui-segc-lh: 16px; --ui-segc-icon: 14px; --ui-segc-gap: 6px; }
.ui-segc[data-size="lg"] { --ui-segc-h: 32px; --ui-segc-px: 12px; }
.ui-segc[data-full] { display: flex; width: 100%; }
.ui-segc[data-disabled] { opacity: .5; pointer-events: none; }
.ui-segc *, .ui-segc *::before, .ui-segc *::after { box-sizing: border-box; }
:where(.ui-segc) button { margin: 0; padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; }
:where(.ui-segc) svg { display: block; flex: none; }
.ui-segc__scroller {
  position: relative; flex: 1; min-width: 0; overflow-x: auto; overflow-y: hidden; padding: var(--ui-segc-pad); border-radius: inherit;
  overscroll-behavior-x: contain; scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to right, transparent, #000 var(--ui-segc-fade-l), #000 calc(100% - var(--ui-segc-fade-r)), transparent);
  mask-image: linear-gradient(to right, transparent, #000 var(--ui-segc-fade-l), #000 calc(100% - var(--ui-segc-fade-r)), transparent);
  transition: --ui-segc-fade-l 160ms ease, --ui-segc-fade-r 160ms ease;
}
.ui-segc__scroller::-webkit-scrollbar { display: none; }
.ui-segc__track { position: relative; display: flex; width: max-content; min-width: 100%; touch-action: pan-y; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.ui-segc[data-overflow] .ui-segc__track { touch-action: pan-x pan-y; }
.ui-segc[data-full] .ui-segc__track { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(var(--ui-segc-min),1fr); }
.ui-segc[data-ready] .ui-segc__track { transition: --ui-segc-min 200ms var(--ui-segc-ease); }
.ui-segc__opt {
  position: relative; z-index: 1; display: flex; flex: none; align-items: center; justify-content: center;
  height: var(--ui-segc-h); padding: 0 var(--ui-segc-px); overflow: clip; border-radius: 6px; white-space: nowrap;
  transition: color 90ms ease, background-color 90ms ease;
}
.ui-segc[data-ready]:not([data-full]) .ui-segc__opt { transition: color 90ms ease, background-color 90ms ease, width 200ms var(--ui-segc-ease); }
.ui-segc__opt[data-active] { color: var(--ui-segc-ink); }
.ui-segc__opt:disabled { opacity: .4; cursor: not-allowed; }
.ui-segc__opt:focus-visible { outline: 2px solid var(--ui-segc-focus); outline-offset: 1px; }
@media (hover: hover) { .ui-segc__opt:not([data-active]):not(:disabled):hover { background-color: var(--ui-segc-wash); } }
.ui-segc__content { display: inline-flex; flex: none; align-items: center; gap: 6px; }
.ui-segc[data-size="sm"] .ui-segc__content { gap: 5px; }
.ui-segc__icon { display: grid; place-items: center; width: var(--ui-segc-icon); height: var(--ui-segc-icon); color: rgba(0,0,0,.447); transition: color 90ms ease; overflow: hidden; }
.ui-segc__opt[data-active] .ui-segc__icon { color: var(--ui-segc-ink); }
.ui-segc__icon svg, .ui-segc__icon img { width: 100%; height: 100%; }
.ui-segc__icon img { display: block; object-fit: contain; }
.ui-segc__label { display: block; }
.ui-segc__count { display: inline-grid; place-items: center; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 5px; background: var(--ui-segc-fill); font-size: 11px; line-height: 16px; font-weight: 500; font-variant-numeric: tabular-nums; color: var(--ui-segc-text); animation: ui-segc-in 200ms var(--ui-segc-ease) both; }
.ui-segc__opt[data-active] .ui-segc__count { background: var(--ui-segc-card); box-shadow: 0 0 0 .5px var(--ui-segc-line); color: var(--ui-segc-ink); }
.ui-segc[data-size="sm"] .ui-segc__count { min-width: 14px; height: 14px; padding: 0 3px; border-radius: 4px; font-size: 10px; line-height: 14px; }
.ui-segc__badge { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 5px; background: var(--ui-segc-accent-soft); font-size: 11px; line-height: 16px; font-weight: 500; color: var(--ui-segc-accent); }
.ui-segc[data-size="sm"] .ui-segc__badge { height: 16px; padding: 0 5px; font-size: 10px; }
.ui-segc__pill { position: absolute; top: 0; bottom: 0; left: 0; right: 100%; z-index: 0; border-radius: 6px; background: var(--ui-segc-fill); opacity: 0; pointer-events: none; transition: left 200ms var(--ui-segc-ease), right 200ms var(--ui-segc-ease), scale 120ms var(--ui-segc-ease), opacity 120ms ease; }
.ui-segc__pill[data-dir="right"] { transition-duration: 220ms,160ms,120ms,120ms; }
.ui-segc__pill[data-dir="left"] { transition-duration: 160ms,220ms,120ms,120ms; }
.ui-segc[data-pressed]:not([data-variant="underline"]) .ui-segc__pill { scale: .97; }
.ui-segc[data-variant="buttons"] { --ui-segc-pad: var(--ui-segc-ring); margin: calc(var(--ui-segc-ring) * -1); max-width: calc(100% + var(--ui-segc-ring) * 2); }
.ui-segc[data-variant="buttons"][data-full] { width: calc(100% + var(--ui-segc-ring) * 2); }
.ui-segc[data-variant="buttons"] .ui-segc__track { gap: var(--ui-segc-gap); }
.ui-segc[data-variant="buttons"] .ui-segc__opt { box-shadow: inset 0 0 0 .5px var(--ui-segc-line); }
.ui-segc[data-variant="tray"] { background: var(--ui-segc-track); }
.ui-segc[data-variant="tray"] .ui-segc__opt { height: calc(var(--ui-segc-h) - var(--ui-segc-pad) * 2); }
.ui-segc[data-variant="tray"] .ui-segc__pill { background: var(--ui-segc-card); box-shadow: var(--ui-segc-card-shadow); }
.ui-segc[data-variant="underline"] { --ui-segc-px: 2px; --ui-segc-gap: 20px; border-radius: 0; box-shadow: inset 0 -.5px 0 var(--ui-segc-line); }
.ui-segc[data-variant="underline"] .ui-segc__scroller { padding: 0; }
.ui-segc[data-variant="underline"]:not([data-full]) .ui-segc__track { gap: var(--ui-segc-gap); }
.ui-segc[data-variant="underline"][data-full] { --ui-segc-px: 10px; }
.ui-segc[data-variant="underline"] .ui-segc__opt { height: calc(var(--ui-segc-h) + 6px); }
.ui-segc[data-variant="underline"] .ui-segc__opt:focus-visible { outline-offset: -2px; }
.ui-segc[data-variant="underline"] .ui-segc__pill { top: auto; height: 1.5px; border-radius: 1.5px 1.5px 0 0; background: var(--ui-segc-ink); }
@media (hover: hover) { .ui-segc[data-variant="underline"] .ui-segc__opt:not([data-active]):not(:disabled):hover { background-color: transparent; color: var(--ui-segc-hover-text); } }
@keyframes ui-segc-in { from { opacity: 0; transform: translateY(2px); filter: blur(2px); } to { opacity: 1; transform: none; filter: none; } }
@media (hover: none) and (pointer: coarse) {
  .ui-segc[data-size] { --ui-segc-h: 40px; }
  .ui-segc[data-size="lg"] { --ui-segc-h: 44px; }
  .ui-segc[data-variant="tray"][data-size] { --ui-segc-h: 44px; }
  .ui-segc[data-variant="underline"] .ui-segc__opt { height: var(--ui-segc-h); }
}
@media (prefers-reduced-motion: reduce) { .ui-segc *, .ui-segc *::before, .ui-segc *::after { animation: none !important; transition: none !important; } }
:where(.dark, [data-theme="dark"]) .ui-segc {
  --ui-segc-ink: rgba(255,255,255,.9); --ui-segc-text: rgba(255,255,255,.62); --ui-segc-hover-text: rgba(255,255,255,.78);
  --ui-segc-line: rgba(255,255,255,.08); --ui-segc-wash: rgba(255,255,255,.04); --ui-segc-fill: rgba(255,255,255,.08);
  --ui-segc-track: rgba(255,255,255,.05); --ui-segc-card: #2c2c2f;
  --ui-segc-card-shadow: 0 0 0 .5px rgba(255,255,255,.1),0 1px 2px rgba(0,0,0,.4);
  --ui-segc-accent: #4d8dff; --ui-segc-accent-soft: rgba(77,141,255,.14); --ui-segc-focus: rgba(77,141,255,.45);
}
:where(.dark, [data-theme="dark"]) .ui-segc__icon { color: rgba(255,255,255,.46); }
:where(.dark, [data-theme="dark"]) .ui-segc__opt[data-active] .ui-segc__icon { color: var(--ui-segc-ink); }
`;
