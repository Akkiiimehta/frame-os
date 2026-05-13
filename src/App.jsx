import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');`;

const SUPABASE_URL = "https://dnsybobzvuczmlgvcesx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuc3lib2J6dnVjem1sZ3ZjZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODcxNDcsImV4cCI6MjA4OTY2MzE0N30.l1BKnrohJ-EFiEs9nhOmEdfzl_SD8XX7j-WaP4sxqag";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Status colors and styling
const STATUS_COLORS = {
  "Pre-Production": { dot: "var(--teal)", bg: "var(--teal-bg)", bd: "rgba(90,200,250,.2)" },
  "In Production": { dot: "var(--accent)", bg: "var(--accent-bg)", bd: "var(--accent-bd)" },
  "Post": { dot: "var(--purple)", bg: "var(--purple-bg)", bd: "rgba(191,90,242,.2)" },
  "Delivered": { dot: "var(--green)", bg: "var(--green-bg)", bd: "rgba(48,209,88,.2)" },
  "On Hold": { dot: "var(--red)", bg: "var(--red-bg)", bd: "rgba(255,69,58,.2)" },
  "Pending": { dot: "var(--amber)", bg: "var(--amber-bg)", bd: "rgba(255,214,10,.2)" },
  "Partial": { dot: "var(--orange)", bg: "var(--orange-bg)", bd: "rgba(255,159,10,.2)" },
  "Paid": { dot: "var(--green)", bg: "var(--green-bg)", bd: "rgba(48,209,88,.2)" },
  "Overdue": { dot: "var(--red)", bg: "var(--red-bg)", bd: "rgba(255,69,58,.2)" },
  "Draft": { dot: "var(--text3)", bg: "rgba(72,72,74,.2)", bd: "rgba(72,72,74,.3)" },
  "Sent": { dot: "var(--accent)", bg: "var(--accent-bg)", bd: "var(--accent-bd)" },
  "Approved": { dot: "var(--green)", bg: "var(--green-bg)", bd: "rgba(48,209,88,.2)" },
};

const INVOICE_STATUSES = ["Pending", "Partial", "Paid", "Overdue"];
const PROJECT_STATUSES = ["Pre-Production", "In Production", "Post", "Delivered", "On Hold"];
const CREW_ROLES = [
  "Director", "DOP", "Producer", "Line Producer", "AD", "AC", 
  "Gaffer", "Grip", "Camera Op", "Sound", "Editor", "Colorist", 
  "VFX", "Makeup", "Stylist", "Food Stylist", "Art Director", 
  "Focus Puller", "DIT", "Other"
];
const ARTIST_ROLES = ["Lead", "Supporting", "Cameo", "Background", "Voice", "Stunt"];
const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#065f46", "#92400e", "#881337", "#1e40af", "#6d28d9"];

// ============================================================================
// UTILITIES
// ============================================================================

