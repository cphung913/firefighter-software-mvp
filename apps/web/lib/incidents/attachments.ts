"use client";

import { getSession, signOut } from "next-auth/react";

import { ApiError, apiFetch } from "@/lib/api/client";

export interface AttachmentOut {
  id: string;
  incident_id: string;
  file_type: string;
  original_filename: string | null;
  file_ref: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export async function fetchAttachments(incidentServerId: string): Promise<AttachmentOut[]> {
  return apiFetch<AttachmentOut[]>(
    `/api/v1/incidents/${incidentServerId}/attachments`
  );
}

export async function uploadAttachment(
  incidentServerId: string,
  file: File,
  caption?: string
): Promise<AttachmentOut> {
  const session = await getSession();
  const formData = new FormData();
  formData.append("file", file);
  if (caption !== undefined && caption !== "") {
    formData.append("caption", caption);
  }

  const headers = new Headers();
  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const res = await fetch(
    `/api/proxy/api/v1/incidents/${encodeURIComponent(incidentServerId)}/attachments`,
    {
      method: "POST",
      body: formData,
      headers,
    }
  );

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      await signOut({ redirect: true, callbackUrl: "/login" });
    }
    throw new ApiError(res.status, body);
  }

  return (await res.json()) as AttachmentOut;
}

export async function deleteAttachment(
  incidentServerId: string,
  attachmentId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/incidents/${incidentServerId}/attachments/${attachmentId}`,
    { method: "DELETE" }
  );
}
