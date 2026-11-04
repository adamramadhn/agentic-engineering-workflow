"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import {
  ArrowLeft,
  CancelIcon,
  CommentIcon,
  EditIcon,
  Eye,
  Paperclip,
  Plus,
  SaveIcon,
  TagIcon,
  Trash2,
} from "@/components/icons";
import { usePermission } from "@/components/dashboard/permission-provider";
import { WikiEditor } from "@/components/wiki/wiki-editor";
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
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import type {
  WikiAttachmentResponse,
  WikiCommentResponse,
  WikiLabelResponse,
  WikiPageDetail,
} from "@/lib/wiki";

/**
 * /wiki/[id] — one page, two modes. Everything action-shaped is hidden without
 * its permission AND rejected by the API without it; this component only keeps
 * the UI from offering buttons the server would refuse.
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function WikiPageView({
  initialPage,
  initialLabels,
  storageConfigured,
}: {
  initialPage: WikiPageDetail;
  initialLabels: WikiLabelResponse[];
  storageConfigured: boolean;
}) {
  const router = useRouter();
  const { user, can } = usePermission();
  const canEdit = can("wiki.update");
  const canComment = can("wiki.comment");
  const canDelete = can("wiki.delete");

  const [page, setPage] = useState(initialPage);
  const [labels, setLabels] = useState(initialLabels);

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draftTitle, setDraftTitle] = useState(initialPage.title);
  const [draftContent, setDraftContent] = useState<JSONContent | null>(
    (initialPage.content as JSONContent | null) ?? null
  );
  const [draftLabelIds, setDraftLabelIds] = useState<Set<string>>(
    () => new Set(initialPage.labels.map((label) => label.id))
  );
  // Remounts the editor when the mode flips so it reloads the SAVED document,
  // not whatever was typed into a cancelled edit session.
  const [docEpoch, setDocEpoch] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [creatingLabel, setCreatingLabel] = useState(false);

  const refreshPage = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/wiki/pages/${page.id}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data?.page) setPage(data.page);
    } catch {
      /* transient — keep showing the last good copy */
    }
  }, [page.id]);

  const refreshLabels = useCallback(async () => {
    try {
      const response = await apiFetch("/api/wiki/labels");
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data?.labels)) setLabels(data.labels);
    } catch {
      /* transient */
    }
  }, []);

  function startEdit(): void {
    setDraftTitle(page.title);
    setDraftContent((page.content as JSONContent | null) ?? null);
    setDraftLabelIds(new Set(page.labels.map((label) => label.id)));
    setDocEpoch((epoch) => epoch + 1);
    setMode("edit");
  }

  function cancelEdit(): void {
    setMode("view");
    setDraftTitle(page.title);
    setDraftLabelIds(new Set(page.labels.map((label) => label.id)));
  }

  async function savePage(): Promise<void> {
    setSaving(true);
    try {
      const response = await apiFetch(`/api/wiki/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle,
          content: draftContent,
          labelIds: [...draftLabelIds],
        }),
      });
      const data = await readBody(response);
      if (!response.ok) {
        toast.error((data.error as string) || "Could not save the page");
        return;
      }
      if (data.page) setPage(data.page as WikiPageDetail);
      toast.success("Page saved");
      setMode("view");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function createLabel(): Promise<void> {
    const name = newLabelName.trim();
    if (!name) return;
    setCreatingLabel(true);
    try {
      const response = await apiFetch("/api/wiki/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await readBody(response);
      if (!response.ok) {
        toast.error((data.error as string) || "Could not create the label");
        return;
      }
      setNewLabelName("");
      await refreshLabels();
      if (data.label) {
        setDraftLabelIds((previous) => new Set(previous).add((data.label as WikiLabelResponse).id));
      }
      toast.success(`Created label ${name}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setCreatingLabel(false);
    }
  }

  /**
   * Upload through the API and hand the resulting `/api/wiki/files/{id}` URL
   * back to the editor, which is the only shape content ever references.
   */
  async function uploadAttachment(file: File): Promise<string | null> {
    const form = new FormData();
    form.append("file", file);
    form.append("pageId", page.id);
    form.append("visibility", "private");
    try {
      const response = await apiFetch("/api/wiki/attachments", { method: "POST", body: form });
      const data = await readBody(response);
      if (!response.ok) {
        toast.error((data.error as string) || "Upload failed");
        return null;
      }
      await refreshPage();
      const attachment = data.attachment as WikiAttachmentResponse | undefined;
      return attachment?.url ?? null;
    } catch {
      // A transport failure mid-upload must never reject up into the editor's
      // void upload() — same contract as savePage/deletePage/postComment.
      toast.error("Network error. Please try again.");
      return null;
    }
  }

  async function deletePage(): Promise<void> {
    setDeleting(true);
    try {
      const response = await apiFetch(`/api/wiki/pages/${page.id}`, { method: "DELETE" });
      const data = await readBody(response);
      if (!response.ok) {
        toast.error((data.error as string) || "Could not delete the page");
        return;
      }
      toast.success("Page deleted");
      router.push("/wiki");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const uploadHint = storageConfigured
    ? undefined
    : "Storage is not configured, so uploads are disabled";

  const contentForEditor = useMemo(
    () => (mode === "edit" ? draftContent : ((page.content as JSONContent | null) ?? null)),
    [mode, draftContent, page.content]
  );

  return (
    <section aria-label={page.title} className="flex min-w-0 flex-col gap-4">
      <h1 className="sr-only">{page.title}</h1>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {mode === "edit" ? (
            <Input
              aria-label="Page title"
              value={draftTitle}
              maxLength={200}
              onChange={(event) => setDraftTitle(event.target.value)}
              className="text-lg font-semibold"
            />
          ) : (
            <Link
              href="/wiki"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3" />
              All pages
            </Link>
          )}
          {mode === "view" && (
            <p className="text-xs text-muted-foreground">
              {page.updatedByName ?? page.authorName ?? "Unknown"} updated this page ·{" "}
              <time dateTime={page.updatedAt}>{formatDate(page.updatedAt)}</time>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === "view" ? (
            <>
              {canEdit && (
                <Button size="sm" icon={<EditIcon />} onClick={startEdit}>
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button size="sm" variant="destructive" icon={<Trash2 />} onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
              )}
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" icon={<CancelIcon />} onClick={cancelEdit}>
                Cancel
              </Button>
              <Button
                size="sm"
                icon={<SaveIcon />}
                loading={saving}
                disabled={!draftTitle.trim()}
                onClick={() => void savePage()}
              >
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Labels — chips in view mode, a toggle set + create box in edit mode. */}
      <div className="flex flex-wrap items-center gap-2">
        <TagIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
        {mode === "view" ? (
          page.labels.length === 0 ? (
            <span className="text-xs text-muted-foreground">No labels</span>
          ) : (
            page.labels.map((label) => (
              <Badge key={label.id} variant="outline">
                {label.name}
              </Badge>
            ))
          )
        ) : (
          <>
            {labels.map((label) => (
              <label key={label.id} className="flex cursor-pointer items-center gap-1.5 text-xs">
                <Checkbox
                  aria-label={`Label ${label.name}`}
                  checked={draftLabelIds.has(label.id)}
                  onCheckedChange={(checked) =>
                    setDraftLabelIds((previous) => {
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
            <span className="flex items-center gap-1.5">
              <Input
                aria-label="New label name"
                placeholder="New label…"
                value={newLabelName}
                onChange={(event) => setNewLabelName(event.target.value)}
                className="h-7 w-32 text-xs"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createLabel();
                  }
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={<Plus />}
                loading={creatingLabel}
                disabled={!newLabelName.trim()}
                onClick={() => void createLabel()}
              >
                Add
              </Button>
            </span>
          </>
        )}
      </div>

      <WikiEditor
        key={`${mode}-${docEpoch}`}
        content={contentForEditor}
        editable={mode === "edit"}
        onChange={setDraftContent}
        storageReady={storageConfigured && mode === "edit"}
        uploadHint={uploadHint}
        onInsertImage={uploadAttachment}
        onAttachFile={uploadAttachment}
        placeholder="Write the page…"
      />

      {/* Attachments — metadata only; the bytes live in S3 and are served
          through /api/wiki/files/{id}, which is also what the links point at. */}
      <section className="task-sheet min-w-0" aria-labelledby="wiki-attachments-title">
        <div className="task-sheet-toolbar flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Paperclip className="size-4" aria-hidden="true" />
            <h2 id="wiki-attachments-title">Attachments</h2>
          </div>
          <span className="task-sheet-count tabular-nums">{page.attachments.length}</span>
        </div>
        {page.attachments.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            {storageConfigured
              ? "No files attached. Use the image or attach button in the editor."
              : "No files attached. Uploads are disabled until an administrator configures storage."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {page.attachments.map((attachment) => (
              <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs">
                <a
                  href={attachment.url}
                  className="flex min-w-0 items-center gap-2 font-medium hover:underline"
                >
                  <Eye className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{attachment.fileName}</span>
                </a>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="tabular-nums">{formatBytes(attachment.sizeBytes)}</span>
                  <Badge variant={attachment.visibility === "public" ? "secondary" : "outline"}>
                    {attachment.visibility}
                  </Badge>
                  <span>{attachment.uploadedByName ?? "Unknown"}</span>
                  <time dateTime={attachment.createdAt}>{formatDate(attachment.createdAt)}</time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CommentsPanel
        pageId={page.id}
        initialComments={page.comments}
        canComment={canComment}
        currentUserId={user?.id ?? null}
        canModerate={canDelete}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {page.title}?</DialogTitle>
            <DialogDescription>
              Comments, labels and attachment records are deleted with it. Objects already in
              storage are cleaned up best-effort.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="lg" variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              size="lg"
              variant="destructive"
              loading={deleting}
              onClick={() => void deletePage()}
            >
              Delete page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CommentsPanel({
  pageId,
  initialComments,
  canComment,
  currentUserId,
  canModerate,
}: {
  pageId: string;
  initialComments: WikiCommentResponse[];
  canComment: boolean;
  currentUserId: string | null;
  canModerate: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function post(): Promise<void> {
    setPosting(true);
    try {
      const response = await apiFetch(`/api/wiki/pages/${pageId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await readBody(response);
      if (!response.ok) {
        toast.error((data.error as string) || "Could not post the comment");
        return;
      }
      setBody("");
      if (data.comment) setComments((previous) => [...previous, data.comment as WikiCommentResponse]);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string): Promise<void> {
    setRemovingId(id);
    try {
      const response = await apiFetch(`/api/wiki/comments/${id}`, { method: "DELETE" });
      const data = await readBody(response);
      if (!response.ok) {
        toast.error((data.error as string) || "Could not delete the comment");
        return;
      }
      setComments((previous) => previous.filter((comment) => comment.id !== id));
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="task-sheet min-w-0" aria-labelledby="wiki-comments-title">
      <div className="task-sheet-toolbar flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CommentIcon className="size-4" aria-hidden="true" />
          <h2 id="wiki-comments-title">Comments</h2>
        </div>
        <span className="task-sheet-count tabular-nums">{comments.length}</span>
      </div>

      {canComment && (
        <div className="grid gap-2 border-b border-border p-3">
          <Textarea
            aria-label="Write a comment"
            placeholder={canComment ? "Add a comment…" : "Comment"}
            value={body}
            rows={3}
            maxLength={5000}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              loading={posting}
              disabled={!body.trim()}
              onClick={() => void post()}
            >
              Comment
            </Button>
          </div>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {comments.map((comment) => {
            // The server decides this; mirroring it here only hides a button
            // that would come back 403.
            const mayRemove = comment.authorId === currentUserId || canModerate;
            return (
              <li key={comment.id} className="flex items-start gap-3 px-3 py-3">
                <Avatar size="sm" aria-hidden="true">
                  <AvatarFallback>{initials(comment.authorName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {comment.authorName ?? "Unknown"}
                    </span>
                    <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
                </div>
                {mayRemove && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 />}
                    aria-label={`Delete comment by ${comment.authorName ?? "unknown"}`}
                    loading={removingId === comment.id}
                    disabled={removingId !== null && removingId !== comment.id}
                    onClick={() => void remove(comment.id)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