// LocalStorage wrapper
const LS = {
  get: (k, d) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

// Data mappers - normalize API responses
const mapProject = (r) => ({
  id: r.id,
  title: r.title || "",
  client: r.client || "",
  type: r.type || "TVC",
  status: r.status || "Pre-Production",
  shoot: r.shoot_date || "",
  budget: Number(r.budget) || 0,
  location: r.location || "",
  driveLink: r.drive_link || "",
  tags: r.tags || [],
  notes: r.notes || "",
  crewIds: (r.crew_ids || []).map(Number),
});

const mapCrew = (r) => ({
  id: r.id,
  name: r.name || "",
  role: r.role || "Other",
  phone: r.phone || "",
  email: r.email || "",
  location: r.location || "",
  tags: r.tags || [],
  notes: r.notes || "",
  projects: (r.project_ids || []).map(Number),
});

const mapInvoice = (r, pays) => ({
  id: r.id,
  invoiceNo: r.invoice_no || "",
  project: r.project || "",
  client: r.client || "",
  amount: Number(r.amount) || 0,
  status: r.status || "Pending",
  due: r.due_date || "",
  payments: (pays || [])
    .filter((p) => Number(p.invoice_id) === Number(r.id))
    .map((p) => ({
      id: p.id,
      amount: Number(p.amount) || 0,
      date: p.date || "",
      note: p.note || "",
    })),
});

const mapQuote = (r) => ({
  id: r.id,
  title: r.title || "",
  client: r.client || "",
  project: r.project || "",
  status: r.status || "Draft",
  taxPct: Number(r.tax_pct) || 18,
  validUntil: r.valid_until || "",
  notes: r.notes || "",
  lines: r.lines || [],
  createdAt: r.created_at || "",
});

const mapAbout = (r) => ({
  name: r.name || "Aki Mehta",
  title: r.title || "Project Manager & Content Strategist",
  studio: r.studio || "Frame OS",
  tagline: r.tagline || "Journey Curators",
  phone: r.phone || "+91 70212 91405",
  email: r.email || "yashmehtaoffice@gmail.com",
  website: r.website || "yashmehtawork.netlify.app",
  services: r.services || "TVC Production · Brand Films · Product Shoots · Digital Content",
  bio: r.bio || "",
  instagram: r.instagram || "linktr.ee/MehtaYash",
  linkedin: r.linkedin || "",
  logoColor: r.logo_color || "#1a2f6e",
});

const mapVendor = (r) => ({
  id: r.id,
  name: r.name || "",
  category: r.category || "Camera",
  contact: r.contact || "",
  phone: r.phone || "",
  email: r.email || "",
  location: r.location || "",
  rate: r.rate || "",
  notes: r.notes || "",
});

const mapArtist = (r) => ({
  id: r.id,
  name: r.name || "",
  role: r.role || "Actor",
  credits: r.credits || "",
  phone: r.phone || "",
  email: r.email || "",
  agency: r.agency || "",
  portfolioUrl: r.portfolio_url || "",
  notes: r.notes || "",
  projectIds: (r.project_ids || []).map(Number),
});

// Formatting utilities
const formatCurrency = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const formatCurrencyK = (n) => `₹${(n / 1000).toFixed(0)}K`;

const getRoleColor = (role) => {
  const colorMap = {
    Director: "var(--purple)",
    DOP: "var(--teal)",
    Producer: "var(--accent)",
    AD: "var(--amber)",
    "Line Producer": "var(--orange)",
    AC: "var(--green)",
    Gaffer: "var(--amber)",
    Editor: "var(--red)",
    Sound: "var(--green)",
  };
  return colorMap[role] || "var(--text2)";
};

// Invoice helpers
const getTotalReceived = (inv) => (inv.payments || []).reduce((s, p) => s + p.amount, 0);

const autoUpdateStatus = (inv) => {
  const received = getTotalReceived(inv);
  if (received === 0) return inv.status === "Overdue" ? "Overdue" : "Pending";
  if (received >= inv.amount) return "Paid";
  return "Partial";
};

// ============================================================================
// HOOKS
// ============================================================================

function usePersist(key, init) {
  const [val, setVal] = useState(() =>
    LS.get(key, typeof init === "function" ? init() : init)
  );

  const set = useCallback(
    (v) => {
      setVal((prev) => {
        const next = typeof v === "function" ? v(prev) : v;
        LS.set(key, next);
        return next;
      });
    },
    [key]
  );

  return [val, set];
}

function useDB(table, mapper) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lsKey = `frameOS_db_${table}`;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await sb.from(table).select("*").order("id");

    if (e) {
      setError(e.message);
      const cached = LS.get(lsKey, []);
      setRows(mapper ? cached.map(mapper) : cached);
      setLoading(false);
      return;
    }

    const mapped = mapper ? data.map(mapper) : data;
    
    if (mapped.length > 0) {
      LS.set(lsKey, data);
    } else {
      const cached = LS.get(lsKey, []);
      if (cached.length > 0) {
        setRows(mapper ? cached.map(mapper) : cached);
        setLoading(false);
        return;
      }
    }

    setRows(mapped);
    setLoading(false);
  }, [table, lsKey]);

  const setRowsAndCache = useCallback(
    (updater) => {
      setRows((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        LS.set(lsKey, next);
        return next;
      });
    },
    [lsKey]
  );

  useEffect(() => {
    load();
  }, [load]);

  return [rows, setRowsAndCache, loading, error, load];
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function dbUpsertProject(p) {
  const row = {
    title: p.title || "",
    client: p.client || "",
    type: p.type || "TVC",
    status: p.status || "Pre-Production",
    shoot_date: p.shoot || "",
    budget: p.budget || 0,
    location: p.location || "",
    drive_link: p.driveLink || "",
    tags: Array.isArray(p.tags) ? p.tags : [],
    notes: p.notes || "",
    crew_ids: Array.isArray(p.crewIds) ? p.crewIds.map(Number) : [],
  };

  if (p.id && p.id < 2e13) {
    const { error } = await sb.from("projects").update(row).eq("id", p.id);
    if (error) console.error("PROJECT UPDATE ERROR:", error);
    return p.id;
  }

  const { data, error } = await sb.from("projects").insert(row).select();
  if (error) {
    console.error("PROJECT INSERT ERROR:", error);
    return null;
  }

  return data?.[0]?.id;
}

