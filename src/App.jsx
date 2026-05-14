import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase.js";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');`;

/* ── LOCALSTORAGE ── */
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
};

function usePersist(key, init) {
  const [val, setVal] = useState(() => LS.get(key, typeof init === "function" ? init() : init));
  const set = useCallback((v) => {
    setVal(prev => {
      const n = typeof v === "function" ? v(prev) : v;
      LS.set(key, n);
      return n;
    });
  }, [key]);
  return [val, set];
}

/* ── DATA MAPPERS ── */
const mpP = r => ({
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
  artistIds: (r.artist_ids || []).map(Number)
});

const mpC = r => ({
  id: r.id,
  name: r.name || "",
  role: r.role || "Other",
  phone: r.phone || "",
  email: r.email || "",
  location: r.location || "",
  tags: r.tags || [],
  notes: r.notes || "",
  projects: (r.project_ids || []).map(Number)
});

const mpAr = r => ({
  id: r.id,
  name: r.name || "",
  type: r.type || "Actor",
  phone: r.phone || "",
  email: r.email || "",
  location: r.location || "",
  agency: r.agency || "",
  rate: r.rate || "",
  portfolio: r.portfolio || "",
  tags: r.tags || [],
  notes: r.notes || "",
  projects: (r.project_ids || []).map(Number)
});

const mpV = r => ({
  id: r.id,
  name: r.name || "",
  category: r.category || "Camera",
  contact: r.contact || "",
  phone: r.phone || "",
  email: r.email || "",
  location: r.location || "",
  rate: r.rate || "",
  notes: r.notes || ""
});

const mpI = (r, pays) => ({
  id: r.id,
  invoiceNo: r.invoice_no || "",
  project: r.project || "",
  client: r.client || "",
  amount: Number(r.amount) || 0,
  status: r.status || "Pending",
  due: r.due_date || "",
  payments: (pays || []).filter(p => Number(p.invoice_id) === Number(r.id)).map(p => ({
    id: p.id,
    amount: Number(p.amount) || 0,
    date: p.date || "",
    note: p.note || ""
  }))
});

const mpQ = r => ({
  id: r.id,
  title: r.title || "",
  client: r.client || "",
  project: r.project || "",
  status: r.status || "Draft",
  taxPct: Number(r.tax_pct) || 18,
  validUntil: r.valid_until || "",
  notes: r.notes || "",
  lines: r.lines || [],
  createdAt: r.created_at || ""
});

const mpCS = r => ({
  id: r.id,
  projectId: r.project_id,
  date: r.date || "",
  location: r.location || "",
  callTime: r.call_time || "06:00",
  notes: r.notes || "",
  crew: r.crew_list || []
});

const mpA = r => ({
  id: r.id || 1,
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
  logoColor: r.logo_color || "#1a2f6e"
});

