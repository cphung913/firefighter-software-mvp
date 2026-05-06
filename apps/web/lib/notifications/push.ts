"use client";

import { apiFetch } from "@/lib/api/client";

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "PushManager" in window && "serviceWorker" in navigator;
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function getVapidPublicKey(): Promise<string | null> {
  const res = await apiFetch<{ public_key: string | null }>(
    "/api/v1/notifications/vapid-public-key"
  );
  return res.public_key ?? null;
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    try {
      reg = await navigator.serviceWorker.register("/sw.js");
    } catch {
      return null;
    }
  }
  return reg;
}

export async function getCurrentSubscription(): Promise<globalThis.PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const publicKey = await getVapidPublicKey();
  if (!publicKey) return false;

  const reg = await ensureServiceWorkerRegistration();
  if (!reg) return false;

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKey),
    });
    const p256dh = arrayBufferToBase64Url(await sub.getKey("p256dh"));
    const auth = arrayBufferToBase64Url(await sub.getKey("auth"));
    await apiFetch("/api/v1/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh_key: p256dh,
        auth_key: auth,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 256) : null,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const sub = await getCurrentSubscription();
  if (!sub) return true;

  const endpoint = sub.endpoint;
  let p256dh = "";
  let auth = "";
  try {
    p256dh = arrayBufferToBase64Url(await sub.getKey("p256dh"));
    auth = arrayBufferToBase64Url(await sub.getKey("auth"));
    await apiFetch("/api/v1/notifications/unsubscribe", {
      method: "DELETE",
      body: JSON.stringify({
        endpoint,
        p256dh_key: p256dh,
        auth_key: auth,
        user_agent: null,
      }),
    });
  } catch {
    return false;
  }

  try {
    await sub.unsubscribe();
  } catch {
    return false;
  }
  return true;
}