async function dbUpsertCrew(c) {
  const row = {
    name: c.name || "",
    role: c.role || "",
    phone: c.phone || "",
    email: c.email || "",
    location: c.location || "",
    tags: Array.isArray(c.tags) ? c.tags : [],
    notes: c.notes || "",
    project_ids: Array.isArray(c.projects) ? c.projects.map(Number) : [],
  };

  if (c.id && c.id < 2e13) {
    const { error } = await sb.from("crew").update(row).eq("id", c.id);
    if (error) console.error("CREW UPDATE ERROR:", error);
    return c.id;
  }

  const { data, error } = await sb.from("crew").insert(row).select();
  if (error) {
    console.error("CREW INSERT ERROR:", error);
    return null;
  }

  return data?.[0]?.id;
}

async function dbDeleteCrew(id) {
  const { error } = await sb.from("crew").delete().eq("id", id);
  if (error) console.error("CREW DELETE ERROR:", error);
}

async function dbUpsertVendor(v) {
  const row = {
    name: v.name,
    category: v.category,
    contact: v.contact,
    phone: v.phone,
    email: v.email,
    location: v.location,
    rate: v.rate,
    notes: v.notes,
  };

  if (v.id && v.id < 2e13) {
    const { data, error } = await sb.from("vendors").update(row).eq("id", v.id).select();
    return data ? mapVendor(data[0]) : v;
  }

  const { data, error } = await sb.from("vendors").insert(row).select();
  return data ? mapVendor(data[0]) : v;
}

async function dbDeleteVendor(id) {
  const { error } = await sb.from("vendors").delete().eq("id", id);
  if (error) console.error("VENDOR DELETE ERROR:", error);
}

async function dbUpsertArtist(a) {
  const row = {
    name: a.name || "",
    role: a.role || "Actor",
    credits: a.credits || "",
    phone: a.phone || "",
    email: a.email || "",
    agency: a.agency || "",
    portfolio_url: a.portfolioUrl || "",
    notes: a.notes || "",
    project_ids: Array.isArray(a.projectIds) ? a.projectIds.map(Number) : [],
  };

  if (a.id && a.id < 2e13) {
    const { error } = await sb.from("artists").update(row).eq("id", a.id).select();
    if (error) console.error("ARTIST UPDATE ERROR:", error);
    return a.id;
  }

  const { data, error } = await sb.from("artists").insert(row).select();
  if (error) {
    console.error("ARTIST INSERT ERROR:", error);
    return null;
  }

  return data?.[0]?.id;
}

async function dbDeleteArtist(id) {
  const { error } = await sb.from("artists").delete().eq("id", id);
  if (error) console.error("ARTIST DELETE ERROR:", error);
}

async function dbUpsertInvoice(inv) {
  const row = {
    invoice_no: inv.invoiceNo,
    project: inv.project,
    client: inv.client,
    amount: inv.amount,
    status: inv.status,
    due_date: inv.due,
  };

  if (inv.id && inv.id < 2e13) {
    await sb.from("invoices").update(row).eq("id", inv.id);
    return inv.id;
  }

  const { data } = await sb.from("invoices").insert(row).select();
  return data?.id;
}

async function dbAddPayment(invId, p) {
  const { data } = await sb.from("payments").insert({
    invoice_id: invId,
    amount: p.amount,
    date: p.date,
    note: p.note,
  }).select();
  return data;
}

async function dbDelPayment(id) {
  await sb.from("payments").delete().eq("id", id);
}

