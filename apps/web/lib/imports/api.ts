"use client";

import {
  ImportCommitResponseSchema,
  ImportPreviewResponseSchema,
  ImportUploadResponseSchema,
  type ImportCommitResponse,
  type ImportPreviewMappingOverride,
  type ImportPreviewResponse,
  type ImportUploadResponse,
} from "@vfd/shared-types";

import { apiFetch } from "@/lib/api/client";

export async function uploadImportFile(
  file: File
): Promise<ImportUploadResponse> {
  const formData = new FormData();
  formData.set("file", file);

  return ImportUploadResponseSchema.parse(
    await apiFetch<unknown>("/api/v1/import/upload", {
      method: "POST",
      body: formData,
    })
  );
}

export async function fetchImportPreview(
  uploadId: string,
  mappingOverrides?: ImportPreviewMappingOverride[]
): Promise<ImportPreviewResponse> {
  return ImportPreviewResponseSchema.parse(
    await apiFetch<unknown>("/api/v1/import/preview", {
      method: "POST",
      body: JSON.stringify({
        upload_id: uploadId,
        mapping_overrides: mappingOverrides ?? [],
      }),
    })
  );
}

export async function commitImportPreview(
  uploadId: string
): Promise<ImportCommitResponse> {
  return ImportCommitResponseSchema.parse(
    await apiFetch<unknown>("/api/v1/import/commit", {
      method: "POST",
      body: JSON.stringify({ upload_id: uploadId }),
    })
  );
}
