"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { en } from "@/locales/en";
import { useParams } from "next/navigation";
import { fmtTime, durationLabel } from "@/lib/client/format-time";
import type { MatchedBy } from "@/lib/signals";

const SIGNAL_BADGE: Record<MatchedBy, { label: string; color: string }> = {
  verified: { label: "Verified", color: "var(--teal)" },
  partial:  { label: "Partial",  color: "var(--amber)" },
  override: { label: "Override", color: "#8B5CF6" },
  none:     { label: "—",        color: "var(--text-muted)" },
};

const TRUST_LABELS: Record<string, string> = {
  mock_gps_suspected: "Mock GPS - accuracy ≤1m (likely fake GPS app)",
  timezone_mismatch:
    "Timezone mismatch - browser timezone differs from IP location",
  vpn_suspected: "VPN/proxy - IP flagged as hosting or proxy provider",
  impossible_travel:
    "Impossible travel - >500km from previous check-in in <2 hours",
  checkout_outside_radius:
    "Checkout outside office - location was beyond the configured office radius",
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  intern: "Intern",
  consultant: "Consultant",
};

const WORK_MODE_LABELS: Record<string, string> = {
  office: "Office",
  remote: "Remote",
  hybrid: "Hybrid",
};

interface MemberInfo {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  added_at: string;
  current_streak: number;
  total_checkins: number;
  employee_record_id: string | null;
  designation: string | null;
  department: string | null;
}

interface EmployeeProfile {
  id: string;
  first_name: string;
  last_name: string;
  work_email: string;
  employee_id: string | null;
  phone: string | null;
  employment: {
    designation: string | null;
    department: string | null;
    employment_type: string | null;
    work_mode: string | null;
    work_location: string | null;
    date_of_joining: string | null;
    confirmation_date: string | null;
    probation_end_date: string | null;
    exit_date: string | null;
    exit_reason: string | null;
  };
}

interface EventWithMatch {
  id: string;
  checkin_at: string;
  checkout_at: string | null;
  matched_by: MatchedBy;
  matched_signals: string[];
  trust_flags: string | null;
  checkout_location_mismatch: number | null;
  wifi_ssid: string | null;
  ip_address: string;
  gps_lat: number | null;
  gps_lng: number | null;
  checkout_gps_lat: number | null;
  checkout_gps_lng: number | null;
  checkout_location_label: string | null;
  checkout_ip_address: string | null;
  location_label: string | null;
  note: string | null;
}

interface TimelineResponse {
  member: MemberInfo;
  events: EventWithMatch[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    nextOffset: number | null;
  };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "40px",
  padding: "0 12px",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  fontSize: "14px",
  fontFamily: "DM Sans, sans-serif",
  background: "var(--surface-2)",
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "DM Sans, sans-serif",
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "4px",
};

// ─── Employee profile components ──────────────────────────────────────────────

interface CreateEmployeeFormProps {
  slug: string;
  userId: string;
  memberEmail: string;
  memberName: string | null;
  onCreated: (emp: EmployeeProfile) => void;
}