async function dbUpsertQuote(q) {
  const row = {
    title: q.title,
    client: q.client,
    project: q.project,
    status: q.status,
    tax_pct: q.taxPct,
    valid_until: q.validUntil,
    notes: q.notes,
    lines: q.lines,
    created_at: q.createdAt,
  };

  if (q.id && q.id < 2e13) {
    await sb.from("quotes").update(row).eq("id", q.id);
    return q.id;
  }

  const { data } = await sb.from("quotes").insert(row).select();
  return data?.id;
}

async function dbDelQuote(id) {
  await sb.from("quotes").delete().eq("id", id);
}

async function dbSaveAbout(a) {
  await sb.from("about").upsert({
    id: 1,
    name: a.name,
    title: a.title,
    studio: a.studio,
    tagline: a.tagline,
    bio: a.bio,
    phone: a.phone,
    email: a.email,
    website: a.website,
    services: a.services,
    instagram: a.instagram,
    linkedin: a.linkedin,
    logo_color: a.logoColor,
  });
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

function exportToCSV(data, filename) {
  if (!data || !data.length) {
    alert("No data to export");
    return;
  }

  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map((r) =>
      headers.map((h) => JSON.stringify(r[h] || "")).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

function exportToPDF(title, dataArray) {
  const html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          h1 { color: #1a2f6e; border-bottom: 2px solid #1a2f6e; padding-bottom: 10px; }
          h2 { margin-top: 30px; color: #1a2f6e; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background: #1a2f6e; color: white; font-weight: bold; }
          tr:nth-child(even) { background: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
        ${dataArray
          .map(({ heading, rows }) => {
            if (!rows || !rows.length) return "";
            const headers = Object.keys(rows[0]);
            return `
              <h2>${heading}</h2>
              <table>
                <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
                ${rows
                  .map(
                    (r) =>
                      `<tr>${headers
                        .map((h) => `<td>${r[h] || ""}</td>`)
                        .join("")}</tr>`
                  )
                  .join("")}
              </table>
            `;
          })
          .join("")}
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "_")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// UI COMPONENTS - SCREENS & STATES
// ============================================================================

function LoadingScreen({ msg = "Loading…" }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "2px solid rgba(255,255,255,0.1)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin .7s linear infinite",
        }}
      />
      <div
        style={{
          fontSize: 13,
          color: "var(--text3)",
          fontFamily: "'Geist Mono',monospace",
        }}
      >
        {msg}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorScreen({ msg }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
      }}
    >
      <div style={{ fontSize: 28 }}>⚠️</div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text)",
        }}
      >
        Database connection failed
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text3)",
          textAlign: "center",
          maxWidth: 340,
        }}
      >
        {msg}
      </div>
      <button
        className="btn-p"
        onClick={() => window.location.reload()}
      >
        Retry
      </button>
    </div>
  );
}

// ============================================================================
// UI COMPONENTS - TYPOGRAPHY & BASICS
// ============================================================================

function Label({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: "var(--text2)",
        marginBottom: 6,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", style = {} }) {
  return (
    <input
      className="input"
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={style}
    />
  );
}

function TextArea({ value, onChange, placeholder }) {
  return (
    <textarea
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

// ============================================================================
// UI COMPONENTS - BADGES & STATUS
// ============================================================================

function Badge({ status }) {
  const s = STATUS_COLORS[status] || {
    dot: "var(--text3)",
    bg: "var(--bg4)",
    bd: "var(--border)",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontFamily: "'Geist Mono',monospace",
        color: s.dot,
        background: s.bg,
        border: `1px solid ${s.bd}`,
        borderRadius: 20,
        padding: "2px 9px",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: s.dot,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}

function RoleBadge({ role }) {
  const c = getRoleColor(role);
  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: "'Geist Mono',monospace",
        color: c,
        background: c + "22",
        border: `1px solid ${c}44`,
        borderRadius: 20,
        padding: "2px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {role}
    </span>
  );
}

function Avatar({ name, idx, size = 26 }) {
  return (
    <div
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: AVATAR_COLORS[idx % AVATAR_COLORS.length],
        border: "2px solid var(--bg2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size > 30 ? 13 : 10,
        fontWeight: 700,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

// ============================================================================
// UI COMPONENTS - MODALS & OVERLAYS
// ============================================================================

function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div className="ovl" onClick={onClose}>
      <div
        className="mbox"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 22,
          }}
        >
          <span
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "var(--bg4)",
              border: "1px solid var(--border)",
              color: "var(--text2)",
              width: 28,
              height: 28,
              borderRadius: 7,
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// UI COMPONENTS - STAT CARDS
// ============================================================================

function StatCard({ label, value, sub, color, icon, delay = 0 }) {
  return (
    <div
      className="card fade-up"
      style={{
        padding: "20px",
        animationDelay: `${delay}ms`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text3)",
              fontFamily: "'Geist Mono',monospace",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              color,
              lineHeight: 1,
            }}
          >
            {value}
          </div>
          {sub && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text2)",
                marginTop: 6,
              }}
            >
              {sub}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 20,
            opacity: 0.35,
            marginTop: 2,
          }}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// UI COMPONENTS - TAGS & NOTES
