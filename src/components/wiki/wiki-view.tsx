"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, RefreshCw, TagIcon, WikiIcon, X } from "@/components/icons";
import { usePermission } from "@/components/dashboard/permission-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button-clean";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import type { WikiLabelResponse, WikiPageSummary } from "@/lib/wiki";

/**
 * /wiki — the flat page list. Search and label filtering are client-side over
 * the same payload the API returns for every visit; the plan explicitly rules
 * out a query language, so there is nothing to push down.
 */

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function WikiView({
  initialPages,
  initialLabels,
}: {
  initialPages: WikiPageSummary[];
  initialLabels: WikiLabelResponse[];
}) {
  const router = useRouter();
  const { can } = usePermission();
  const canCreate = can("wiki.create");

  const [pages, setPages] = useState(initialPages);
  const [labels, setLabels] = useState(initialLabels);
  const [query, setQuery] = useState("");
  const [labelFilter, setLabelFilter] = useState<Set<string>>(() => new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [pageResponse, labelResponse] = await Promise.all([
        apiFetch("/api/wiki/pages"),
        apiFetch("/api/wiki/labels"),
      ]);
      if (pageResponse.ok) {
        const data = await pageResponse.json();
        if (Array.isArray(data?.pages)) setPages(data.pages);
      }
      if (labelResponse.ok) {
        const data = await labelResponse.json();
        if (Array.isArray(data?.labels)) setLabels(data.labels);
      }
    } catch {
      /* transient — the list keeps its last good rows */
    }
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pages.filter((page) => {
      if (needle && !page.title.toLowerCase().includes(needle)) return false;
      if (labelFilter.size > 0) {
        const ids = new Set(page.labels.map((label) => label.id));
        for (const wanted of labelFilter) {
          if (!ids.has(wanted)) return false;
        }
      }
      return true;
    });
  }, [pages, query, labelFilter]);

  function toggleLabel(id: string, checked: boolean): void {
    setLabelFilter((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <section aria-label="Wiki" className="flex min-w-0 flex-col gap-4">
      <h1 className="sr-only">Wiki</h1>

      <section className="task-sheet wiki-sheet min-w-0" aria-labelledby="wiki-list-title">
        <div className="task-sheet-toolbar flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <WikiIcon className="size-4" aria-hidden="true" />
            <h2 id="wiki-list-title">Wiki pages</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="task-sheet-count tabular-nums">{visible.length} pages</span>
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw />}
              aria-label="Refresh wiki pages"
              onClick={() => void refresh()}
            >
              Refresh
            </Button>
            <Button size="sm" icon={<Plus />} disabled={!canCreate} onClick={() => setCreateOpen(true)}>
              New page
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Input
              aria-label="Search pages by title"
              placeholder="Search pages by title…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pr-8"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {labels.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <TagIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {labels.map((label) => (
                <label
                  key={label.id}
                  className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Checkbox
                    aria-label={`Filter by label ${label.name}`}
                    checked={labelFilter.has(label.id)}
                    onCheckedChange={(checked) => toggleLabel(label.id, Boolean(checked))}
                  />
                  <span>{label.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <ul className="divide-y divide-border">
          {visible.map((page) => (
            <li key={page.id}>
              <button
                type="button"
                onClick={() => router.push(`/wiki/${page.id}`)}
                className="flex w-full flex-col gap-2 px-3 py-3 text-start transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{page.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {page.labels.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No labels</span>
                    ) : (
                      page.labels.map((label) => (
                        <Badge key={label.id} variant="outline">
                          {label.name}
                        </Badge>
                      ))
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <Avatar size="sm" aria-hidden="true">
                    <AvatarFallback>{initials(page.updatedByName ?? page.authorName)}</AvatarFallback>
                  </Avatar>
                  <span>{page.updatedByName ?? page.authorName ?? "Unknown"}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={page.updatedAt}>{formatDate(page.updatedAt)}</time>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {page.commentCount} comment{page.commentCount === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="px-3 py-10 text-center">
              <p>{pages.length === 0 ? "No wiki pages yet" : "No pages match those filters"}</p>
              {canCreate && pages.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Create the first one with “New page”.
                </p>
              )}
            </li>
          )}
        </ul>
      </section>

      <CreatePageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        labels={labels}
        onCreated={(page) => {
          void refresh();
          router.push(`/wiki/${page.id}`);
        }}
      />
    </section>
  );
}

function CreatePageDialog({
  open,
  onOpenChange,
  labels,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: WikiLabelResponse[];
  onCreated: (page: WikiPageSummary) => void;
}) {
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  function reset(): void {
    setTitle("");
    setSelected(new Set());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch("/api/wiki/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, labelIds: [...selected] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || "Failed to create the page");
        return;
      }
      toast.success(`Created ${data.page?.title ?? title}`);
      reset();
      onOpenChange(false);
      if (data.page) onCreated(data.page);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) reset();
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New wiki page</DialogTitle>
          <DialogDescription>
            Give it a title — the editor opens straight after, labels and all.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="new-wiki-title" className="text-xs font-medium text-muted-foreground">
              Title
            </label>
            <Input
              id="new-wiki-title"
              name="title"
              value={title}
              maxLength={200}
              placeholder="Runbook: rotating credentials"
              onChange={(event) => setTitle(event.target.value)}
              required
              autoFocus
            />
          </div>
          {labels.length > 0 && (
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Labels</span>
              <div className="flex flex-wrap gap-3 rounded-lg border border-border p-3">
                {labels.map((label) => (
                  <label
                    key={label.id}
                    className="flex cursor-pointer items-center gap-1.5 text-xs"
                  >
                    <Checkbox
                      aria-label={`Label ${label.name}`}
                      checked={selected.has(label.id)}
                      onCheckedChange={(checked) =>
                        setSelected((previous) => {
                          const next = new Set(previous);
                          if (checked) next.add(label.id);
                          else next.delete(label.id);
                          return next;
                        })
                      }
                    />
                    <span>{label.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" size="lg" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg" loading={saving} disabled={!title.trim()}>
              Create page
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