function CreateEmployeeForm({ slug, userId, memberEmail, memberName, onCreated }: CreateEmployeeFormProps) {
  const parts = (memberName ?? "").trim().split(/\s+/);
  const [form, setForm] = useState({
    first_name: parts[0] ?? "",
    last_name: parts.slice(1).join(" "),
    work_email: memberEmail,
    designation: "",
    department: "",
    employment_type: "",
    date_of_joining: "",
    employee_id: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        work_email: form.work_email.trim(),
      };
      if (form.designation.trim()) body.designation = form.designation.trim();
      if (form.department.trim()) body.department = form.department.trim();
      if (form.employment_type) body.employment_type = form.employment_type;
      if (form.date_of_joining) body.date_of_joining = form.date_of_joining;
      if (form.employee_id.trim()) body.employee_id = form.employee_id.trim();
      if (form.phone.trim()) body.phone = form.phone.trim();

      const res = await fetch(`/api/ws/${slug}/members/${userId}/employee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        onCreated(data.employee);
      } else {
        setError(data.error ?? "Failed to create profile");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <p style={labelStyle}>First name *</p>
          <input style={inputStyle} value={form.first_name} onChange={set("first_name")} required />
        </div>
        <div>
          <p style={labelStyle}>Last name *</p>
          <input style={inputStyle} value={form.last_name} onChange={set("last_name")} required />
        </div>
      </div>
      <div>
        <p style={labelStyle}>Work email *</p>
        <input style={inputStyle} type="email" value={form.work_email} onChange={set("work_email")} required />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <p style={labelStyle}>Designation</p>
          <input style={inputStyle} value={form.designation} onChange={set("designation")} placeholder="e.g. Software Engineer" />
        </div>
        <div>
          <p style={labelStyle}>Department</p>
          <input style={inputStyle} value={form.department} onChange={set("department")} placeholder="e.g. Engineering" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <p style={labelStyle}>Employment type</p>
          <select style={{ ...inputStyle }} value={form.employment_type} onChange={set("employment_type")}>
            <option value="">Select</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
            <option value="consultant">Consultant</option>
          </select>
        </div>
        <div>
          <p style={labelStyle}>Date of joining</p>
          <input style={inputStyle} type="date" value={form.date_of_joining} onChange={set("date_of_joining")} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <p style={labelStyle}>Employee ID</p>
          <input style={inputStyle} value={form.employee_id} onChange={set("employee_id")} placeholder="e.g. EMP-001" />
        </div>
        <div>
          <p style={labelStyle}>Phone</p>
          <input style={inputStyle} type="tel" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
        </div>
      </div>
      {error && (
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "13px", color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        style={{
          height: "40px",
          background: "var(--brand)",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontFamily: "DM Sans, sans-serif",
          fontSize: "14px",
          fontWeight: 500,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Creating…" : "Create employee profile"}
      </button>
    </form>
  );
}

interface EmployeeProfileViewProps {
  slug: string;
  userId: string;
  employee: EmployeeProfile;
  onUpdated: (emp: EmployeeProfile) => void;
}

function EmployeeProfileView({ slug, userId, employee, onUpdated }: EmployeeProfileViewProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    designation: employee.employment.designation ?? "",
    department: employee.employment.department ?? "",
    employment_type: employee.employment.employment_type ?? "",
    work_mode: employee.employment.work_mode ?? "",
    work_location: employee.employment.work_location ?? "",
    date_of_joining: employee.employment.date_of_joining ?? "",
    phone: employee.phone ?? "",
    employee_id: employee.employee_id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string | null> = {
        designation: form.designation.trim() || null,
        department: form.department.trim() || null,
        employment_type: form.employment_type || null,
        work_mode: form.work_mode || null,
        work_location: form.work_location.trim() || null,
        date_of_joining: form.date_of_joining || null,
        phone: form.phone.trim() || null,
        employee_id: form.employee_id.trim() || null,
      };
      const res = await fetch(`/api/ws/${slug}/members/${userId}/employee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdated(data.employee);
        setEditing(false);
      } else {
        setError(data.error ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, value: string | null) => (
    <div>
      <p style={labelStyle}>{label}</p>
      <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "14px", color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
        {value ?? "—"}
      </p>
    </div>
  );

  if (!editing) {
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          {field("Employee ID", employee.employee_id)}
          {field("Designation", employee.employment.designation)}
          {field("Department", employee.employment.department)}
          {field("Employment type", employee.employment.employment_type ? EMPLOYMENT_TYPE_LABELS[employee.employment.employment_type] ?? employee.employment.employment_type : null)}
          {field("Work mode", employee.employment.work_mode ? WORK_MODE_LABELS[employee.employment.work_mode] ?? employee.employment.work_mode : null)}
          {field("Work location", employee.employment.work_location)}
          {field("Date of joining", employee.employment.date_of_joining)}
          {field("Phone", employee.phone)}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{
            height: "36px",
            padding: "0 14px",
            background: "transparent",
            color: "var(--brand)",
            border: "1px solid var(--brand)",
            borderRadius: "6px",
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Edit profile
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <p style={labelStyle}>Designation</p>
          <input style={inputStyle} value={form.designation} onChange={set("designation")} />
        </div>
        <div>
          <p style={labelStyle}>Department</p>
          <input style={inputStyle} value={form.department} onChange={set("department")} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <p style={labelStyle}>Employment type</p>
          <select style={{ ...inputStyle }} value={form.employment_type} onChange={set("employment_type")}>
            <option value="">Select</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
            <option value="consultant">Consultant</option>
          </select>
        </div>
        <div>
          <p style={labelStyle}>Work mode</p>
          <select style={{ ...inputStyle }} value={form.work_mode} onChange={set("work_mode")}>
            <option value="">Select</option>
            <option value="office">Office</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <p style={labelStyle}>Date of joining</p>
          <input style={inputStyle} type="date" value={form.date_of_joining} onChange={set("date_of_joining")} />
        </div>
        <div>
          <p style={labelStyle}>Work location</p>
          <input style={inputStyle} value={form.work_location} onChange={set("work_location")} placeholder="e.g. Mumbai HQ" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <p style={labelStyle}>Employee ID</p>
          <input style={inputStyle} value={form.employee_id} onChange={set("employee_id")} />
        </div>
        <div>
          <p style={labelStyle}>Phone</p>
          <input style={inputStyle} type="tel" value={form.phone} onChange={set("phone")} />
        </div>
      </div>
      {error && (
        <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "13px", color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            height: "36px",
            padding: "0 14px",
            background: "var(--brand)",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setError(null); }}
          style={{
            height: "36px",
            padding: "0 14px",
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Timeline components ──────────────────────────────────────────────────────

function TrustPopover({ flags }: { flags: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "color-mix(in srgb,var(--amber) 15%,transparent)",
          border: "1px solid var(--amber)",
          borderRadius: "4px",
          padding: "2px 6px",
          fontSize: "11px",
          color: "var(--amber)",
          cursor: "pointer",
          fontFamily: "DM Sans, sans-serif",
          fontWeight: 600,
        }}
      >
        ⚠ Suspicious
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 100,
            marginTop: "4px",
            background: "var(--surface-0)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            minWidth: "260px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          }}
        >
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--amber)",
              marginBottom: "6px",
            }}
          >
            ⚠ Suspicious signals
          </p>
          {flags.map((f) => (
            <p
              key={f}
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "11px",
                color: "var(--text-secondary)",
                marginBottom: "4px",
                lineHeight: 1.4,
              }}
            >
              • {TRUST_LABELS[f] ?? f}
            </p>
          ))}
        </div>
      )}
    </span>
  );
}