/* ── CUSTOM HOOK: useDB ── */
function useDB(table, mapper) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const lsKey = `frameOS_db_${table}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.from(table).select("*").order("id");

      if (e) {
        console.error(`Error loading ${table}:`, e);
        const cached = LS.get(lsKey, []);
        setRows(mapper ? cached.map(mapper) : cached);
        setError(e.message);
        setLoading(false);
        return;
      }

      const mapped = mapper ? data.map(mapper) : data;
      if (mapped.length > 0) {
        LS.set(lsKey, data);
      }
      setRows(mapped);
      setLoading(false);
    } catch (err) {
      console.error("Unexpected error loading data:", err);
      setError(err.message);
      setLoading(false);
    }
  }, [table, lsKey, mapper]);

  const setRowsAndCache = useCallback((updater) => {
    setRows(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      LS.set(lsKey, next);
      return next;
    });
  }, [lsKey]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  return [rows, setRowsAndCache, loading, error, refresh];
}

/* ── DB WRITE FUNCTIONS ── */

// PROJECT
async function dbUpsertProject(p) {
  try {
    const row = {
      title: p.title || "",
      client: p.client || "",
      type: p.type || "TVC",
      status: p.status || "Pre-Production",
      shoot_date: p.shoot || "",
      budget: Number(p.budget) || 0,
      location: p.location || "",
      drive_link: p.driveLink || "",
      tags: Array.isArray(p.tags) ? p.tags : [],
      notes: p.notes || "",
      crew_ids: Array.isArray(p.crewIds) ? p.crewIds.map(Number) : [],
      artist_ids: Array.isArray(p.artistIds) ? p.artistIds.map(Number) : []
    };

    if (p.id && p.id < 2e13) {
      const { data, error } = await supabase.from("projects").update(row).eq("id", p.id).select();
      if (error) throw error;
      return data && data.length > 0 ? mpP(data[0]) : p;
    } else {
      const { data, error } = await supabase.from("projects").insert(row).select();
      if (error) throw error;
      return data && data.length > 0 ? mpP(data[0]) : p;
    }
  } catch (error) {
    console.error("Project save error:", error.message);
    throw error;
  }
}

async function dbDeleteProject(id) {
  try {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Project delete error:", error.message);
    throw error;
  }
}

// CREW
async function dbUpsertCrew(c) {
  try {
    const row = {
      name: c.name || "",
      role: c.role || "",
      phone: c.phone || "",
      email: c.email || "",
      location: c.location || "",
      tags: Array.isArray(c.tags) ? c.tags : [],
      notes: c.notes || "",
      project_ids: Array.isArray(c.projects) ? c.projects.map(Number) : []
    };

    if (c.id && c.id < 2e13) {
      const { data, error } = await supabase.from("crew").update(row).eq("id", c.id).select();
      if (error) throw error;
      return data && data.length > 0 ? mpC(data[0]) : c;
    } else {
      const { data, error } = await supabase.from("crew").insert(row).select();
      if (error) throw error;
      return data && data.length > 0 ? mpC(data[0]) : c;
    }
  } catch (error) {
    console.error("Crew save error:", error.message);
    throw error;
  }
}

async function dbDeleteCrew(id) {
  try {
    const { error } = await supabase.from("crew").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Crew delete error:", error.message);
    throw error;
  }
}

// ARTIST (NEW)
async function dbUpsertArtist(ar) {
  try {
    const row = {
      name: ar.name || "",
      type: ar.type || "Actor",
      phone: ar.phone || "",
      email: ar.email || "",
      location: ar.location || "",
      agency: ar.agency || "",
      rate: ar.rate || "",
      portfolio: ar.portfolio || "",
      tags: Array.isArray(ar.tags) ? ar.tags : [],
      notes: ar.notes || "",
      project_ids: Array.isArray(ar.projects) ? ar.projects.map(Number) : []
    };

    if (ar.id && ar.id < 2e13) {
      const { data, error } = await supabase.from("artists").update(row).eq("id", ar.id).select();
      if (error) throw error;
      return data && data.length > 0 ? mpAr(data[0]) : ar;
    } else {
      const { data, error } = await supabase.from("artists").insert(row).select();
      if (error) throw error;
      return data && data.length > 0 ? mpAr(data[0]) : ar;
    }
  } catch (error) {
    console.error("Artist save error:", error.message);
    throw error;
  }
}

async function dbDeleteArtist(id) {
  try {
    const { error } = await supabase.from("artists").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Artist delete error:", error.message);
    throw error;
  }
}

// VENDOR
async function dbUpsertVendor(v) {
  try {
    const row = {
      name: v.name || "",
      category: v.category || "Camera",
      contact: v.contact || "",
      phone: v.phone || "",
      email: v.email || "",
      location: v.location || "",
      rate: v.rate || "",
      notes: v.notes || ""
    };

    if (v.id && v.id < 2e13) {
      const { data, error } = await supabase.from("vendors").update(row).eq("id", v.id).select();
      if (error) throw error;
      return data && data.length > 0 ? mpV(data[0]) : v;
    } else {
      const { data, error } = await supabase.from("vendors").insert(row).select();
      if (error) throw error;
      return data && data.length > 0 ? mpV(data[0]) : v;
    }
  } catch (error) {
    console.error("Vendor save error:", error.message);
    throw error;
  }
}

async function dbDeleteVendor(id) {
  try {
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Vendor delete error:", error.message);
    throw error;
  }
}

// INVOICE
async function dbUpsertInvoice(inv) {
  try {
    const row = {
      invoice_no: inv.invoiceNo || "",
      project: inv.project || "",
      client: inv.client || "",
      amount: Number(inv.amount) || 0,
      status: inv.status || "Pending",
      due_date: inv.due || ""
    };

    if (inv.id && inv.id < 2e13) {
      const { error } = await supabase.from("invoices").update(row).eq("id", inv.id);
      if (error) throw error;
      return inv.id;
    } else {
      const { data, error } = await supabase.from("invoices").insert(row).select();
      if (error) throw error;
      return data && data.length > 0 ? data[0].id : null;
    }
  } catch (error) {
    console.error("Invoice save error:", error.message);
    throw error;
  }
}

async function dbDeleteInvoice(id) {
  try {
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Invoice delete error:", error.message);
    throw error;
  }
}

// QUOTE
async function dbUpsertQuote(q) {
  try {
    const row = {
      title: q.title || "",
      client: q.client || "",
      project: q.project || "",
      status: q.status || "Draft",
      tax_pct: Number(q.taxPct) || 18,
      valid_until: q.validUntil || "",
      notes: q.notes || "",
      lines: q.lines || [],
      created_at: q.createdAt || new Date().toISOString()
    };

    if (q.id && q.id < 2e13) {
      const { error } = await supabase.from("quotes").update(row).eq("id", q.id);
      if (error) throw error;
      return q.id;
    } else {
      const { data, error } = await supabase.from("quotes").insert(row).select();
      if (error) throw error;
      return data && data.length > 0 ? data[0].id : null;
    }
  } catch (error) {
    console.error("Quote save error:", error.message);
    throw error;
  }
}

async function dbDeleteQuote(id) {
  try {
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Quote delete error:", error.message);
    throw error;
  }
}

// CALL SHEET
async function dbUpsertCallSheet(cs) {
  try {
    const row = {
      project_id: cs.projectId,
      date: cs.date || "",
      location: cs.location || "",
      call_time: cs.callTime || "06:00",
      notes: cs.notes || "",
      crew_list: cs.crew || []
    };

    if (cs.id && cs.id < 2e13) {
      const { error } = await supabase.from("call_sheets").update(row).eq("id", cs.id);
      if (error) throw error;
      return cs.id;
    } else {
      const { data, error } = await supabase.from("call_sheets").insert(row).select();
      if (error) throw error;
      return data && data.length > 0 ? data[0].id : null;
    }
  } catch (error) {
    console.error("Call sheet save error:", error.message);
    throw error;
  }
}

async function dbDeleteCallSheet(id) {
  try {
    const { error } = await supabase.from("call_sheets").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Call sheet delete error:", error.message);
    throw error;
  }
}

// ABOUT/SETTINGS
async function dbSaveAbout(a) {
  try {
    await supabase.from("about").upsert({
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
      logo_color: a.logoColor
    });
  } catch (error) {
    console.error("About save error:", error.message);
    throw error;
  }
}

// EXPORT HELPERS
function exportToCSV(data, filename) {
  if (!data || !data.length) { alert("No data to export"); return; }
  const headers = Object.keys(data[0]);
  const csv = [headers.join(","), ...data.map(r => headers.map(h => JSON.stringify(r[h] || "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename + ".csv"; a.click();
  URL.revokeObjectURL(url);
}

function exportToPDF(title, dataArray) {
  const html = `<html><head><style>body{font-family:Arial,sans-serif;margin:20px;color:#333;}h1{color:#1a2f6e;border-bottom:2px solid #1a2f6e;padding-bottom:10px;}h2{margin-top:30px;color:#1a2f6e;}table{width:100%;border-collapse:collapse;margin:20px 0;}th,td{border:1px solid #ddd;padding:12px;text-align:left;}th{background:#1a2f6e;color:white;font-weight:bold;}tr:nth-child(even){background:#f9f9f9;}</style></head><body><h1>${title}</h1><p>Generated on ${new Date().toLocaleDateString()}</p>${dataArray.map(({ heading, rows }) => { if (!rows || !rows.length) return ""; const headers = Object.keys(rows[0]); return `<h2>${heading}</h2><table><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>${rows.map(r => `<tr>${headers.map(h => `<td>${r[h] || ""}</td>`).join("")}</tr>`).join("")}</table>`; }).join("")}</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${title.replace(/\s+/g, "_")}.html`; a.click();
  URL.revokeObjectURL(url);
}

