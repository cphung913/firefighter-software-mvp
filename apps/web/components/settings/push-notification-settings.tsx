"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getCurrentSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/notifications/push";
import { cn } from "@/lib/utils";

export function PushNotificationSettings() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    const sup = isPushSupported();
    setSupported(sup);
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
    if (!sup) {
      setSubscribed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const sub = await getCurrentSubscription();
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleEnable() {
    setActionLoading(true);
    try {
      const ok = await subscribeToPush();
      await loadStatus();
      if (typeof window !== "undefined" && "Notification" in window) {
        setPermission(Notification.permission);
      }
      if (!ok) setSubscribed(false);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisable() {
    setActionLoading(true);
    try {
      await unsubscribeFromPush();
      await loadStatus();
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Bell className="h-5 w-5 text-primary" />
          Dispatch Alerts
        </CardTitle>
        <CardDescription>
          Browser push notifications for new dispatches (when VAPID is configured on the server).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking notification status…
          </div>
        ) : null}

        {!loading && !supported ? (
          <p className="text-sm text-muted-foreground">
            Push notifications are not supported on this device/browser.
          </p>
        ) : null}

        {!loading && supported && permission === "denied" ? (
          <p className="text-sm text-amber-800 dark:text-amber-200/90">
            Notifications blocked. Enable in browser settings.
          </p>
        ) : null}

        {!loading &&
        supported &&
        permission !== "denied" &&
        !subscribed ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Get instant alerts when a new dispatch is created.
            </p>
            <Button
              type="button"
              onClick={() => void handleEnable()}
              disabled={actionLoading}
              className="shrink-0"
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Bell className="mr-2 h-4 w-4" />
              )}
              Enable dispatch alerts
            </Button>
          </div>
        ) : null}

        {!loading && supported && subscribed ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500",
                  "ring-2 ring-emerald-500/30"
                )}
                aria-hidden
              />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Alerts enabled
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDisable()}
              disabled={actionLoading}
              className="shrink-0"
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BellOff className="mr-2 h-4 w-4" />
              )}
              Disable
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