function SignalBadge({ matchedBy, matchedSignals }: { matchedBy: MatchedBy; matchedSignals: string[] }) {
  const badge = SIGNAL_BADGE[matchedBy]
  const signalLabels: Record<string, string> = { gps: 'GPS', ip: 'IP' }
  const signals = matchedSignals.map((s) => signalLabels[s] ?? s).join(' + ')
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span style={{
        fontSize: '11px',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 600,
        color: badge.color,
        background: `color-mix(in srgb,${badge.color} 12%,transparent)`,
        border: `1px solid color-mix(in srgb,${badge.color} 40%,transparent)`,
        borderRadius: '4px',
        padding: '2px 6px',
      }}>
        {badge.label}{signals ? ` (${signals})` : ''}
      </span>
    </span>
  )
}

function EventRow({ ev }: { ev: EventWithMatch }) {
  const flags = (() => {
    try {
      return ev.trust_flags ? (JSON.parse(ev.trust_flags) as string[]) : null;
    } catch {
      return null;
    }
  })();
  const dur = durationLabel(ev.checkin_at, ev.checkout_at);
  return (
    <div
      style={{
        background: "var(--surface-0)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
        marginBottom: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "13px",
            color: "var(--text-primary)",
          }}
        >
          {fmtTime(ev.checkin_at)}
          {ev.checkout_at ? ` - ${fmtTime(ev.checkout_at)}` : ""}
        </span>
        {dur && (
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            {dur}
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>
          <SignalBadge
            matchedBy={ev.matched_by}
            matchedSignals={ev.matched_signals}
          />
        </span>
        {flags && flags.length > 0 && <TrustPopover flags={flags} />}
        {(ev.matched_by === "verified" || ev.matched_by === "override") &&
          ev.checkout_location_mismatch != null && (
            <span
              style={{
                fontSize: "11px",
                fontFamily: "DM Sans, sans-serif",
                color: flags?.includes("checkout_outside_radius")
                  ? "var(--danger)"
                  : "var(--text-muted)",
                background: flags?.includes("checkout_outside_radius")
                  ? "color-mix(in srgb,var(--danger) 10%,transparent)"
                  : "var(--surface-1)",
                padding: "2px 7px",
                borderRadius: "4px",
                border: flags?.includes("checkout_outside_radius")
                  ? "1px solid var(--danger)"
                  : "1px solid var(--border)",
                fontWeight: flags?.includes("checkout_outside_radius")
                  ? 600
                  : 400,
              }}
            >
              {flags?.includes("checkout_outside_radius")
                ? "⚠ Outside office"
                : "✓ Near office"}{" "}
              ({ev.checkout_location_mismatch}m away)
            </span>
          )}
        {(ev.matched_by === "partial" || ev.matched_by === "none") && (
          <span
            style={{
              fontSize: "11px",
              fontFamily: "DM Sans, sans-serif",
              color: "var(--text-muted)",
              background: "var(--surface-1)",
              padding: "2px 7px",
              borderRadius: "4px",
              border: "1px solid var(--border)",
            }}
          >
            🌐 Remote
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Check-in
          </span>
          {ev.gps_lat != null && ev.gps_lng != null && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${ev.gps_lat}&mlon=${ev.gps_lng}&zoom=16`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "11px",
                color: "var(--brand)",
                textDecoration: "none",
                fontFamily: "DM Sans, sans-serif",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span style={{ color: "var(--teal)" }}>◉</span>{" "}
              {ev.location_label ??
                `${ev.gps_lat.toFixed(4)}, ${ev.gps_lng.toFixed(4)}`}
            </a>
          )}
          {ev.ip_address && (
            <span
              style={{
                fontSize: "11px",
                fontFamily: "JetBrains Mono, monospace",
                color: "var(--text-muted)",
              }}
            >
              {ev.ip_address}
            </span>
          )}
        </div>

        {ev.checkout_at && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Checkout
            </span>
            {ev.checkout_gps_lat != null && ev.checkout_gps_lng != null ? (
              <a
                href={`https://www.openstreetmap.org/?mlat=${ev.checkout_gps_lat}&mlon=${ev.checkout_gps_lng}&zoom=16`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "11px",
                  color: "var(--brand)",
                  textDecoration: "none",
                  fontFamily: "DM Sans, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    color: flags?.includes("checkout_outside_radius")
                      ? "var(--danger)"
                      : "var(--teal)",
                  }}
                >
                  ◉
                </span>{" "}
                {ev.checkout_location_label ??
                  ev.location_label ??
                  `${ev.checkout_gps_lat.toFixed(4)}, ${ev.checkout_gps_lng.toFixed(4)}`}
              </a>
            ) : (
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                Location not captured
              </span>
            )}
            {ev.checkout_ip_address && (
              <span
                style={{
                  fontSize: "11px",
                  fontFamily: "JetBrains Mono, monospace",
                  color: "var(--text-muted)",
                }}
              >
                {ev.checkout_ip_address}
              </span>
            )}
          </div>
        )}
      </div>
      {ev.note && (
        <p
          style={{
            marginTop: "6px",
            fontSize: "12px",
            fontFamily: "DM Sans, sans-serif",
            color: "var(--text-secondary)",
            fontStyle: "italic",
          }}
        >
          {ev.note}
        </p>
      )}
    </div>
  );
}

