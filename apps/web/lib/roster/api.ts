"use client";

import {
  PersonnelCreateRequestSchema,
  UserSchema,
  type PersonnelCreateRequest,
  type User,
} from "@vfd/shared-types";

import { apiFetch } from "@/lib/api/client";

export async function createPersonnel(
  payload: PersonnelCreateRequest
): Promise<User> {
  const body = PersonnelCreateRequestSchema.parse(payload);
  return UserSchema.parse(
    await apiFetch<unknown>("/api/v1/roster", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}
