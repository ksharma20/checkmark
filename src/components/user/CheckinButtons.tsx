"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PresenceEvent } from "@/lib/db/queries/events";
import type { MatchedBy } from "@/lib/signals";
import { fmtTime, fmtHours, durationLabel } from "@/lib/client/format-time";
import {
  startProgress,
  stopProgress,
} from "@/components/shared/TopProgressBar";
import { collectDeviceInfo } from "@/lib/client/device-info";
import { useToast } from "@/components/shared/Toast";
import { Button, Chip, Divider, Modal } from "@/components/ui";
import ExtendSessionModal from "./ExtendSessionModal";
import { me } from "@/locales/en/me";
import { extendSession } from "@/locales/en/notifications";

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

/** One of today's presence rows, trimmed to what the card renders. */
export interface TodaySession {
  id: string;
  checkin_at: string;
  checkout_at: string | null;
  event_type: string;
  matched_by: MatchedBy | null;
}

interface CheckinButtonsProps {
  activeEvent: PresenceEvent | null;
  allowRemote?: boolean;
  /** Consecutive days with a check-in, from `user_stats`. */
  streak?: number;
  /** Today's presence rows, oldest-to-newest as the server returned them. */
  todaySessions?: TodaySession[];
}

type ToastType = "success" | "info" | "error";

/** The eight-point burst behind the check-in badge. Fixed angles, no randomness. */
const BURST_DOTS = Array.from({ length: 10 }, (_, i) => {
  const angle = ((Math.PI * 2) / 10) * i;
  return { dx: `${Math.round(Math.cos(angle) * 62)}px`, dy: `${Math.round(Math.sin(angle) * 62)}px` };
});

