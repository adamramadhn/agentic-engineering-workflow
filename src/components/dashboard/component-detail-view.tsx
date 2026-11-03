"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Info,
  Layers,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Terminal,
  Trash2,
  User,
  Zap,
} from "@/components/icons";
import { toast } from "sonner";
import {
  ComponentMeta,
  COMPONENTS_CATALOG,
} from "@/lib/components-catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ComponentDetailView({ meta }: { meta: ComponentMeta }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // States for interactive previews
  const [switchState, setSwitchState] = useState(true);
  const [checkboxA, setCheckboxA] = useState(true);
  const [checkboxB, setCheckboxB] = useState(false);
  const [textareaCount, setTextareaCount] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const [selectVal, setSelectVal] = useState("enterprise");

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const currentIndex = COMPONENTS_CATALOG.findIndex((c) => c.slug === meta.slug);
  const prevComponent = currentIndex > 0 ? COMPONENTS_CATALOG[currentIndex - 1] : null;
  const nextComponent =
    currentIndex < COMPONENTS_CATALOG.length - 1
      ? COMPONENTS_CATALOG[currentIndex + 1]
      : null;

  return (
    <div className="flex flex-col space-y-8 pb-16">
      {/* Top Header */}
      <div className="border-b border-neutral-100 dark:border-neutral-800 pb-5">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 select-none">
          {meta.categoryLabel}
        </span>
        <h1 className="mt-1.5 text-[22px] sm:text-[24px] font-bold tracking-[-0.011em] text-[#09090b] dark:text-[#fafafa]">
          {meta.title}
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[12.5px] leading-relaxed text-[#71717a] dark:text-neutral-400 tracking-[-0.011em]">
          {meta.description}
        </p>

        {/* Code Snippets (CLI & Import) */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[800px]">
          {/* CLI */}
          <div className="flex items-center justify-between rounded-lg border border-[#e2e2e5] dark:border-neutral-800 bg-[#f8f8fa] dark:bg-[#151518] px-3 py-2">
            <div className="flex items-center gap-2 overflow-hidden mr-2">
              <Terminal className="size-3.5 text-neutral-400 shrink-0" />
              <code className="font-mono text-[11px] text-[#09090b] dark:text-neutral-200 truncate">
                {meta.cli}
              </code>
            </div>
            <button
              type="button"
              onClick={() => copyText("cli", meta.cli)}
              aria-label="Copy CLI command"
              className="size-6 shrink-0 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              {copiedKey === "cli" ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          </div>

          {/* Import */}
          <div className="flex items-center justify-between rounded-lg border border-[#e2e2e5] dark:border-neutral-800 bg-[#f8f8fa] dark:bg-[#151518] px-3 py-2">
            <div className="flex items-center gap-2 overflow-hidden mr-2">
              <span className="font-mono text-[10px] uppercase text-neutral-400 font-bold shrink-0">
                TS
              </span>
              <code className="font-mono text-[11px] text-[#09090b] dark:text-neutral-200 truncate">
                {meta.importPath}
              </code>
            </div>
            <button
              type="button"
              onClick={() => copyText("import", meta.importPath)}
              aria-label="Copy import statement"
              className="size-6 shrink-0 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              {copiedKey === "import" ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Demo Container */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-[#18181b] dark:text-[#fafafa] tracking-[-0.011em]">
            Interactive Showcase & States
          </h2>
          <span className="text-[11px] font-mono text-neutral-400">
            Preview Canvas
          </span>
        </div>

        <div className="rounded-xl border border-[#e2e2e5] dark:border-neutral-800 bg-white dark:bg-[#121215] p-6 shadow-2xs">
          {/* RENDER BY SLUG */}
          {meta.slug === "button" && (
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-3">
                  Visual Variants
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    className="h-7.5 px-3 text-[11.5px] active:scale-[0.96]"
                    onClick={() => toast.success("Default Primary")}
                  >
                    Default Primary
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-7.5 px-3 text-[11.5px] active:scale-[0.96]"
                    onClick={() => toast.info("Secondary")}
                  >
                    Secondary
                  </Button>
                  <Button
                    variant="outline"
                    className="h-7.5 px-3 text-[11.5px] active:scale-[0.96]"
                    onClick={() => toast("Outline")}
                  >
                    Outline
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-7.5 px-3 text-[11.5px] active:scale-[0.96]"
                    onClick={() => toast("Ghost")}
                  >
                    Ghost
                  </Button>
                  <Button
                    variant="destructive"
                    className="h-7.5 px-3 text-[11.5px] active:scale-[0.96]"
                    onClick={() => toast.error("Destructive")}
                  >
                    <Trash2 className="size-3 mr-1" />
                    Destructive
                  </Button>
                  <Button
                    disabled
                    className="h-7.5 px-3 text-[11.5px] opacity-75"
                  >
                    <Loader2 className="size-3 mr-1.5 animate-spin" />
                    Loading
                  </Button>
                </div>
              </div>

              <div className="h-px bg-neutral-100 dark:bg-neutral-800/80" />

              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-3">
                  Sizes & Icon Buttons
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" className="h-6.5 text-[11px]">
                    Small (h-6.5)
                  </Button>
                  <Button size="default" className="h-7.5 text-[11.5px]">
                    Default (h-7.5)
                  </Button>
                  <Button size="lg" className="h-8.5 text-[12px]">
                    Large (h-8.5)
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    aria-label="Download"
                    onClick={() => toast.info("Export started")}
                  >
                    <Download className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    aria-label="Refresh"
                    onClick={() => toast.info("Data refreshed")}
                  >
                    <RefreshCw className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {meta.slug === "badge" && (
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-3">
                  Variants & Status Badges
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge variant="default">Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50">
                    Connected
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50">
                    In Review
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50">
                    Syncing
                  </span>
                </div>
              </div>

              <div className="h-px bg-neutral-100 dark:bg-neutral-800/80" />

              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-3">
                  Monospace Keyboard Shortcut Badges
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <kbd className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded border border-[#e2e2e5] dark:border-neutral-700 bg-[#f8f8fa] dark:bg-neutral-800 px-1 font-mono text-[10px] text-neutral-600 dark:text-neutral-300">
                    ⌘K
                  </kbd>
                  <kbd className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded border border-[#e2e2e5] dark:border-neutral-700 bg-[#f8f8fa] dark:bg-neutral-800 px-1 font-mono text-[10px] text-neutral-600 dark:text-neutral-300">
                    ⌘S
                  </kbd>
                  <kbd className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded border border-[#e2e2e5] dark:border-neutral-700 bg-[#f8f8fa] dark:bg-neutral-800 px-1 font-mono text-[10px] text-neutral-600 dark:text-neutral-300">
                    ⇧P
                  </kbd>
                  <kbd className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded border border-[#e2e2e5] dark:border-neutral-700 bg-[#f8f8fa] dark:bg-neutral-800 px-1 font-mono text-[10px] text-neutral-600 dark:text-neutral-300">
                    Esc
                  </kbd>
                </div>
              </div>
            </div>
          )}

          {meta.slug === "avatar" && (
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-3">
                  Avatar Sizes & Fallback
                </p>
                <div className="flex items-center gap-4">
                  <Avatar className="size-6">
                    <AvatarImage src="/avatar.png" />
                    <AvatarFallback className="text-[10px]">JD</AvatarFallback>
                  </Avatar>
                  <Avatar className="size-8">
                    <AvatarImage src="/avatar.png" />
                    <AvatarFallback className="text-[11px]">JD</AvatarFallback>
                  </Avatar>
                  <Avatar className="size-10">
                    <AvatarImage src="/avatar.png" />
                    <AvatarFallback className="text-[13px]">JD</AvatarFallback>
                  </Avatar>
                  <Avatar className="size-12">
                    <AvatarImage src="/avatar.png" />
                    <AvatarFallback className="text-[14px]">JD</AvatarFallback>
                  </Avatar>
                </div>
              </div>

              <div className="h-px bg-neutral-100 dark:bg-neutral-800/80" />

              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-3">
                  Stacked Avatar Cluster
                </p>
                <div className="flex -space-x-2 overflow-hidden">
                  <Avatar className="size-8 border-2 border-white dark:border-[#121215]">
                    <AvatarImage src="/avatar.png" />
                    <AvatarFallback>A</AvatarFallback>
                  </Avatar>
                  <Avatar className="size-8 border-2 border-white dark:border-[#121215]">
                    <AvatarFallback className="bg-neutral-200 dark:bg-neutral-700 text-[11px]">
                      BK
                    </AvatarFallback>
                  </Avatar>
                  <Avatar className="size-8 border-2 border-white dark:border-[#121215]">
                    <AvatarFallback className="bg-neutral-300 dark:bg-neutral-600 text-[11px]">
                      MC
                    </AvatarFallback>
                  </Avatar>
                  <Avatar className="size-8 border-2 border-white dark:border-[#121215]">
                    <AvatarFallback className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[10px] font-medium">
                      +5
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </div>
          )}

          {meta.slug === "input" && (
            <div className="space-y-4 max-w-[500px]">
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Standard Input
                </label>
                <Input placeholder="Enter workspace title..." />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  With Icon
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" />
                  <Input placeholder="Search endpoints or members..." className="pl-8" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Password Input
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter secret token..."
                    defaultValue="sh_prod_9481b0a8812c"
                    className="pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Disabled Input
                </label>
                <Input disabled defaultValue="immutable_cluster_id_394" />
              </div>
            </div>
          )}

          {meta.slug === "textarea" && (
            <div className="space-y-4 max-w-[560px]">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                    Release Changelog Description
                  </label>
                  <span className="font-mono text-[10px] text-neutral-400">
                    {textareaCount.length}/180
                  </span>
                </div>
                <Textarea
                  rows={3}
                  maxLength={180}
                  value={textareaCount}
                  onChange={(e) => setTextareaCount(e.target.value)}
                  placeholder="Summary of architectural enhancements..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Disabled Textarea
                </label>
                <Textarea disabled defaultValue="Generated system logs are read-only." />
              </div>
            </div>
          )}

          {meta.slug === "select" && (
            <div className="space-y-4 max-w-[360px]">
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                  Cluster Subscription Tier
                </label>
                <Select value={selectVal} onValueChange={(val) => setSelectVal(val || "enterprise")}>
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue placeholder="Select tier..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter ($29/mo)</SelectItem>
                    <SelectItem value="pro">Pro ($79/mo)</SelectItem>
                    <SelectItem value="enterprise">Enterprise ($299/mo)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-neutral-400">
                  Selected value: <span className="font-mono">{selectVal}</span>
                </p>
              </div>
            </div>
          )}

          {meta.slug === "switch" && (
            <div className="space-y-4 max-w-[480px]">
              <div className="flex items-center justify-between rounded-lg border border-[#e2e2e5] dark:border-neutral-800 p-3.5">
                <div>
                  <p className="text-[12px] font-medium text-[#09090b] dark:text-neutral-200">
                    Automatic SSL renewal
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Renew Let's Encrypt certificates 30 days before expiration.
                  </p>
                </div>
                <Switch
                  checked={switchState}
                  onCheckedChange={setSwitchState}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#e2e2e5] dark:border-neutral-800 p-3.5 opacity-60">
                <div>
                  <p className="text-[12px] font-medium text-[#09090b] dark:text-neutral-200">
                    Dark pool routing (Disabled)
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Requires Dedicated Gateway add-on.
                  </p>
                </div>
                <Switch disabled checked={false} />
              </div>
            </div>
          )}

          {meta.slug === "checkbox" && (
            <div className="space-y-3.5 max-w-[480px]">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={checkboxA}
                  onCheckedChange={(val) => setCheckboxA(!!val)}
                />
                <div>
                  <p className="text-[12px] font-medium text-neutral-900 dark:text-neutral-100 leading-tight">
                    Receive weekly digest reports
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Aggregated analytics delivered every Monday at 08:00 UTC.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={checkboxB}
                  onCheckedChange={(val) => setCheckboxB(!!val)}
                />
                <div>
                  <p className="text-[12px] font-medium text-neutral-900 dark:text-neutral-100 leading-tight">
                    Enable strict Content-Security-Policy
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Blocks inline script tags and unvetted CDN bundles.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 opacity-50 cursor-not-allowed">
                <Checkbox disabled checked={false} />
                <div>
                  <p className="text-[12px] font-medium text-neutral-900 dark:text-neutral-100 leading-tight">
                    Custom domain proxy (Locked)
                  </p>
                </div>
              </label>
            </div>
          )}

          {meta.slug === "dialog" && (
            <div className="space-y-4">
              <p className="text-[12px] text-neutral-600 dark:text-neutral-400">
                Click to open an accessible modal dialog with backdrop dismiss and focus trap:
              </p>
              <Dialog>
                <DialogTrigger
                  render={
                    <Button className="h-7.5 px-3 text-[11.5px]">
                      Open Confirmation Dialog
                    </Button>
                  }
                />
                <DialogContent className="max-w-[360px] p-5">
                  <DialogHeader>
                    <DialogTitle className="text-[14px] font-semibold text-[#09090b] dark:text-[#fafafa]">
                      Deprecate API endpoint?
                    </DialogTitle>
                    <DialogDescription className="text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      This action will return a 410 Gone header to any active consumers requesting this path.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-4 flex items-center justify-end gap-2">
                    <DialogClose
                      render={
                        <Button variant="outline" className="h-7.5 px-2.5 text-[11.5px]">
                          Cancel
                        </Button>
                      }
                    />
                    <DialogClose
                      render={
                        <Button
                          variant="destructive"
                          className="h-7.5 px-3 text-[11.5px]"
                          onClick={() => toast.error("Endpoint deprecated")}
                        >
                          Confirm Deprecation
                        </Button>
                      }
                    />
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {meta.slug === "sheet" && (
            <div className="space-y-4">
              <p className="text-[12px] text-neutral-600 dark:text-neutral-400">
                Click to trigger slide-over side drawer panel:
              </p>
              <Sheet>
                <SheetTrigger
                  render={
                    <Button variant="outline" className="h-7.5 px-3 text-[11.5px]">
                      Open Side Drawer Panel
                    </Button>
                  }
                />
                <SheetContent side="right" className="p-6">
                  <SheetHeader>
                    <SheetTitle className="text-[15px] font-semibold">
                      Integration Parameters
                    </SheetTitle>
                    <SheetDescription className="text-[12px] text-neutral-500">
                      Configure webhook credentials and rate limits.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="py-4 space-y-3">
                    <div>
                      <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                        Webhook URL
                      </label>
                      <Input
                        defaultValue="https://api.onyx.dev/v1/events"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                        Signature Secret
                      </label>
                      <Input
                        defaultValue="whsec_8921a942bc"
                        type="password"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="mt-auto pt-4 flex gap-2">
                    <SheetClose
                      render={
                        <Button className="w-full h-7.5 text-[11.5px]">
                          Save Configuration
                        </Button>
                      }
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}

          {meta.slug === "dropdown-menu" && (
            <div className="space-y-4">
              <p className="text-[12px] text-neutral-600 dark:text-neutral-400">
                Click to trigger an accessible floating dropdown menu:
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" className="h-7.5 px-3 text-[11.5px]">
                      <span>Actions Menu</span>
                      <ChevronDown className="size-3.5 ml-1.5 opacity-60" />
                    </Button>
                  }
                />
                <DropdownMenuContent className="w-48">
                  <DropdownMenuLabel className="text-[11px] font-semibold text-neutral-400 uppercase font-mono">
                    Workspace Operations
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="text-[12px] cursor-pointer"
                    onClick={() => toast.info("Syncing metrics...")}
                  >
                    <RefreshCw className="size-3.5 mr-2" />
                    <span>Sync Metrics</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-[12px] cursor-pointer"
                    onClick={() => toast("Downloading logs...")}
                  >
                    <Download className="size-3.5 mr-2" />
                    <span>Export CSV</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-[12px] text-red-600 dark:text-red-400 cursor-pointer"
                    onClick={() => toast.error("Workspace revoked")}
                  >
                    <Trash2 className="size-3.5 mr-2" />
                    <span>Delete Workspace</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {meta.slug === "popover" && (
            <div className="space-y-4">
              <p className="text-[12px] text-neutral-600 dark:text-neutral-400">
                Click to open a rich inline popover overlay:
              </p>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button variant="outline" className="h-7.5 px-3 text-[11.5px]">
                      <Sliders className="size-3 mr-1.5" />
                      Configure Filter
                    </Button>
                  }
                />
                <PopoverContent className="w-64 p-3.5 space-y-3">
                  <p className="text-[12px] font-semibold text-neutral-900 dark:text-white">
                    Filter Records
                  </p>
                  <div>
                    <label className="text-[11px] font-medium text-neutral-500">
                      Minimum Amount ($)
                    </label>
                    <Input defaultValue="500" className="h-7 mt-1 text-[11.5px]" />
                  </div>
                  <Button
                    className="w-full h-7 text-[11.5px]"
                    onClick={() => toast.success("Filters applied")}
                  >
                    Apply Filter
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {meta.slug === "tooltip" && (
            <div className="space-y-4">
              <p className="text-[12px] text-neutral-600 dark:text-neutral-400">
                Hover over buttons to inspect micro tooltips:
              </p>
              <TooltipProvider>
                <div className="flex flex-wrap items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button variant="outline" className="h-7.5 px-2.5 text-[11.5px]">
                          Tooltip Top
                        </Button>
                      }
                    />
                    <TooltipContent side="top">Tooltip top orientation</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button variant="outline" className="h-7.5 px-2.5 text-[11.5px]">
                          Tooltip Bottom
                        </Button>
                      }
                    />
                    <TooltipContent side="bottom">Tooltip bottom orientation</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button variant="outline" className="h-7.5 px-2.5 text-[11.5px]">
                          Tooltip Right
                        </Button>
                      }
                    />
                    <TooltipContent side="right">Tooltip right orientation</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          )}

          {meta.slug === "card" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-[11px] font-mono uppercase">
                    Monthly Recurring Revenue
                  </CardDescription>
                  <CardTitle className="text-[20px] font-bold tracking-tight">
                    $128,490.00
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  +14.2% acceleration compared to previous 30-day baseline.
                </CardContent>
                <CardFooter className="pt-2">
                  <Button variant="outline" className="h-6.5 text-[11px] w-full">
                    View Ledger
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-[11px] font-mono uppercase">
                    Active Subscriptions
                  </CardDescription>
                  <CardTitle className="text-[20px] font-bold tracking-tight">
                    1,429
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  99.4% retention rate over current quarter billing cycle.
                </CardContent>
                <CardFooter className="pt-2">
                  <Button variant="outline" className="h-6.5 text-[11px] w-full">
                    Customer Directory
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {meta.slug === "table" && (
            <div className="rounded-lg border border-[#e2e2e5] dark:border-neutral-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f8f8fa] dark:bg-[#151518]">
                    <TableHead className="text-[11px] font-mono uppercase text-neutral-500">
                      Invoice
                    </TableHead>
                    <TableHead className="text-[11px] font-mono uppercase text-neutral-500">
                      Customer
                    </TableHead>
                    <TableHead className="text-[11px] font-mono uppercase text-neutral-500">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] font-mono uppercase text-neutral-500 text-right">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-[11.5px] font-medium">
                      INV-9021
                    </TableCell>
                    <TableCell className="text-[12px]">Acme Robotics</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        Paid
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-[11.5px] text-right">
                      $2,450.00
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-[11.5px] font-medium">
                      INV-9022
                    </TableCell>
                    <TableCell className="text-[12px]">Canguard Labs</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        Pending
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-[11.5px] text-right">
                      $1,890.00
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {meta.slug === "tabs" && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-[#f0f0f2] dark:bg-[#1a1a1f] p-0.5 rounded-lg h-8 mb-3">
                <TabsTrigger
                  value="overview"
                  className="text-[11.5px] px-3 h-7 rounded-md cursor-pointer"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="security"
                  className="text-[11.5px] px-3 h-7 rounded-md cursor-pointer"
                >
                  Security
                </TabsTrigger>
                <TabsTrigger
                  value="billing"
                  className="text-[11.5px] px-3 h-7 rounded-md cursor-pointer"
                >
                  Billing
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="overview"
                className="p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 text-[12px] text-neutral-600 dark:text-neutral-400"
              >
                Overview panel displaying cluster performance telemetry.
              </TabsContent>
              <TabsContent
                value="security"
                className="p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 text-[12px] text-neutral-600 dark:text-neutral-400"
              >
                Security certificates and active two-factor authorization configurations.
              </TabsContent>
              <TabsContent
                value="billing"
                className="p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 text-[12px] text-neutral-600 dark:text-neutral-400"
              >
                Invoices, payment methods, and current subscription plan tier.
              </TabsContent>
            </Tabs>
          )}

          {meta.slug === "skeleton" && (
            <div className="space-y-4 max-w-[420px]">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-1/3 rounded" />
                  <Skeleton className="h-2.5 w-1/2 rounded" />
                </div>
              </div>
              <Skeleton className="h-2.5 w-full rounded" />
              <Skeleton className="h-2.5 w-5/6 rounded" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          )}

          {meta.slug === "breadcrumb" && (
            <div className="space-y-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/" className="text-[12px]">
                      Home
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/components" className="text-[12px]">
                      Components
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-[12px] font-semibold">
                      Breadcrumb
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          )}

          {meta.slug === "collapsible" && (
            <div className="max-w-[480px]">
              <Collapsible
                open={collapsibleOpen}
                onOpenChange={setCollapsibleOpen}
                className="rounded-lg border border-[#e2e2e5] dark:border-neutral-800 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-medium text-neutral-900 dark:text-neutral-100">
                    How are API tokens rotated?
                  </p>
                  <CollapsibleTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-neutral-400"
                        aria-label="Toggle details"
                      >
                        <ChevronRight
                          className={`size-3.5 transition-transform duration-200 ${
                            collapsibleOpen ? "rotate-90" : ""
                          }`}
                        />
                      </Button>
                    }
                  />
                </div>
                <CollapsibleContent className="text-[11.5px] text-neutral-500 dark:text-neutral-400 leading-relaxed pt-1 border-t border-neutral-100 dark:border-neutral-800">
                  Tokens can be rotated with zero downtime by generating a secondary token, updating client headers, and then revoking the previous credential.
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {meta.slug === "alert" && (
            <div className="space-y-3 max-w-[560px]">
              <Alert variant="default">
                <Info className="size-4" />
                <div>
                  <AlertTitle>Cluster Migration Scheduled</AlertTitle>
                  <AlertDescription>
                    Routine DNS maintenance is scheduled for Sunday at 02:00 UTC with expected failover under 200ms.
                  </AlertDescription>
                </div>
              </Alert>

              <Alert variant="success">
                <Check className="size-4" />
                <div>
                  <AlertTitle>Stripe Connect Synchronization Completed</AlertTitle>
                  <AlertDescription>
                    Successfully reconciled 142 webhooks and updated customer ledger balances.
                  </AlertDescription>
                </div>
              </Alert>

              <Alert variant="destructive">
                <Trash2 className="size-4" />
                <div>
                  <AlertTitle>Rate Limit Approaching Threshold</AlertTitle>
                  <AlertDescription>
                    Your current API tier usage has reached 94% of hourly quota allocation.
                  </AlertDescription>
                </div>
              </Alert>
            </div>
          )}

          {meta.slug === "sonner" && (
            <div className="space-y-4">
              <p className="text-[12px] text-neutral-600 dark:text-neutral-400">
                Trigger interactive notifications using the Sonner toast engine:
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  variant="outline"
                  className="h-7.5 px-3 text-[11.5px]"
                  onClick={() =>
                    toast.success("Changes saved successfully", {
                      description: "Workspace profile synchronized.",
                    })
                  }
                >
                  <span className="size-2 rounded-full bg-emerald-500 mr-2" />
                  Success Toast
                </Button>

                <Button
                  variant="outline"
                  className="h-7.5 px-3 text-[11.5px]"
                  onClick={() =>
                    toast.error("Database query failed", {
                      description: "Timeout connecting to pool host.",
                    })
                  }
                >
                  <span className="size-2 rounded-full bg-red-500 mr-2" />
                  Error Toast
                </Button>

                <Button
                  className="h-7.5 px-3 text-[11.5px]"
                  onClick={() =>
                    toast("API Key Generated", {
                      description: "sec_live_948a0f9b...",
                      action: {
                        label: "Copy",
                        onClick: () => {
                          navigator.clipboard.writeText("sec_live_948a0f9b");
                          toast.success("Copied to clipboard");
                        },
                      },
                    })
                  }
                >
                  Toast with Action Button
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Props Reference Table */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold text-[#18181b] dark:text-[#fafafa] tracking-[-0.011em]">
          Props & API Reference
        </h2>

        <div className="rounded-xl border border-[#e2e2e5] dark:border-neutral-800 bg-white dark:bg-[#121215] overflow-hidden">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[#f8f8fa] dark:bg-[#151518] border-b border-[#e2e2e5] dark:border-neutral-800">
              <tr>
                <th className="py-2.5 px-4 font-mono text-[10.5px] uppercase font-semibold text-neutral-500">
                  Prop
                </th>
                <th className="py-2.5 px-4 font-mono text-[10.5px] uppercase font-semibold text-neutral-500">
                  Type
                </th>
                <th className="py-2.5 px-4 font-mono text-[10.5px] uppercase font-semibold text-neutral-500">
                  Default
                </th>
                <th className="py-2.5 px-4 font-mono text-[10.5px] uppercase font-semibold text-neutral-500">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
              {meta.propsDoc.map((p) => (
                <tr key={p.name} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                  <td className="py-2.5 px-4 font-mono text-[11.5px] font-semibold text-neutral-900 dark:text-neutral-100">
                    {p.name}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                    {p.type}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-neutral-400">
                    {p.default || "—"}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] text-neutral-600 dark:text-neutral-300">
                    {p.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pagination Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-neutral-100 dark:border-neutral-800">
        {prevComponent ? (
          <Link
            href={`/components/${prevComponent.slug}`}
            className="group flex flex-col items-start gap-1 text-left"
          >
            <span className="font-mono text-[10px] uppercase text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 flex items-center gap-1 transition-colors">
              <ArrowLeft className="size-3" />
              Previous
            </span>
            <span className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 group-hover:underline">
              {prevComponent.title}
            </span>
          </Link>
        ) : (
          <div />
        )}

        {nextComponent ? (
          <Link
            href={`/components/${nextComponent.slug}`}
            className="group flex flex-col items-end gap-1 text-right"
          >
            <span className="font-mono text-[10px] uppercase text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 flex items-center gap-1 transition-colors">
              Next
              <ArrowRight className="size-3" />
            </span>
            <span className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 group-hover:underline">
              {nextComponent.title}
            </span>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