/* ── MAIN APP ── */
export default function App() {
  const [tab, setTab] = usePersist("frameOS_tab", "projects");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});

  // Load all data
  const [projects, setProjects, pLoading] = useDB("projects", mpP);
  const [crew, setCrew, cLoading] = useDB("crew", mpC);
  const [artists, setArtists, arLoading] = useDB("artists", mpAr);
  const [vendors, setVendors, vLoading] = useDB("vendors", mpV);
  const [invoices, setInvoices, iLoading] = useDB("invoices", mpI);
  const [quotes, setQuotes, qLoading] = useDB("quotes", mpQ);
  const [callSheets, setCallSheets, csLoading] = useDB("call_sheets", mpCS);
  const [about, setAbout, aLoading] = useDB("about", mpA);

  const resetForm = () => setForm({});

  // ── PROJECT CRUD ──
  const saveProject = async () => {
    try {
      const saved = await dbUpsertProject(form);
      if (!editingId) {
        setProjects(prev => [...prev, saved]);
      } else {
        setProjects(prev => prev.map(p => p.id === saved.id ? saved : p));
      }
      resetForm();
      setEditingId(null);
    } catch (error) {
      alert("Error saving project: " + error.message);
    }
  };

  const deleteProject = async (id) => {
    if (!confirm("Delete this project?")) return;
    try {
      await dbDeleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      alert("Error deleting project: " + error.message);
    }
  };

  // ── CREW CRUD ──
  const saveCrew = async () => {
    try {
      const saved = await dbUpsertCrew(form);
      if (!editingId) {
        setCrew(prev => [...prev, saved]);
      } else {
        setCrew(prev => prev.map(c => c.id === saved.id ? saved : c));
      }
      resetForm();
      setEditingId(null);
    } catch (error) {
      alert("Error saving crew: " + error.message);
    }
  };

  const deleteCrew = async (id) => {
    if (!confirm("Delete this crew member?")) return;
    try {
      await dbDeleteCrew(id);
      setCrew(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      alert("Error deleting crew: " + error.message);
    }
  };

  // ── ARTIST CRUD ──
  const saveArtist = async () => {
    try {
      const saved = await dbUpsertArtist(form);
      if (!editingId) {
        setArtists(prev => [...prev, saved]);
      } else {
        setArtists(prev => prev.map(a => a.id === saved.id ? saved : a));
      }
      resetForm();
      setEditingId(null);
    } catch (error) {
      alert("Error saving artist: " + error.message);
    }
  };

  const deleteArtist = async (id) => {
    if (!confirm("Delete this artist?")) return;
    try {
      await dbDeleteArtist(id);
      setArtists(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      alert("Error deleting artist: " + error.message);
    }
  };

  // ── VENDOR CRUD ──
  const saveVendor = async () => {
    try {
      const saved = await dbUpsertVendor(form);
      if (!editingId) {
        setVendors(prev => [...prev, saved]);
      } else {
        setVendors(prev => prev.map(v => v.id === saved.id ? saved : v));
      }
      resetForm();
      setEditingId(null);
    } catch (error) {
      alert("Error saving vendor: " + error.message);
    }
  };

  const deleteVendor = async (id) => {
    if (!confirm("Delete this vendor?")) return;
    try {
      await dbDeleteVendor(id);
      setVendors(prev => prev.filter(v => v.id !== id));
    } catch (error) {
      alert("Error deleting vendor: " + error.message);
    }
  };

  // ── INVOICE CRUD ──
  const saveInvoice = async () => {
    try {
      await dbUpsertInvoice(form);
      const { data } = await supabase.from("invoices").select("*");
      setInvoices(data.map(inv => mpI(inv, [])));
      resetForm();
      setEditingId(null);
    } catch (error) {
      alert("Error saving invoice: " + error.message);
    }
  };

  const deleteInvoice = async (id) => {
    if (!confirm("Delete this invoice?")) return;
    try {
      await dbDeleteInvoice(id);
      setInvoices(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      alert("Error deleting invoice: " + error.message);
    }
  };

  // ── QUOTE CRUD ──
  const saveQuote = async () => {
    try {
      await dbUpsertQuote(form);
      const { data } = await supabase.from("quotes").select("*");
      setQuotes(data.map(mpQ));
      resetForm();
      setEditingId(null);
    } catch (error) {
      alert("Error saving quote: " + error.message);
    }
  };

  const deleteQuote = async (id) => {
    if (!confirm("Delete this quote?")) return;
    try {
      await dbDeleteQuote(id);
      setQuotes(prev => prev.filter(q => q.id !== id));
    } catch (error) {
      alert("Error deleting quote: " + error.message);
    }
  };

  // ── CALL SHEET CRUD ──
  const saveCallSheet = async () => {
    try {
      await dbUpsertCallSheet(form);
      const { data } = await supabase.from("call_sheets").select("*");
      setCallSheets(data.map(mpCS));
      resetForm();
      setEditingId(null);
    } catch (error) {
      alert("Error saving call sheet: " + error.message);
    }
  };

  const deleteCallSheet = async (id) => {
    if (!confirm("Delete this call sheet?")) return;
    try {
      await dbDeleteCallSheet(id);
      setCallSheets(prev => prev.filter(cs => cs.id !== id));
    } catch (error) {
      alert("Error deleting call sheet: " + error.message);
    }
  };

  // ── ABOUT/SETTINGS ──
  const saveAbout = async () => {
    try {
      await dbSaveAbout(form);
      setAbout([form]);
      alert("Studio info saved!");
    } catch (error) {
      alert("Error saving studio info: " + error.message);
    }
  };

  return (
    <div style={{ fontFamily: "Geist, sans-serif", backgroundColor: "#0a0e27", color: "#fff", minHeight: "100vh", padding: "20px" }}>
      <style>{FONTS}</style>

      {/* HEADER */}
      <div style={{ maxWidth: "1400px", margin: "0 auto", marginBottom: "30px" }}>
        <h1 style={{ margin: 0, fontSize: "32px", fontWeight: 700, color: "#1a2f6e" }}>🎬 Frame OS</h1>
        <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "#888" }}>Production Management Suite</p>
      </div>

      {/* TABS */}
      <div style={{ maxWidth: "1400px", margin: "0 auto", marginBottom: "30px", display: "flex", gap: "8px", borderBottom: "1px solid #222", flexWrap: "wrap" }}>
        {["projects", "crew", "artists", "vendors", "invoices", "quotes", "callsheets", "about"].map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setEditingId(null); resetForm(); }}
            style={{
              padding: "12px 20px",
              background: tab === t ? "#1a2f6e" : "transparent",
              border: "none",
              color: tab === t ? "#fff" : "#666",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
              textTransform: "capitalize",
              borderBottom: tab === t ? "2px solid #1a2f6e" : "none",
              transition: "all 0.2s"
            }}
          >
            {t === "callsheets" ? "Call Sheets" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {tab === "projects" && <ProjectsTab projects={projects} loading={pLoading} form={form} setForm={setForm} onSave={saveProject} onEdit={(p) => { setForm(p); setEditingId(p.id); }} onDelete={deleteProject} onCancel={() => { resetForm(); setEditingId(null); }} isEditing={editingId !== null} />}
        {tab === "crew" && <CrewTab crew={crew} loading={cLoading} form={form} setForm={setForm} onSave={saveCrew} onEdit={(c) => { setForm(c); setEditingId(c.id); }} onDelete={deleteCrew} onCancel={() => { resetForm(); setEditingId(null); }} isEditing={editingId !== null} />}
        {tab === "artists" && <ArtistsTab artists={artists} loading={arLoading} form={form} setForm={setForm} onSave={saveArtist} onEdit={(a) => { setForm(a); setEditingId(a.id); }} onDelete={deleteArtist} onCancel={() => { resetForm(); setEditingId(null); }} isEditing={editingId !== null} />}
        {tab === "vendors" && <VendorsTab vendors={vendors} loading={vLoading} form={form} setForm={setForm} onSave={saveVendor} onEdit={(v) => { setForm(v); setEditingId(v.id); }} onDelete={deleteVendor} onCancel={() => { resetForm(); setEditingId(null); }} isEditing={editingId !== null} />}
        {tab === "invoices" && <InvoicesTab invoices={invoices} loading={iLoading} form={form} setForm={setForm} onSave={saveInvoice} onEdit={(i) => { setForm(i); setEditingId(i.id); }} onDelete={deleteInvoice} onCancel={() => { resetForm(); setEditingId(null); }} isEditing={editingId !== null} />}
        {tab === "quotes" && <QuotesTab quotes={quotes} loading={qLoading} form={form} setForm={setForm} onSave={saveQuote} onEdit={(q) => { setForm(q); setEditingId(q.id); }} onDelete={deleteQuote} onCancel={() => { resetForm(); setEditingId(null); }} isEditing={editingId !== null} />}
        {tab === "callsheets" && <CallSheetsTab callSheets={callSheets} loading={csLoading} form={form} setForm={setForm} onSave={saveCallSheet} onEdit={(cs) => { setForm(cs); setEditingId(cs.id); }} onDelete={deleteCallSheet} onCancel={() => { resetForm(); setEditingId(null); }} isEditing={editingId !== null} projects={projects} />}
        {tab === "about" && <AboutTab about={about} loading={aLoading} form={form} setForm={setForm} onSave={saveAbout} />}
      </div>
    </div>
  );
}

