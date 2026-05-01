"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MapPinOff } from "lucide-react";
import type { PresenceEvent } from "@/lib/db/queries/events";
import { fmtTimeOnDate, fmtHours } from "@/lib/client/format-time";
import {
  startProgress,
  stopProgress,
} from "@/components/shared/TopProgressBar";
import { collectDeviceInfo } from "@/lib/client/device-info";

/** Play a short chime via Web Audio API — works regardless of OS notification mode. */
function playChime(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.7);
  } catch {
    /* audio context not available */
  }
}

interface CheckinButtonsProps {
  activeEvent: PresenceEvent | null;
  name: string;
  allowRemote?: boolean;
}

type ToastType = "success" | "info" | "error";

export default function CheckinButtons({
  activeEvent: initialActiveEvent,
  name,
  allowRemote = false,
}: CheckinButtonsProps) {
  const router = useRouter();
  const [state, setState] = useState<"checked_in" | "checked_out">(
    initialActiveEvent ? "checked_in" : "checked_out",
  );
  const [activeEvent, setActiveEvent] = useState(initialActiveEvent);
  type LoadingAction = null | "gps_checkin" | "remote_checkin" | "checkout";
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const loading = loadingAction !== null;
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const [locationAlert, setLocationAlert] = useState<{
    title: string;
    message: string;
  } | null>(null);

  function formatRemaining(ms: number): string {
    const totalMins = Math.max(0, Math.ceil(ms / 60_000));
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  const [autoCheckoutLabel, setAutoCheckoutLabel] = useState<string | null>(
    null,
  );

  // Auto-checkout countdown (minute-based) using device clock
  useEffect(() => {
    const scheduled = activeEvent?.scheduled_checkout_at ?? null;
    if (!scheduled) {
      setAutoCheckoutLabel(null);
      return;
    }

    const scheduledAtMs = new Date(scheduled).getTime();
    if (!Number.isFinite(scheduledAtMs)) {
      setAutoCheckoutLabel(null);
      return;
    }

    const update = () => {
      const remainingMs = scheduledAtMs - Date.now();
      setAutoCheckoutLabel(
        remainingMs > 0
          ? `Auto checkout in ${formatRemaining(remainingMs)}`
          : null,
      );
    };

    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [activeEvent?.scheduled_checkout_at]);

  // Listen for push messages from the service worker — show in-app toast + play chime
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; title?: string; body?: string }
        | undefined;
      if (data?.type === "push-received") {
        playChime();
        showToast(data.body ?? data.title ?? "Notification", "info");
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  async function requestNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }

  function showToast(message: string, type: ToastType = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  type GpsResult =
    | { ok: true; lat: number; lng: number; accuracy: number }
    | { ok: false; reason: "denied" | "timeout" | "unavailable" };

  async function collectGps(): Promise<GpsResult> {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        resolve({ ok: false, reason: "unavailable" });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            ok: true,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        (err) => {
          if (err.code === 1) resolve({ ok: false, reason: "denied" });
          else if (err.code === 3) resolve({ ok: false, reason: "timeout" });
          else resolve({ ok: false, reason: "unavailable" });
        },
        { timeout: 8000, maximumAge: 30000 },
      );
    });
  }

  async function handleCheckin() {
    if (state !== "checked_out" || loading) return;
    setLoadingAction("gps_checkin");
    startProgress();
    try {
      const gps = await collectGps();
      if (!gps.ok) {
        setLocationAlert(
          gps.reason === "denied"
            ? {
                title: "Location access denied",
                message:
                  "CheckMark needs your location to verify check-in. Please enable location permission in your browser settings and try again.",
              }
            : gps.reason === "timeout"
              ? {
                  title: "Location request timed out",
                  message:
                    "Could not get your location in time. Make sure you're not in airplane mode, then try again.",
                }
              : {
                  title: "Location unavailable",
                  message:
                    "Your device could not determine your location. Check that location services are enabled and try again.",
                },
        );
        setLoadingAction(null);
        stopProgress();
        return;
      }
      const gpsCoords = gps;
      const deviceInfo = await collectDeviceInfo().catch(() => null);

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gps_lat: gpsCoords?.lat,
          gps_lng: gpsCoords?.lng,
          gps_accuracy_m: gpsCoords?.accuracy
            ? Math.round(gpsCoords.accuracy)
            : undefined,
          device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
          device_timezone: deviceInfo?.timezone ?? null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setState("checked_in");
        setActiveEvent(data.event);
        await requestNotificationPermission();
        showToast("Checked in!", "success");
        router.refresh();
      } else if (res.status === 409) {
        setState("checked_in");
        showToast(data.error || "Already checked in.", "info");
        router.refresh();
      } else {
        showToast(data.error || "Check-in failed", "error");
      }
    } catch {
      showToast(
        "Check-in failed. Please check your connection and try again.",
        "error",
      );
    } finally {
      stopProgress();
      setLoadingAction(null);
    }
  }

  async function handleRemoteCheckin() {
    if (state !== "checked_out" || loading) return;
    setLoadingAction("remote_checkin");
    startProgress();
    try {
      const deviceInfo = await collectDeviceInfo().catch(() => null);

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gps_lat: null,
          gps_lng: null,
          gps_accuracy_m: null,
          device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
          device_timezone: deviceInfo?.timezone ?? null,
          event_type: "remote_checkin",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setState("checked_in");
        setActiveEvent(data.event);
        await requestNotificationPermission();
        showToast("Checked in remotely!", "success");
        router.refresh();
      } else if (res.status === 409) {
        setState("checked_in");
        showToast(data.error || "Already checked in.", "info");
        router.refresh();
      } else {
        showToast(data.error || "Check-in failed", "error");
      }
    } catch {
      showToast(
        "Check-in failed. Please check your connection and try again.",
        "error",
      );
    } finally {
      stopProgress();
      setLoadingAction(null);
    }
  }

  async function handleCheckout() {
    if (state !== "checked_in" || loading) return;
    setLoadingAction("checkout");
    startProgress();
    try {
      const isRemote = activeEvent?.event_type === "remote_checkin";

      // Remote sessions should not request or capture GPS on checkout.
      // Office sessions: best-effort GPS, but never block checkout on it.
      const gps = isRemote
        ? ({ ok: false, reason: "unavailable" } as const)
        : await Promise.race([
            collectGps(),
            new Promise<GpsResult>((resolve) =>
              setTimeout(() => resolve({ ok: false, reason: "timeout" }), 1500),
            ),
          ]);
      const gpsCoords = gps.ok ? gps : null;

      const res = await fetch("/api/checkin/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gps_lat: isRemote ? null : gpsCoords?.lat,
          gps_lng: isRemote ? null : gpsCoords?.lng,
          gps_accuracy_m: isRemote
            ? null
            : gpsCoords?.accuracy
              ? Math.round(gpsCoords.accuracy)
              : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const hrs = data.duration_hours ? fmtHours(data.duration_hours) : "";
        setState("checked_out");
        setActiveEvent(null);
        showToast(
          `Checked out${hrs ? ` — ${hrs} logged` : ""}${gps.ok ? "" : isRemote ? "" : " (location not captured)"}`,
          "success",
        );
        router.refresh();
      } else if (res.status === 409) {
        setState("checked_out");
        setActiveEvent(null);
        showToast(data.error || "You're not checked in.", "info");
        router.refresh();
      } else {
        showToast(data.error || "Checkout failed", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      stopProgress();
      setLoadingAction(null);
    }
  }

  const toastBg =
    toast?.type === "error"
      ? "var(--danger)"
      : toast?.type === "info"
        ? "var(--amber)"
        : "var(--teal)";

  const isCheckedIn = state === "checked_in";

  const todayDisplay = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      {/* Greeting */}
      <p
        style={{
          fontFamily: "Syne, sans-serif",
          fontSize: "32px",
          fontWeight: 700,
          color: "var(--navy)",
          marginBottom: "6px",
        }}
      >
        Hi, {name}
      </p>

      {/* Date header */}
      <p
        style={{
          fontSize: "13px",
          color: "var(--text-muted)",
          fontFamily: "DM Sans, sans-serif",
          marginBottom: "4px",
        }}
      >
        {todayDisplay}
      </p>

      {/* Status line */}
      <p
        style={{
          fontSize: "15px",
          fontFamily: "DM Sans, sans-serif",
          color: isCheckedIn ? "var(--teal)" : "var(--text-secondary)",
          marginBottom: autoCheckoutLabel ? "8px" : "16px",
        }}
      >
        {isCheckedIn && activeEvent
          ? `Checked in at ${fmtTimeOnDate(activeEvent.checkin_at)}`
          : "Not checked in yet"}
      </p>

      {isCheckedIn && autoCheckoutLabel && (
        <p
          style={{
            fontSize: "13px",
            fontFamily: "DM Sans, sans-serif",
            color: "var(--text-muted)",
            marginBottom: "16px",
          }}
        >
          {autoCheckoutLabel}
        </p>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            background: toastBg,
            color: "#fff",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            marginBottom: "12px",
            fontSize: "14px",
            fontFamily: "DM Sans, sans-serif",
            lineHeight: 1.4,
          }}
        >
          {toast.message}
        </div>
      )}

      {/* "I'm here" — only when CHECKED_OUT */}
      {!isCheckedIn && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "5px",
          }}
        >
          <button
            onClick={handleCheckin}
            disabled={loading}
            style={{
              width: allowRemote ? "60%" : "100%",
              height: "64px",
              background: loading ? "var(--brand-hover)" : "var(--brand)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: "18px",
              fontWeight: 700,
              fontFamily: "Syne, sans-serif",
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "-0.2px",
            }}
          >
            {loadingAction === "gps_checkin" ? "Getting location…" : "I'm here"}
          </button>
          {allowRemote && (
            <button
              onClick={handleRemoteCheckin}
              disabled={loading}
              style={{
                width: "40%",
                height: "64px",
                background: "var(--amber)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-md)",
                fontSize: "18px",
                fontWeight: 700,
                fontFamily: "Syne, sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "-0.2px",
              }}
            >
              {loadingAction === "remote_checkin"
                ? "Checking in…"
                : "Remote check-in"}
            </button>
          )}
        </div>
      )}

      {/* "I'm leaving" — only when CHECKED_IN */}
      {isCheckedIn && (
        <button
          onClick={handleCheckout}
          disabled={loading}
          style={{
            width: "100%",
            height: "64px",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "15px",
            fontWeight: 600,
            fontFamily: "DM Sans, sans-serif",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loadingAction === "checkout" ? "Checking out…" : "I'm leaving"}
        </button>
      )}

      {/* Location error alert */}
      {locationAlert &&
        createPortal(
          <div
            onClick={() => setLocationAlert(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(13,27,42,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--surface-0)",
                border: "1px solid var(--border)",
                borderRadius: "20px",
                padding: "28px 24px 24px",
                width: "100%",
                maxWidth: "420px",
                margin: "0 16px",
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  background:
                    "color-mix(in srgb, var(--danger) 10%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--danger) 20%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                }}
              >
                <MapPinOff size={24} stroke="var(--danger)" strokeWidth={2} />
              </div>

              {/* Title */}
              <p
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "var(--navy)",
                  marginBottom: "8px",
                  lineHeight: 1.3,
                }}
              >
                {locationAlert.title}
              </p>

              {/* Message */}
              <p
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  marginBottom: "24px",
                }}
              >
                {locationAlert.message}
              </p>

              {/* Close button */}
              <button
                onClick={() => setLocationAlert(null)}
                style={{
                  width: "100%",
                  height: "48px",
                  background: "var(--navy)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  fontSize: "15px",
                  fontWeight: 600,
                  fontFamily: "DM Sans, sans-serif",
                  cursor: "pointer",
                  letterSpacing: "-0.1px",
                }}
              >
                Got it
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
