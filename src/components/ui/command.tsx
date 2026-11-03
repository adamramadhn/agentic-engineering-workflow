"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "cn"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SearchIcon, CheckIcon } from "@/components/icons"

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-2xl bg-white text-neutral-900",
        className
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
  children: React.ReactNode
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn(
          "top-[8%] sm:top-[16%] -translate-y-0 overflow-hidden rounded-2xl p-0 gap-0 shadow-2xl w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-[540px] border border-neutral-200/90 bg-white ring-0",
          className
        )}
        showCloseButton={showCloseButton}
      >
        <Command className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.05em] [&_[cmdk-group-heading]]:text-neutral-400 [&_[cmdk-group]]:px-0 [&_[cmdk-item]]:px-2.5 [&_[cmdk-item]]:py-1.5 [&_[cmdk-item]_svg]:size-4">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-[48px] items-center border-b border-neutral-100 px-3.5">
      <SearchIcon className="mr-2.5 size-[15px] shrink-0 text-neutral-400" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-full w-full bg-transparent text-[13.5px] font-normal text-neutral-900 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      <kbd className="ml-2 inline-flex h-[18px] select-none items-center rounded border border-neutral-200/80 bg-neutral-100/80 px-1.5 font-mono text-[10px] font-medium text-neutral-400">
        ESC
      </kbd>
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "custom-scrollbar max-h-[380px] scroll-py-1 overflow-x-hidden overflow-y-auto p-1.5 outline-none",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-12 text-center text-[13px] text-neutral-400", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-0 text-neutral-900",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("my-1 h-px bg-neutral-100 mx-2", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex h-[35px] cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-neutral-700 outline-none transition-colors data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-neutral-100 data-selected:text-neutral-900 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
    </CommandPrimitive.Item>
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-[10px] font-mono font-medium tracking-normal text-neutral-400 group-data-selected/command-item:text-neutral-500",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