/* ── TAB COMPONENTS ── */

function ProjectsTab({ projects, loading, form, setForm, onSave, onEdit, onDelete, onCancel, isEditing }) {
  if (loading) return <div style={{ padding: "20px", color: "#888" }}>Loading projects...</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Projects ({projects.length})</h2>
        <button onClick={() => { setForm({ title: "", client: "", budget: 0, status: "Pre-Production", crewIds: [], artistIds: [] }); }} style={{ padding: "8px 16px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>+ New Project</button>
      </div>

      {isEditing && (
        <div style={{ background: "#111", padding: "20px", marginBottom: "20px", borderRadius: "8px", border: "1px solid #333" }}>
          <h3 style={{ marginTop: 0 }}>Edit Project</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <input type="text" placeholder="Title" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Client" value={form.client || ""} onChange={(e) => setForm({ ...form, client: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <select value={form.type || "TVC"} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }}>
              <option>TVC</option>
              <option>Brand Film</option>
              <option>Product Shoot</option>
              <option>Corporate</option>
              <option>Digital</option>
            </select>
            <select value={form.status || "Pre-Production"} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }}>
              <option>Pre-Production</option>
              <option>Production</option>
              <option>Post-Production</option>
              <option>Completed</option>
            </select>
            <input type="number" placeholder="Budget (₹)" value={form.budget || 0} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="date" value={form.shoot || ""} onChange={(e) => setForm({ ...form, shoot: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Location" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px", gridColumn: "1 / -1" }} />
            <textarea placeholder="Notes" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px", gridColumn: "1 / -1", minHeight: "80px" }} />
          </div>
          <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
            <button onClick={onSave} style={{ padding: "8px 16px", background: "#1a9d6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Save</button>
            <button onClick={onCancel} style={{ padding: "8px 16px", background: "#666", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "10px" }}>
        {projects.map(p => (
          <div key={p.id} style={{ background: "#111", padding: "15px", borderRadius: "6px", border: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: "16px" }}>{p.title}</strong><br />
              <span style={{ color: "#888", fontSize: "13px" }}>{p.client} • {p.type} • ₹{(p.budget || 0).toLocaleString()} • {p.status}</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => onEdit(p)} style={{ padding: "6px 12px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Edit</button>
              <button onClick={() => onDelete(p.id)} style={{ padding: "6px 12px", background: "#c41e3a", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrewTab({ crew, loading, form, setForm, onSave, onEdit, onDelete, onCancel, isEditing }) {
  if (loading) return <div style={{ padding: "20px", color: "#888" }}>Loading crew...</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Crew ({crew.length})</h2>
        <button onClick={() => { setForm({ name: "", role: "Other", phone: "", email: "", location: "" }); }} style={{ padding: "8px 16px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>+ New Crew</button>
      </div>

      {isEditing && (
        <div style={{ background: "#111", padding: "20px", marginBottom: "20px", borderRadius: "8px", border: "1px solid #333" }}>
          <h3 style={{ marginTop: 0 }}>Edit Crew Member</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <input type="text" placeholder="Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Role" value={form.role || ""} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Phone" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="email" placeholder="Email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Location" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px", gridColumn: "1 / -1" }} />
            <textarea placeholder="Notes" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px", gridColumn: "1 / -1", minHeight: "80px" }} />
          </div>
          <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
            <button onClick={onSave} style={{ padding: "8px 16px", background: "#1a9d6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Save</button>
            <button onClick={onCancel} style={{ padding: "8px 16px", background: "#666", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "10px" }}>
        {crew.map(c => (
          <div key={c.id} style={{ background: "#111", padding: "15px", borderRadius: "6px", border: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: "16px" }}>{c.name}</strong><br />
              <span style={{ color: "#888", fontSize: "13px" }}>{c.role} • {c.phone}</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => onEdit(c)} style={{ padding: "6px 12px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Edit</button>
              <button onClick={() => onDelete(c.id)} style={{ padding: "6px 12px", background: "#c41e3a", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArtistsTab({ artists, loading, form, setForm, onSave, onEdit, onDelete, onCancel, isEditing }) {
  if (loading) return <div style={{ padding: "20px", color: "#888" }}>Loading artists...</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Artists ({artists.length})</h2>
        <button onClick={() => { setForm({ name: "", type: "Actor", phone: "", email: "", location: "", agency: "", rate: "", portfolio: "" }); }} style={{ padding: "8px 16px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>+ New Artist</button>
      </div>

      {isEditing && (
        <div style={{ background: "#111", padding: "20px", marginBottom: "20px", borderRadius: "8px", border: "1px solid #333" }}>
          <h3 style={{ marginTop: 0 }}>Edit Artist</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <input type="text" placeholder="Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <select value={form.type || "Actor"} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }}>
              <option>Actor</option>
              <option>Model</option>
              <option>Musician</option>
              <option>Voice Artist</option>
              <option>Dancer</option>
            </select>
            <input type="text" placeholder="Phone" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="email" placeholder="Email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Agency" value={form.agency || ""} onChange={(e) => setForm({ ...form, agency: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Rate (₹/day)" value={form.rate || ""} onChange={(e) => setForm({ ...form, rate: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Location" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Portfolio URL" value={form.portfolio || ""} onChange={(e) => setForm({ ...form, portfolio: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <textarea placeholder="Notes" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px", gridColumn: "1 / -1", minHeight: "80px" }} />
          </div>
          <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
            <button onClick={onSave} style={{ padding: "8px 16px", background: "#1a9d6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Save</button>
            <button onClick={onCancel} style={{ padding: "8px 16px", background: "#666", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "10px" }}>
        {artists.map(a => (
          <div key={a.id} style={{ background: "#111", padding: "15px", borderRadius: "6px", border: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: "16px" }}>{a.name}</strong><br />
              <span style={{ color: "#888", fontSize: "13px" }}>{a.type} • {a.agency} • ₹{a.rate} {a.phone && `• ${a.phone}`}</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => onEdit(a)} style={{ padding: "6px 12px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Edit</button>
              <button onClick={() => onDelete(a.id)} style={{ padding: "6px 12px", background: "#c41e3a", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VendorsTab({ vendors, loading, form, setForm, onSave, onEdit, onDelete, onCancel, isEditing }) {
  if (loading) return <div style={{ padding: "20px", color: "#888" }}>Loading vendors...</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Vendors ({vendors.length})</h2>
        <button onClick={() => { setForm({ name: "", category: "Camera", phone: "", email: "" }); }} style={{ padding: "8px 16px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>+ New Vendor</button>
      </div>

      {isEditing && (
        <div style={{ background: "#111", padding: "20px", marginBottom: "20px", borderRadius: "8px", border: "1px solid #333" }}>
          <h3 style={{ marginTop: 0 }}>Edit Vendor</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <input type="text" placeholder="Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <select value={form.category || "Camera"} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }}>
              <option>Camera</option>
              <option>Lights</option>
              <option>Sound</option>
              <option>Grip</option>
              <option>Location</option>
              <option>Transport</option>
            </select>
            <input type="text" placeholder="Contact Person" value={form.contact || ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Phone" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="email" placeholder="Email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Rate" value={form.rate || ""} onChange={(e) => setForm({ ...form, rate: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Location" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px", gridColumn: "1 / -1" }} />
            <textarea placeholder="Notes" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px", gridColumn: "1 / -1", minHeight: "80px" }} />
          </div>
          <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
            <button onClick={onSave} style={{ padding: "8px 16px", background: "#1a9d6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Save</button>
            <button onClick={onCancel} style={{ padding: "8px 16px", background: "#666", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "10px" }}>
        {vendors.map(v => (
          <div key={v.id} style={{ background: "#111", padding: "15px", borderRadius: "6px", border: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: "16px" }}>{v.name}</strong><br />
              <span style={{ color: "#888", fontSize: "13px" }}>{v.category} • {v.phone} • ₹{v.rate}</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => onEdit(v)} style={{ padding: "6px 12px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Edit</button>
              <button onClick={() => onDelete(v.id)} style={{ padding: "6px 12px", background: "#c41e3a", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoicesTab({ invoices, loading, form, setForm, onSave, onEdit, onDelete, onCancel, isEditing }) {
  if (loading) return <div style={{ padding: "20px", color: "#888" }}>Loading invoices...</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Invoices ({invoices.length})</h2>
        <button onClick={() => { setForm({ invoiceNo: "", client: "", project: "", amount: 0, status: "Pending" }); }} style={{ padding: "8px 16px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>+ New Invoice</button>
      </div>

      {isEditing && (
        <div style={{ background: "#111", padding: "20px", marginBottom: "20px", borderRadius: "8px", border: "1px solid #333" }}>
          <h3 style={{ marginTop: 0 }}>Edit Invoice</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <input type="text" placeholder="Invoice #" value={form.invoiceNo || ""} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Client" value={form.client || ""} onChange={(e) => setForm({ ...form, client: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Project" value={form.project || ""} onChange={(e) => setForm({ ...form, project: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="number" placeholder="Amount (₹)" value={form.amount || 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <select value={form.status || "Pending"} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }}>
              <option>Pending</option>
              <option>Paid</option>
              <option>Overdue</option>
            </select>
            <input type="date" value={form.due || ""} onChange={(e) => setForm({ ...form, due: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
          </div>
          <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
            <button onClick={onSave} style={{ padding: "8px 16px", background: "#1a9d6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Save</button>
            <button onClick={onCancel} style={{ padding: "8px 16px", background: "#666", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "10px" }}>
        {invoices.map(i => (
          <div key={i.id} style={{ background: "#111", padding: "15px", borderRadius: "6px", border: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: "16px" }}>{i.invoiceNo}</strong><br />
              <span style={{ color: "#888", fontSize: "13px" }}>{i.client} • ₹{(i.amount || 0).toLocaleString()} • {i.status}</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => onEdit(i)} style={{ padding: "6px 12px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Edit</button>
              <button onClick={() => onDelete(i.id)} style={{ padding: "6px 12px", background: "#c41e3a", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuotesTab({ quotes, loading, form, setForm, onSave, onEdit, onDelete, onCancel, isEditing }) {
  if (loading) return <div style={{ padding: "20px", color: "#888" }}>Loading quotes...</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Quotes ({quotes.length})</h2>
        <button onClick={() => { setForm({ title: "", client: "", project: "", status: "Draft", taxPct: 18 }); }} style={{ padding: "8px 16px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>+ New Quote</button>
      </div>

      {isEditing && (
        <div style={{ background: "#111", padding: "20px", marginBottom: "20px", borderRadius: "8px", border: "1px solid #333" }}>
          <h3 style={{ marginTop: 0 }}>Edit Quote</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <input type="text" placeholder="Title" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Client" value={form.client || ""} onChange={(e) => setForm({ ...form, client: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Project" value={form.project || ""} onChange={(e) => setForm({ ...form, project: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <select value={form.status || "Draft"} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }}>
              <option>Draft</option>
              <option>Sent</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
            <input type="number" placeholder="Tax %" value={form.taxPct || 18} onChange={(e) => setForm({ ...form, taxPct: Number(e.target.value) })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="date" value={form.validUntil || ""} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <textarea placeholder="Notes" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px", gridColumn: "1 / -1", minHeight: "80px" }} />
          </div>
          <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
            <button onClick={onSave} style={{ padding: "8px 16px", background: "#1a9d6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Save</button>
            <button onClick={onCancel} style={{ padding: "8px 16px", background: "#666", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "10px" }}>
        {quotes.map(q => (
          <div key={q.id} style={{ background: "#111", padding: "15px", borderRadius: "6px", border: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: "16px" }}>{q.title}</strong><br />
              <span style={{ color: "#888", fontSize: "13px" }}>{q.client} • {q.status} • Tax: {q.taxPct}%</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => onEdit(q)} style={{ padding: "6px 12px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Edit</button>
              <button onClick={() => onDelete(q.id)} style={{ padding: "6px 12px", background: "#c41e3a", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CallSheetsTab({ callSheets, loading, form, setForm, onSave, onEdit, onDelete, onCancel, isEditing, projects }) {
  if (loading) return <div style={{ padding: "20px", color: "#888" }}>Loading call sheets...</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Call Sheets ({callSheets.length})</h2>
        <button onClick={() => { setForm({ projectId: "", date: "", location: "", callTime: "06:00", crew: [] }); }} style={{ padding: "8px 16px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>+ New Call Sheet</button>
      </div>

      {isEditing && (
        <div style={{ background: "#111", padding: "20px", marginBottom: "20px", borderRadius: "8px", border: "1px solid #333" }}>
          <h3 style={{ marginTop: 0 }}>Edit Call Sheet</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <select value={form.projectId || ""} onChange={(e) => setForm({ ...form, projectId: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }}>
              <option value="">Select Project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="time" value={form.callTime || "06:00"} onChange={(e) => setForm({ ...form, callTime: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <input type="text" placeholder="Location" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
            <textarea placeholder="Notes" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px", gridColumn: "1 / -1", minHeight: "80px" }} />
          </div>
          <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
            <button onClick={onSave} style={{ padding: "8px 16px", background: "#1a9d6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Save</button>
            <button onClick={onCancel} style={{ padding: "8px 16px", background: "#666", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "10px" }}>
        {callSheets.map(cs => (
          <div key={cs.id} style={{ background: "#111", padding: "15px", borderRadius: "6px", border: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: "16px" }}>{cs.date}</strong><br />
              <span style={{ color: "#888", fontSize: "13px" }}>Call: {cs.callTime} • {cs.location}</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => onEdit(cs)} style={{ padding: "6px 12px", background: "#1a2f6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Edit</button>
              <button onClick={() => onDelete(cs.id)} style={{ padding: "6px 12px", background: "#c41e3a", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AboutTab({ about, loading, form, setForm, onSave }) {
  const studioInfo = about && about.length > 0 ? about[0] : { name: "Aki Mehta", title: "Project Manager", studio: "Frame OS", email: "yashmehtaoffice@gmail.com", phone: "+91 70212 91405", website: "", services: "", tagline: "", bio: "", instagram: "", linkedin: "", logoColor: "#1a2f6e" };

  useEffect(() => {
    if (Object.keys(form).length === 0 && about && about.length > 0) {
      setForm(about[0]);
    }
  }, [about, form, setForm]);

  if (loading) return <div style={{ padding: "20px", color: "#888" }}>Loading settings...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>Studio Settings</h2>
      <div style={{ background: "#111", padding: "20px", borderRadius: "8px", border: "1px solid #333" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
          <input type="text" placeholder="Studio Name" value={form.name || studioInfo.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
          <input type="text" placeholder="Title" value={form.title || studioInfo.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
          <input type="text" placeholder="Studio / Brand" value={form.studio || studioInfo.studio} onChange={(e) => setForm({ ...form, studio: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
          <input type="text" placeholder="Tagline" value={form.tagline || studioInfo.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
          <input type="email" placeholder="Email" value={form.email || studioInfo.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
          <input type="text" placeholder="Phone" value={form.phone || studioInfo.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
          <input type="text" placeholder="Website" value={form.website || studioInfo.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
          <input type="text" placeholder="Instagram" value={form.instagram || studioInfo.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
          <input type="text" placeholder="LinkedIn" value={form.linkedin || studioInfo.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
          <input type="color" placeholder="Logo Color" value={form.logoColor || studioInfo.logoColor} onChange={(e) => setForm({ ...form, logoColor: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px" }} />
          <textarea placeholder="Services" value={form.services || studioInfo.services} onChange={(e) => setForm({ ...form, services: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px", gridColumn: "1 / -1", minHeight: "60px" }} />
          <textarea placeholder="Bio" value={form.bio || studioInfo.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} style={{ padding: "8px", background: "#222", color: "#fff", border: "1px solid #333", borderRadius: "4px", gridColumn: "1 / -1", minHeight: "100px" }} />
        </div>
        <button onClick={onSave} style={{ marginTop: "15px", padding: "8px 20px", background: "#1a9d6e", color: "#fff", border: "none", cursor: "pointer", borderRadius: "4px", fontSize: "14px" }}>Save Settings</button>
      </div>
    </div>
  );
}
