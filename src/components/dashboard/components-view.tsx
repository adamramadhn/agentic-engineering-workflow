"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Layers,
  Search,
  Terminal,
} from "@/components/icons";
import { toast } from "sonner";
import {
  COMPONENTS_CATALOG,
  COMPONENT_CATEGORIES,
} from "@/lib/components-catalog";

export function ComponentsView() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const copyCli = (e: React.MouseEvent, slug: string, cli: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(cli);
    setCopiedSlug(slug);
    toast.success("CLI command copied");
    setTimeout(() => setCopiedSlug(null), 1500);
  };

  const filteredComponents = COMPONENTS_CATALOG.filter((c) => {
    const matchesCat =
      selectedCategory === "all" || c.category === selectedCategory;
    const matchesQuery =
      searchQuery.trim() === "" ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="flex flex-col space-y-8 pb-16">
      {/* Header */}
      <div className="border-b border-neutral-100 dark:border-neutral-800 pb-5">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 select-none">
          Design System & Showcase
        </span>
        <h1 className="mt-1.5 text-[22px] sm:text-[24px] font-bold tracking-[-0.011em] text-[#09090b] dark:text-[#fafafa]">
          Component library
        </h1>
        <p className="mt-1 max-w-[760px] text-[12.5px] leading-relaxed text-[#71717a] dark:text-neutral-400 tracking-[-0.011em]">
          Comprehensive catalog of {COMPONENTS_CATALOG.length} accessible UI components built with Tailwind CSS and Radix/Base-UI primitives. Each component has its own dedicated documentation page, live interactive playground, and API specifications.
        </p>

        {/* Filter Bar & Quick Search */}
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`h-7 px-2.5 rounded-md text-[11.5px] font-medium transition-all select-none active:scale-[0.96] cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-[#f4f4f6] dark:bg-neutral-800/80 text-[#71717a] dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              All ({COMPONENTS_CATALOG.length})
            </button>

            {COMPONENT_CATEGORIES.map((cat) => {
              const count = COMPONENTS_CATALOG.filter(
                (c) => c.category === cat.id
              ).length;
              const isActive = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`h-7 px-2.5 rounded-md text-[11.5px] font-medium transition-all select-none active:scale-[0.96] cursor-pointer ${
                    isActive
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "bg-[#f4f4f6] dark:bg-neutral-800/80 text-[#71717a] dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 21 components..."
              className="h-7.5 w-full rounded-lg border border-[#e2e2e5] dark:border-neutral-800 bg-[#f8f8fa] dark:bg-[#16161a] pl-8 pr-2.5 text-[11.5px] text-[#09090b] dark:text-neutral-200 placeholder:text-neutral-400 outline-none focus:bg-white dark:focus:bg-[#18181c] focus:border-neutral-400 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Grid of Components */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredComponents.map((item) => (
          <Link
            key={item.slug}
            href={`/components/${item.slug}`}
            className="group relative flex flex-col justify-between rounded-xl border border-[#e2e2e5] dark:border-neutral-800 bg-white dark:bg-[#121215] p-4.5 hover:border-neutral-400 dark:hover:border-neutral-600 transition-all shadow-2xs cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
                  {item.categoryLabel}
                </span>
                <button
                  type="button"
                  title="Copy CLI add command"
                  onClick={(e) => copyCli(e, item.slug, item.cli)}
                  className="size-6 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {copiedSlug === item.slug ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              </div>

              <h3 className="text-[14px] font-semibold text-neutral-900 dark:text-white tracking-[-0.011em] group-hover:text-neutral-600 dark:group-hover:text-neutral-200 transition-colors">
                {item.title}
              </h3>

              <p className="mt-1 text-[11.5px] leading-relaxed text-[#71717a] dark:text-neutral-400 tracking-[-0.011em] line-clamp-2">
                {item.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
              <span className="font-mono text-[10.5px] text-neutral-400">
                {item.propsDoc.length} props
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 group-hover:translate-x-0.5 transition-transform">
                Explore
                <ChevronRight className="size-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {filteredComponents.length === 0 && (
        <div className="text-center py-12 rounded-xl border border-dashed border-[#e2e2e5] dark:border-neutral-800">
          <p className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
            No components found
          </p>
          <p className="text-[11.5px] text-neutral-400 mt-1">
            Try adjusting your search query or filter category.
          </p>
        </div>
      )}
    </div>
  );
}
