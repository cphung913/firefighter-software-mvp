"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Music,
  Paperclip,
  Video,
  X,
} from "lucide-react";

import {
  type AttachmentOut,
  deleteAttachment,
  fetchAttachments,
  uploadAttachment,
} from "@/lib/incidents/attachments";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/*,application/pdf,video/*";

function formatFilename(name: string | null): string {
  if (name?.trim()) return name;
  return "Attachment";
}

function FileThumb({ attachment }: { attachment: AttachmentOut }) {
  const isImg =
    attachment.file_type === "photo" ||
    (attachment.mime_type?.startsWith("image/") ?? false);
  const hasDataSrc =
    attachment.file_ref.startsWith("data:image/") && isImg;

  if (hasDataSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URIs from API
      <img
        src={attachment.file_ref}
        alt=""
        className="h-full w-full object-cover"
      />
    );
  }

  let Icon = Paperclip;
  if (attachment.file_type === "document") Icon = FileText;
  else if (attachment.file_type === "video") Icon = Video;
  else if (attachment.file_type === "audio") Icon = Music;
  else if (attachment.file_type === "photo") Icon = ImageIcon;

  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--ink)]/80">
      <Icon className="h-10 w-10 text-[var(--bone-dim)]" aria-hidden />
    </div>
  );
}

interface Props {
  incidentServerId: string | null;
}

export function AttachmentPanel({ incidentServerId }: Props) {
  const [items, setItems] = useState<AttachmentOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    if (!incidentServerId) return;
    setLoading(true);
    setInlineError(null);
    try {
      const list = await fetchAttachments(incidentServerId);
      setItems(list);
    } catch (err) {
      setItems([]);
      setInlineError(
        err instanceof Error ? err.message : "Could not load attachments."
      );
    } finally {
      setLoading(false);
    }
  }, [incidentServerId]);

  useEffect(() => {
    if (!incidentServerId) {
      setItems([]);
      return;
    }
    void load();
  }, [incidentServerId, load]);

  async function handleDelete(id: string) {
    if (!incidentServerId) return;
    setDeletingId(id);
    setInlineError(null);
    try {
      await deleteAttachment(incidentServerId, id);
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setInlineError("You can only delete your own uploads (or ask an admin).");
      } else {
        setInlineError(
          err instanceof Error ? err.message : "Could not delete attachment."
        );
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function enqueueUploads(files: FileList | File[]) {
    if (!incidentServerId) return;
    const list = Array.from(files).filter(Boolean);
    for (const file of list) {
      if (file.size > MAX_BYTES) {
        setInlineError(`"${file.name}" is over 10MB and was skipped.`);
        continue;
      }
      setUploading(true);
      setInlineError(null);
      try {
        const created = await uploadAttachment(incidentServerId, file);
        setItems((prev) => [created, ...prev]);
      } catch (err) {
        if (err instanceof ApiError && err.status === 413) {
          setInlineError("That file exceeds the 10MB limit.");
        } else {
          setInlineError(
            err instanceof Error ? err.message : "Upload failed. Try again."
          );
        }
      } finally {
        setUploading(false);
      }
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  if (!incidentServerId) {
    return (
      <div className="rounded border border-[var(--rule)] bg-[var(--ink)]/40 px-4 py-6 text-center font-body text-[14px] text-[var(--bone-dim)]">
        Save and sync the incident to add attachments.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {inlineError ? (
        <div className="border border-[var(--signal)]/50 bg-[rgba(200,54,44,0.08)] px-3 py-2 font-body text-[13px] text-[var(--signal)]">
          {inlineError}
        </div>
      ) : null}

      <div
        className={cn(
          "relative rounded border border-dashed border-[var(--rule-strong)] bg-[var(--ink)]/30 px-4 py-8 text-center transition-colors",
          dragOver && "border-[var(--amber)] bg-[rgba(232,161,58,0.06)]"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          if (uploading) return;
          const files = e.dataTransfer?.files;
          if (files?.length) void enqueueUploads(files);
        }}
      >
        <label className="block min-h-[5rem] cursor-pointer rounded px-4 py-8 text-center font-body text-[14px] text-[var(--bone-dim)]">
          <span className="font-medium text-[var(--bone)]">
            Click or drag to add photos or files
          </span>
          <span className="mt-2 block text-[12px]">
            Images, PDF, or video · max 10MB each
          </span>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={ACCEPT}
            disabled={uploading}
            multiple
            onChange={(e) => {
              const picked = e.target.files;
              if (picked?.length) void enqueueUploads(picked);
            }}
          />
        </label>
        {uploading ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-[var(--ink)]/55">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--bone)]" />
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--bone-dim)]" />
        </div>
      ) : items.length === 0 ? (
        <p className="font-body text-[13px] text-[var(--bone-dim)]">
          No attachments yet.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <li
              key={a.id}
              className="group relative overflow-hidden rounded border border-[var(--rule)] bg-[var(--ink)]/50"
            >
              <div className="aspect-video w-full overflow-hidden border-b border-[var(--rule)]">
                <FileThumb attachment={a} />
              </div>
              <div className="space-y-1 p-3 pr-9">
                <p className="truncate font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--bone-dim)]">
                  {formatFilename(a.original_filename)}
                </p>
                {a.caption ? (
                  <p className="font-body text-[13px] text-[var(--bone)]">{a.caption}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded border border-[var(--rule)] bg-[var(--ink)]/90 text-[var(--bone)] opacity-80 transition hover:border-[var(--signal)] hover:text-[var(--signal)] group-hover:opacity-100"
                aria-label="Delete attachment"
                disabled={deletingId === a.id || uploading}
                onClick={() => void handleDelete(a.id)}
              >
                {deletingId === a.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
