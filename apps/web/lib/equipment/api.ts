"use client";

import {
  EquipmentCreateRequestSchema,
  EquipmentInspectionSchema,
  EquipmentMaintenanceSchema,
  EquipmentSchema,
  type Equipment,
  type EquipmentCreateRequest,
  type EquipmentInspection,
  type EquipmentMaintenance,
} from "@vfd/shared-types";
import { z } from "zod";

import { apiFetch } from "@/lib/api/client";

const BASE = "/api/v1/assets/equipment";

export async function listEquipment(): Promise<Equipment[]> {
  const data = await apiFetch<unknown[]>(BASE);
  return z.array(EquipmentSchema).parse(data);
}

export async function createEquipment(payload: EquipmentCreateRequest): Promise<Equipment> {
  const body = EquipmentCreateRequestSchema.parse(payload);
  return EquipmentSchema.parse(
    await apiFetch<unknown>(BASE, { method: "POST", body: JSON.stringify(body) })
  );
}

export async function updateEquipment(
  equipmentId: string,
  payload: Partial<EquipmentCreateRequest>
): Promise<Equipment> {
  return EquipmentSchema.parse(
    await apiFetch<unknown>(`${BASE}/${equipmentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  );
}

export async function listInspections(equipmentId: string): Promise<EquipmentInspection[]> {
  const data = await apiFetch<unknown[]>(`${BASE}/${equipmentId}/inspections`);
  return z.array(EquipmentInspectionSchema).parse(data);
}

export async function logInspection(
  equipmentId: string,
  payload: Omit<EquipmentInspection, "id">
): Promise<EquipmentInspection> {
  return EquipmentInspectionSchema.parse(
    await apiFetch<unknown>(`${BASE}/${equipmentId}/inspections`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  );
}

export async function listMaintenance(equipmentId: string): Promise<EquipmentMaintenance[]> {
  const data = await apiFetch<unknown[]>(`${BASE}/${equipmentId}/maintenance`);
  return z.array(EquipmentMaintenanceSchema).parse(data);
}

export async function logMaintenance(
  equipmentId: string,
  payload: Omit<EquipmentMaintenance, "id">
): Promise<EquipmentMaintenance> {
  return EquipmentMaintenanceSchema.parse(
    await apiFetch<unknown>(`${BASE}/${equipmentId}/maintenance`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  );
}