// ============================================================================

function EditableTags({ tags, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const ref = useRef();

  useEffect(() => {
    if (adding && ref.current) ref.current.focus();
  }, [adding]);

  const commit = () => {
    const t = val.trim();
    if (t && !tags.includes(t)) onAdd(t);
    setVal("");
    setAdding(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
      }}
    >
      {tags.map((t) => (
        <span key={t} className="tchip">
          {t}
          <span className="del" onClick={() => onDelete(t)}>
            ✕
          </span>
        </span>
      ))}
      {adding ? (
        <input
          ref={ref}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setAdding(false);
              setVal("");
            }
          }}
          placeholder="tag…"
          style={{
            background: "var(--bg3)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            color: "var(--text)",
            fontFamily: "'Geist Mono',monospace",
            fontSize: 11,
            padding: "2px 8px",
            outline: "none",
            width: 80,
          }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            fontSize: 11,
            fontFamily: "'Geist Mono',monospace",
            background: "transparent",
            border: "1px dashed var(--border2)",
            color: "var(--text3)",
            borderRadius: 6,
            padding: "2px 8px",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border2)";
            e.currentTarget.style.color = "var(--text3)";
          }}
        >
          + tag
        </button>
      )}
    </div>
  );
}

function EditableNotes({ notes, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes || "");

  if (editing) {
    return (
      <div>
        <TextArea
          value={draft}
          onChange={setDraft}
          placeholder="Add notes…"
        />
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 8,
          }}
        >
          <button
            className="btn-p"
            style={{ padding: "5px 14px", fontSize: 12 }}
            onClick={() => {
              onSave(draft);
              setEditing(false);
            }}
          >
            Save
          </button>
          <button
            className="btn-g"
            style={{ padding: "5px 12px", fontSize: 12 }}
            onClick={() => {
              setDraft(notes || "");
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        cursor: "pointer",
      }}
      onClick={() => {
        setDraft(notes || "");
        setEditing(true);
      }}
    >
      {notes ? (
        <div
          style={{
            fontSize: 13,
            color: "var(--text2)",
            lineHeight: 1.7,
            background: "var(--bg3)",
            border: "1px solid var(--border)",
            borderRadius: 9,
            padding: "12px 36px 12px 14px",
          }}
        >
          {notes}
        </div>
      ) : (
        <div
          style={{
            fontSize: 13,
            color: "var(--text3)",
            fontStyle: "italic",
            background: "var(--bg3)",
            border: "1px dashed var(--border2)",
            borderRadius: 9,
            padding: "12px 14px",
          }}
        >
          Click to add notes…
        </div>
      )}
      <span
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          fontSize: 11,
          color: "var(--text3)",
        }}
      >
        ✎
      </span>
    </div>
  );
}

// ============================================================================
// UI COMPONENTS - EDITABLE CELLS
// ============================================================================