function formatDayHeading(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByDay(events: EventWithMatch[]): { date: string; label: string; items: EventWithMatch[] }[] {
  const map = new Map<string, EventWithMatch[]>();
  for (const ev of events) {
    const day = ev.checkin_at.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(ev);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, label: formatDayHeading(date + 'T00:00:00'), items }));
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "timeline" | "profile";

export default function MemberDetailPage() {
  const { slug, memberId } = useParams<{ slug: string; memberId: string }>();
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [events, setEvents] = useState<EventWithMatch[]>([]);
  const [pagination, setPagination] = useState<{
    total: number;
    nextOffset: number | null;
  } | null>(null);
  const nextOffsetRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("timeline");
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [employeeFetched, setEmployeeFetched] = useState(false);
  const [loadingEmployee, setLoadingEmployee] = useState(false);

  const load = useCallback(
    async (opts?: { append?: boolean }) => {
      const append = !!opts?.append;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        if (!append) nextOffsetRef.current = null;
        const offset = append ? (nextOffsetRef.current ?? 0) : 0;
        const res = await fetch(
          `/api/ws/${slug}/members/${memberId}/timeline?offset=${offset}`,
        );
        if (!res.ok) {
          setMember(null);
          setEvents([]);
          setPagination(null);
          return;
        }
        const d = (await res.json()) as TimelineResponse;
        const next = d.pagination?.nextOffset ?? null;
        nextOffsetRef.current = next;
        if (!append) setMember(d.member);
        setEvents((prev) => (append ? [...prev, ...d.events] : d.events));
        setPagination({
          total: d.pagination.total,
          nextOffset: next,
        });
      } catch {
        if (!append) {
          setMember(null);
          setEvents([]);
          setPagination(null);
        }
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [slug, memberId],
  );

  const loadEmployee = useCallback(async () => {
    setLoadingEmployee(true);
    try {
      const res = await fetch(`/api/ws/${slug}/members/${memberId}/employee`);
      if (res.ok) {
        const data = await res.json();
        setEmployee(data.employee ?? null);
      }
    } finally {
      setLoadingEmployee(false);
      setEmployeeFetched(true);
    }
  }, [slug, memberId]);

  useEffect(() => {
    nextOffsetRef.current = null;
    setMember(null);
    setEvents([]);
    setPagination(null);
    load();
  }, [load]);

  useEffect(() => {
    if (activeTab === "profile" && !employeeFetched) {
      loadEmployee();
    }
  }, [activeTab, employeeFetched, loadEmployee]);

  if (!member && loading)
    return (
      <div
        style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 16px" }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: "72px",
              background: "var(--surface-2)",
              borderRadius: "var(--radius-md)",
              marginBottom: "8px",
              animation: "cm-pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
        <style>{`@keyframes cm-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      </div>
    );

  if (!member) return null;

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 16px" }}>
      {/* Header card */}
      <div
        style={{
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "20px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "var(--brand)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {(member.full_name ?? member.email)[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--navy)",
                marginBottom: "2px",
              }}
            >
              {member.full_name ?? "—"}
            </p>
            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "13px",
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {member.email}
            </p>
            {(member.designation || member.department) && (
              <p
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginTop: "2px",
                }}
              >
                {[member.designation, member.department].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <span
            style={{
              fontSize: "11px",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              color: "var(--brand)",
              background: "color-mix(in srgb,var(--brand) 10%,transparent)",
              padding: "3px 8px",
              borderRadius: "20px",
              border: "1px solid var(--brand)",
              textTransform: "capitalize",
              flexShrink: 0,
            }}
          >
            {member.role}
          </span>
        </div>
        <div style={{ display: "flex", gap: "24px" }}>
          <div>
            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "2px",
              }}
            >
              Streak
            </p>
            <p
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--navy)",
              }}
            >
              {member.current_streak}d
            </p>
          </div>
          <div>
            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "2px",
              }}
            >
              Total check-ins
            </p>
            <p
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--navy)",
              }}
            >
              {member.total_checkins}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          marginBottom: "20px",
          gap: "4px",
        }}
      >
        {(["timeline", "profile"] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--brand)" : "2px solid transparent",
              padding: "10px 14px",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "13px",
              fontWeight: activeTab === tab ? 600 : 500,
              color: activeTab === tab ? "var(--brand)" : "var(--text-secondary)",
              cursor: "pointer",
              textTransform: "capitalize",
              marginBottom: "-1px",
            }}
          >
            {tab === "timeline" ? "Timeline" : "Employee Profile"}
          </button>
        ))}
      </div>

      {/* Timeline tab */}
      {activeTab === "timeline" && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h2
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--navy)",
              }}
            >
              Timeline
            </h2>
            <span
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              {pagination?.total ?? 0} events
            </span>
          </div>

          {events.length === 0 && !loading && (
            <p
              style={{
                textAlign: "center",
                color: "var(--text-muted)",
                fontFamily: "DM Sans, sans-serif",
                padding: "40px 0",
              }}
            >
              No events found.
            </p>
          )}

          {groupByDay(events).map(({ date, label, items }) => (
            <div key={date} style={{ marginBottom: "8px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "10px",
                  marginTop: "20px",
                }}
              >
                <div
                  style={{
                    width: "3px",
                    height: "16px",
                    borderRadius: "2px",
                    background: "var(--brand)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    background: "rgba(27,77,255,0.3)",
                  }}
                />
                <span
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {items.length} {items.length === 1 ? "event" : "events"}
                </span>
              </div>
              {items.map((ev) => (
                <EventRow key={ev.id} ev={ev} />
              ))}
            </div>
          ))}

          {loadingMore && (
            <div style={{ marginTop: "8px" }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={`tl-sk-${i}`}
                  style={{
                    height: "72px",
                    background: "var(--surface-2)",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "8px",
                    animation: "cm-pulse 1.5s ease-in-out infinite",
                  }}
                />
              ))}
            </div>
          )}

          {(pagination?.nextOffset ?? null) !== null && (
            <div style={{ marginTop: "16px" }}>
              <button
                type="button"
                onClick={() => load({ append: true })}
                disabled={loadingMore}
                style={{
                  width: "100%",
                  height: "44px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "var(--surface-0)",
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  cursor: loadingMore ? "default" : "pointer",
                }}
              >
                {loadingMore
                  ? en.wsMemberTimeline.loadingMore
                  : en.wsMemberTimeline.viewMore}
              </button>
            </div>
          )}
        </>
      )}

      {/* Employee Profile tab */}
      {activeTab === "profile" && (
        <div
          style={{
            background: "var(--surface-0)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "20px",
          }}
        >
          <h2
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--navy)",
              marginBottom: "16px",
            }}
          >
            Employee Profile
          </h2>

          {loadingEmployee ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: "40px", background: "var(--surface-2)", borderRadius: "6px", animation: "cm-pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : employee ? (
            <EmployeeProfileView
              slug={slug}
              userId={memberId}
              employee={employee}
              onUpdated={setEmployee}
            />
          ) : (
            <div>
              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                No employee profile yet. Create one to store HR details like designation, department, and employment info.
              </p>
              <CreateEmployeeForm
                slug={slug}
                userId={memberId}
                memberEmail={member.email}
                memberName={member.full_name}
                onCreated={setEmployee}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
