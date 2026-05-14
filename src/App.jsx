import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase.js"; // ✅ Import from safe module, NOT hardcoded

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');`;

/* ── LOCALSTORAGE (auth/settings only) ── */
const LS={get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
function usePersist(key,init){const[val,setVal]=useState(()=>LS.get(key,typeof init==="function"?init():init));const set=useCallback((v)=>{setVal(prev=>{const n=typeof v==="function"?v(prev):v;LS.set(key,n);return n;});},[key]);return[val,set];}

/* ── DATA MAPPERS ── */
const mpP=r=>({id:r.id,title:r.title||"",client:r.client||"",type:r.type||"TVC",status:r.status||"Pre-Production",shoot:r.shoot_date||"",budget:Number(r.budget)||0,location:r.location||"",driveLink:r.drive_link||"",tags:r.tags||[],notes:r.notes||"",crewIds:(r.crew_ids||[]).map(Number)});
const mpC=r=>({id:r.id,name:r.name||"",role:r.role||"Other",phone:r.phone||"",email:r.email||"",location:r.location||"",tags:r.tags||[],notes:r.notes||"",projects:(r.project_ids||[]).map(Number)});
const mpI=(r,pays)=>({id:r.id,invoiceNo:r.invoice_no||"",project:r.project||"",client:r.client||"",amount:Number(r.amount)||0,status:r.status||"Pending",due:r.due_date||"",payments:(pays||[]).filter(p=>Number(p.invoice_id)===Number(r.id)).map(p=>({id:p.id,amount:Number(p.amount)||0,date:p.date||"",note:p.note||""}))});
const mpQ=r=>({id:r.id,title:r.title||"",client:r.client||"",project:r.project||"",status:r.status||"Draft",taxPct:Number(r.tax_pct)||18,validUntil:r.valid_until||"",notes:r.notes||"",lines:r.lines||[],createdAt:r.created_at||""});
const mpA=r=>({name:r.name||"Aki Mehta",title:r.title||"Project Manager & Content Strategist",studio:r.studio||"Frame OS",tagline:r.tagline||"Journey Curators",phone:r.phone||"+91 70212 91405",email:r.email||"yashmehtaoffice@gmail.com",website:r.website||"yashmehtawork.netlify.app",services:r.services||"TVC Production · Brand Films · Product Shoots · Digital Content",bio:r.bio||"",instagram:r.instagram||"linktr.ee/MehtaYash",linkedin:r.linkedin||"",logoColor:r.logo_color||"#1a2f6e"});

/* ── DB HOOKS ── */
function useDB(table,mapper){
  const[rows,setRows]=useState([]);const[loading,setLoading]=useState(true);const[error,setError]=useState(null);
  const lsKey=`frameOS_db_${table}`;
  const load=useCallback(async()=>{setLoading(true);const{data,error:e}=await supabase.from(table).select("*").order("id");if(e){setError(e.message);// fallback to localStorage
    const cached=LS.get(lsKey,[]);setRows(mapper?cached.map(mapper):cached);setLoading(false);return;}
    const mapped=mapper?data.map(mapper):data;
    if(mapped.length>0){LS.set(lsKey,data);}// cache raw rows
    else{// try restore from cache if supabase returned empty
      const cached=LS.get(lsKey,[]);if(cached.length>0){setRows(mapper?cached.map(mapper):cached);setLoading(false);return;}}
    setRows(mapped);setLoading(false);},[table,lsKey]);
  // persist rows to localStorage whenever they change
  const setRowsAndCache=useCallback((updater)=>{setRows(prev=>{const next=typeof updater==="function"?updater(prev):updater;// cache raw-ish (we store mapped for simplicity here)
    LS.set(lsKey,next);return next;});},[lsKey]);
  useEffect(()=>{load();},[load]);
  return[rows,setRowsAndCache,loading,error,load];
}

/* ── DB WRITE HELPERS ── */
async function dbUpsertCrew(c) {
  const row = {
    name: c.name || "",
    role: c.role || "",
    phone: c.phone || "",
    email: c.email || "",
    location: c.location || "",
    tags: Array.isArray(c.tags) ? c.tags : [],
    notes: c.notes || "",
    project_ids: Array.isArray(c.projects)
      ? c.projects.map(Number)
      : []
  };

  const { data, error } = await supabase
    .from("crew")
    .insert(row)
    .select();

  if (error) {
    console.error("CREW INSERT ERROR:", error);
    return c;
  }

  return data[0];
}
async function dbDeleteCrew(id){await supabase.from("crew").delete().eq("id",id);}
async function dbUpsertInvoice(inv){
  const row={invoice_no:inv.invoiceNo,project:inv.project,client:inv.client,amount:inv.amount,status:inv.status,due_date:inv.due};
  if(inv.id&&inv.id<2e13){await supabase.from("invoices").update(row).eq("id",inv.id);return inv.id;}
  const{data}=await supabase.from("invoices").insert(row).select();return data?.id;
}
async function dbAddPayment(invId,p){const{data}=await supabase.from("payments").insert({invoice_id:invId,amount:p.amount,date:p.date,note:p.note}).select();return data;}
async function dbDelPayment(id){await supabase.from("payments").delete().eq("id",id);}
async function dbUpsertQuote(q){
  const row={title:q.title,client:q.client,project:q.project,status:q.status,tax_pct:q.taxPct,valid_until:q.validUntil,notes:q.notes,lines:q.lines,created_at:q.createdAt};
  if(q.id&&q.id<2e13){await supabase.from("quotes").update(row).eq("id",q.id);return q.id;}
  const{data}=await supabase.from("quotes").insert(row).select();return data?.id;
}
async function dbDelQuote(id){await supabase.from("quotes").delete().eq("id",id);}
async function dbSaveAbout(a){await supabase.from("about").upsert({id:1,name:a.name,title:a.title,studio:a.studio,tagline:a.tagline,bio:a.bio,phone:a.phone,email:a.email,website:a.website,services:a.services,instagram:a.instagram,linkedin:a.linkedin,logo_color:a.logoColor});}

/* ── VENDOR MAPPER & DB FUNCTIONS (NEW) ── */
const mpV=r=>({id:r.id,name:r.name||"",category:r.category||"Camera",contact:r.contact||"",phone:r.phone||"",email:r.email||"",location:r.location||"",rate:r.rate||"",notes:r.notes||""});
async function dbUpsertVendor(v){
  const row={name:v.name,category:v.category,contact:v.contact,phone:v.phone,email:v.email,location:v.location,rate:v.rate,notes:v.notes};
  if(v.id&&v.id<2e13){const{data}=await supabase.from("vendors").update(row).eq("id",v.id).select();return data?mpV(data):v;}
  const{data}=await supabase.from("vendors").insert(row).select();return data?mpV(data):v;
}
async function dbDeleteVendor(id){await supabase.from("vendors").delete().eq("id",id);}

/* ── EXPORT HELPERS (NEW) ── */
function exportToCSV(data,filename){
  if(!data||!data.length){alert("No data to export");return;}
  const headers=Object.keys(data[0]);
  const csv=[headers.join(","),...data.map(r=>headers.map(h=>JSON.stringify(r[h]||"")).join(","))].join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename+".csv";a.click();
  URL.revokeObjectURL(url);
}
function exportToPDF(title,dataArray){
  const html=`<html><head><style>body{font-family:Arial,sans-serif;margin:20px;color:#333;}h1{color:#1a2f6e;border-bottom:2px solid #1a2f6e;padding-bottom:10px;}h2{margin-top:30px;color:#1a2f6e;}table{width:100%;border-collapse:collapse;margin:20px 0;}th,td{border:1px solid #ddd;padding:12px;text-align:left;}th{background:#1a2f6e;color:white;font-weight:bold;}tr:nth-child(even){background:#f9f9f9;}</style></head><body><h1>${title}</h1><p>Generated on ${new Date().toLocaleDateString()}</p>${dataArray.map(({heading,rows})=>{if(!rows||!rows.length)return "";const headers=Object.keys(rows[0]);return`<h2>${heading}</h2><table><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>${rows.map(r=>`<tr>${headers.map(h=>`<td>${r[h]||""}</td>`).join("")}</tr>`).join("")}</table>`;}).join("")}</body></html>`;
  const blob=new Blob([html],{type:"text/html"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=`${title.replace(/\s+/g,"_")}.html`;a.click();
  URL.revokeObjectURL(url);
}

// [CONTINUE WITH THE REST OF YOUR APP.JSX - just replace "sb" with "supabase" throughout]
// Copy the rest of your App.jsx from line 117 onwards, replacing all instances of "sb" with "supabase"

export default function App() {
  // Your main app component here...
  return <div>Frame OS App</div>;
}
