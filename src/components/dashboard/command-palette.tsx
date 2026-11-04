"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PanelLeft, Users } from "@/components/icons";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { useSidebar } from "@/components/ui/sidebar";
import { usePermission } from "./permission-provider";
import { pageViewPermission } from "@/lib/permissions";
import { ADMIN_PAGES, WORKSPACE_PAGES, WATCHED_COMPANIES } from "./navigation";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (route: string) => void;
}

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const { can } = usePermission();

  // Same filtering rule as the sidebar (design §6): nav entries gate on their
  // page's view permission (admin entries via pageViewPermission — the future
  // /permissions page shares roles.view), everything Watching-related on
  // watching.view. Empty groups hide entirely, separator included.
  const workspacePages = WORKSPACE_PAGES.filter(page => can(`${page.id}.view`));
  const adminPages = ADMIN_PAGES.filter(page => can(pageViewPermission(page.id)));
  const canWatchWatching = can("watching.view");
  const hasNavigation = workspacePages.length > 0 || canWatchWatching;
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const select = (action: () => void) => { action(); onOpenChange(false); };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages and watched companies..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {hasNavigation && (
          <>
            <CommandGroup heading="Navigation">
              {workspacePages.map(page => (
                <CommandItem key={page.id} onSelect={() => select(() => onNavigate ? onNavigate(page.id) : router.push(page.href))}>
                  <page.icon className="size-4 text-neutral-500" /><span>{page.label}</span>
                </CommandItem>
              ))}
              {canWatchWatching && (
                <CommandItem onSelect={() => select(() => router.push("/watching"))}>
                  <Users className="size-4 text-neutral-500" /><span>Watching</span>
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {adminPages.length > 0 && (
          <>
            <CommandGroup heading="Admin">
              {adminPages.map(page => <CommandItem key={page.id} onSelect={() => select(() => onNavigate ? onNavigate(page.id) : router.push(page.href))}>
                <page.icon className="size-4 text-neutral-500" /><span>{page.label}</span>
              </CommandItem>)}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {canWatchWatching && (
          <>
            <CommandGroup heading="Watched Companies">
              {WATCHED_COMPANIES.map(company => (
                <CommandItem key={company.id} onSelect={() => select(() => router.push(`/watching#${company.id}`))}>
                  <Image src={company.icon} alt="" width={16} height={16} className="size-4 rounded object-cover" />
                  <span>{company.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => select(toggleSidebar)}>
            <PanelLeft className="size-4 text-neutral-500" /><span>Toggle Sidebar</span><CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
