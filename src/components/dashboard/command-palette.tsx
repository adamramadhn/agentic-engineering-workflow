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
import { ADMIN_PAGES, WORKSPACE_PAGES, WATCHED_COMPANIES } from "./navigation";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (route: string) => void;
}

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
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
        <CommandGroup heading="Navigation">
          {WORKSPACE_PAGES.map(page => (
            <CommandItem key={page.id} onSelect={() => select(() => onNavigate ? onNavigate(page.id) : router.push(page.href))}>
              <page.icon className="size-4 text-neutral-500" /><span>{page.label}</span>
            </CommandItem>
          ))}
          <CommandItem onSelect={() => select(() => router.push("/watching"))}>
            <Users className="size-4 text-neutral-500" /><span>Watching</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Admin">
          {ADMIN_PAGES.map(page => <CommandItem key={page.id} onSelect={() => select(() => onNavigate ? onNavigate(page.id) : router.push(page.href))}>
            <page.icon className="size-4 text-neutral-500" /><span>{page.label}</span>
          </CommandItem>)}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Watched Companies">
          {WATCHED_COMPANIES.map(company => (
            <CommandItem key={company.id} onSelect={() => select(() => router.push(`/watching#${company.id}`))}>
              <Image src={company.icon} alt="" width={16} height={16} className="size-4 rounded object-cover" />
              <span>{company.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => select(toggleSidebar)}>
            <PanelLeft className="size-4 text-neutral-500" /><span>Toggle Sidebar</span><CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