function AmountCell({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef();

  useEffect(() => {
    if (editing && ref.current) ref.current.focus();
  }, [editing]);

  const commit = () => {
    const n = Number(draft.replace(/[^0-9.]/g, ""));
    if (!isNaN(n) && n > 0) onChange(n);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ padding: "6px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "var(--bg3)",
            border: "1px solid var(--accent)",
            borderRadius: 7,
            padding: "4px 8px",
            width: "fit-content",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "var(--text3)",
              fontFamily: "'Geist Mono',monospace",
            }}
          >
            ₹
          </span>
          <input
            ref={ref}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontFamily: "'Geist Mono',monospace",
              fontSize: 14,
              fontWeight: 600,
              width: 90,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      style={{
        padding: "13px 16px",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "'Geist Mono',monospace",
        color: "var(--text)",
        cursor: "text",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {formatCurrency(value)}
      <span
        style={{
          fontSize: 10,
          color: "var(--text3)",
          opacity: 0.6,
        }}
      >
        ✎
      </span>
    </div>
  );
}

function StatusCell({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const trigRef = useRef();
  const dropRef = useRef();

  useEffect(() => {
    if (!open) return;

    const h = (e) => {
      if (
        trigRef.current &&
        !trigRef.current.contains(e.target) &&
        dropRef.current &&
        !dropRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const handleOpen = () => {
    if (trigRef.current) {
      const r = trigRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((o) => !o);
  };

  return (
    <div style={{ padding: "10px 16px" }}>
      <div
        ref={trigRef}
        onClick={handleOpen}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          cursor: "pointer",
        }}
      >
        <Badge status={status} />
        <span style={{ fontSize: 10, color: "var(--text3)" }}>▾</span>
      </div>

      {open && (
        <div
          ref={dropRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: 300,
            background: "var(--modal-bg)",
            border: "1px solid var(--border2)",
            borderRadius: 10,
            padding: 6,
            minWidth: 140,
            boxShadow: "0 12px 36px rgba(0,0,0,.3)",
          }}
        >
          {INVOICE_STATUSES.map((st) => {
            const ss = STATUS_COLORS[st];
            const active = status === st;
            return (
              <div
                key={st}
                onClick={() => {
                  onChange(st);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 11px",
                  borderRadius: 7,
                  cursor: "pointer",
                  background: active ? "var(--bg4)" : "transparent",
                  transition: "background .1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg4)")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = active ? "var(--bg4)" : "transparent")
                }
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: ss.dot,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "'Geist Mono',monospace",
                    color: active ? ss.dot : "var(--text2)",
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {st}
                </span>
                {active && (
                  <span style={{ marginLeft: "auto", fontSize: 11, color: ss.dot }}>
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// GLOBAL STYLES
// ============================================================================

const GLOBAL_STYLES = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :root {
    --bg: #111113;
    --bg2: #18181b;
    --bg3: #1c1c1f;
    --bg4: #242428;
    --border: rgba(255, 255, 255, 0.08);
    --border2: rgba(255, 255, 255, 0.13);
    --text: #f2f2f7;
    --text2: #8e8e93;
    --text3: #48484a;
    --accent: #3a8ef6;
    --accent-bg: rgba(58, 142, 246, 0.12);
    --accent-bd: rgba(58, 142, 246, 0.25);
    --green: #30d158;
    --green-bg: rgba(48, 209, 88, 0.1);
    --amber: #ffd60a;
    --amber-bg: rgba(255, 214, 10, 0.1);
    --red: #ff453a;
    --red-bg: rgba(255, 69, 58, 0.1);
    --purple: #bf5af2;
    --purple-bg: rgba(191, 90, 242, 0.1);
    --teal: #5ac8fa;
    --teal-bg: rgba(90, 200, 250, 0.1);
    --orange: #ff9f0a;
    --orange-bg: rgba(255, 159, 10, 0.1);
    --radius: 12px;
    --header-h: 52px;
    --bottom-h: 62px;
    --panel-bg: #14141a;
    --header-glass: rgba(14, 14, 16, 0.9);
    --modal-bg: #1a1a1e;
    --sidebar-bg: rgba(14, 14, 16, 0.96);
  }

  body.light {
    --bg: #f5f4f0;
    --bg2: #ffffff;
    --bg3: #eeece8;
    --bg4: #e5e2dc;
    --border: rgba(0, 0, 0, 0.09);
    --border2: rgba(0, 0, 0, 0.14);
    --text: #1a1a1a;
    --text2: #5a5a5a;
    --text3: #a0a0a0;
    --accent: #1a56db;
    --accent-bg: rgba(26, 86, 219, 0.08);
    --accent-bd: rgba(26, 86, 219, 0.2);
    --green: #0d7a4e;
    --green-bg: rgba(13, 122, 78, 0.08);
    --amber: #b45309;
    --amber-bg: rgba(180, 83, 9, 0.08);
    --red: #c0392b;
    --red-bg: rgba(192, 57, 43, 0.08);
    --purple: #7c3aed;
    --purple-bg: rgba(124, 58, 237, 0.08);
    --teal: #0891b2;
    --teal-bg: rgba(8, 145, 178, 0.08);
    --orange: #c2410c;
    --orange-bg: rgba(194, 65, 12, 0.08);
    --panel-bg: #faf9f6;
    --header-glass: rgba(245, 244, 240, 0.92);
    --modal-bg: #ffffff;
    --sidebar-bg: rgba(245, 244, 240, 0.97);
  }

  body.light .card.clickable:hover {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  }

  body.light .row-h:hover {
    background: rgba(0, 0, 0, 0.025);
  }

  body.light input[type=date].input {
    color-scheme: light;
  }

  html, body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Geist', sans-serif;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar {
    width: 4px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--bg4);
    border-radius: 4px;
  }

  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes slideRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .fade-up {
    animation: fadeUp 0.35s cubic-bezier(0.32, 0.72, 0, 1) both;
  }

  .card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    transition: box-shadow 0.2s, border-color 0.2s, transform 0.2s;
  }

  .card.clickable {
    cursor: pointer;
  }

  .card.clickable:hover {
    border-color: var(--border2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    transform: translateY(-2px);
  }

  .input {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 9px;
    color: var(--text);
    font-family: 'Geist', sans-serif;
    font-size: 14px;
    padding: 9px 12px;
    width: 100%;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(58, 142, 246, 0.12);
  }

  .input::placeholder {
    color: var(--text3);
  }

  select.input {
    cursor: pointer;
  }

  input[type=date].input {
    color-scheme: dark;
  }

  textarea.input {
    resize: vertical;
    min-height: 72px;
    line-height: 1.6;
  }

  .btn-p {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 9px;
    padding: 8px 18px;
    font-family: 'Geist', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: filter 0.15s, transform 0.15s;
    white-space: nowrap;
  }

  .btn-p:hover {
    filter: brightness(1.1);
  }

  .btn-p:active {
    transform: scale(0.98);
  }

  .btn-g {
    background: var(--bg4);
    color: var(--text2);
    border: 1px solid var(--border);
    border-radius: 9px;
    padding: 7px 16px;
    font-family: 'Geist', sans-serif;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .btn-g:hover {
    background: var(--bg3);
    color: var(--text);
  }

  .btn-sm {
    background: var(--bg4);
    color: var(--text2);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 4px 12px;
    font-family: 'Geist', sans-serif;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .btn-sm:hover {
    border-color: var(--green);
    color: var(--green);
    background: var(--green-bg);
  }

  .fpill {
    border-radius: 20px;
    padding: 4px 14px;
    font-size: 12px;
    font-family: 'Geist Mono', monospace;
    cursor: pointer;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text2);
    transition: all 0.15s;
    white-space: nowrap;
  }

  .fpill.active {
    background: var(--bg4);
    color: var(--text);
    border-color: var(--border2);
  }

  .fpill:hover:not(.active) {
    background: var(--bg3);
  }

  .ovl {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.18s ease;
  }

  .mbox {
    background: var(--modal-bg);
    border: 1px solid var(--border2);
    border-radius: 16px;
    padding: 28px;
    width: 480px;
    max-width: 95vw;
    max-height: 90vh;
    overflow-y: auto;
    animation: scaleIn 0.22s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .tchip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-family: 'Geist Mono', monospace;
    background: var(--bg4);
    color: var(--text2);
    border-radius: 6px;
    padding: 2px 8px;
    border: 1px solid var(--border);
  }

  .tchip .del {
    cursor: pointer;
    font-size: 10px;
    color: var(--text3);
    transition: color 0.12s;
  }

  .tchip .del:hover {
    color: var(--red);
  }

  @media (max-width: 768px) {
    .g2 {
      grid-template-columns: 1fr !important;
    }

    .g4 {
      grid-template-columns: 1fr 1fr !important;
    }
  }

  @media (max-width: 480px) {
    .g4 {
      grid-template-columns: 1fr 1fr !important;
    }

    .g3 {
      grid-template-columns: 1fr !important;
    }
  }
`;

// ============================================================================
// MAIN APP (Stub for demonstration)
// ============================================================================

export default function App() {
  return (
    <div>
      <style>{FONTS}</style>
      <style>{GLOBAL_STYLES}</style>
      <LoadingScreen msg="Frame OS initializing…" />
    </div>
  );
}