export default function CheckinButtons({
  activeEvent: initialActiveEvent,
  allowRemote = false,
  streak = 0,
  todaySessions = [],
}: CheckinButtonsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [state, setState] = useState<"checked_in" | "checked_out">(
    initialActiveEvent ? "checked_in" : "checked_out",
  );
  const [activeEvent, setActiveEvent] = useState(initialActiveEvent);
  type LoadingAction = null | "gps_checkin" | "remote_checkin" | "checkout";
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const loading = loadingAction !== null;
  // Presentation only: which signal row is currently pulsing.
  const [acquiring, setAcquiring] = useState<null | "gps" | "network">(null);
  // Fires the ring/badge/dot celebration exactly once, right after a check-in
  // completes in this session — never on a plain page load of a checked-in day.
  const [celebrate, setCelebrate] = useState(false);
  const [locationAlert, setLocationAlert] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // The extension picker is opened two ways: by the control below, and by the
  // 10h presence push, which links to `/me?extend=1`.
  //
  // `null` means "nobody has decided yet, so the URL decides" - which is what
  // keeps this a derived value rather than a `useState` seeded from an effect.
  // Syncing the URL into state in a `useEffect` is the pattern the Modal
  // primitive went out of its way to avoid, and it would also reopen the dialog
  // every time this component re-rendered with the param still on the URL.
  const [extendChoice, setExtendChoice] = useState<boolean | null>(null);
  const extendOpen = extendChoice ?? searchParams.get("extend") === "1";

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
          ? me.checkin.autoCheckoutIn(formatRemaining(remainingMs))
          : null,
      );
    };

    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [activeEvent?.scheduled_checkout_at]);

  // Clear the one-shot celebration once its longest animation (1.1s) has run,
  // so the burst dots do not linger in the tree.
  useEffect(() => {
    if (!celebrate) return;
    const id = window.setTimeout(() => setCelebrate(false), 1400);
    return () => window.clearTimeout(id);
  }, [celebrate]);

  // Listen for push messages from the service worker — show in-app toast + play chime
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; title?: string; body?: string }
        | undefined;
      if (data?.type === "push-received") {
        playChime();
        showToast(data.body ?? data.title ?? me.checkin.toastNotification, "info");
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }

  function showToast(message: string, type: ToastType = "success") {
    toast.show(message, type);
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
    setAcquiring("gps");
    startProgress();
    try {
      const gps = await collectGps();
      if (!gps.ok) {
        setLocationAlert(
          gps.reason === "denied"
            ? me.checkin.locationAlert.denied
            : gps.reason === "timeout"
              ? me.checkin.locationAlert.timeout
              : me.checkin.locationAlert.unavailable,
        );
        setLoadingAction(null);
        setAcquiring(null);
        // No stopProgress() here: `return` still runs the finally block below,
        // which stops it. Calling it twice against one startProgress() steals a
        // decrement from whatever else is in flight.
        return;
      }
      setAcquiring("network");
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
        setCelebrate(true);
        await requestNotificationPermission();
        showToast(me.checkin.toastCheckedIn, "success");
        router.refresh();
      } else if (res.status === 409) {
        setState("checked_in");
        showToast(data.error || me.checkin.toastAlreadyCheckedIn, "info");
        router.refresh();
      } else {
        showToast(data.error || me.checkin.toastCheckinFailed, "error");
      }
    } catch {
      showToast(me.checkin.toastConnectionError, "error");
    } finally {
      stopProgress();
      setLoadingAction(null);
      setAcquiring(null);
    }
  }

  async function handleRemoteCheckin() {
    if (state !== "checked_out" || loading) return;
    setLoadingAction("remote_checkin");
    setAcquiring("network");
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
        setCelebrate(true);
        await requestNotificationPermission();
        showToast(me.checkin.toastCheckedInRemotely, "success");
        router.refresh();
      } else if (res.status === 409) {
        setState("checked_in");
        showToast(data.error || me.checkin.toastAlreadyCheckedIn, "info");
        router.refresh();
      } else {
        showToast(data.error || me.checkin.toastCheckinFailed, "error");
      }
    } catch {
      showToast(me.checkin.toastConnectionError, "error");
    } finally {
      stopProgress();
      setLoadingAction(null);
      setAcquiring(null);
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
        setCelebrate(false);
        showToast(
          `${me.checkin.checkedOut}${hrs ? ` — ${hrs} logged` : ""}${gps.ok ? "" : isRemote ? "" : me.checkin.checkedOutLocationMissing}`,
          "success",
        );
        router.refresh();
      } else if (res.status === 409) {
        setState("checked_out");
        setActiveEvent(null);
        showToast(data.error || me.checkin.toastNotCheckedIn, "info");
        router.refresh();
      } else {
        showToast(data.error || me.checkin.toastCheckoutFailed, "error");
      }
    } catch {
      showToast(me.checkin.toastNetworkError, "error");
    } finally {
      stopProgress();
      setLoadingAction(null);
    }
  }

  const isCheckedIn = state === "checked_in";
  const isRemoteSession =
    (activeEvent?.event_type ?? "") === "remote_checkin";
  const sessionCount = todaySessions.length;

  /* ── card bodies ──────────────────────────────────────────────────────── */

  function renderAcquiring() {
    const gpsDone = acquiring === "network" && loadingAction === "gps_checkin";
    const showGpsRow = loadingAction === "gps_checkin";
    return (
      <div
        style={{
          maxWidth: "280px",
          margin: "10px auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {showGpsRow && (
          <div className={`signal-row ${gpsDone ? "ok" : "pulse"}`}>
            <span className="dot" />
            <span style={{ flex: 1, textAlign: "left", fontSize: "13px" }}>
              {gpsDone ? me.checkin.gpsMatched : me.checkin.locatingYou}
            </span>
            {gpsDone && <span aria-hidden="true">✓</span>}
          </div>
        )}
        <div
          className={`signal-row ${acquiring === "network" ? "pulse" : ""}`}
          style={acquiring === "gps" ? { opacity: 0.4 } : undefined}
        >
          <span className="dot" />
          <span style={{ flex: 1, textAlign: "left", fontSize: "13px" }}>
            {me.checkin.verifyingNetwork}
          </span>
        </div>
      </div>
    );
  }

  function renderCheckedIn() {
    return (
      <>
        <div className="ci-stage" id="ci-stage">
          <div className={`ci-ring${celebrate ? " play" : ""}`} />
          <div className={`ci-ring r2${celebrate ? " play" : ""}`} />
          <div className={`ci-badge${celebrate ? " play" : ""}`} aria-hidden="true">
            ✓
          </div>
          {celebrate &&
            BURST_DOTS.map((d, i) => (
              <span
                key={i}
                className="ci-dot play"
                style={
                  {
                    left: "calc(50% - 3px)",
                    top: "calc(50% - 3px)",
                    "--dx": d.dx,
                    "--dy": d.dy,
                  } as React.CSSProperties
                }
              />
            ))}
        </div>

        <h2 className="t-h1" style={{ marginTop: "6px" }}>
          {activeEvent
            ? me.checkin.checkedInAt(fmtTime(activeEvent.checkin_at))
            : me.checkin.checkedIn}
        </h2>

        {sessionCount > 1 && (
          <p className="t-muted" style={{ marginTop: "4px" }}>
            {me.checkin.sessionCount(sessionCount)}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "center",
            marginTop: "10px",
            flexWrap: "wrap",
          }}
        >
          {isRemoteSession ? (
            <Chip tone="partial">{me.checkin.remoteSession}</Chip>
          ) : (
            <Chip tone="verified">{me.checkin.officeSession}</Chip>
          )}
        </div>

        {autoCheckoutLabel && (
          <p className="t-muted" style={{ marginTop: "10px" }}>
            {autoCheckoutLabel}
          </p>
        )}

        {/* The in-app half of the 10h push's offer. Present whenever a session is
            open, not only near the deadline: somebody who knows at 9am that
            today runs long should not have to wait to be nagged. */}
        <div className="mt-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExtendChoice(true)}
            disabled={loading}
          >
            {extendSession.trigger}
          </Button>
        </div>

        <Divider />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <p className="t-muted">{me.checkin.currentStreak}</p>
            <p className="t-h1" style={{ fontFamily: "var(--font-mono)" }}>
              {me.checkin.streakDays(streak)}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={handleCheckout}
            loading={loadingAction === "checkout"}
          >
            {loadingAction === "checkout"
              ? me.checkin.checkingOut
              : me.checkin.checkOut}
          </Button>
        </div>
      </>
    );
  }

  function renderSessionsToday() {
    return (
      <div style={{ textAlign: "left" }}>
        <p className="t-eyebrow" style={{ textAlign: "center" }}>
          {me.checkin.sessionsToday(sessionCount)}
        </p>

        <div style={{ marginTop: "12px" }}>
          {todaySessions.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
                padding: "10px 0",
                borderTop: i > 0 ? "1px solid var(--border)" : undefined,
              }}
            >
              <div>
                <p style={{ fontWeight: 600, fontSize: "13px" }}>
                  {me.checkin.sessionLabel(i + 1)}
                  {s.event_type === "remote_checkin"
                    ? ` · ${me.checkin.remoteSession}`
                    : ""}
                </p>
                <p className="t-muted mono" style={{ marginTop: "2px" }}>
                  {fmtTime(s.checkin_at)} –{" "}
                  {s.checkout_at ? fmtTime(s.checkout_at) : me.checkin.inProgress}
                  {durationLabel(s.checkin_at, s.checkout_at)
                    ? ` · ${durationLabel(s.checkin_at, s.checkout_at)}`
                    : ""}
                </p>
              </div>
              {s.matched_by && (
                <Chip tone={s.matched_by}>
                  {me.checkin.matchedBy[s.matched_by]}
                </Chip>
              )}
            </div>
          ))}
        </div>

        <Divider />

        <Button block onClick={handleCheckin} disabled={loading}>
          {me.checkin.checkInAgain}
        </Button>
        <p className="t-muted" style={{ marginTop: "10px", textAlign: "center" }}>
          {me.checkin.verifyHint}
        </p>
        {allowRemote && (
          <div style={{ textAlign: "center" }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoteCheckin}
              disabled={loading}
              style={{ marginTop: "6px" }}
            >
              {me.checkin.checkInRemotely}
            </Button>
          </div>
        )}
      </div>
    );
  }

  function renderIdle() {
    return (
      <>
        <p className="t-muted" style={{ marginBottom: "6px" }}>
          {me.checkin.tapToCheckIn}
        </p>
        <button
          type="button"
          className="checkin-btn pressable"
          onClick={handleCheckin}
          disabled={loading}
        >
          <span className="ic-big" aria-hidden="true">
            ◎
          </span>
          <span style={{ fontSize: "12px", fontWeight: 700 }}>
            {me.checkin.checkInLabel}
          </span>
        </button>
        <p className="t-muted" style={{ marginTop: "10px" }}>
          {me.checkin.verifyHint}
        </p>
        {allowRemote && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoteCheckin}
            disabled={loading}
            style={{ marginTop: "10px" }}
          >
            {me.checkin.checkInRemotely}
          </Button>
        )}
      </>
    );
  }

  const body = acquiring
    ? renderAcquiring()
    : isCheckedIn
      ? renderCheckedIn()
      : sessionCount > 0
        ? renderSessionsToday()
        : renderIdle();

  return (
    <>
      <div className="card" style={{ marginTop: "18px", textAlign: "center" }}>
        <div className="ci-fade-target ci-fade-in">{body}</div>
      </div>

      <Modal
        open={!!locationAlert}
        onClose={() => setLocationAlert(null)}
        title={locationAlert?.title}
        footer={
          <Button block onClick={() => setLocationAlert(null)}>
            {me.checkin.locationAlert.dismiss}
          </Button>
        }
      >
        <p className="t-secondary" style={{ lineHeight: 1.6 }}>
          {locationAlert?.message}
        </p>
      </Modal>

      {/* Gated on there being an open session as well as on the URL: a `?extend=1`
          link opened after checking out would otherwise present a picker whose
          only possible answer is `409 NOT_CHECKED_IN`. */}
      <ExtendSessionModal
        open={extendOpen && isCheckedIn}
        onClose={() => setExtendChoice(false)}
        onExtended={(scheduledCheckoutAt) => {
          setActiveEvent((prev) =>
            prev ? { ...prev, scheduled_checkout_at: scheduledCheckoutAt } : prev,
          );
          router.refresh();
        }}
      />
    </>
  );
}
