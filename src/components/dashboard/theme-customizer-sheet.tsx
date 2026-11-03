"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  SlidersHorizontal,
  Sun,
  Moon,
  Laptop,
  Check,
  RotateCcw,
} from "@/components/icons";
import { toast } from "sonner";

interface ThemeCustomizerSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ACCENT_COLORS = [
  { id: "zinc", name: "Zinc", hex: "#18181b", class: "bg-neutral-900" },
  { id: "indigo", name: "Indigo", hex: "#6366f1", class: "bg-indigo-600" },
  { id: "emerald", name: "Emerald", hex: "#10b981", class: "bg-emerald-600" },
  { id: "violet", name: "Violet", hex: "#8b5cf6", class: "bg-violet-600" },
  { id: "amber", name: "Amber", hex: "#f59e0b", class: "bg-amber-600" },
];

export function ThemeCustomizerSheet({ open, onOpenChange }: ThemeCustomizerSheetProps) {
  const { theme, setTheme } = useTheme();
  const [selectedAccent, setSelectedAccent] = useState("zinc");
  const [density, setDensity] = useState<"default" | "compact">("default");
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const handleSelectAccent = (id: string, name: string) => {
    setSelectedAccent(id);
    toast.success(`Theme accent applied: ${name}`);
  };

  const handleReset = () => {
    setTheme("light");
    setSelectedAccent("zinc");
    setDensity("default");
    toast.info("Appearance reset");
  };

  return (
    <>
      {/* Appearance settings */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Appearance settings"
        className="fixed bottom-5 right-5 z-40 size-9 rounded-lg border border-neutral-200 bg-white text-neutral-500 dark:border-neutral-800 dark:bg-[#121215] dark:text-neutral-400 shadow-xs flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
      >
        <SlidersHorizontal className="size-4" />
      </button>

      <Sheet open={currentOpen} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-white dark:bg-[#121215] border-l border-neutral-200 dark:border-neutral-800 p-0 flex flex-col shadow-2xl overflow-y-auto custom-scrollbar"
        >
          {/* Header */}
          <div className="p-6 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/40">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-[17px] font-semibold text-neutral-900 dark:text-neutral-100">
                  Appearance
                </SheetTitle>
              </div>
            </div>
            <SheetDescription className="text-[12.5px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Choose your display preferences.
            </SheetDescription>
          </div>

          <div className="p-6 space-y-6 flex-1">
            {/* Color Scheme Section */}
            <div className="space-y-3">
              <label className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
                <span>Color Scheme</span>
                <span className="text-[11.5px] font-normal text-neutral-400 capitalize">
                  {theme || "light"} mode
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: "light", label: "Light", icon: Sun },
                  { id: "dark", label: "Dark", icon: Moon },
                  { id: "system", label: "System", icon: Laptop },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = theme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTheme(item.id)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-[12px] font-medium transition-all cursor-pointer ${
                        isActive
                          ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs"
                          : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50/50"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accent Color Section */}
            <div className="space-y-3">
              <label className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
                <span>Accent Color</span>
                <span className="text-[11.5px] font-normal text-neutral-400">
                  {ACCENT_COLORS.find((c) => c.id === selectedAccent)?.name}
                </span>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {ACCENT_COLORS.map((accent) => {
                  const isSelected = selectedAccent === accent.id;
                  return (
                    <button
                      key={accent.id}
                      type="button"
                      onClick={() => handleSelectAccent(accent.id, accent.name)}
                      className={`h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                        isSelected
                          ? "ring-2 ring-neutral-900 dark:ring-white ring-offset-2 dark:ring-offset-[#121215] scale-105"
                          : "hover:scale-102 opacity-85 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: accent.hex }}
                      title={accent.name}
                    >
                      {isSelected && <Check className="size-4 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Layout Density */}
            <div className="space-y-3">
              <label className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                Layout Density
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: "default", label: "Comfortable" },
                  { id: "compact", label: "Compact" },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setDensity(d.id as "default" | "compact");
                      toast.info(`Layout density set to ${d.label}`);
                    }}
                    className={`p-2.5 rounded-xl border text-[12px] font-medium transition-all cursor-pointer ${
                      density === d.id
                        ? "border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50/50"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-9 gap-1.5 text-[12px] border-neutral-200 dark:border-neutral-800 cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              Reset Defaults
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
              }}
              className="h-9 gap-1.5 text-[12px] bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 cursor-pointer"
            >
              Done
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
