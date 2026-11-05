"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "@/components/icons";
import { Button } from "@/components/ui/button-clean";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrightdeskMark } from "./icons";

interface WorkspaceSwitcherProps {
  workspaces: { id: string; name: string; plan: string }[];
  /** Active workspace's project id (names are labels and need not be unique). */
  value: string;
  onChange: (id: string) => void;
  onCreate: () => void;
  collapsed?: boolean;
}

export function WorkspaceSwitcher({ workspaces, value, onChange, onCreate, collapsed = false }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const activeName = workspaces.find(workspace => workspace.id === value)?.name ?? "";
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <style href="workspace-switcher-clean" precedence="default">{css}</style>
      <DropdownMenuTrigger render={<Button variant="ghost" size="md" className="workspace-switcher-trigger" aria-label={activeName ? `Switch workspace, current ${activeName}` : "Switch workspace"} icon={<BrightdeskMark />} iconRight={collapsed ? undefined : <ChevronDown />} />}>
        {collapsed ? null : activeName}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="workspace-switcher-menu">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {workspaces.map(workspace => (
              <DropdownMenuRadioItem key={workspace.id} value={workspace.id} closeOnClick onClick={() => setOpen(false)}>
                <span className="workspace-switcher-mark" aria-hidden="true">{workspace.name.slice(0, 1)}</span>
                <span className="workspace-switcher-details"><span>{workspace.name}</span><span className="workspace-switcher-plan">{workspace.plan}</span></span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled title="Workspace creation is unavailable in this demo" onClick={onCreate}><Plus data-icon="inline-start" /><span>Create workspace</span><span className="workspace-switcher-unavailable">Demo</span></DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const css = /* css */ `
.workspace-switcher-trigger.ui-buttonc { max-width: 100%; padding-inline: 4px; gap: 8px; }
.workspace-switcher-trigger .ui-buttonc__icon:first-child { width: 20px; height: 20px; }
.workspace-switcher-trigger .ui-buttonc__icon:first-child svg { width: 20px; height: 20px; border-radius: 5px; }
.workspace-switcher-trigger .ui-buttonc__icon:last-child svg { width: 12px; height: 12px; }
.workspace-switcher-menu[data-slot="dropdown-menu-content"] {
  width: min(248px, calc(100vw - 32px)); padding: 4px; border: 1px solid var(--border); border-radius: 10px;
  background: var(--popover); color: var(--popover-foreground); box-shadow: none;
  font-family: inherit; font-size: .8125rem; line-height: 1.5; --tw-ring-shadow: 0 0 #0000;
  overscroll-behavior: contain;
}
.workspace-switcher-menu [data-slot="dropdown-menu-label"] {
  padding: 6px 8px; font-size: .75rem; line-height: 1.5; font-weight: 500; color: var(--muted-foreground);
}
.workspace-switcher-menu [data-slot="dropdown-menu-radio-item"] {
  min-height: 42px; padding-block: 5px; padding-inline: 8px 28px; gap: 8px;
  font-size: .8125rem; line-height: 1.4; cursor: pointer; color: var(--popover-foreground);
}
.workspace-switcher-menu [data-slot="dropdown-menu-item"] {
  min-height: 32px; padding: 6px 8px; gap: 8px; font-size: .8125rem; line-height: 1.5;
}
.workspace-switcher-menu [data-slot="dropdown-menu-radio-item"]:is(:focus, [data-highlighted]) {
  background: var(--accent); color: var(--accent-foreground);
}
.workspace-switcher-menu [data-slot="dropdown-menu-radio-item"]:focus-visible {
  outline: 2px solid var(--popover-foreground); outline-offset: -2px;
}
.workspace-switcher-mark {
  display: grid; place-items: center; flex: none; width: 24px; height: 24px; border-radius: 5px;
  background: var(--muted); color: var(--muted-foreground); font-size: .75rem; font-weight: 500;
}
.workspace-switcher-details { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
.workspace-switcher-plan { font-size: .75rem; color: var(--muted-foreground); }
.workspace-switcher-menu [data-slot="dropdown-menu-radio-item"]:is(:focus, [data-highlighted]) .workspace-switcher-plan { color: var(--accent-foreground); }
.workspace-switcher-menu [data-slot="dropdown-menu-separator"] { margin: 4px 0; background: var(--border); }
.workspace-switcher-menu [data-slot="dropdown-menu-radio-item-indicator"] { inset-inline-end: 8px; inset-inline-start: auto; }
.workspace-switcher-unavailable { margin-inline-start: auto; font-size: .75rem; color: var(--muted-foreground); }
@media (hover: hover) {
  .workspace-switcher-menu [data-slot="dropdown-menu-radio-item"]:hover { background: var(--accent); color: var(--accent-foreground); }
  .workspace-switcher-menu [data-slot="dropdown-menu-radio-item"]:hover .workspace-switcher-plan { color: var(--accent-foreground); }
}
@media (hover: none) and (pointer: coarse) { .workspace-switcher-menu [data-slot="dropdown-menu-radio-item"], .workspace-switcher-menu [data-slot="dropdown-menu-item"] { min-height: 44px; } }
@media (prefers-reduced-motion: reduce) { .workspace-switcher-menu { animation: none !important; transition: none !important; } }
`;
