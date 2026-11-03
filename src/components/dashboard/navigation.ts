import { Bot, KeyRound, SlidersHorizontal, Sparkles, Users } from "@/components/icons";
import { HomeIcon } from "./icons";

export const WORKSPACE_PAGES = [
  { id: "home", href: "/", label: "Home", icon: HomeIcon },
  { id: "ask-ai", href: "/ask-ai", label: "Ask AI", icon: Sparkles },
  { id: "agent-board", href: "/agent-board", label: "Agent Board", icon: Bot },
] as const;

export const ADMIN_PAGES = [
  { id: "users", href: "/users", label: "Users", icon: Users },
  { id: "roles", href: "/roles", label: "Roles", icon: KeyRound },
  // Gated by pageViewPermission("permissions") → roles.view: the page renders
  // the roles resource's permissions, so it owns no verbs of its own.
  { id: "permissions", href: "/permissions", label: "Permissions", icon: SlidersHorizontal },
] as const;

export const ALL_PAGES = [...WORKSPACE_PAGES, ...ADMIN_PAGES];
export type WorkspaceRoute = typeof ALL_PAGES[number]["id"] | "watching";

export function workspaceHref(route: string) {
  return route === "watching" ? "/watching" : ALL_PAGES.find(page => page.id === route)?.href;
}

export const WATCHED_COMPANIES = [
  { id: "canguard", name: "Canguard", icon: "/icons/canguard.png" },
  { id: "segnalio", name: "Segnalio", icon: "/icons/segnalio.png" },
  { id: "byteforge", name: "Byteforge", icon: "/icons/byteforge.png" },
  { id: "omnicorp", name: "OmniCorp", icon: "/icons/omnicorp.png" },
] as const;
