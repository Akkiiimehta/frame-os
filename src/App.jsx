import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');`;

/* ── SUPABASE ── */
const sb = createClient(
  "https://dnsybobzvuczmlgvcesx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuc3lib2J6dnVjem1sZ3ZjZXN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODcxNDcsImV4cCI6MjA4OTY2MzE0N30.l1BKnrohJ-EFiEs9nhOmEdfzl_SD8XX7j-WaP4sxqag"
);

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
  const load=useCallback(async()=>{setLoading(true);const{data,error:e}=await sb.from(table).select("*").order("id");if(e){setError(e.message);// fallback to localStorage
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
async function dbUpsertProject(p){
  const row={title:p.title,client:p.client,type:p.type,status:p.status,shoot_date:p.shoot,budget:p.budget,location:p.location,drive_link:p.driveLink,tags:p.tags,notes:p.notes,crew_ids:p.crewIds};
  if(p.id&&p.id<2e13){const{data}=await sb.from("projects").update(row).eq("id",p.id).select().single();return data?mpP(data):p;}
  const{data}=await sb.from("projects").insert(row).select().single();return data?mpP(data):p;
}
async function dbUpsertCrew(c){
  const row={name:c.name,role:c.role,phone:c.phone,email:c.email,location:c.location,tags:c.tags,notes:c.notes,project_ids:c.projects};
  if(c.id&&c.id<2e13){const{data}=await sb.from("crew").update(row).eq("id",c.id).select().single();return data?mpC(data):c;}
  const{data}=await sb.from("crew").insert(row).select().single();return data?mpC(data):c;
}
async function dbDeleteCrew(id){await sb.from("crew").delete().eq("id",id);}
async function dbUpsertInvoice(inv){
  const row={invoice_no:inv.invoiceNo,project:inv.project,client:inv.client,amount:inv.amount,status:inv.status,due_date:inv.due};
  if(inv.id&&inv.id<2e13){await sb.from("invoices").update(row).eq("id",inv.id);return inv.id;}
  const{data}=await sb.from("invoices").insert(row).select().single();return data?.id;
}
async function dbAddPayment(invId,p){const{data}=await sb.from("payments").insert({invoice_id:invId,amount:p.amount,date:p.date,note:p.note}).select().single();return data;}
async function dbDelPayment(id){await sb.from("payments").delete().eq("id",id);}
async function dbUpsertQuote(q){
  const row={title:q.title,client:q.client,project:q.project,status:q.status,tax_pct:q.taxPct,valid_until:q.validUntil,notes:q.notes,lines:q.lines,created_at:q.createdAt};
  if(q.id&&q.id<2e13){await sb.from("quotes").update(row).eq("id",q.id);return q.id;}
  const{data}=await sb.from("quotes").insert(row).select().single();return data?.id;
}
async function dbDelQuote(id){await sb.from("quotes").delete().eq("id",id);}
async function dbSaveAbout(a){await sb.from("about").upsert({id:1,name:a.name,title:a.title,studio:a.studio,tagline:a.tagline,bio:a.bio,phone:a.phone,email:a.email,website:a.website,services:a.services,instagram:a.instagram,linkedin:a.linkedin,logo_color:a.logoColor});}

/* ── VENDOR MAPPER & DB FUNCTIONS (NEW) ── */
const mpV=r=>({id:r.id,name:r.name||"",category:r.category||"Camera",contact:r.contact||"",phone:r.phone||"",email:r.email||"",location:r.location||"",rate:r.rate||"",notes:r.notes||""});
async function dbUpsertVendor(v){
  const row={name:v.name,category:v.category,contact:v.contact,phone:v.phone,email:v.email,location:v.location,rate:v.rate,notes:v.notes};
  if(v.id&&v.id<2e13){const{data}=await sb.from("vendors").update(row).eq("id",v.id).select().single();return data?mpV(data):v;}
  const{data}=await sb.from("vendors").insert(row).select().single();return data?mpV(data):v;
}
async function dbDeleteVendor(id){await sb.from("vendors").delete().eq("id",id);}

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


/* ── UI HELPERS ── */
function LoadingScreen({msg="Loading…"}){return<div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}><div style={{width:36,height:36,border:"2px solid rgba(255,255,255,0.1)",borderTopColor:"var(--accent)",borderRadius:"50%",animation:"spin .7s linear infinite"}}/><div style={{fontSize:13,color:"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>{msg}</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;}
function ErrScreen({msg}){return<div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:24}}><div style={{fontSize:28}}>⚠️</div><div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>Database connection failed</div><div style={{fontSize:13,color:"var(--text3)",textAlign:"center",maxWidth:340}}>{msg}</div><button className="btn-p" onClick={()=>window.location.reload()}>Retry</button></div>;}


const GS=`
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#111113;--bg2:#18181b;--bg3:#1c1c1f;--bg4:#242428;
  --border:rgba(255,255,255,0.08);--border2:rgba(255,255,255,0.13);
  --text:#f2f2f7;--text2:#8e8e93;--text3:#48484a;
  --accent:#3a8ef6;--accent-bg:rgba(58,142,246,0.12);--accent-bd:rgba(58,142,246,0.25);
  --green:#30d158;--green-bg:rgba(48,209,88,0.1);
  --amber:#ffd60a;--amber-bg:rgba(255,214,10,0.1);
  --red:#ff453a;--red-bg:rgba(255,69,58,0.1);
  --purple:#bf5af2;--purple-bg:rgba(191,90,242,0.1);
  --teal:#5ac8fa;--teal-bg:rgba(90,200,250,0.1);
  --orange:#ff9f0a;--orange-bg:rgba(255,159,10,0.1);
  --radius:12px;--header-h:52px;--bottom-h:62px;
  --panel-bg:#14141a;--header-glass:rgba(14,14,16,0.9);--modal-bg:#1a1a1e;--sidebar-bg:rgba(14,14,16,0.96);
}
body.light{
  --bg:#f5f4f0;--bg2:#ffffff;--bg3:#eeece8;--bg4:#e5e2dc;
  --border:rgba(0,0,0,0.09);--border2:rgba(0,0,0,0.14);
  --text:#1a1a1a;--text2:#5a5a5a;--text3:#a0a0a0;
  --accent:#1a56db;--accent-bg:rgba(26,86,219,0.08);--accent-bd:rgba(26,86,219,0.2);
  --green:#0d7a4e;--green-bg:rgba(13,122,78,0.08);
  --amber:#b45309;--amber-bg:rgba(180,83,9,0.08);
  --red:#c0392b;--red-bg:rgba(192,57,43,0.08);
  --purple:#7c3aed;--purple-bg:rgba(124,58,237,0.08);
  --teal:#0891b2;--teal-bg:rgba(8,145,178,0.08);
  --orange:#c2410c;--orange-bg:rgba(194,65,12,0.08);
  --panel-bg:#faf9f6;--header-glass:rgba(245,244,240,0.92);--modal-bg:#ffffff;--sidebar-bg:rgba(245,244,240,0.97);
}
body.light .card.clickable:hover{box-shadow:0 8px 32px rgba(0,0,0,.12);}
body.light .row-h:hover{background:rgba(0,0,0,.025);}
body.light input[type=date].input{color-scheme:light;}
html,body{background:var(--bg);color:var(--text);font-family:'Geist',sans-serif;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:4px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
@keyframes slideRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
.fade-up{animation:fadeUp .35s cubic-bezier(.32,.72,0,1) both;}
.card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);transition:box-shadow .2s,border-color .2s,transform .2s;}
.card.clickable{cursor:pointer;}.card.clickable:hover{border-color:var(--border2);box-shadow:0 8px 32px rgba(0,0,0,.45);transform:translateY(-2px);}
.nav-s{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;cursor:pointer;transition:background .15s;white-space:nowrap;overflow:hidden;color:var(--text2);border:none;background:none;width:100%;text-align:left;}
.nav-s:hover{background:var(--bg4);color:var(--text);}.nav-s.active{background:var(--bg4);color:var(--text);}
.input{background:var(--bg3);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:'Geist',sans-serif;font-size:14px;padding:9px 12px;width:100%;outline:none;transition:border-color .15s,box-shadow .15s;}
.input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(58,142,246,.12);}.input::placeholder{color:var(--text3);}
select.input{cursor:pointer;}input[type=date].input{color-scheme:dark;}textarea.input{resize:vertical;min-height:72px;line-height:1.6;}
.btn-p{background:var(--accent);color:#fff;border:none;border-radius:9px;padding:8px 18px;font-family:'Geist',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:filter .15s,transform .15s;white-space:nowrap;}
.btn-p:hover{filter:brightness(1.1);}.btn-p:active{transform:scale(.98);}
.btn-g{background:var(--bg4);color:var(--text2);border:1px solid var(--border);border-radius:9px;padding:7px 16px;font-family:'Geist',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s,color .15s;white-space:nowrap;}
.btn-g:hover{background:var(--bg3);color:var(--text);}
.btn-sm{background:var(--bg4);color:var(--text2);border:1px solid var(--border);border-radius:7px;padding:4px 12px;font-family:'Geist',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap;}
.btn-sm:hover{border-color:var(--green);color:var(--green);background:var(--green-bg);}
.fpill{border-radius:20px;padding:4px 14px;font-size:12px;font-family:'Geist Mono',monospace;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--text2);transition:all .15s;white-space:nowrap;}
.fpill.active{background:var(--bg4);color:var(--text);border-color:var(--border2);}.fpill:hover:not(.active){background:var(--bg3);}
.row-h{transition:background .12s;}.row-h:hover{background:rgba(255,255,255,.025);}
.ovl{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);z-index:200;display:flex;align-items:center;justify-content:center;animation:fadeIn .18s ease;}
.mbox{background:var(--modal-bg);border:1px solid var(--border2);border-radius:16px;padding:28px;width:480px;max-width:95vw;max-height:90vh;overflow-y:auto;animation:scaleIn .22s cubic-bezier(.32,.72,0,1);}
.panel{position:fixed;top:0;right:0;bottom:0;width:500px;max-width:100vw;background:#14141a;border-left:1px solid var(--border2);z-index:160;overflow-y:auto;display:flex;flex-direction:column;animation:slideRight .28s cubic-bezier(.32,.72,0,1);}
.povl{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);z-index:150;animation:fadeIn .2s ease;}
.cs-panel{position:fixed;top:0;right:0;bottom:0;width:540px;max-width:100vw;background:#14141a;border-left:1px solid var(--border2);z-index:172;overflow-y:auto;display:flex;flex-direction:column;animation:slideRight .28s cubic-bezier(.32,.72,0,1);}
.cs-ovl{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(5px);z-index:168;animation:fadeIn .2s ease;}
.ps{padding:20px 26px;border-bottom:1px solid var(--border);}.ps:last-child{border-bottom:none;}
.drow{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);}.drow:last-child{border-bottom:none;}
.tchip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-family:'Geist Mono',monospace;background:var(--bg4);color:var(--text2);border-radius:6px;padding:2px 8px;border:1px solid var(--border);}
.tchip .del{cursor:pointer;font-size:10px;color:var(--text3);transition:color .12s;}.tchip .del:hover{color:var(--red);}
.bnav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:80;background:rgba(10,10,14,0.97);backdrop-filter:blur(20px);border-top:1px solid var(--border);height:var(--bottom-h);padding-bottom:env(safe-area-inset-bottom,0px);}
.bni{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;flex:1;height:100%;border:none;background:none;cursor:pointer;padding:6px 2px;}
.bni-ic{font-size:20px;line-height:1;}.bni-lb{font-size:9px;font-family:'Geist Mono',monospace;color:var(--text3);letter-spacing:0.03em;text-transform:uppercase;}
.bni.active .bni-lb{color:var(--accent);}
@media(max-width:768px){
  .sd{display:none!important;}.bnav{display:flex;}
  .mc{margin-left:0!important;padding-bottom:calc(var(--bottom-h) + 12px)!important;}
  .panel,.cs-panel{width:100vw;border-left:none;}
  .mbox{width:96vw;padding:20px 16px;}
  .g2{grid-template-columns:1fr!important;}
  .g4{grid-template-columns:1fr 1fr!important;}
  .hpad{padding:0 16px!important;}
  .ps{padding:14px 16px;}
  .fscroll{overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;max-width:100%;}
  .fscroll>div{min-width:540px;width:100%;}
  .hmob{display:none!important;}
}
@media(max-width:480px){.g4{grid-template-columns:1fr 1fr!important;}.g3{grid-template-columns:1fr!important;}}
`;

const SC={"Pre-Production":{dot:"var(--teal)",bg:"var(--teal-bg)",bd:"rgba(90,200,250,.2)"},"In Production":{dot:"var(--accent)",bg:"var(--accent-bg)",bd:"var(--accent-bd)"},"Post":{dot:"var(--purple)",bg:"var(--purple-bg)",bd:"rgba(191,90,242,.2)"},"Delivered":{dot:"var(--green)",bg:"var(--green-bg)",bd:"rgba(48,209,88,.2)"},"On Hold":{dot:"var(--red)",bg:"var(--red-bg)",bd:"rgba(255,69,58,.2)"},"Pending":{dot:"var(--amber)",bg:"var(--amber-bg)",bd:"rgba(255,214,10,.2)"},"Partial":{dot:"var(--orange)",bg:"var(--orange-bg)",bd:"rgba(255,159,10,.2)"},"Paid":{dot:"var(--green)",bg:"var(--green-bg)",bd:"rgba(48,209,88,.2)"},"Overdue":{dot:"var(--red)",bg:"var(--red-bg)",bd:"rgba(255,69,58,.2)"},"Draft":{dot:"var(--text3)",bg:"rgba(72,72,74,.2)",bd:"rgba(72,72,74,.3)"},"Sent":{dot:"var(--accent)",bg:"var(--accent-bg)",bd:"var(--accent-bd)"},"Approved":{dot:"var(--green)",bg:"var(--green-bg)",bd:"rgba(48,209,88,.2)"}};
const INV_ST=["Pending","Partial","Paid","Overdue"];
const PROJ_ST=["Pre-Production","In Production","Post","Delivered","On Hold"];
const CREW_ROLES=["Director","DOP","Producer","Line Producer","AD","AC","Gaffer","Grip","Camera Op","Sound","Editor","Colorist","VFX","Makeup","Stylist","Food Stylist","Art Director","Focus Puller","DIT","Other"];
const BRAND_GRADS=["linear-gradient(135deg,#1a2f6e,#2a4fa8)","linear-gradient(135deg,#1e3a2f,#2d6b50)","linear-gradient(135deg,#3a1a2e,#7a2d5a)","linear-gradient(135deg,#2a1a10,#7a4010)","linear-gradient(135deg,#0a2240,#1a5080)","linear-gradient(135deg,#2a0a3a,#6020a0)"];
const AVC=["#2563eb","#7c3aed","#0891b2","#065f46","#92400e","#881337","#1e40af","#6d28d9"];
const SEED_CREW=[{id:101,name:"Kabir Malhotra",role:"DOP",phone:"9876543210",email:"kabir@frameops.in",location:"Mumbai",tags:["arri","reliable"],notes:"Prefers natural light.",projects:[1,2]},{id:102,name:"Riya Sharma",role:"Producer",phone:"9988776655",email:"riya@frameops.in",location:"Mumbai",tags:["logistics"],notes:"Strong vendor network.",projects:[1,3]},{id:103,name:"Priya Nair",role:"Director",phone:"9123456789",email:"priya@studio.in",location:"Delhi",tags:["commercial"],notes:"Known for fashion campaigns.",projects:[2,4]},{id:104,name:"Aman Khanna",role:"Editor",phone:"9000111222",email:"aman@edit.in",location:"Bengaluru",tags:["premiere"],notes:"Fast turnaround.",projects:[4]},{id:105,name:"Zara Sheikh",role:"Gaffer",phone:"9876001234",email:"zara.g@lights.in",location:"Mumbai",tags:["studio"],notes:"Full lighting kit.",projects:[1]},{id:106,name:"Dev Patel",role:"AD",phone:"9001234567",email:"dev.ad@film.in",location:"Mumbai",tags:["organised"],notes:"Excellent with large shoots.",projects:[2]}];
const SEED_PROJECTS=[{id:1,title:"Zara Campaign TVC",client:"Zara India",type:"TVC",status:"In Production",shoot:"2026-03-28",budget:320000,driveLink:"",location:"Delhi NCR",crewIds:[101,102,105],tags:["fashion","TVC"],notes:"Second day wrapping up."},{id:2,title:"Taj Hotels Brand Film",client:"Taj Group",type:"Brand Film",status:"Pre-Production",shoot:"2026-04-10",budget:580000,driveLink:"",location:"Mumbai — Taj Palace",crewIds:[101,103,106],tags:["luxury"],notes:"Recce done."},{id:3,title:"Mamaearth Product Shoot",client:"Mamaearth",type:"Product Shoot",status:"Delivered",shoot:"2026-03-05",budget:95000,driveLink:"",location:"Mumbai Studio",crewIds:[102],tags:["ecomm"],notes:"Delivered."},{id:4,title:"Nykaa Summer Reels",client:"Nykaa",type:"Digital",status:"Post",shoot:"2026-03-14",budget:140000,driveLink:"",location:"Mumbai Bandra",crewIds:[103,104],tags:["digital"],notes:"Edit v2 shared."}];
const SEED_INV=[{id:1,invoiceNo:"INV-2026-001",project:"Zara Campaign TVC",client:"Zara India",amount:160000,status:"Partial",due:"2026-04-01",payments:[{id:101,amount:80000,date:"2026-03-10",note:"50% advance"}]},{id:2,invoiceNo:"INV-2026-002",project:"Taj Hotels Brand Film",client:"Taj Group",amount:290000,status:"Paid",due:"2026-03-15",payments:[{id:201,amount:145000,date:"2026-03-01",note:"First instalment"},{id:202,amount:145000,date:"2026-03-14",note:"Final payment"}]},{id:3,invoiceNo:"INV-2026-003",project:"Mamaearth Product Shoot",client:"Mamaearth",amount:95000,status:"Overdue",due:"2026-03-10",payments:[]},{id:4,invoiceNo:"INV-2026-004",project:"Nykaa Summer Reels",client:"Nykaa",amount:70000,status:"Pending",due:"2026-04-05",payments:[]}];

const fmt=n=>`₹${Number(n).toLocaleString("en-IN")}`;
const fmtK=n=>`₹${(n/1000).toFixed(0)}K`;
const totalRec=inv=>(inv.payments||[]).reduce((s,p)=>s+p.amount,0);
const autoSt=inv=>{const r=totalRec(inv);if(r===0)return inv.status==="Overdue"?"Overdue":"Pending";if(r>=inv.amount)return "Paid";return "Partial";};
const rc=role=>{const m={Director:"var(--purple)",DOP:"var(--teal)",Producer:"var(--accent)",AD:"var(--amber)","Line Producer":"var(--orange)",AC:"var(--green)",Gaffer:"var(--amber)",Editor:"var(--red)",Sound:"var(--green)"};return m[role]||"var(--text2)";};

function Badge({status}){const s=SC[status]||{dot:"var(--text3)",bg:"var(--bg4)",bd:"var(--border)"};return <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontFamily:"'Geist Mono',monospace",color:s.dot,background:s.bg,border:`1px solid ${s.bd}`,borderRadius:20,padding:"2px 9px",whiteSpace:"nowrap"}}><span style={{width:5,height:5,borderRadius:"50%",background:s.dot,display:"inline-block",flexShrink:0}}/>{status}</span>;}
function RBadge({role}){const c=rc(role);return <span style={{fontSize:11,fontFamily:"'Geist Mono',monospace",color:c,background:c+"22",border:`1px solid ${c}44`,borderRadius:20,padding:"2px 10px",whiteSpace:"nowrap"}}>{role}</span>;}
function Lbl({ch}){return <div style={{fontSize:12,color:"var(--text2)",marginBottom:6,fontWeight:500}}>{ch}</div>;}
function Inp({value,onChange,placeholder,type="text",style={}}){return <input className="input" type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={style}/>;}
function TA({value,onChange,placeholder}){return <textarea className="input" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>;}
function Sel({value,onChange,options}){return <select className="input" value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o}>{o}</option>)}</select>;}
function Modal({title,onClose,children,width=480}){return <div className="ovl" onClick={onClose}><div className="mbox" style={{width}} onClick={e=>e.stopPropagation()}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}><span style={{fontSize:17,fontWeight:600,color:"var(--text)"}}>{title}</span><button onClick={onClose} style={{background:"var(--bg4)",border:"1px solid var(--border)",color:"var(--text2)",width:28,height:28,borderRadius:7,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button></div>{children}</div></div>;}
function SC2({label,value,sub,color,icon,delay=0}){return <div className="card fade-up" style={{padding:"20px",animationDelay:`${delay}ms`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:10}}>{label}</div><div style={{fontSize:26,fontWeight:600,color,lineHeight:1}}>{value}</div>{sub&&<div style={{fontSize:12,color:"var(--text2)",marginTop:6}}>{sub}</div>}</div><span style={{fontSize:20,opacity:.35,marginTop:2}}>{icon}</span></div></div>;}
function Av({name,idx,size=26}){return <div title={name} style={{width:size,height:size,borderRadius:"50%",background:AVC[idx%AVC.length],border:"2px solid var(--bg2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size>30?13:10,fontWeight:700,color:"#fff",flexShrink:0}}>{(name||"?")[0].toUpperCase()}</div>;}

function ETags({tags,onAdd,onDelete}){const[adding,setAdding]=useState(false);const[val,setVal]=useState("");const ref=useRef();useEffect(()=>{if(adding&&ref.current)ref.current.focus();},[adding]);const commit=()=>{const t=val.trim();if(t&&!tags.includes(t))onAdd(t);setVal("");setAdding(false);};return <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>{tags.map(t=><span key={t} className="tchip">{t}<span className="del" onClick={()=>onDelete(t)}>✕</span></span>)}{adding?<input ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setAdding(false);setVal("");}}} placeholder="tag…" style={{background:"var(--bg3)",border:"1px solid var(--accent)",borderRadius:6,color:"var(--text)",fontFamily:"'Geist Mono',monospace",fontSize:11,padding:"2px 8px",outline:"none",width:80}}/>:<button onClick={()=>setAdding(true)} style={{fontSize:11,fontFamily:"'Geist Mono',monospace",background:"transparent",border:"1px dashed var(--border2)",color:"var(--text3)",borderRadius:6,padding:"2px 8px",cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="var(--accent)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border2)";e.currentTarget.style.color="var(--text3)";}}>+ tag</button>}</div>;}

function ENotes({notes,onSave}){const[editing,setEditing]=useState(false);const[draft,setDraft]=useState(notes||"");if(editing)return <div><TA value={draft} onChange={setDraft} placeholder="Add notes…"/><div style={{display:"flex",gap:8,marginTop:8}}><button className="btn-p" style={{padding:"5px 14px",fontSize:12}} onClick={()=>{onSave(draft);setEditing(false);}}>Save</button><button className="btn-g" style={{padding:"5px 12px",fontSize:12}} onClick={()=>{setDraft(notes||"");setEditing(false);}}>Cancel</button></div></div>;return <div style={{position:"relative",cursor:"pointer"}} onClick={()=>{setDraft(notes||"");setEditing(true);}}>{notes?<div style={{fontSize:13,color:"var(--text2)",lineHeight:1.7,background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:9,padding:"12px 36px 12px 14px"}}>{notes}</div>:<div style={{fontSize:13,color:"var(--text3)",fontStyle:"italic",background:"var(--bg3)",border:"1px dashed var(--border2)",borderRadius:9,padding:"12px 14px"}}>Click to add notes…</div>}<span style={{position:"absolute",top:10,right:12,fontSize:11,color:"var(--text3)"}}>✎</span></div>;}

function ACell({value,onChange}){const[editing,setEditing]=useState(false);const[draft,setDraft]=useState(String(value));const ref=useRef();useEffect(()=>{if(editing&&ref.current)ref.current.focus();},[editing]);const commit=()=>{const n=Number(draft.replace(/[^0-9.]/g,""));if(!isNaN(n)&&n>0)onChange(n);setEditing(false);};if(editing)return <div style={{padding:"6px 16px"}}><div style={{display:"flex",alignItems:"center",gap:4,background:"var(--bg3)",border:"1px solid var(--accent)",borderRadius:7,padding:"4px 8px",width:"fit-content"}}><span style={{fontSize:12,color:"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>₹</span><input ref={ref} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape")setEditing(false);}} style={{background:"transparent",border:"none",outline:"none",color:"var(--text)",fontFamily:"'Geist Mono',monospace",fontSize:14,fontWeight:600,width:90}}/></div></div>;return <div onClick={()=>{setDraft(String(value));setEditing(true);}} style={{padding:"13px 16px",fontSize:14,fontWeight:600,fontFamily:"'Geist Mono',monospace",color:"var(--text)",cursor:"text",display:"flex",alignItems:"center",gap:5}}>{fmt(value)}<span style={{fontSize:10,color:"var(--text3)",opacity:.6}}>✎</span></div>;}

function StCell({status,onChange}){
  const[open,setOpen]=useState(false);const[pos,setPos]=useState({top:0,left:0});
  const trigRef=useRef();const dropRef=useRef();
  useEffect(()=>{if(!open)return;const h=e=>{if(trigRef.current&&!trigRef.current.contains(e.target)&&dropRef.current&&!dropRef.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[open]);
  const handleOpen=()=>{if(trigRef.current){const r=trigRef.current.getBoundingClientRect();setPos({top:r.bottom+4,left:r.left});}setOpen(o=>!o);};
  return <div style={{padding:"10px 16px"}}>
    <div ref={trigRef} onClick={handleOpen} style={{display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer"}}><Badge status={status}/><span style={{fontSize:10,color:"var(--text3)"}}>▾</span></div>
    {open&&<div ref={dropRef} style={{position:"fixed",top:pos.top,left:pos.left,zIndex:300,background:"var(--modal-bg)",border:"1px solid var(--border2)",borderRadius:10,padding:6,minWidth:140,boxShadow:"0 12px 36px rgba(0,0,0,.3)"}}>
      {INV_ST.map(st=>{const ss=SC[st];const act=status===st;return <div key={st} onClick={()=>{onChange(st);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 11px",borderRadius:7,cursor:"pointer",background:act?"var(--bg4)":"transparent",transition:"background .1s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--bg4)"} onMouseLeave={e=>e.currentTarget.style.background=act?"var(--bg4)":"transparent"}>
        <span style={{width:7,height:7,borderRadius:"50%",background:ss.dot,display:"inline-block",flexShrink:0}}/>
        <span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:act?ss.dot:"var(--text2)",fontWeight:act?500:400}}>{st}</span>
        {act&&<span style={{marginLeft:"auto",fontSize:11,color:ss.dot}}>✓</span>}
      </div>;})}
    </div>}
  </div>;
}

/* ── CALL SHEET GENERATOR ── */
function genCS(cs,crewMap){
  const crew=(cs.crewIds||[]).map(id=>crewMap[id]).filter(Boolean);
  const contactStr=crew.filter(c=>c.phone).slice(0,3).map(c=>`${c.name} — ${c.phone}`).join("<br>");
  const keyRoles=["Director","DOP","Executive Producer","Producer","1st AD","AD","1st AC","AC","Gaffer","Focus Puller","Art Director","Costume Stylist","Hair and Makeup","Food Stylist","DIT","Sound","Production Controller"];
  const crewBlock=keyRoles.map(role=>{const c=crew.find(m=>m.role===role);return c?`<div class="ci"><b>${role}:</b> ${c.name}</div>`:""}).filter(Boolean).join("");
  const deptRows=(()=>{const d=cs.deptCalls||[];const rows=[];for(let i=0;i<d.length;i+=2){rows.push(`<tr><td>${d[i].dept}</td><td>${d[i].time||"OC"}</td><td>${d[i+1]?d[i+1].dept:""}</td><td>${d[i+1]?d[i+1].time||"OC":""}</td></tr>`);}return rows.join("");})();
  const castRows=(cs.cast||[]).map(c=>`<tr><td>${c.no}</td><td><b>${c.name}</b></td><td>${c.number}</td><td>${c.reach}</td><td>${c.hmw}</td><td>${c.onset}</td><td>${c.notes||"—"}</td></tr>`).join("");
  const shotRows=(cs.schedule||[]).map((s,i)=>`<tr style="${i%2===0?"background:#fafafa":""}"><td>${s.no}</td><td><b>${s.scene}</b></td><td>${s.description}</td><td>${s.characters}</td><td>${s.costumes}</td><td><b>${s.eta}</b></td></tr>`).join("");
  const prod=crew.find(m=>m.role==="Producer"||m.role==="Executive Producer");
  const ad=crew.find(m=>m.role==="AD"||m.role==="1st AD");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Call Sheet — ${cs.projectTitle||"Shoot"}</title><style>
  *{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;background:#fff;color:#000;font-size:12px;}
  .page{max-width:920px;margin:0 auto;padding:16px;}
  .red-bar{background:#e4002b;height:7px;width:100%;margin-bottom:0;}
  .hbox{border:2px solid #000;}
  .htop{display:grid;grid-template-columns:155px 1fr 1fr;border-bottom:2px solid #000;}
  .logo-c{border-right:2px solid #000;padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;}
  .logo-init{font-size:30px;font-weight:900;color:#e4002b;letter-spacing:-2px;}
  .logo-sub{font-size:9px;font-weight:700;letter-spacing:0.15em;color:#444;margin-top:3px;}
  .shoot-c{border-right:2px solid #000;padding:12px;}
  .loc-c{padding:12px;}
  .info-g{display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid #000;}
  .ic{padding:10px 12px;border-right:2px solid #000;font-size:11px;}.ic:last-child{border-right:none;}
  .ic .lbl{font-weight:700;margin-bottom:3px;font-size:11px;}
  .crew-s{padding:10px 12px;border-bottom:2px solid #000;}
  .cg{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;}
  .ci{font-size:11px;padding:2px 0;}
  .sh{background:#000;color:#fff;text-align:center;font-weight:700;font-size:12px;letter-spacing:0.1em;padding:6px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#000;color:#fff;padding:7px 8px;font-size:10px;text-align:left;letter-spacing:0.05em;}
  td{padding:6px 8px;border:1px solid #ddd;font-size:11px;}
  .dec{background:#f5f5f5;border:2px solid #000;border-top:none;padding:8px 14px;font-size:10px;font-style:italic;text-align:center;font-weight:600;letter-spacing:0.03em;}
  .appr{border:2px solid #000;border-top:none;display:grid;grid-template-columns:1fr 1fr;}
  .ac{padding:8px 12px;font-size:11px;border-right:2px solid #000;}.ac:last-child{border-right:none;}
  .red-foot{background:#e4002b;height:5px;width:100%;margin-top:10px;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.page{padding:8px;}}
  </style></head><body><div class="page">
  <div class="red-bar"></div>
  <div class="hbox">
    <div class="htop">
      <div class="logo-c"><div class="logo-init">${(cs.productionHouse||"FO").substring(0,2).toUpperCase()}</div><div class="logo-sub">${cs.productionHouse||"FRAME OS"}</div></div>
      <div class="shoot-c"><div style="font-size:14px;font-weight:700;">SHOOT DATE: ${cs.shootDate||"—"}</div><div style="margin-top:4px;font-size:12px;">Shooting Day: ${cs.shootDay||"1/1"}</div><div style="margin-top:8px;font-weight:700;font-size:13px;">CREW CALL — ${cs.crewCall||"6:00 AM"}</div><div>SHIFT: ${cs.shiftStart||"7:00 AM"} — ${cs.shiftEnd||"7:00 PM"}</div></div>
      <div class="loc-c"><div style="font-weight:700;font-size:10px;margin-bottom:4px;">LOCATION:</div><div>${(cs.location||"").replace(/\n/g,"<br>")}</div><div style="font-weight:700;font-size:10px;margin:8px 0 3px;">CONTACT ON SET:</div><div>${contactStr||cs.contactOnSet||"—"}</div></div>
    </div>
    <div class="info-g">
      <div class="ic"><div class="lbl">MEALS</div>Breakfast: ${cs.breakfast||"7:00 AM onwards"}<br>Lunch: ${cs.lunch||"1:00 PM"}<br>Evening Snacks: ${cs.snacks||"5:30 PM"}</div>
      <div class="ic"><div class="lbl">WEATHER</div>${cs.weather||"Clear sky"} · ${cs.temp||"—"}<br>Sunrise: ${cs.sunrise||"—"} · Sunset: ${cs.sunset||"—"}<br><b>Nearest Hospital:</b> ${cs.hospital||"—"}</div>
    </div>
    <div class="crew-s"><div class="cg">${crewBlock||crew.map(c=>`<div class="ci"><b>${c.role}:</b> ${c.name}</div>`).join("")}</div></div>
  </div>
  <div class="dec">SHOOT DECORUM: ${cs.decorum||"NO PERSONAL PHOTOGRAPHY ON SET · NO OPEN SHOES · NO SMOKING · DO NOT TOUCH PROPS · MAINTAIN SILENCE"}</div>
  ${(cs.deptCalls||[]).length>0?`<div class="sh">CALL TIME ON SET</div><table><thead><tr><th>DEPARTMENT</th><th>CALL TIME</th><th>DEPARTMENT</th><th>CALL TIME</th></tr></thead><tbody>${deptRows}</tbody></table>`:""}
  ${(cs.cast||[]).filter(c=>c.name).length>0?`<div class="sh">PRIMARY CAST</div><table><thead><tr><th>SR.NO</th><th>CAST</th><th>NUMBER</th><th>REACH</th><th>HMW</th><th>ON SET</th><th>NOTES</th></tr></thead><tbody>${castRows}</tbody></table>`:""}
  ${(cs.schedule||[]).filter(s=>s.scene).length>0?`<div class="sh">SHOOTING SCHEDULE</div><table><thead><tr><th>SR NO</th><th>SCENE</th><th>DESCRIPTION</th><th>CHARACTERS</th><th>COSTUMES</th><th>ETA</th></tr></thead><tbody>${shotRows}</tbody></table>`:""}
  ${cs.requirements?`<div class="sh">REQUIREMENTS</div><div style="padding:10px 14px;border:2px solid #000;border-top:none;font-size:11px;white-space:pre-wrap">${cs.requirements}</div>`:""}
  <div class="appr"><div class="ac"><b>Approved by Executive Producer:</b> ${prod?prod.name:"_______________________"}</div><div class="ac"><b>1st Assistant Director:</b> ${ad?ad.name:"_______________________"}</div></div>
  <div class="red-foot"></div>
  </div></body></html>`;
}

function CSPanel({project,allCrew,onClose}){
  const crewMap=Object.fromEntries(allCrew.map(c=>[c.id,c]));
  const defDepts=[{dept:"Director",time:"OC"},{dept:"Camera Team",time:"8:00 AM"},{dept:"DOP",time:"OC"},{dept:"Costume Team",time:"8:00 AM"},{dept:"Producer",time:"OC"},{dept:"Art Team",time:"6:00 AM"},{dept:"Client & Agency",time:"8:30 AM"},{dept:"Sound Team",time:"N/A"},{dept:"Direction Team",time:"7:00 AM"},{dept:"Make Up Team",time:"8:00 AM"},{dept:"Food Stylist",time:"7:00 AM"},{dept:"Production Support",time:"6:00 AM"},{dept:"Lighting Team",time:"6:00 AM"},{dept:"DIT",time:"8:30 AM"}];
  const[cs,setCs]=useState({projectTitle:project.title,client:project.client,productionHouse:"Frame OS",shootDate:project.shoot||"",shootDay:"1/1",crewCall:"6:00 AM",shiftStart:"7:00 AM",shiftEnd:"7:00 PM",location:project.location||"",contactOnSet:"",breakfast:"7:00 AM Onwards",lunch:"12:30 PM",snacks:"5:30 PM",weather:"Clear sky",temp:"34°- 25°",sunrise:"6:47 AM",sunset:"6:49 PM",hospital:"",decorum:"NO PERSONAL PHOTOGRAPHY ON SET · NO OPEN SHOES ON SET · NO SMOKING ON SET · DO NOT TOUCH PROPS ON SET · MAINTAIN SILENCE",crewIds:project.crewIds||[],deptCalls:defDepts,cast:[{no:1,name:"",number:"",reach:"",hmw:"",onset:"",notes:""}],schedule:[{no:1,scene:"",description:"",characters:"",costumes:"",eta:""}],requirements:""});
  const[tab,setTab]=useState("info");
  const upd=(k,v)=>setCs(s=>({...s,[k]:v}));
  const dl=()=>{const html=genCS(cs,crewMap);const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([html],{type:"text/html"}));a.download=`CallSheet_${cs.projectTitle.replace(/\s+/g,"_")}.html`;a.click();};
  const tabs=["info","crew","cast","schedule","requirements"];
  const crew=allCrew.filter(c=>(project.crewIds||[]).includes(c.id));
  return(<><div className="cs-ovl" onClick={onClose}/><div className="cs-panel">
    <div style={{padding:"18px 24px 14px",borderBottom:"1px solid var(--border)",position:"sticky",top:0,background:"#14141a",zIndex:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div><div style={{fontSize:17,fontWeight:700,color:"var(--text)"}}>Call Sheet Generator</div><div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>{cs.projectTitle}</div></div>
        <div style={{display:"flex",gap:8}}><button className="btn-p" onClick={dl}>↓ Download</button><button onClick={onClose} style={{background:"var(--bg4)",border:"1px solid var(--border)",color:"var(--text2)",width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button></div>
      </div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{tabs.map(t=><button key={t} onClick={()=>setTab(t)} style={{fontSize:11,fontFamily:"'Geist Mono',monospace",padding:"4px 12px",borderRadius:20,cursor:"pointer",background:tab===t?"var(--accent)":"transparent",color:tab===t?"#fff":"var(--text2)",border:`1px solid ${tab===t?"var(--accent)":"var(--border)"}`,textTransform:"capitalize"}}>{t}</button>)}</div>
    </div>
    {tab==="info"&&<div className="ps"><div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><Lbl ch="Production house"/><Inp value={cs.productionHouse} onChange={v=>upd("productionHouse",v)} placeholder="Frame OS Productions"/></div><div><Lbl ch="Shoot date"/><Inp type="date" value={cs.shootDate} onChange={v=>upd("shootDate",v)}/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}><div><Lbl ch="Shooting day"/><Inp value={cs.shootDay} onChange={v=>upd("shootDay",v)} placeholder="1/1"/></div><div><Lbl ch="Crew call"/><Inp value={cs.crewCall} onChange={v=>upd("crewCall",v)} placeholder="6:00 AM"/></div><div><Lbl ch="Shift start"/><Inp value={cs.shiftStart} onChange={v=>upd("shiftStart",v)} placeholder="7:00 AM"/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><Lbl ch="Shift end"/><Inp value={cs.shiftEnd} onChange={v=>upd("shiftEnd",v)} placeholder="7:00 PM"/></div><div><Lbl ch="Contact override"/><Inp value={cs.contactOnSet} onChange={v=>upd("contactOnSet",v)} placeholder="Auto from crew"/></div></div>
      <div><Lbl ch="Location"/><TA value={cs.location} onChange={v=>upd("location",v)} placeholder="Full address"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}><div><Lbl ch="Breakfast"/><Inp value={cs.breakfast} onChange={v=>upd("breakfast",v)}/></div><div><Lbl ch="Lunch"/><Inp value={cs.lunch} onChange={v=>upd("lunch",v)}/></div><div><Lbl ch="Snacks"/><Inp value={cs.snacks} onChange={v=>upd("snacks",v)}/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}><div><Lbl ch="Weather"/><Inp value={cs.weather} onChange={v=>upd("weather",v)}/></div><div><Lbl ch="Temp"/><Inp value={cs.temp} onChange={v=>upd("temp",v)}/></div><div><Lbl ch="Sunrise"/><Inp value={cs.sunrise} onChange={v=>upd("sunrise",v)}/></div><div><Lbl ch="Sunset"/><Inp value={cs.sunset} onChange={v=>upd("sunset",v)}/></div></div>
      <div><Lbl ch="Nearest hospital"/><Inp value={cs.hospital} onChange={v=>upd("hospital",v)} placeholder="Hospital name + address"/></div>
      <div><Lbl ch="Shoot decorum"/><TA value={cs.decorum} onChange={v=>upd("decorum",v)}/></div>
    </div></div>}
    {tab==="crew"&&<div className="ps">
      <div style={{fontSize:12,color:"var(--text3)",marginBottom:14}}>Auto-filled from project crew. Edit call times below.</div>
      {crew.map((c,i)=><div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--border)"}}><Av name={c.name} idx={i} size={28}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{c.name}</div><div style={{fontSize:11,color:"var(--text3)"}}>{c.role}{c.phone&&` · ${c.phone}`}</div></div><RBadge role={c.role}/></div>)}
      <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",margin:"16px 0 10px"}}>Department call times</div>
      {cs.deptCalls.map((d,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><Inp value={d.dept} onChange={v=>{const n=[...cs.deptCalls];n[i]={...n[i],dept:v};upd("deptCalls",n);}} placeholder="Department"/><Inp value={d.time} onChange={v=>{const n=[...cs.deptCalls];n[i]={...n[i],time:v};upd("deptCalls",n);}} placeholder="Call time"/></div>)}
      <button className="btn-g" style={{fontSize:12,marginTop:4}} onClick={()=>upd("deptCalls",[...cs.deptCalls,{dept:"",time:""}])}>+ Add department</button>
    </div>}
    {tab==="cast"&&<div className="ps">
      {cs.cast.map((c,i)=><div key={i} style={{background:"var(--bg3)",borderRadius:10,padding:"14px",marginBottom:10,border:"1px solid var(--border)"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Cast #{i+1}</span><button onClick={()=>upd("cast",cs.cast.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14}}>✕</button></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div><Lbl ch="Name (role)"/><Inp value={c.name} onChange={v=>{const n=[...cs.cast];n[i]={...n[i],name:v};upd("cast",n);}} placeholder="SASHA DHAWAN (Girl)"/></div><div><Lbl ch="Phone"/><Inp value={c.number} onChange={v=>{const n=[...cs.cast];n[i]={...n[i],number:v};upd("cast",n);}} placeholder="+91 98765 43210"/></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>{[["reach","Reach"],["hmw","HMW"],["onset","On Set"],["notes","Notes"]].map(([k,l])=><div key={k}><Lbl ch={l}/><Inp value={c[k]||""} onChange={v=>{const n=[...cs.cast];n[i]={...n[i],[k]:v};upd("cast",n);}} placeholder={k==="notes"?"—":"8:00 AM"}/></div>)}
        </div>
      </div>)}
      <button className="btn-g" style={{fontSize:12}} onClick={()=>upd("cast",[...cs.cast,{no:cs.cast.length+1,name:"",number:"",reach:"",hmw:"",onset:"",notes:""}])}>+ Add cast</button>
    </div>}
    {tab==="schedule"&&<div className="ps">
      {cs.schedule.map((s,i)=><div key={i} style={{background:"var(--bg3)",borderRadius:10,padding:"14px",marginBottom:10,border:"1px solid var(--border)"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Shot #{i+1}</span><button onClick={()=>upd("schedule",cs.schedule.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14}}>✕</button></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div><Lbl ch="Scene number"/><Inp value={s.scene} onChange={v=>{const n=[...cs.schedule];n[i]={...n[i],scene:v};upd("schedule",n);}} placeholder="Film 1 — SHOT 1"/></div><div><Lbl ch="ETA"/><Inp value={s.eta} onChange={v=>{const n=[...cs.schedule];n[i]={...n[i],eta:v};upd("schedule",n);}} placeholder="9:00 AM — 9:15 AM"/></div></div>
        <div style={{marginBottom:8}}><Lbl ch="Description"/><Inp value={s.description} onChange={v=>{const n=[...cs.schedule];n[i]={...n[i],description:v};upd("schedule",n);}} placeholder="Wide shot…"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><Lbl ch="Characters"/><Inp value={s.characters} onChange={v=>{const n=[...cs.schedule];n[i]={...n[i],characters:v};upd("schedule",n);}} placeholder="Girl, Boy"/></div><div><Lbl ch="Costumes"/><Inp value={s.costumes} onChange={v=>{const n=[...cs.schedule];n[i]={...n[i],costumes:v};upd("schedule",n);}} placeholder="As per director"/></div></div>
      </div>)}
      <button className="btn-g" style={{fontSize:12}} onClick={()=>upd("schedule",[...cs.schedule,{no:cs.schedule.length+1,scene:"",description:"",characters:"",costumes:"",eta:""}])}>+ Add shot</button>
    </div>}
    {tab==="requirements"&&<div className="ps"><Lbl ch="Requirements (art, F&B, costume, lighting etc)"/><TA value={cs.requirements} onChange={v=>upd("requirements",v)} placeholder={"ART:\n- Stand for product\n\nF&B:\n- Lettuce 2kg\n\nCOSTUME:\n- Smart casuals"}/></div>}
  </div></>);
}

/* ── INVOICE PANEL ── */
function InvPanel({invoice,onClose,onUpdate}){
  const[pf,setPf]=useState({amount:"",date:"",note:""});
  const rec=totalRec(invoice);const rem=invoice.amount-rec;const pct=Math.min(100,invoice.amount>0?(rec/invoice.amount)*100:0);
  const sc=SC[invoice.status]||SC["Pending"];
  const addP=()=>{const a=Number(pf.amount);if(!a||!pf.date)return;const np=[...invoice.payments,{id:Date.now(),amount:a,date:pf.date,note:pf.note}];onUpdate(invoice.id,{payments:np,status:autoSt({...invoice,payments:np})});setPf({amount:"",date:"",note:""});};
  const delP=pid=>{const np=invoice.payments.filter(p=>p.id!==pid);onUpdate(invoice.id,{payments:np,status:autoSt({...invoice,payments:np})});};
  return(<><div className="povl" onClick={onClose}/><div className="panel">
    <div style={{padding:"22px 26px 18px",borderBottom:"1px solid var(--border)",position:"sticky",top:0,background:"#14141a",zIndex:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",marginBottom:5}}>{invoice.invoiceNo}</div><div style={{fontSize:20,fontWeight:700,color:"var(--text)",marginBottom:3}}>{invoice.project}</div><div style={{fontSize:13,color:"var(--text2)"}}>{invoice.client}</div></div>
        <button onClick={onClose} style={{background:"var(--bg4)",border:"1px solid var(--border)",color:"var(--text2)",width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
      </div>
      <div style={{display:"flex",gap:10}}><Badge status={invoice.status}/><span style={{fontSize:12,color:"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>Due {invoice.due}</span></div>
    </div>
    <div className="ps">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:18}}>
        {[["Total",fmt(invoice.amount),"var(--text)"],["Received",fmt(rec),"var(--green)"],["Outstanding",fmt(Math.max(0,rem)),rem>0?"var(--red)":"var(--text3)"]].map(([l,v,c])=><div key={l} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,padding:"13px 14px"}}><div style={{fontSize:10,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:7}}>{l}</div><div style={{fontSize:16,fontWeight:600,color:c,fontFamily:"'Geist Mono',monospace"}}>{v}</div></div>)}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><span style={{fontSize:12,color:"var(--text2)"}}>Payment progress</span><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:sc.dot}}>{pct.toFixed(0)}%</span></div>
      <div style={{height:6,borderRadius:6,background:"var(--bg4)",overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,var(--green),${pct<100?"var(--amber)":"var(--green)"})`,borderRadius:6,transition:"width .6s ease"}}/></div>
    </div>
    <div className="ps">
      <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:14}}>Payment history</div>
      {invoice.payments.length===0?<div style={{fontSize:13,color:"var(--text3)",fontStyle:"italic"}}>No payments yet.</div>:invoice.payments.map((p,i)=><div key={p.id} style={{display:"flex",alignItems:"flex-start",gap:12,paddingBottom:i<invoice.payments.length-1?14:0,marginBottom:i<invoice.payments.length-1?14:0,borderBottom:i<invoice.payments.length-1?"1px solid var(--border)":"none"}}><div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}><div style={{width:10,height:10,borderRadius:"50%",background:"var(--green)",marginTop:3}}/>{i<invoice.payments.length-1&&<div style={{width:1,flex:1,background:"var(--border)",marginTop:4,minHeight:20}}/>}</div><div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:15,fontWeight:600,color:"var(--green)",fontFamily:"'Geist Mono',monospace"}}>{fmt(p.amount)}</span><span style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>{p.date}</span></div>{p.note&&<div style={{fontSize:12,color:"var(--text2)"}}>{p.note}</div>}</div><button onClick={()=>delP(p.id)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14,padding:"2px 4px"}}>✕</button></div>)}
    </div>
    {rem>0?<div className="ps"><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:14}}>Log a payment</div><div style={{display:"flex",flexDirection:"column",gap:10}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><Lbl ch="Amount (₹)"/><Inp value={pf.amount} onChange={v=>setPf(f=>({...f,amount:v}))} placeholder={`Max ${fmt(rem)}`}/></div><div><Lbl ch="Date"/><Inp type="date" value={pf.date} onChange={v=>setPf(f=>({...f,date:v}))}/></div></div><div><Lbl ch="Note"/><Inp value={pf.note} onChange={v=>setPf(f=>({...f,note:v}))} placeholder="e.g. 50% advance"/></div><button className="btn-p" style={{alignSelf:"flex-start"}} onClick={addP}>Add payment</button></div></div>:<div className="ps"><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--green)"}}><span>✓</span>Fully paid.</div></div>}
  </div></>);
}

/* ── PROJECT PANEL ── */
function ProjPanel({project,invoices,allCrew,onClose,onUpdate,onStatusChange,onAddCrew,onRemoveCrew,role,expTrackerUrl}){
  const isAdmin=role==="admin";const[showCS,setShowCS]=useState(false);
  const sc2=SC[project.status]||SC["On Hold"];const crewOnP=allCrew.filter(c=>project.crewIds.includes(c.id));
  const relInv=invoices.find(i=>i.project===project.title);
  const pm={"Pre-Production":15,"In Production":45,"Post":75,"Delivered":100,"On Hold":30};const prog=pm[project.status]||0;
  // Expense data from tracker
  const expEvents=()=>{try{const d=JSON.parse(localStorage.getItem("ym_expense_pro_final")||"{}");return Object.values(d.events||{});}catch{return[];}};
  const matchedExp=expEvents().find(ev=>(ev.brand||"").toLowerCase()===project.client.toLowerCase()||(ev.title||"").toLowerCase().includes(project.title.toLowerCase().split(" ")[0]));
  const expSpent=matchedExp?(matchedExp.rows||[]).reduce((s,r)=>s+(parseFloat(r.amt)||0),0):null;
  function CPicker(){const[open,setOpen]=useState(false);const[search,setSearch]=useState("");const ref=useRef();useEffect(()=>{if(!open)return;const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[open]);const avail=allCrew.filter(c=>!project.crewIds.includes(c.id)&&(c.name.toLowerCase().includes(search.toLowerCase())||c.role.toLowerCase().includes(search.toLowerCase())));return <div ref={ref} style={{position:"relative"}}><button className="btn-g" style={{fontSize:12,padding:"5px 14px"}} onClick={()=>setOpen(o=>!o)}>+ Add crew</button>{open&&<div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:90,background:"#1e1e24",border:"1px solid var(--border2)",borderRadius:12,padding:10,minWidth:260,maxHeight:280,overflowY:"auto",boxShadow:"0 16px 48px rgba(0,0,0,.6)"}}><input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or role…" style={{marginBottom:8,fontSize:13,padding:"7px 10px"}}/>{avail.length===0&&<div style={{fontSize:12,color:"var(--text3)",padding:"8px 4px",fontStyle:"italic"}}>No crew found.</div>}{avail.map(c=><div key={c.id} onClick={()=>{onAddCrew(project.id,c.id,false);setOpen(false);setSearch("");}} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 8px",borderRadius:8,cursor:"pointer",transition:"background .12s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--bg4)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><Av name={c.name} idx={allCrew.indexOf(c)} size={28}/><div><div style={{fontSize:13,fontWeight:500,color:"var(--text)"}}>{c.name}</div><div style={{fontSize:11,color:"var(--text3)"}}>{c.role} · {c.location}</div></div></div>)}</div>}</div>;}
  return(<>
    {showCS&&<CSPanel project={project} allCrew={allCrew} onClose={()=>setShowCS(false)}/>}
    <div className="povl" onClick={onClose}/>
    <div className="panel" style={{width:490}}>
      <div style={{padding:"22px 26px 18px",borderBottom:"1px solid var(--border)",position:"sticky",top:0,background:"#14141a",zIndex:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div style={{flex:1,minWidth:0,marginRight:12}}><div style={{fontSize:19,fontWeight:700,color:"var(--text)",marginBottom:3}}>{project.title}</div><div style={{fontSize:13,color:"var(--text2)"}}>{project.client}</div></div>
          <div style={{display:"flex",gap:8}}>
            {isAdmin&&<button className="btn-g" style={{fontSize:12,padding:"5px 12px",color:"var(--teal)",borderColor:"rgba(90,200,250,.25)"}} onClick={()=>setShowCS(true)}>📋 Call sheet</button>}
            <button onClick={onClose} style={{background:"var(--bg4)",border:"1px solid var(--border)",color:"var(--text2)",width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
          </div>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Badge status={project.status}/><span style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>{project.type}</span>{project.location&&<span style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>📍 {project.location}</span>}</div>
      </div>
      <div className="ps">
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>Production progress</span><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:sc2.dot}}>{prog}%</span></div>
        <div style={{height:4,borderRadius:4,background:"var(--bg4)",overflow:"hidden",marginBottom:10}}><div style={{height:"100%",width:`${prog}%`,background:sc2.dot,borderRadius:4,transition:"width .6s ease"}}/></div>
        <div style={{display:"flex",justifyContent:"space-between"}}>{["Pre-Prod","Shoot","Post","Delivered"].map((s,i)=>{const done=prog>=[15,45,75,100][i];return <div key={s} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:done?sc2.dot:"var(--bg4)",border:`1px solid ${done?sc2.dot:"var(--border2)"}`}}/><span style={{fontSize:10,fontFamily:"'Geist Mono',monospace",color:done?"var(--text2)":"var(--text3)"}}>{s}</span></div>;})}
        </div>
      </div>
      <div className="ps">
        <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:14}}>Details</div>
        {isAdmin?<div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div><Lbl ch="Type"/><Inp value={project.type} onChange={v=>onUpdate(project.id,{type:v})} placeholder="TVC, Brand Film, etc."/></div>
          <div><Lbl ch="Shoot Date"/><Inp type="date" value={project.shoot} onChange={v=>onUpdate(project.id,{shoot:v})}/></div>
          <div><Lbl ch="Budget (₹)"/><Inp value={project.budget} onChange={v=>onUpdate(project.id,{budget:Number(v)})} placeholder="0"/></div>
        </div>:<div>
          {[["Shoot date",project.shoot||"TBD"],["Budget","Hidden"],["Type",project.type]].map(([k,v])=><div key={k} className="drow"><span style={{fontSize:13,color:"var(--text2)"}}>{k}</span><span style={{fontSize:13,fontWeight:500,color:"var(--text)",fontFamily:k==="Budget"?"'Geist Mono',monospace":"inherit"}}>{v}</span></div>)}
        </div>}
        <div style={{paddingTop:10}}><Lbl ch="Location"/>{isAdmin?<Inp value={project.location||""} onChange={v=>onUpdate(project.id,{location:v})} placeholder="Shoot location"/>:<div style={{fontSize:13,color:"var(--text2)",paddingTop:2}}>{project.location||"—"}</div>}</div>
      </div>
      {/* Expense tracker linkage */}
      {isAdmin&&<div className="ps">
        <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:12}}>Expenses</div>
        {matchedExp&&expSpent!==null?(<div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",marginBottom:4}}>MATCHED EVENT: {matchedExp.title}</div><div style={{fontSize:16,fontWeight:700,fontFamily:"'Geist Mono',monospace",color:"var(--red)"}}>{fmt(expSpent)} spent</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",marginBottom:4}}>OF BUDGET</div><div style={{fontSize:16,fontWeight:700,fontFamily:"'Geist Mono',monospace",color:"var(--text)"}}>{fmt(project.budget)}</div></div>
          </div>
          <div style={{height:5,borderRadius:5,background:"var(--bg4)",overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:`${Math.min(100,project.budget>0?(expSpent/project.budget)*100:0)}%`,background:expSpent>project.budget?"var(--red)":"var(--amber)",borderRadius:5,transition:"width .5s"}}/></div>
          <div style={{fontSize:12,color:remaining=>remaining<0?"var(--red)":"var(--green)"}}>{fmt(project.budget-expSpent)} remaining · {((expSpent/project.budget)*100).toFixed(0)}% of budget used</div>
          <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Remaining: {fmt(Math.max(0,project.budget-expSpent))} · Burn: {((expSpent/project.budget)*100).toFixed(0)}%</div>
        </div>):(<div style={{fontSize:13,color:"var(--text3)",fontStyle:"italic",marginBottom:12}}>No matched expense event found for "{project.client}".</div>)}
        {expTrackerUrl&&<a href={expTrackerUrl} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:13,color:"var(--accent)",textDecoration:"none",fontWeight:500,background:"var(--accent-bg)",border:"1px solid var(--accent-bd)",borderRadius:9,padding:"8px 14px"}}>💰 Open Expense Tracker</a>}
      </div>}
      {isAdmin&&<div className="ps"><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:12}}>Update status</div><div style={{display:"flex",flexWrap:"wrap",gap:7}}>{PROJ_ST.map(s=>{const act=project.status===s;const ss=SC[s];return <button key={s} onClick={()=>onStatusChange(project.id,s)} style={{fontSize:12,fontFamily:"'Geist Mono',monospace",padding:"5px 12px",borderRadius:20,cursor:"pointer",transition:"all .15s",background:act?ss.bg:"transparent",color:act?ss.dot:"var(--text2)",border:`1px solid ${act?ss.bd:"var(--border)"}`,fontWeight:act?500:400}}>{s}</button>;})}</div></div>}
      <div className="ps"><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:12}}>Tags</div>{isAdmin?<ETags tags={project.tags||[]} onAdd={t=>onUpdate(project.id,{tags:[...(project.tags||[]),t]})} onDelete={t=>onUpdate(project.id,{tags:(project.tags||[]).filter(x=>x!==t)})}/>:<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{(project.tags||[]).map(t=><span key={t} className="tchip">{t}</span>)}</div>}</div>
      <div className="ps"><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:12}}>Notes</div>{isAdmin?<ENotes notes={project.notes} onSave={v=>onUpdate(project.id,{notes:v})}/>:<div style={{fontSize:13,color:"var(--text2)",lineHeight:1.7}}>{project.notes||<span style={{color:"var(--text3)",fontStyle:"italic"}}>No notes.</span>}</div>}</div>
      <div className="ps">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase"}}>Crew ({crewOnP.length})</div>
          {isAdmin&&<CPicker/>}
        </div>
        {crewOnP.length===0?<div style={{fontSize:13,color:"var(--text3)",fontStyle:"italic"}}>No crew added yet.</div>:crewOnP.map(c=><div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border)"}}><Av name={c.name} idx={allCrew.indexOf(c)} size={34}/><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}><span style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{c.name}</span><RBadge role={c.role}/></div><div style={{fontSize:12,color:"var(--text3)"}}>{c.phone&&<span>📞 {c.phone}</span>}{c.phone&&c.email&&<span> · </span>}{c.email&&<span>✉ {c.email}</span>}</div>{c.location&&<div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>📍 {c.location}</div>}</div>{isAdmin&&<button onClick={()=>onRemoveCrew(project.id,c.id)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14,padding:"4px",flexShrink:0}}>✕</button>}</div>)}
      </div>
      {relInv&&isAdmin&&<div className="ps"><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:14}}>Linked invoice</div><div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:"var(--text3)"}}>{relInv.invoiceNo}</span><Badge status={relInv.status}/></div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:14,fontWeight:600,fontFamily:"'Geist Mono',monospace",color:"var(--text)"}}>{fmt(relInv.amount)}</span><span style={{fontSize:12,color:"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>Due {relInv.due}</span></div>{totalRec(relInv)>0&&<div style={{marginTop:10}}><div style={{height:3,borderRadius:3,background:"var(--bg4)",overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,(totalRec(relInv)/relInv.amount)*100)}%`,background:"var(--green)",borderRadius:3}}/></div><div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>{fmt(totalRec(relInv))} of {fmt(relInv.amount)} received</div></div>}</div></div>}
    </div>
  </>);
}

/* ── PROJECTS VIEW ── */
function ProjectsView({allCrew,setAllCrew,role,expTrackerUrl,allVendors}){
  const isAdmin=role==="admin";
  const[projects,setProjects,loadingP,errP]=useDB("projects",mpP);
  const[rawInv,,loadingI]=useDB("invoices");
  const[rawPay]=useDB("payments");
  const invoices=rawInv.map(i=>mpI(i,rawPay));
  const[filter,setFilter]=useState("All");const[showAdd,setShowAdd]=useState(false);const[selected,setSelected]=useState(null);const[showExport,setShowExport]=useState(false);
  const[form,setForm]=useState({title:"",client:"",type:"TVC",status:"Pre-Production",shoot:"",budget:"",driveLink:"",location:"",tags:"",notes:""});
  const fset=k=>v=>setForm(f=>({...f,[k]:v}));
  const shown=filter==="All"?projects:projects.filter(p=>p.status===filter);
  const totalBudget=projects.reduce((s,p)=>s+p.budget,0);
  const upd=async(id,patch)=>{
    if(!isAdmin)return;
    const p=projects.find(x=>x.id===id);if(!p)return;
    const next={...p,...patch};
    setProjects(ps=>ps.map(x=>x.id===id?next:x));
    await dbUpsertProject(next);
  };
  const addCrew=async(pid,cid,isNew)=>{
    const proj=projects.find(p=>p.id===pid);if(!proj)return;
    if(isNew){
      const saved=await dbUpsertCrew({...cid,projects:[pid]});
      setAllCrew(c=>[...c,saved]);
      const next={...proj,crewIds:[...proj.crewIds,saved.id]};
      setProjects(ps=>ps.map(p=>p.id===pid?next:p));
      await dbUpsertProject(next);
    } else {
      const next={...proj,crewIds:[...proj.crewIds,cid]};
      setProjects(ps=>ps.map(p=>p.id===pid?next:p));
      await dbUpsertProject(next);
      const cm=allCrew.find(m=>m.id===cid);
      if(cm){const cu={...cm,projects:[...cm.projects,pid]};setAllCrew(c=>c.map(m=>m.id===cid?cu:m));await dbUpsertCrew(cu);}
    }
  };
  const remCrew=async(pid,cid)=>{
    const proj=projects.find(p=>p.id===pid);if(!proj)return;
    const next={...proj,crewIds:proj.crewIds.filter(x=>x!==cid)};
    setProjects(ps=>ps.map(p=>p.id===pid?next:p));
    await dbUpsertProject(next);
    const cm=allCrew.find(m=>m.id===cid);
    if(cm){const cu={...cm,projects:cm.projects.filter(x=>x!==pid)};setAllCrew(c=>c.map(m=>m.id===cid?cu:m));await dbUpsertCrew(cu);}
  };
  const doAdd=async()=>{
    if(!form.title.trim()||!form.client.trim())return;
    const tags=form.tags.split(",").map(t=>t.trim()).filter(Boolean);
    const saved=await dbUpsertProject({...form,crewIds:[],budget:Number(form.budget)||0,tags,id:Date.now()});
    setProjects(ps=>[...ps,saved]);
    setForm({title:"",client:"",type:"TVC",status:"Pre-Production",shoot:"",budget:"",driveLink:"",location:"",tags:"",notes:""});
    setShowAdd(false);
  };
  const selP=selected?projects.find(p=>p.id===selected.id):null;
  if(loadingP)return <LoadingScreen msg="Loading projects…"/>;
  if(errP)return <ErrScreen msg={errP}/>;
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}} className="g4">
      <SC2 label="Projects" value={projects.length} color="var(--text)" icon="🎬" delay={0}/>
      <SC2 label="Active" value={projects.filter(p=>p.status==="In Production").length} color="var(--accent)" icon="🎥" delay={50}/>
      <SC2 label="Delivered" value={projects.filter(p=>p.status==="Delivered").length} color="var(--green)" icon="✓" delay={100}/>
      {isAdmin?<SC2 label="Pipeline" value={`₹${(totalBudget/100000).toFixed(1)}L`} color="var(--text)" icon="₹" delay={150}/>:<SC2 label="Pre-Prod" value={projects.filter(p=>p.status==="Pre-Production").length} color="var(--teal)" icon="📅" delay={150}/>}
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:18}}>
      {["All",...PROJ_ST].map(s=><button key={s} className={`fpill${filter===s?" active":""}`} onClick={()=>setFilter(s)}>{s}</button>)}
      <div style={{flex:1}}/>{isAdmin&&<><button className="btn-g" onClick={()=>setShowExport(true)}>📊 Export</button><button className="btn-p" onClick={()=>setShowAdd(true)}>+ New project</button></>}
    </div>
    <div style={{fontSize:12,color:"var(--text3)",marginBottom:14,fontFamily:"'Geist Mono',monospace"}}>↗ tap card to view · {isAdmin&&"📋 call sheet inside panel"}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}} className="g2">
      {shown.map((p,i)=>{
        const sc2=SC[p.status]||SC["On Hold"];const crew=allCrew.filter(c=>p.crewIds.includes(c.id));
        return <div key={p.id} className="card clickable fade-up" style={{padding:"20px 22px",animationDelay:`${i*55}ms`,position:"relative",overflow:"hidden"}} onClick={()=>setSelected(p)}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${sc2.dot}55,transparent)`}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,gap:10}}>
            <div style={{minWidth:0}}><div style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.title}</div><div style={{fontSize:13,color:"var(--text2)"}}>{p.client}</div></div>
            <Badge status={p.status}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,paddingBottom:12,borderBottom:"1px solid var(--border)",marginBottom:12}}>
            {[["TYPE",p.type],["SHOOT",p.shoot||"TBD"]].map(([k,v])=><div key={k}><div style={{fontSize:10,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.06em",marginBottom:3}}>{k}</div><div style={{fontSize:13,color:"var(--text2)"}}>{v}</div></div>)}
            {isAdmin?<div style={{textAlign:"right"}}><div style={{fontSize:10,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.06em",marginBottom:3}}>BUDGET</div><div style={{fontSize:15,fontWeight:600,color:"var(--text)",fontFamily:"'Geist Mono',monospace"}}>{fmtK(p.budget)}</div></div>:<div/>}
          </div>
          {p.location&&<div style={{fontSize:11,color:"var(--text3)",marginBottom:8,fontFamily:"'Geist Mono',monospace"}}>📍 {p.location}</div>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{(p.tags||[]).slice(0,3).map(t=><span key={t} className="tchip">{t}</span>)}</div>
            <div style={{display:"flex"}}>{crew.slice(0,4).map((c,j)=><div key={c.id} style={{marginLeft:j>0?-7:0,zIndex:10-j}}><Av name={c.name} idx={allCrew.indexOf(c)} size={24}/></div>)}{crew.length>4&&<div style={{width:24,height:24,borderRadius:"50%",background:"var(--bg4)",border:"2px solid var(--bg2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"var(--text3)",marginLeft:-7}}>+{crew.length-4}</div>}</div>
          </div>
          <div style={{position:"absolute",bottom:14,right:18,fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",opacity:.6}}>View →</div>
        </div>;
      })}
    </div>
    {showExport&&<ExportModal onClose={()=>setShowExport(false)} allProjects={projects} allCrew={allCrew} allVendors={allVendors}/>}
    {selP&&<ProjPanel project={selP} invoices={invoices} allCrew={allCrew} onClose={()=>setSelected(null)} onUpdate={upd} onStatusChange={(id,s)=>upd(id,{status:s})} onAddCrew={addCrew} onRemoveCrew={remCrew} role={role} expTrackerUrl={expTrackerUrl}/>}
    {showAdd&&<Modal title="New project" onClose={()=>setShowAdd(false)}><div style={{display:"flex",flexDirection:"column",gap:13}}>
      <div><Lbl ch="Title"/><Inp value={form.title} onChange={fset("title")} placeholder="Nike AW26 Campaign"/></div>
      <div><Lbl ch="Client"/><Inp value={form.client} onChange={fset("client")} placeholder="Client name"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><Lbl ch="Type"/><Sel value={form.type} onChange={fset("type")} options={["TVC","Brand Film","Product Shoot","Documentary","Corporate","Digital"]}/></div><div><Lbl ch="Status"/><Sel value={form.status} onChange={fset("status")} options={PROJ_ST}/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><Lbl ch="Shoot date"/><Inp type="date" value={form.shoot} onChange={fset("shoot")}/></div><div><Lbl ch="Budget (₹)"/><Inp value={form.budget} onChange={fset("budget")} placeholder="250000"/></div></div>
      <div><Lbl ch="Location"/><Inp value={form.location} onChange={fset("location")} placeholder="Mumbai Studio, Bandra"/></div>
      <div><Lbl ch="Drive URL"/><Inp value={form.driveLink} onChange={fset("driveLink")} placeholder="https://drive.google.com/…"/></div>
      <div><Lbl ch="Tags"/><Inp value={form.tags} onChange={fset("tags")} placeholder="fashion, TVC"/></div>
      <div><Lbl ch="Notes"/><Inp value={form.notes} onChange={fset("notes")} placeholder="Any notes…"/></div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:4}}><button className="btn-g" onClick={()=>setShowAdd(false)}>Cancel</button><button className="btn-p" onClick={doAdd}>Add project</button></div>
    </div></Modal>}
  </div>);
}

/* ── FINANCE VIEW ── */
function FinanceView(){
  const[rawInv,,loadingI,errI,refetchI]=useDB("invoices");
  const[rawPay,,loadingP,,refetchP]=useDB("payments");
  const invoices=rawInv.map(i=>mpI(i,rawPay));
  const[showAdd,setShowAdd]=useState(false);const[selected,setSelected]=useState(null);
  const[form,setForm]=useState({invoiceNo:"",project:"",client:"",amount:"",status:"Pending",due:""});
  const fset=k=>v=>setForm(f=>({...f,[k]:v}));
  const upd=async(id,patch)=>{
    const inv=invoices.find(i=>i.id===id);if(!inv)return;
    const next={...inv,...patch};
    if(patch.payments){
      const existing=rawPay.filter(p=>Number(p.invoice_id)===Number(id));
      for(const ep of existing){if(!next.payments.find(p=>p.id===ep.id))await dbDelPayment(ep.id);}
      for(const np of next.payments){if(!existing.find(p=>p.id===np.id))await dbAddPayment(id,np);}
      await dbUpsertInvoice({...next,payments:[]});
      refetchP();refetchI();
    } else {
      await dbUpsertInvoice(next);
      refetchI();
    }
  };
  const paid=invoices.filter(i=>i.status==="Paid").reduce((s,i)=>s+i.amount,0);
  const partial=invoices.filter(i=>i.status==="Partial").reduce((s,i)=>s+totalRec(i),0);
  const pending=invoices.filter(i=>["Pending","Partial"].includes(i.status)).reduce((s,i)=>s+(i.amount-totalRec(i)),0);
  const overdue=invoices.filter(i=>i.status==="Overdue").reduce((s,i)=>s+i.amount,0);
  const total=invoices.reduce((s,i)=>s+i.amount,0)||1;
  const doAdd=async()=>{
    if(!form.project.trim()||!form.amount)return;
    await dbUpsertInvoice({...form,amount:Number(form.amount),payments:[]});
    refetchI();
    setForm({invoiceNo:"",project:"",client:"",amount:"",status:"Pending",due:""});
    setShowAdd(false);
  };
  const expCSV=()=>{const rows=[["Invoice No","Project","Client","Total","Received","Status","Due"],...invoices.map(i=>[i.invoiceNo,i.project,i.client,i.amount,totalRec(i),i.status,i.due])];const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"}));a.download="invoices.csv";a.click();};
  const selInv=selected?invoices.find(i=>i.id===selected):null;
  const[isMobile,setIsMobile]=useState(()=>window.innerWidth<=768);
  useEffect(()=>{const h=()=>setIsMobile(window.innerWidth<=768);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  if(loadingI||loadingP)return <LoadingScreen msg="Loading finance…"/>;
  if(errI)return <ErrScreen msg={errI}/>;
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}} className="g4">
      <SC2 label="Collected" value={fmtK(paid+partial)} sub={`${invoices.filter(i=>i.status==="Paid").length} fully paid`} color="var(--green)" icon="✓" delay={0}/>
      <SC2 label="Partial" value={fmtK(partial)} sub={`${invoices.filter(i=>i.status==="Partial").length} invoices`} color="var(--orange)" icon="◑" delay={50}/>
      <SC2 label="Outstanding" value={fmtK(pending)} sub={`${invoices.filter(i=>["Pending","Partial"].includes(i.status)).length}`} color="var(--amber)" icon="⏳" delay={100}/>
      <SC2 label="Overdue" value={fmtK(overdue)} sub={`${invoices.filter(i=>i.status==="Overdue").length} invoices`} color="var(--red)" icon="⚠" delay={150}/>
    </div>
    <div className="card" style={{padding:"16px 20px",marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:13,color:"var(--text2)",fontWeight:500}}>Revenue overview</span><span style={{fontSize:15,fontWeight:600,fontFamily:"'Geist Mono',monospace"}}>{fmt(total)} total</span></div>
      <div style={{height:5,borderRadius:5,overflow:"hidden",display:"flex",background:"var(--bg4)"}}>{[[paid+partial,"var(--green)"],[pending,"var(--amber)"],[overdue,"var(--red)"]].map(([v,c],idx)=><div key={idx} style={{width:`${(v/total)*100}%`,background:c,transition:"width .5s ease"}}/>)}</div>
      <div style={{display:"flex",gap:16,marginTop:10}}>{[["Collected","var(--green)",paid+partial],["Outstanding","var(--amber)",pending],["Overdue","var(--red)",overdue]].map(([l,c,v])=><div key={l} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:7,height:7,borderRadius:2,background:c}}/><span style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>{l} {((v/total)*100).toFixed(0)}%</span></div>)}</div>
    </div>
    <div style={{fontSize:12,color:"var(--text3)",marginBottom:12,fontFamily:"'Geist Mono',monospace"}}>✎ click amount · click badge · click row to open</div>
    <div style={{display:"flex",gap:10,marginBottom:14}}><button className="btn-p" onClick={()=>setShowAdd(true)}>+ New invoice</button><button className="btn-g" onClick={expCSV}>↓ Export CSV</button></div>
    <div className="fscroll"><div className="card" style={{overflow:"visible"}}>
      <div style={{display:"grid",gridTemplateColumns:"1.1fr 2fr 1fr 1.4fr 1fr 1.4fr",background:"var(--bg3)",borderBottom:"1px solid var(--border)",borderRadius:"12px 12px 0 0",minWidth:540}}>
        {["Invoice","Project","Client","Amount","Due","Status"].map(h=><div key={h} style={{padding:"10px 16px",fontSize:10,fontFamily:"'Geist Mono',monospace",color:"var(--text3)",letterSpacing:"0.07em",textTransform:"uppercase"}}>{h}</div>)}
      </div>
      {invoices.map((inv,i)=>{const rec=totalRec(inv);return <div key={inv.id} className="row-h fade-up" style={{display:"grid",gridTemplateColumns:"1.1fr 2fr 1fr 1.4fr 1fr 1.4fr",borderBottom:i<invoices.length-1?"1px solid var(--border)":"none",alignItems:"center",animationDelay:`${i*45}ms`,cursor:"pointer",minWidth:540}} onClick={e=>{if(!e.target.closest("[data-nc]"))setSelected(inv.id);}}>
        <div style={{padding:"13px 16px",fontSize:11,fontFamily:"'Geist Mono',monospace",color:"var(--text3)"}}>{inv.invoiceNo}</div>
        <div style={{padding:"13px 16px",fontSize:14,fontWeight:500,color:"var(--text)"}}>{inv.project}</div>
        <div style={{padding:"13px 16px",fontSize:13,color:"var(--text2)"}}>{inv.client}</div>
        <div data-nc="1" onClick={e=>e.stopPropagation()} style={{minWidth:0}}><ACell value={inv.amount} onChange={v=>upd(inv.id,{amount:v})}/>{rec>0&&rec<inv.amount&&<div style={{paddingLeft:16,paddingBottom:4}}><div style={{height:2,background:"var(--bg4)",borderRadius:2,overflow:"hidden",width:"80%"}}><div style={{height:"100%",width:`${(rec/inv.amount)*100}%`,background:"var(--green)",borderRadius:2}}/></div><div style={{fontSize:10,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",marginTop:2}}>{fmt(rec)} rec.</div></div>}</div>
        <div style={{padding:"13px 16px",fontSize:12,fontFamily:"'Geist Mono',monospace",color:"var(--text2)"}}>{inv.due}</div>
        <div data-nc="1" onClick={e=>e.stopPropagation()}><StCell status={inv.status} onChange={st=>upd(inv.id,{status:st})}/></div>
      </div>;})}
    </div></div>
    {selInv&&<InvPanel invoice={selInv} onClose={()=>setSelected(null)} onUpdate={upd}/>}
    {showAdd&&<Modal title="New invoice" onClose={()=>setShowAdd(false)}><div style={{display:"flex",flexDirection:"column",gap:13}}>
      <div><Lbl ch="Invoice number"/><Inp value={form.invoiceNo} onChange={fset("invoiceNo")} placeholder="INV-2026-005"/></div>
      <div><Lbl ch="Project"/><Inp value={form.project} onChange={fset("project")} placeholder="Project name"/></div>
      <div><Lbl ch="Client"/><Inp value={form.client} onChange={fset("client")} placeholder="Client name"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><Lbl ch="Amount (₹)"/><Inp value={form.amount} onChange={fset("amount")} placeholder="150000"/></div><div><Lbl ch="Due date"/><Inp type="date" value={form.due} onChange={fset("due")}/></div></div>
      <div><Lbl ch="Status"/><Sel value={form.status} onChange={fset("status")} options={INV_ST}/></div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:4}}><button className="btn-g" onClick={()=>setShowAdd(false)}>Cancel</button><button className="btn-p" onClick={doAdd}>Add invoice</button></div>
    </div></Modal>}
  </div>);
}

/* ── CLIENTS VIEW ── */
function ClientsView({role}){
  const isAdmin=role==="admin";
  const[rawProj]=useDB("projects",mpP);const[rawInvC]=useDB("invoices");const[rawPayC]=useDB("payments");
  const projects=rawProj;const invoices=rawInvC.map(i=>mpI(i,rawPayC));
  const[selected,setSelected]=useState(null);
  const names=[...new Set([...projects.map(p=>p.client),...invoices.map(i=>i.client)])];
  const clients=names.map((name,idx)=>{const cP=projects.filter(p=>p.client===name);const cI=invoices.filter(i=>i.client===name);const tb=cI.reduce((s,i)=>s+i.amount,0);const tr=cI.reduce((s,i)=>s+totalRec(i),0);return{name,projects:cP,invoices:cI,totalBilled:tb,totalReceived:tr,outstanding:tb-tr,hasOverdue:cI.some(i=>i.status==="Overdue"),hasPending:cI.some(i=>["Pending","Partial"].includes(i.status)),isRegular:cP.length>=2,idx};});
  const sel=selected?clients.find(c=>c.name===selected):null;
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}} className="g3">
      <SC2 label="Total clients" value={clients.length} color="var(--text)" icon="🏢" delay={0}/>
      <SC2 label="Regular" value={clients.filter(c=>c.isRegular).length} color="var(--accent)" icon="⭐" delay={50}/>
      <SC2 label="Outstanding" value={clients.filter(c=>c.outstanding>0).length} color="var(--amber)" icon="⏳" delay={100}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}} className="g2">
      {clients.map((c,i)=>{const initials=c.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);return <div key={c.name} className="card clickable fade-up" style={{padding:"20px 22px",animationDelay:`${i*55}ms`,position:"relative",overflow:"hidden"}} onClick={()=>setSelected(c.name)}>
        {c.hasOverdue&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"var(--red)"}}/>}
        {!c.hasOverdue&&c.hasPending&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"var(--amber)"}}/>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
            <div style={{width:44,height:44,borderRadius:11,background:BRAND_GRADS[i%BRAND_GRADS.length],display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 14px rgba(0,0,0,.35)"}}><span style={{fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.92)",fontFamily:"'Geist',sans-serif"}}>{initials}</span></div>
            <div style={{minWidth:0}}><div style={{fontSize:15,fontWeight:600,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:4}}>{c.name}</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{c.isRegular&&<span style={{fontSize:10,fontFamily:"'Geist Mono',monospace",background:"var(--accent-bg)",color:"var(--accent)",border:"1px solid var(--accent-bd)",borderRadius:20,padding:"1px 7px"}}>Regular</span>}{c.hasOverdue&&isAdmin&&<span style={{fontSize:10,fontFamily:"'Geist Mono',monospace",background:"var(--red-bg)",color:"var(--red)",border:"1px solid rgba(255,69,58,.2)",borderRadius:20,padding:"1px 7px"}}>Overdue</span>}</div></div>
          </div>
          {isAdmin&&<div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:10,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",marginBottom:3}}>BILLED</div><div style={{fontSize:15,fontWeight:600,color:"var(--text)",fontFamily:"'Geist Mono',monospace"}}>{fmtK(c.totalBilled)}</div></div>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:isAdmin?"1fr 1fr 1fr":"1fr",gap:10,paddingTop:12,borderTop:"1px solid var(--border)"}}>
          <div><div style={{fontSize:10,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",marginBottom:3}}>PROJECTS</div><div style={{fontSize:13,fontWeight:600,color:"var(--text)",fontFamily:"'Geist Mono',monospace"}}>{c.projects.length}</div></div>
          {isAdmin&&<div><div style={{fontSize:10,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",marginBottom:3}}>RECEIVED</div><div style={{fontSize:13,fontWeight:600,color:"var(--green)",fontFamily:"'Geist Mono',monospace"}}>{fmtK(c.totalReceived)}</div></div>}
          {isAdmin&&<div><div style={{fontSize:10,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",marginBottom:3}}>OUTSTANDING</div><div style={{fontSize:13,fontWeight:600,color:c.outstanding>0?"var(--red)":"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>{c.outstanding>0?fmtK(c.outstanding):"—"}</div></div>}
        </div>
        <div style={{position:"absolute",bottom:14,right:18,fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",opacity:.6}}>View →</div>
      </div>;})}
    </div>
    {sel&&(<><div className="povl" onClick={()=>setSelected(null)}/><div className="panel">
      <div style={{padding:"22px 26px 18px",borderBottom:"1px solid var(--border)",position:"sticky",top:0,background:"#14141a",zIndex:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:52,height:52,borderRadius:14,background:BRAND_GRADS[sel.idx%BRAND_GRADS.length],display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 6px 20px rgba(0,0,0,.4)"}}><span style={{fontSize:18,fontWeight:700,color:"rgba(255,255,255,0.92)"}}>{sel.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)}</span></div>
            <div><div style={{fontSize:19,fontWeight:700,color:"var(--text)"}}>{sel.name}</div><div style={{display:"flex",gap:6,marginTop:4}}>{sel.isRegular&&<span style={{fontSize:11,fontFamily:"'Geist Mono',monospace",background:"var(--accent-bg)",color:"var(--accent)",border:"1px solid var(--accent-bd)",borderRadius:20,padding:"2px 9px"}}>Regular</span>}{sel.hasOverdue&&isAdmin&&<span style={{fontSize:11,fontFamily:"'Geist Mono',monospace",background:"var(--red-bg)",color:"var(--red)",border:"1px solid rgba(255,69,58,.2)",borderRadius:20,padding:"2px 9px"}}>⚠ Overdue</span>}</div></div>
          </div>
          <button onClick={()=>setSelected(null)} style={{background:"var(--bg4)",border:"1px solid var(--border)",color:"var(--text2)",width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
      </div>
      {isAdmin&&<div className="ps"><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:14}}>Financial summary</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}} className="g2">
          {[["Total billed",fmt(sel.totalBilled),"var(--text)"],["Received",fmt(sel.totalReceived),"var(--green)"],["Outstanding",fmt(sel.outstanding),sel.outstanding>0?"var(--red)":"var(--text3)"],["Projects",sel.projects.length,"var(--accent)"]].map(([k,v,c])=><div key={k} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",textTransform:"uppercase",marginBottom:6}}>{k}</div><div style={{fontSize:16,fontWeight:600,color:c,fontFamily:"'Geist Mono',monospace"}}>{v}</div></div>)}
        </div>
        {sel.outstanding>0&&<div style={{background:"rgba(255,69,58,.06)",border:"1px solid rgba(255,69,58,.18)",borderRadius:9,padding:"11px 14px",display:"flex",alignItems:"center",gap:8}}><span>⚠</span><span style={{fontSize:13,color:"var(--red)"}}>{fmt(sel.outstanding)} pending. Follow up required.</span></div>}
      </div>}
      <div className="ps"><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:14}}>Projects ({sel.projects.length})</div>{sel.projects.map(p=><div key={p.id} className="drow"><div><div style={{fontSize:13,fontWeight:500,color:"var(--text)",marginBottom:3}}>{p.title}</div><div style={{fontSize:11,color:"var(--text3)"}}>{p.type} · {p.shoot||"TBD"}{p.location&&` · 📍 ${p.location}`}</div></div><div style={{textAlign:"right"}}><Badge status={p.status}/>{isAdmin&&<div style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:"var(--text2)",marginTop:5}}>{fmt(p.budget)}</div>}</div></div>)}</div>
      {isAdmin&&<div className="ps"><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:14}}>Invoices ({sel.invoices.length})</div>{sel.invoices.map(inv=>{const rec=totalRec(inv);return <div key={inv.id} style={{background:"var(--bg3)",border:`1px solid ${inv.status==="Overdue"?"rgba(255,69,58,.25)":inv.status==="Partial"?"rgba(255,159,10,.2)":"var(--border)"}`,borderRadius:10,padding:"14px 16px",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,fontFamily:"'Geist Mono',monospace",color:"var(--text3)"}}>{inv.invoiceNo}</span><Badge status={inv.status}/></div><div style={{display:"flex",justifyContent:"space-between",marginBottom:rec>0?8:0}}><span style={{fontSize:14,fontWeight:600,color:"var(--text)",fontFamily:"'Geist Mono',monospace"}}>{fmt(inv.amount)}</span><span style={{fontSize:12,color:"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>Due {inv.due}</span></div>{rec>0&&<div><div style={{height:3,background:"var(--bg4)",borderRadius:3,overflow:"hidden",marginBottom:4}}><div style={{height:"100%",width:`${Math.min(100,(rec/inv.amount)*100)}%`,background:"var(--green)",borderRadius:3}}/></div><div style={{fontSize:11,color:"var(--text3)"}}>{fmt(rec)} received · {fmt(inv.amount-rec)} outstanding</div></div>}{inv.status==="Overdue"&&<div style={{marginTop:8,fontSize:12,color:"var(--red)"}}>⚠ {fmt(inv.amount-rec)} unpaid</div>}</div>;})}</div>}
    </div></>)}
  </div>);
}

/* ── CREW VIEW ── */
/* ── CUSTOM DESIGNATIONS MODAL (NEW) ── */
function OtherDesignationsModal({onClose}){
  const[designations,setDesignations]=usePersist("frameOS_customDesignations",["Senior Producer","Product Designer","DOP","Editor","Sound Designer","VFX Artist","Gaffer","Assistant Director"]);
  const[newDes,setNewDes]=useState("");
  const add=()=>{if(!newDes.trim()){alert("Enter a designation");return;}if(designations.includes(newDes)){alert("Already exists");return;}setDesignations([...designations,newDes]);setNewDes("");};
  const remove=(d)=>setDesignations(designations.filter(x=>x!==d));
  return<Modal title="Manage Crew Designations" onClose={onClose} wide>
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:9,padding:13,fontSize:13,color:"var(--text2)",lineHeight:1.7}}>Add or remove custom crew roles. These will appear in the crew dropdown when adding team members.</div>
      <div style={{display:"flex",gap:10}}><input type="text" value={newDes} onChange={(e)=>setNewDes(e.target.value)} placeholder="Enter new designation (e.g., Senior Producer)" style={{flex:1,border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text)",borderRadius:6,padding:"9px 12px",fontSize:13}}/><button className="btn-p" onClick={add}>Add</button></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,maxHeight:300,overflowY:"auto"}}>{designations.map(d=><div key={d} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:6,padding:12,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}><span>{d}</span><button onClick={()=>remove(d)} style={{fontSize:16,color:"var(--text3)",width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer"}}>×</button></div>)}</div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:4}}><button className="btn-g" onClick={onClose}>Close</button></div>
    </div>
  </Modal>;
}

/* ── VENDOR MANAGEMENT MODAL (NEW) ── */
function VendorModal({onClose,vendors,setVendors}){
  const[edit,setEdit]=useState(null);const[search,setSearch]=useState("");const[categoryFilter,setCategoryFilter]=useState("All");
  const CATEGORIES=["Camera","Grip","Lighting","Catering","Transport","Locations","Post-Production","Other"];
  const filtered=vendors.filter(v=>(categoryFilter==="All"||v.category===categoryFilter)&&(v.name.toLowerCase().includes(search.toLowerCase())||v.contact.toLowerCase().includes(search.toLowerCase())));
  const openAdd=()=>setEdit({id:Date.now(),name:"",category:"Camera",contact:"",phone:"",email:"",location:"",rate:"",notes:""});
  const openEdit=(v)=>setEdit({...v});
  const closeEdit=()=>setEdit(null);
  const save=async()=>{if(!edit.name.trim()){alert("Enter vendor name");return;}if(!edit.phone.trim()&&!edit.email.trim()){alert("Enter phone or email");return;}const updated=edit.id<2e13?vendors.map(v=>v.id===edit.id?edit:v):[...vendors,edit];setVendors(updated);await dbUpsertVendor(edit);closeEdit();};
  const delete_=async(id)=>{if(!confirm("Delete vendor?"))return;setVendors(vendors.filter(v=>v.id!==id));await dbDeleteVendor(id);};
  return<Modal title="Manage Vendors" onClose={onClose} wide>
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:180}}><label style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Search vendors</label><input type="text" value={search} onChange={(e)=>setSearch(e.target.value) placeholder="Name or contact..." style={{width:"100%",border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text)",borderRadius:6,padding:"9px 12px",fontSize:13}}/></div>
        <div><label style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Category</label><select value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value) style={{border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text)",borderRadius:6,padding:"9px 12px",fontSize:13}}><option>All</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
        <button className="btn-p" onClick={openAdd}>+ Add Vendor</button>
      </div>
      <div style={{maxHeight:400,overflowY:"auto"}}>{filtered.length===0?<div style={{textAlign:"center",padding:40,color:"var(--text3)",fontSize:13}}>No vendors found</div>:<div style={{display:"grid",gap:10}}>{filtered.map(v=><div key={v.id} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:9,padding:14,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600}}>{v.name}</div><div style={{fontSize:12,color:"var(--text2)",marginTop:4}}><div>{v.category} · {v.location}</div>{v.phone&&<div>☎ {v.phone}</div>}{v.email&&<div>✉ {v.email}</div>}{v.rate&&<div>Rate: {v.rate}</div>}</div></div><div style={{display:"flex",gap:6,flexShrink:0}}><button className="btn-g" onClick={()=>openEdit(v)} style={{padding:"6px 12px"}}>Edit</button><button className="btn-r" onClick={()=>delete_(v.id)} style={{padding:"6px 12px"}}>Delete</button></div></div>)}</div>}</div>
      {edit&&<Modal title={edit.id<2e13?"Edit Vendor":"Add Vendor"} onClose={closeEdit}><div style={{display:"flex",flexDirection:"column",gap:12}}><div><label style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Vendor Name</label><input type="text" value={edit.name} onChange={(v)=>setEdit({...edit,name:v}) placeholder="e.g., Sony Rentals" style={{width:"100%",border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text)",borderRadius:6,padding:"9px 12px",fontSize:13}}/></div><div><label style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Category</label><select value={edit.category} onChange={(e)=>setEdit({...edit,category:e.target.value}) style={{width:"100%",border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text)",borderRadius:6,padding:"9px 12px",fontSize:13}}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div><div><label style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Contact Person</label><input type="text" value={edit.contact} onChange={(v)=>setEdit({...edit,contact:v}) style={{width:"100%",border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text)",borderRadius:6,padding:"9px 12px",fontSize:13}}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><label style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Phone</label><input type="text" value={edit.phone} onChange={(v)=>setEdit({...edit,phone:v}) style={{width:"100%",border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text)",borderRadius:6,padding:"9px 12px",fontSize:13}}/></div><div><label style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Email</label><input type="text" value={edit.email} onChange={(v)=>setEdit({...edit,email:v}) style={{width:"100%",border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text)",borderRadius:6,padding:"9px 12px",fontSize:13}}/></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><label style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Location</label><input type="text" value={edit.location} onChange={(v)=>setEdit({...edit,location:v}) style={{width:"100%",border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text)",borderRadius:6,padding:"9px 12px",fontSize:13}}/></div><div><label style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Rate/Budget</label><input type="text" value={edit.rate} onChange={(v)=>setEdit({...edit,rate:v}) style={{width:"100%",border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text)",borderRadius:6,padding:"9px 12px",fontSize:13}}/></div></div><div><label style={{fontSize:12,fontWeight:600,color:"var(--text2)"}}>Notes</label><textarea value={edit.notes} onChange={(e)=>setEdit({...edit,notes:e.target.value}) placeholder="Additional details..." style={{width:"100%",border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text)",borderRadius:6,padding:"9px 12px",fontSize:13,minHeight:80}}/></div><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:4}}><button className="btn-g" onClick={closeEdit}>Cancel</button><button className="btn-p" onClick={save}>Save Vendor</button></div></div></Modal>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:4}}><button className="btn-g" onClick={onClose}>Close</button></div>
    </div>
  </Modal>;
}

/* ── EXPORT MODAL (NEW) ── */
function ExportModal({onClose,allProjects,allCrew,allVendors}){
  const exportAll=(format)=>{
    const projectData=allProjects.map(p=>({Title:p.title,Client:p.client,Type:p.type,Status:p.status,"Shoot Date":p.shoot,Budget:p.budget,Location:p.location,Notes:p.notes}));
    const crewData=allCrew.map(c=>({Name:c.name,Role:c.role,Phone:c.phone,Email:c.email,Location:c.location,Notes:c.notes}));
    const vendorData=allVendors.map(v=>({Name:v.name,Category:v.category,Contact:v.contact,Phone:v.phone,Email:v.email,Location:v.location,Rate:v.rate}));
    if(format==="pdf"){exportToPDF("Frame OS - Complete Export",[{heading:"Projects",rows:projectData},{heading:"Crew",rows:crewData},{heading:"Vendors",rows:vendorData}]);}
    else if(format==="csv"){exportToCSV(projectData,"Projects");exportToCSV(crewData,"Crew");exportToCSV(vendorData,"Vendors");}
  };
  return<Modal title="Export Data" onClose={onClose}><div style={{display:"flex",flexDirection:"column",gap:14}}><div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:9,padding:13,fontSize:13,color:"var(--text2)",lineHeight:1.7}}>Export all projects, crew, and vendor data in your preferred format.</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}><button onClick={()=>exportAll("pdf")} style={{background:"var(--accent-bg)",border:"1px solid var(--accent-bd)",borderRadius:8,padding:16,textAlign:"center",fontSize:13,fontWeight:600,color:"var(--accent)",cursor:"pointer"}}>📄 PDF</button><button onClick={()=>exportAll("csv")} style={{background:"var(--accent-bg)",border:"1px solid var(--accent-bd)",borderRadius:8,padding:16,textAlign:"center",fontSize:13,fontWeight:600,color:"var(--accent)",cursor:"pointer"}}>📊 CSV</button></div><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:4}}><button className="btn-g" onClick={onClose}>Close</button></div></div></Modal>;
}

function CrewView({allCrew,setAllCrew,projects,role}){
  const isAdmin=role==="admin";
  const[customDesignations]=usePersist("frameOS_customDesignations",["Senior Producer","Product Designer","DOP","Editor","Sound Designer","VFX Artist","Gaffer","Assistant Director"]);
  const[filterR,setFilterR]=useState("All");const[search,setSearch]=useState("");const[showAdd,setShowAdd]=useState(false);const[selected,setSelected]=useState(null);const[showDesignations,setShowDesignations]=useState(false);
  const allRoleOptions=[...CREW_ROLES,...customDesignations.filter(d=>!CREW_ROLES.includes(d))];
  const[form,setForm]=useState({name:"",role:"DOP",phone:"",email:"",location:"",tags:"",notes:""});const fset=k=>v=>setForm(f=>({...f,[k]:v}));
  const shown=allCrew.filter(c=>(filterR==="All"||c.role===filterR)&&(c.name.toLowerCase().includes(search.toLowerCase())||c.role.toLowerCase().includes(search.toLowerCase())));
  const updM=async(id,patch)=>{
    if(!isAdmin)return;
    const m=allCrew.find(x=>x.id===id);if(!m)return;
    const next={...m,...patch};
    setAllCrew(c=>c.map(x=>x.id===id?next:x));
    await dbUpsertCrew(next);
  };
  const delM=async(id)=>{
    if(!isAdmin)return;
    setAllCrew(c=>c.filter(m=>m.id!==id));
    await dbDeleteCrew(id);
  };
  const doAdd=async()=>{
    if(!form.name.trim())return;
    const tags=form.tags.split(",").map(t=>t.trim()).filter(Boolean);
    const saved=await dbUpsertCrew({...form,tags,projects:[],id:Date.now()});
    setAllCrew(c=>[...c,saved]);
    setForm({name:"",role:"DOP",phone:"",email:"",location:"",tags:"",notes:""});
    setShowAdd(false);
  };
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}} className="g4">
      <SC2 label="Total crew" value={allCrew.length} color="var(--text)" icon="👥" delay={0}/>
      {[["Directors","Director","var(--purple)","🎥"],["DOPs","DOP","var(--teal)","📷"],["Editors","Editor","var(--red)","✂"]].map(([l,r,c,ic])=><SC2 key={l} label={l} value={allCrew.filter(m=>m.role===r).length} color={c} icon={ic} delay={50}/>)}
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:18}}>
      <Inp value={search} onChange={setSearch} placeholder="Search name or role…" style={{maxWidth:220,padding:"6px 12px",fontSize:13}}/>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{["All","Director","DOP","Producer","AD","Editor","Gaffer","Other"].map(r=><button key={r} className={`fpill${filterR===r?" active":""}`} onClick={()=>setFilterR(r)}>{r}</button>)}</div>
      <div style={{flex:1}}/>{isAdmin&&<><button className="btn-g" onClick={()=>setShowDesignations(true)}>⚙️ Manage Roles</button><button className="btn-p" onClick={()=>setShowAdd(true)}>+ Add member</button></>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}} className="g2">
      {shown.map((c,i)=>{const cP=projects.filter(p=>c.projects.includes(p.id));return <div key={c.id} className="card clickable fade-up" style={{padding:"18px 20px",animationDelay:`${i*45}ms`,position:"relative",overflow:"hidden"}} onClick={()=>setSelected(c.id)}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:rc(c.role)+"44"}}/>
        <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
          <Av name={c.name} idx={allCrew.indexOf(c)} size={38}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}><span style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>{c.name}</span><RBadge role={c.role}/></div>
            {c.location&&<div style={{fontSize:12,color:"var(--text3)",marginBottom:4}}>📍 {c.location}</div>}
            <div style={{fontSize:12,color:"var(--text2)",display:"flex",alignItems:"center",gap:5}}><span>📞</span><span style={{fontFamily:"'Geist Mono',monospace"}}>{c.phone||<span style={{color:"var(--text3)",fontStyle:"italic",fontFamily:"inherit"}}>No phone</span>}</span></div>
            {c.email&&<div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>✉ {c.email}</div>}
          </div>
        </div>
        {(c.tags||[]).length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>{c.tags.map(t=><span key={t} className="tchip">{t}</span>)}</div>}
        <div style={{paddingTop:10,borderTop:"1px solid var(--border)",display:"flex",justifyContent:"space-between"}}>
          <div style={{fontSize:12,color:"var(--text3)"}}>{cP.length} project{cP.length!==1?"s":""}</div>
          <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",opacity:.6}}>View →</div>
        </div>
      </div>;})}
    </div>
    {selected&&(()=>{
      const m=allCrew.find(x=>x.id===selected);if(!m)return null;
      const cP=projects.filter(p=>m.projects.includes(p.id));const idx=allCrew.findIndex(x=>x.id===selected);
      return <><div className="povl" onClick={()=>setSelected(null)}/><div className="panel" style={{width:460}}>
        <div style={{padding:"22px 26px 18px",borderBottom:"1px solid var(--border)",position:"sticky",top:0,background:"#14141a",zIndex:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}><Av name={m.name} idx={idx} size={46}/><div><div style={{fontSize:19,fontWeight:700,color:"var(--text)",marginBottom:4}}>{m.name}</div><RBadge role={m.role}/>{m.phone&&<div style={{fontSize:12,color:"var(--text2)",marginTop:5,display:"flex",alignItems:"center",gap:5}}><span>📞</span><span style={{fontFamily:"'Geist Mono',monospace"}}>{m.phone}</span></div>}</div></div>
            <div style={{display:"flex",gap:8}}>
              {isAdmin&&<button onClick={()=>{if(window.confirm(`Remove ${m.name}?`)){delM(m.id);setSelected(null);}}} style={{background:"var(--red-bg)",border:"1px solid rgba(255,69,58,.2)",color:"var(--red)",width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑</button>}
              <button onClick={()=>setSelected(null)} style={{background:"var(--bg4)",border:"1px solid var(--border)",color:"var(--text2)",width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
          </div>
        </div>
        <div className="ps"><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:14}}>Contact</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div><Lbl ch="Full name"/>{isAdmin?<Inp value={m.name||""} onChange={v=>updM(m.id,{name:v})} placeholder="Full name"/>:<div style={{fontSize:13,color:"var(--text2)"}}>{m.name}</div>}</div>
            <div><Lbl ch="Role"/>{isAdmin?<Sel value={m.role} onChange={v=>updM(m.id,{role:v})} options={allRoleOptions}/>:<div style={{fontSize:13,color:"var(--text2)"}}>{m.role}</div>}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><Lbl ch="Phone"/>{isAdmin?<Inp value={m.phone||""} onChange={v=>updM(m.id,{phone:v})} placeholder="9876543210"/>:<div style={{fontSize:13,color:"var(--text2)"}}>{m.phone||"—"}</div>}</div>
              <div><Lbl ch="Email"/>{isAdmin?<Inp value={m.email||""} onChange={v=>updM(m.id,{email:v})} placeholder="name@email.com"/>:<div style={{fontSize:13,color:"var(--text2)"}}>{m.email||"—"}</div>}</div>
            </div>
            <div><Lbl ch="Location"/>{isAdmin?<Inp value={m.location||""} onChange={v=>updM(m.id,{location:v})} placeholder="Mumbai"/>:<div style={{fontSize:13,color:"var(--text2)"}}>{m.location||"—"}</div>}</div>
          </div>
        </div>
        <div className="ps"><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:12}}>Tags</div>{isAdmin?<ETags tags={m.tags||[]} onAdd={t=>updM(m.id,{tags:[...(m.tags||[]),t]})} onDelete={t=>updM(m.id,{tags:(m.tags||[]).filter(x=>x!==t)})}/>:<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{(m.tags||[]).map(t=><span key={t} className="tchip">{t}</span>)}</div>}</div>
        <div className="ps"><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:12}}>Notes</div>{isAdmin?<ENotes notes={m.notes} onSave={v=>updM(m.id,{notes:v})}/>:<div style={{fontSize:13,color:"var(--text2)"}}>{m.notes||<span style={{color:"var(--text3)",fontStyle:"italic"}}>No notes.</span>}</div>}</div>
        <div className="ps"><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:14}}>Projects ({cP.length})</div>{cP.length===0?<div style={{fontSize:13,color:"var(--text3)",fontStyle:"italic"}}>Not assigned yet.</div>:cP.map(p=><div key={p.id} className="drow"><div><div style={{fontSize:13,fontWeight:500,color:"var(--text)",marginBottom:3}}>{p.title}</div><div style={{fontSize:11,color:"var(--text3)"}}>{p.client} · {p.type}{p.location&&` · 📍 ${p.location}`}</div></div><div style={{textAlign:"right"}}><Badge status={p.status}/></div></div>)}</div>
      </div></>;
    })()}
    {isAdmin&&showAdd&&<Modal title="Add crew member" onClose={()=>setShowAdd(false)}><div style={{display:"flex",flexDirection:"column",gap:13}}>
      <div><Lbl ch="Full name"/><Inp value={form.name} onChange={fset("name")} placeholder="Rahul Verma"/></div>
      <div><Lbl ch="Role"/><Sel value={form.role} onChange={fset("role")} options={allRoleOptions}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><Lbl ch="Phone"/><Inp value={form.phone} onChange={fset("phone")} placeholder="9876543210"/></div><div><Lbl ch="Email"/><Inp value={form.email} onChange={fset("email")} placeholder="name@email.com"/></div></div>
      <div><Lbl ch="Location"/><Inp value={form.location} onChange={fset("location")} placeholder="Mumbai"/></div>
      <div><Lbl ch="Tags"/><Inp value={form.tags} onChange={fset("tags")} placeholder="arri, studio"/></div>
      <div><Lbl ch="Notes"/><Inp value={form.notes} onChange={fset("notes")} placeholder="Any notes…"/></div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:4}}><button className="btn-g" onClick={()=>setShowAdd(false)}>Cancel</button><button className="btn-p" onClick={doAdd}>Add member</button></div>
    </div></Modal>}
    {showDesignations&&<OtherDesignationsModal onClose={()=>setShowDesignations(false)}/>}
  </div>);
}

/* ── QUOTES VIEW ── */
const QLCATS=["Day Rate","Equipment","Travel","Post Production","Studio","Talent","Props & Art","Catering","Miscellaneous"];
function QuotesView({projects}){
  const[quotes,setQuotes,loadingQ,,refetchQ]=useDB("quotes",mpQ);
  const[selected,setSelected]=useState(null);const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({title:"",client:"",project:"",validUntil:"",taxPct:"18",notes:"",status:"Draft"});
  const fset=k=>v=>setForm(f=>({...f,[k]:v}));
  const sub=q=>(q.lines||[]).reduce((s,l)=>s+(l.qty*l.rate),0);
  const tax=q=>sub(q)*((Number(q.taxPct)||0)/100);
  const grand=q=>{const s=sub(q);return s+(s*(Number(q.taxPct)||0)/100);};
  const create=async()=>{
    if(!form.title.trim()||!form.client.trim())return;
    const q={...form,taxPct:Number(form.taxPct)||18,lines:[{id:1,desc:"",cat:"Day Rate",qty:1,rate:0}],createdAt:new Date().toISOString().split("T")[0],id:Date.now()};
    const newId=await dbUpsertQuote(q);
    await refetchQ();
    setForm({title:"",client:"",project:"",validUntil:"",taxPct:"18",notes:"",status:"Draft"});
    setShowAdd(false);
    setTimeout(()=>setSelected(newId),120);
  };
  const updQ=async(id,patch)=>{
    const q=quotes.find(x=>x.id===id);if(!q)return;
    const next={...q,...patch};
    setQuotes(qs=>qs.map(x=>x.id===id?next:x));
    await dbUpsertQuote(next);
  };
  const delQ=async(id)=>{
    setQuotes(qs=>qs.filter(q=>q.id!==id));
    if(selected===id)setSelected(null);
    await dbDelQuote(id);
  };
  const dlQ=(q)=>{const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Quote — ${q.title}</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;font-size:13px;color:#000;background:#fff;}.page{max-width:800px;margin:0 auto;padding:32px;}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;border-bottom:3px solid #000;padding-bottom:20px;}.co{font-size:22px;font-weight:900;}.co-s{font-size:10px;letter-spacing:0.15em;color:#555;margin-top:3px;}.qt{font-size:28px;font-weight:900;color:#e4002b;text-align:right;}.meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;}.mb{font-size:12px;line-height:1.8;}.mb b{display:block;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#555;margin-bottom:4px;}table{width:100%;border-collapse:collapse;margin-bottom:20px;}th{background:#000;color:#fff;padding:9px 12px;font-size:11px;text-align:left;letter-spacing:0.06em;}td{padding:9px 12px;border-bottom:1px solid #ddd;font-size:12px;}.ts{border-top:2px solid #000;padding-top:12px;}.tr{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;}.grand{font-weight:900;font-size:16px;border-top:2px solid #000;padding-top:8px;margin-top:8px;}.foot{margin-top:32px;font-size:11px;color:#888;border-top:1px solid #ddd;padding-top:12px;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body><div class="page"><div class="header"><div><div class="co">FRAME OS</div><div class="co-s">PRODUCTION SUITE</div></div><div><div class="qt">ESTIMATE</div><div style="font-size:11px;text-align:right;margin-top:6px;color:#555;">Quote #${q.id.toString().slice(-6)}<br>Date: ${q.createdAt}<br>Valid until: ${q.validUntil||"30 days"}</div></div></div><div class="meta"><div class="mb"><b>Prepared for</b>${q.client}${q.project?`<br>${q.project}`:""}</div><div class="mb"><b>Status</b><span style="background:${q.status==="Approved"?"#30d158":q.status==="Sent"?"#3a8ef6":"#666"};color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;">${q.status}</span></div></div><table><thead><tr><th style="width:40%">Description</th><th>Category</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>${(q.lines||[]).map((l,i)=>`<tr style="${i%2===1?"background:#f9f9f9":""}"><td>${l.desc||"—"}</td><td style="color:#666">${l.cat}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">₹${Number(l.rate).toLocaleString("en-IN")}</td><td style="text-align:right;font-weight:600">₹${(l.qty*l.rate).toLocaleString("en-IN")}</td></tr>`).join("")}</tbody></table><div class="ts"><div class="tr"><span>Subtotal</span><span>₹${sub(q).toLocaleString("en-IN")}</span></div><div class="tr"><span>GST (${q.taxPct}%)</span><span>₹${tax(q).toLocaleString("en-IN")}</span></div><div class="tr grand"><span>TOTAL</span><span>₹${grand(q).toLocaleString("en-IN")}</span></div></div>${q.notes?`<div style="margin-top:20px;font-size:12px;background:#f9f9f9;padding:12px;border-left:3px solid #e4002b;"><b>Notes:</b> ${q.notes}</div>`:""}<div class="foot">This is an estimate. Valid for ${q.validUntil||"30 days"} from date of issue.</div></div></body></html>`;const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([html],{type:"text/html"}));a.download=`Quote_${q.title.replace(/\s+/g,"_")}.html`;a.click();};
  const selQ=selected?quotes.find(q=>q.id===selected):null;
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}} className="g4">
      <SC2 label="Quotes" value={quotes.length} color="var(--text)" icon="📋" delay={0}/>
      <SC2 label="Approved" value={quotes.filter(q=>q.status==="Approved").length} color="var(--green)" icon="✓" delay={50}/>
      <SC2 label="Pending" value={quotes.filter(q=>["Draft","Sent"].includes(q.status)).length} color="var(--amber)" icon="⏳" delay={100}/>
      <SC2 label="Total value" value={fmtK(quotes.reduce((s,q)=>s+grand(q),0))} color="var(--accent)" icon="₹" delay={150}/>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:18}}><button className="btn-p" onClick={()=>setShowAdd(true)}>+ New quote</button></div>
    {quotes.length===0&&<div style={{textAlign:"center",padding:"48px 0",color:"var(--text3)",fontSize:14}}>No quotes yet. Create your first estimate.</div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}} className="g2">
      {quotes.map((q,i)=><div key={q.id} className="card clickable fade-up" style={{padding:"18px 20px",animationDelay:`${i*50}ms`,position:"relative",overflow:"hidden"}} onClick={()=>setSelected(q.id)}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:(SC[q.status]||{dot:"var(--text3)"}).dot}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}><div><div style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:3}}>{q.title}</div><div style={{fontSize:13,color:"var(--text2)"}}>{q.client}</div></div><Badge status={q.status}/></div>
        <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid var(--border)"}}>
          <div><div style={{fontSize:10,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",marginBottom:3}}>TOTAL (incl. GST)</div><div style={{fontSize:16,fontWeight:600,fontFamily:"'Geist Mono',monospace",color:"var(--text)"}}>{fmt(grand(q))}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--text3)"}}>{(q.lines||[]).length} items</div><div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{q.createdAt}</div></div>
        </div>
        <div style={{position:"absolute",bottom:14,right:18,fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",opacity:.6}}>Edit →</div>
      </div>)}
    </div>
    {selQ&&(<><div className="povl" onClick={()=>setSelected(null)}/><div className="panel" style={{width:580}}>
      <div style={{padding:"18px 24px 14px",borderBottom:"1px solid var(--border)",position:"sticky",top:0,background:"#14141a",zIndex:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:17,fontWeight:700,color:"var(--text)"}}>{selQ.title}</div><div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>{selQ.client}{selQ.project&&` · ${selQ.project}`}</div></div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn-sm" style={{color:"var(--accent)",borderColor:"var(--accent-bd)"}} onClick={()=>dlQ(selQ)}>↓ Download</button>
            <button onClick={()=>{delQ(selQ.id);}} style={{background:"var(--red-bg)",border:"1px solid rgba(255,69,58,.2)",color:"var(--red)",width:28,height:28,borderRadius:7,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑</button>
            <button onClick={()=>setSelected(null)} style={{background:"var(--bg4)",border:"1px solid var(--border)",color:"var(--text2)",width:28,height:28,borderRadius:7,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginTop:10}}>{["Draft","Sent","Approved"].map(st=>{const act=selQ.status===st;const ss=SC[st];return <button key={st} onClick={()=>updQ(selQ.id,{status:st})} style={{fontSize:11,fontFamily:"'Geist Mono',monospace",padding:"3px 12px",borderRadius:20,cursor:"pointer",background:act?ss.bg:"transparent",color:act?ss.dot:"var(--text2)",border:`1px solid ${act?ss.bd:"var(--border)"}`}}>{st}</button>;})}</div>
      </div>
      <div className="ps">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.07em",textTransform:"uppercase"}}>Line items</div><button className="btn-g" style={{fontSize:12,padding:"4px 12px"}} onClick={()=>updQ(selQ.id,{lines:[...(selQ.lines||[]),{id:Date.now(),desc:"",cat:"Day Rate",qty:1,rate:0}]})}>+ Add line</button></div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 0.5fr 0.8fr 0.8fr 28px",gap:6,marginBottom:6}}>{["Description","Category","Qty","Rate (₹)","Amount",""].map(h=><div key={h} style={{fontSize:10,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.05em"}}>{h}</div>)}</div>
        {(selQ.lines||[]).map((l,i)=><div key={l.id} style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 0.5fr 0.8fr 0.8fr 28px",gap:6,marginBottom:8,alignItems:"center"}}>
          <input className="input" value={l.desc} onChange={e=>{const n=[...selQ.lines];n[i]={...n[i],desc:e.target.value};updQ(selQ.id,{lines:n});}} placeholder="e.g. Director day rate" style={{padding:"7px 10px",fontSize:13}}/>
          <select className="input" value={l.cat} onChange={e=>{const n=[...selQ.lines];n[i]={...n[i],cat:e.target.value};updQ(selQ.id,{lines:n});}} style={{padding:"7px 8px",fontSize:12}}>{QLCATS.map(c=><option key={c}>{c}</option>)}</select>
          <input className="input" type="number" value={l.qty} onChange={e=>{const n=[...selQ.lines];n[i]={...n[i],qty:Number(e.target.value)||1};updQ(selQ.id,{lines:n});}} style={{padding:"7px 8px",fontSize:13,textAlign:"center"}}/>
          <input className="input" type="number" value={l.rate} onChange={e=>{const n=[...selQ.lines];n[i]={...n[i],rate:Number(e.target.value)||0};updQ(selQ.id,{lines:n});}} style={{padding:"7px 8px",fontSize:13}}/>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text)",fontFamily:"'Geist Mono',monospace",textAlign:"right"}}>{fmtK(l.qty*l.rate)}</div>
          <button onClick={()=>updQ(selQ.id,{lines:selQ.lines.filter((_,j)=>j!==i)})} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:13}}>✕</button>
        </div>)}
        <div style={{borderTop:"1px solid var(--border)",marginTop:8,paddingTop:12}}>
          {[["Subtotal",fmt(sub(selQ))],[`GST (${selQ.taxPct}%)`,fmt(tax(selQ))]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"var(--text2)",marginBottom:6}}><span>{k}</span><span style={{fontFamily:"'Geist Mono',monospace"}}>{v}</span></div>)}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:700,color:"var(--text)",borderTop:"1px solid var(--border2)",paddingTop:8,marginTop:6}}><span>Grand Total</span><span style={{fontFamily:"'Geist Mono',monospace",color:"var(--green)"}}>{fmt(grand(selQ))}</span></div>
        </div>
        <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Lbl ch="Valid until"/><Inp type="date" value={selQ.validUntil} onChange={v=>updQ(selQ.id,{validUntil:v})}/></div>
          <div><Lbl ch="GST %"/><Inp type="number" value={selQ.taxPct} onChange={v=>updQ(selQ.id,{taxPct:Number(v)||0})} placeholder="18"/></div>
        </div>
        <div style={{marginTop:10}}><Lbl ch="Notes"/><TA value={selQ.notes||""} onChange={v=>updQ(selQ.id,{notes:v})} placeholder="Payment terms, exclusions…"/></div>
      </div>
    </div></>)}
    {showAdd&&<Modal title="New quote / estimate" onClose={()=>setShowAdd(false)}><div style={{display:"flex",flexDirection:"column",gap:13}}>
      <div><Lbl ch="Title"/><Inp value={form.title} onChange={fset("title")} placeholder="Zara AW26 — TVC Estimate"/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><Lbl ch="Client"/><Inp value={form.client} onChange={fset("client")} placeholder="Client name"/></div><div><Lbl ch="Project"/><Sel value={form.project} onChange={fset("project")} options={["—",...projects.map(p=>p.title)]}/></div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><Lbl ch="Valid until"/><Inp type="date" value={form.validUntil} onChange={fset("validUntil")}/></div><div><Lbl ch="GST %"/><Inp value={form.taxPct} onChange={fset("taxPct")} placeholder="18"/></div></div>
      <div><Lbl ch="Notes"/><Inp value={form.notes} onChange={fset("notes")} placeholder="Payment terms…"/></div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:4}}><button className="btn-g" onClick={()=>setShowAdd(false)}>Cancel</button><button className="btn-p" onClick={create}>Create quote</button></div>
    </div></Modal>}
  </div>);
}


/* ── NAV ARRAYS ── */
const NAV_A=[{id:"projects",label:"Projects",icon:"🎬",sub:"Shoots & pipeline"},{id:"finance",label:"Finance",icon:"₹",sub:"Invoices & revenue"},{id:"clients",label:"Clients",icon:"🏢",sub:"Client directory"},{id:"crew",label:"Crew",icon:"👥",sub:"Cast & crew"},{id:"quotes",label:"Quotes",icon:"📋",sub:"Estimates & quotes"},{id:"about",label:"About",icon:"👤",sub:"Profile & studio"}];
const NAV_V=[{id:"projects",label:"Projects",icon:"🎬",sub:"Shoots & pipeline"},{id:"clients",label:"Clients",icon:"🏢",sub:"Client directory"},{id:"crew",label:"Crew",icon:"👥",sub:"Cast & crew"},{id:"about",label:"About",icon:"👤",sub:"Profile & studio"}];

/* ── SIDEBAR ── */
function Sidebar({tab,setTab,collapsed,setCollapsed,studioName,setStudioName,role}){
  const isAdmin=role==="admin";const W=collapsed?60:220;const NAV=isAdmin?NAV_A:NAV_V;
  const[editName,setEditName]=useState(false);const[draft,setDraft]=useState(studioName);const nameRef=useRef();
  useEffect(()=>{if(editName&&nameRef.current)nameRef.current.focus();},[editName]);
  const commitName=()=>{const t=draft.trim();if(t)setStudioName(t);else setDraft(studioName);setEditName(false);};
  return(<nav className="sd" style={{width:W,minHeight:"100vh",position:"fixed",top:0,left:0,zIndex:50,background:"var(--sidebar-bg)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",paddingBottom:20,transition:"width .25s cubic-bezier(.32,.72,0,1)",overflow:"hidden"}}>
    <div style={{padding:collapsed?"18px 0":"20px 16px 18px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:collapsed?"center":"space-between",gap:10}}>
      {!collapsed&&<div style={{display:"flex",alignItems:"center",gap:10,overflow:"hidden",flex:1,minWidth:0}}>
        <div style={{width:32,height:32,borderRadius:9,background:"var(--bg4)",border:"1px solid var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🎞</div>
        <div style={{overflow:"hidden",flex:1,minWidth:0}}>
          {editName&&isAdmin?<input ref={nameRef} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commitName} onKeyDown={e=>{if(e.key==="Enter")commitName();if(e.key==="Escape"){setDraft(studioName);setEditName(false);}}} style={{background:"transparent",border:"none",borderBottom:"1px solid var(--accent)",outline:"none",color:"var(--text)",fontFamily:"'Geist',sans-serif",fontSize:15,fontWeight:700,lineHeight:1,width:"100%",padding:"0 0 2px"}}/>:<div style={{display:"flex",alignItems:"center",gap:4,cursor:isAdmin?"pointer":"default"}} onClick={()=>{if(isAdmin){setDraft(studioName);setEditName(true);}}}><div style={{fontSize:15,fontWeight:700,color:"var(--text)",lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{studioName}</div>{isAdmin&&<span style={{fontSize:10,color:"var(--text3)",flexShrink:0}}>✎</span>}</div>}
          <div style={{fontSize:9,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.1em",marginTop:2,whiteSpace:"nowrap"}}>PRODUCTION</div>
        </div>
      </div>}
      {collapsed&&<div style={{width:32,height:32,borderRadius:9,background:"var(--bg4)",border:"1px solid var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎞</div>}
      {isAdmin&&<button onClick={()=>setCollapsed(c=>!c)} style={{background:"var(--bg4)",border:"1px solid var(--border)",borderRadius:7,color:"var(--text2)",width:26,height:26,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{collapsed?"›":"‹"}</button>}
    </div>
    <div style={{flex:1,padding:collapsed?"12px 8px":"14px 10px"}}>
      {!collapsed&&<div style={{fontSize:9,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.1em",padding:"0 8px",marginBottom:8}}>WORKSPACE</div>}
      {NAV.map(n=>{const act=tab===n.id;return <button key={n.id} className={`nav-s${act?" active":""}`} onClick={()=>setTab(n.id)} title={collapsed?n.label:""} style={{justifyContent:collapsed?"center":"flex-start",padding:collapsed?"10px":"8px 10px",marginBottom:2,position:"relative"}}>{act&&!collapsed&&<span style={{position:"absolute",left:0,top:"20%",bottom:"20%",width:2.5,borderRadius:3,background:"var(--accent)"}}/>}<span style={{fontSize:17,flexShrink:0,lineHeight:1}}>{n.icon}</span>{!collapsed&&<div style={{overflow:"hidden"}}><div style={{fontSize:13,fontWeight:act?600:400,lineHeight:1.2,color:act?"var(--text)":"var(--text2)",whiteSpace:"nowrap"}}>{n.label}</div><div style={{fontSize:11,color:"var(--text3)",marginTop:1,whiteSpace:"nowrap"}}>{n.sub}</div></div>}</button>;})}
      {isAdmin&&<><div style={{borderTop:"1px solid var(--border)",margin:"14px 0 10px"}}/>{!collapsed&&<div style={{fontSize:9,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.1em",padding:"0 8px",marginBottom:8}}>COMING SOON</div>}<div className="nav-s" style={{opacity:.35,cursor:"not-allowed",justifyContent:collapsed?"center":"flex-start",padding:collapsed?"10px":"8px 10px"}}><span style={{fontSize:17,flexShrink:0,lineHeight:1}}>📁</span>{!collapsed&&<div style={{overflow:"hidden"}}><div style={{fontSize:13,color:"var(--text2)",whiteSpace:"nowrap"}}>Assets</div><div style={{fontSize:9,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.06em",marginTop:1}}>SOON</div></div>}</div></>}
    </div>
    {!collapsed?<div style={{padding:"0 10px"}}><div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:11,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}><div style={{width:28,height:28,borderRadius:"50%",background:isAdmin?"#1d3461":"#1a3a20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:isAdmin?"#60a0f8":"#4ade96",flexShrink:0}}>{isAdmin?"A":"V"}</div><div style={{overflow:"hidden"}}><div style={{fontSize:13,fontWeight:600,color:"var(--text)",whiteSpace:"nowrap"}}>{isAdmin?"Aki Mehta":"Viewer"}</div><div style={{fontSize:11,color:"var(--text3)",whiteSpace:"nowrap"}}>{isAdmin?"Admin · Full access":"Read only"}</div></div></div></div>:<div style={{display:"flex",justifyContent:"center",padding:"0 0 4px"}}><div style={{width:32,height:32,borderRadius:"50%",background:isAdmin?"#1d3461":"#1a3a20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:isAdmin?"#60a0f8":"#4ade96",cursor:"default"}}>{isAdmin?"A":"V"}</div></div>}
  </nav>);
}

/* ── ABOUT VIEW ── */
function AboutView({role}){
  const isAdmin=role==="admin";
  const[rawAbout,,loadingA]=useDB("about");
  const def={name:"Aki Mehta",title:"Project Manager & Content Strategist",studio:"Frame OS",tagline:"Journey Curators",phone:"+91 70212 91405",email:"yashmehtaoffice@gmail.com",website:"yashmehtawork.netlify.app",services:"TVC Production · Brand Films · Product Shoots · Digital Content",bio:"",instagram:"linktr.ee/MehtaYash",linkedin:"",logoColor:"#1a2f6e"};
  const[about,setAbout]=useState(def);
  useEffect(()=>{if(rawAbout.length>0)setAbout(mpA(rawAbout[0]));},[rawAbout]);
  const[editing,setEditing]=useState(false);
  const[draft,setDraft]=useState(about);
  useEffect(()=>{if(!editing)setDraft(about);},[about]);
  const ds=k=>v=>setDraft(d=>({...d,[k]:v}));
  const save=async()=>{setAbout(draft);await dbSaveAbout(draft);setEditing(false);};
  const cancel=()=>{setDraft(about);setEditing(false);};
  const initials=(about.studio||"FO").substring(0,2).toUpperCase();
  const nameInitials=(about.name||"A").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
  if(loadingA)return <LoadingScreen msg="Loading profile…"/>;
  return(
    <div style={{maxWidth:680,margin:"0 auto"}}>
      <div className="card fade-up" style={{padding:"32px 28px",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,var(--accent),var(--purple))"}}/>
        <div style={{display:"flex",alignItems:"flex-start",gap:20,flexWrap:"wrap"}}>
          <div style={{width:72,height:72,borderRadius:20,background:about.logoColor||"#1a2f6e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:800,color:"rgba(255,255,255,0.92)",flexShrink:0,boxShadow:"0 8px 24px rgba(0,0,0,.25)"}}>{nameInitials}</div>
          <div style={{flex:1,minWidth:0}}>
            {editing?<div style={{display:"flex",flexDirection:"column",gap:8}}><Inp value={draft.name} onChange={ds("name")} placeholder="Your name"/><Inp value={draft.title} onChange={ds("title")} placeholder="Your title"/></div>:<><div style={{fontSize:22,fontWeight:700,color:"var(--text)",marginBottom:4}}>{about.name}</div><div style={{fontSize:14,color:"var(--text2)"}}>{about.title}</div></>}
          </div>
          {isAdmin&&!editing&&<button className="btn-g" style={{fontSize:12,padding:"6px 14px",flexShrink:0}} onClick={()=>{setDraft(about);setEditing(true);}}>Edit</button>}
        </div>
        {editing&&<div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}><button className="btn-g" style={{fontSize:12}} onClick={cancel}>Cancel</button><button className="btn-p" style={{fontSize:12}} onClick={save}>Save</button></div>}
      </div>
      <div className="card fade-up" style={{padding:"24px 28px",marginBottom:16,animationDelay:"40ms"}}>
        <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:16}}>Production House</div>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
          <div style={{width:52,height:52,borderRadius:14,background:about.logoColor||"#1a2f6e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:800,color:"rgba(255,255,255,0.92)",flexShrink:0}}>{initials}</div>
          <div style={{flex:1,minWidth:0}}>
            {editing?<div style={{display:"flex",flexDirection:"column",gap:8}}><Inp value={draft.studio} onChange={ds("studio")} placeholder="Studio name"/><Inp value={draft.tagline} onChange={ds("tagline")} placeholder="Tagline"/></div>:<><div style={{fontSize:18,fontWeight:700,color:"var(--text)"}}>{about.studio}</div><div style={{fontSize:13,color:"var(--text2)",fontStyle:"italic"}}>{about.tagline}</div></>}
          </div>
          {editing&&<div><Lbl ch="Colour"/><input type="color" value={draft.logoColor||"#1a2f6e"} onChange={e=>setDraft(d=>({...d,logoColor:e.target.value}))} style={{width:36,height:36,border:"none",borderRadius:8,cursor:"pointer",background:"transparent"}}/></div>}
        </div>
        {editing?<div><Lbl ch="Bio"/><TA value={draft.bio} onChange={ds("bio")} placeholder="A short bio…"/></div>:about.bio&&<div style={{fontSize:13,color:"var(--text2)",lineHeight:1.8,background:"var(--bg3)",borderRadius:9,padding:"12px 14px"}}>{about.bio}</div>}
      </div>
      <div className="card fade-up" style={{padding:"24px 28px",marginBottom:16,animationDelay:"80ms"}}>
        <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:16}}>Contact</div>
        {editing?<div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}} className="g2"><div><Lbl ch="Phone"/><Inp value={draft.phone} onChange={ds("phone")} placeholder="+91 98765 43210"/></div><div><Lbl ch="Email"/><Inp value={draft.email} onChange={ds("email")} placeholder="email@example.com"/></div></div>
          <div><Lbl ch="Website"/><Inp value={draft.website} onChange={ds("website")} placeholder="yoursite.com"/></div>
        </div>:<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[["📞",about.phone],["✉",about.email],["🌐",about.website]].filter(([,v])=>v).map(([icon,val])=><div key={val} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"var(--bg3)",borderRadius:9}}><span style={{fontSize:16,flexShrink:0}}>{icon}</span><span style={{fontSize:13,color:"var(--text)"}}>{val}</span></div>)}
        </div>}
      </div>
      <div className="card fade-up" style={{padding:"24px 28px",marginBottom:16,animationDelay:"120ms"}}>
        <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:16}}>Services</div>
        {editing?<Inp value={draft.services} onChange={ds("services")} placeholder="TVC · Brand Films · Product Shoots"/>:<div style={{display:"flex",flexWrap:"wrap",gap:8}}>{(about.services||"").split("·").map(s=>s.trim()).filter(Boolean).map(s=><span key={s} style={{fontSize:12,fontFamily:"'Geist Mono',monospace",background:"var(--accent-bg)",color:"var(--accent)",border:"1px solid var(--accent-bd)",borderRadius:20,padding:"4px 12px"}}>{s}</span>)}</div>}
      </div>
      <div className="card fade-up" style={{padding:"24px 28px",animationDelay:"160ms"}}>
        <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:16}}>Social & Links</div>
        {editing?<div style={{display:"flex",flexDirection:"column",gap:10}}><div><Lbl ch="Instagram / Linktree"/><Inp value={draft.instagram} onChange={ds("instagram")} placeholder="linktr.ee/yourname"/></div><div><Lbl ch="LinkedIn"/><Inp value={draft.linkedin} onChange={ds("linkedin")} placeholder="linkedin.com/in/yourname"/></div></div>:<div style={{display:"flex",flexWrap:"wrap",gap:10}}>
          {[["🔗",about.instagram,"Linktree"],["💼",about.linkedin,"LinkedIn"]].filter(([,v])=>v).map(([icon,val,label])=><a key={label} href={"https://"+val.replace(/^https?:\/\//,"")} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:9,textDecoration:"none",color:"var(--text)",fontSize:13}}><span style={{fontSize:16}}>{icon}</span><span>{label}</span></a>)}
        </div>}
      </div>
    </div>
  );
}

/* ── SPLASH SCREEN ── */
function SplashScreen({onDone,studioName}){
  const FULL="AKI";
  const[typed,setTyped]=useState("");const[showCursor,setShowCursor]=useState(true);const[showSub,setShowSub]=useState(false);const[fading,setFading]=useState(false);
  useEffect(()=>{
    const t=[];
    [300,580,860].forEach((d,i)=>t.push(setTimeout(()=>setTyped(FULL.slice(0,i+1)),d)));
    t.push(setTimeout(()=>setShowSub(true),1200));
    t.push(setTimeout(()=>setShowCursor(false),1700));
    t.push(setTimeout(()=>setFading(true),2200));
    t.push(setTimeout(()=>onDone(),2600));
    return()=>t.forEach(clearTimeout);
  },[]);
  return(
    <div style={{position:"fixed",inset:0,background:"#0c0c0e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:999,opacity:fading?0:1,transition:"opacity 0.4s ease",userSelect:"none"}}>
      <div style={{display:"flex",alignItems:"flex-end",marginBottom:28,minHeight:"clamp(80px,20vw,130px)"}}>
        <span style={{fontSize:"clamp(80px,20vw,128px)",fontWeight:800,fontFamily:"'Geist',sans-serif",letterSpacing:"0.04em",color:"#f2f2f7",lineHeight:1}}>{typed}</span>
        <span style={{display:"inline-block",width:"clamp(4px,1vw,6px)",height:"clamp(56px,14vw,90px)",background:"#3a8ef6",marginLeft:6,marginBottom:4,borderRadius:2,opacity:showCursor?1:0,animation:showCursor?"cursorBlink 0.6s step-end infinite":"none",transition:"opacity 0.2s ease",flexShrink:0}}/>
      </div>
      <div style={{width:showSub?52:0,height:"1px",background:"linear-gradient(90deg,transparent,rgba(58,142,246,0.7),transparent)",transition:"width 0.5s cubic-bezier(.32,.72,0,1)",marginBottom:16}}/>
      <div style={{fontSize:11,fontFamily:"'Geist Mono',monospace",letterSpacing:"0.32em",textTransform:"uppercase",color:"#6e6e73",opacity:showSub?1:0,transition:"opacity 0.5s ease 0.15s"}}>{studioName||"Frame OS"}</div>
      <style>{`@keyframes cursorBlink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
}

/* ── LOCK SCREEN ── */
function LockScreen({onUnlock,studioName}){
  const[pass,setPass]=useState("");const[err,setErr]=useState(false);const[shake,setShake]=useState(false);const ref=useRef();
  useEffect(()=>{setTimeout(()=>ref.current?.focus(),100);},[]);
  const attempt=()=>{const role=onUnlock(pass);if(role){setErr(false);}else{setErr(true);setShake(true);setPass("");setTimeout(()=>setShake(false),600);}};
  return(
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:360,animation:"fadeUp .4s ease"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:60,height:60,borderRadius:16,background:"var(--bg4)",border:"1px solid var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>🎞</div>
          <div style={{fontSize:22,fontWeight:700,color:"var(--text)",marginBottom:6}}>{studioName||"Frame OS"}</div>
          <div style={{fontSize:13,color:"var(--text2)"}}>Enter your password to continue</div>
        </div>
        <div style={{animation:shake?"shake .4s ease":"none"}}>
          <input ref={ref} type="password" className="input" value={pass} onChange={e=>{setPass(e.target.value);setErr(false);}} onKeyDown={e=>{if(e.key==="Enter")attempt();}} placeholder="Password" style={{textAlign:"center",fontSize:18,letterSpacing:"0.2em",marginBottom:12}}/>
          {err&&<div style={{fontSize:12,color:"var(--red)",textAlign:"center",marginBottom:10}}>Incorrect password. Try again.</div>}
          <button className="btn-p" style={{width:"100%",padding:"11px",fontSize:15}} onClick={attempt}>Unlock</button>
        </div>
        <div style={{marginTop:20,background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 16px"}}>
          <div style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:8}}>Access levels</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text2)"}}><span style={{width:7,height:7,borderRadius:"50%",background:"var(--accent)",display:"inline-block",flexShrink:0}}/><span><b style={{color:"var(--text)"}}>Admin</b> full access</span></div>
            <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text2)"}}><span style={{width:7,height:7,borderRadius:"50%",background:"var(--green)",display:"inline-block",flexShrink:0}}/><span><b style={{color:"var(--text)"}}>Viewer</b> read-only</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── CHANGE PASS MODAL ── */
function ChangePassModal({onClose,onSave,viewerPassword,onSaveViewer}){
  const[tab,setTab]=useState("admin");
  const[cur,setCur]=useState("");const[next,setNext]=useState("");const[conf,setConf]=useState("");const[err,setErr]=useState("");
  const[vcur,setVcur]=useState("");const[vnext,setVnext]=useState("");const[vconf,setVconf]=useState("");const[verr,setVerr]=useState("");
  const saveA=()=>{if(!cur||!next){setErr("Fill all fields.");return;}if(next!==conf){setErr("Passwords do not match.");return;}if(next.length<4){setErr("Min 4 characters.");return;}onSave(cur,next);setErr("");};
  const saveV=()=>{if(!vcur||!vnext){setVerr("Fill all fields.");return;}if(vnext!==vconf){setVerr("Passwords do not match.");return;}if(vnext.length<4){setVerr("Min 4 characters.");return;}onSaveViewer(vcur,vnext);setVerr("");};
  return(<Modal title="Manage passwords" onClose={onClose} width={440}>
    <div style={{display:"flex",gap:4,marginBottom:18}}>{[["admin","🔒 Admin"],["viewer","👁 Viewer"]].map(([id,label])=><button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"7px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:"'Geist',sans-serif",background:tab===id?"var(--accent)":"var(--bg4)",color:tab===id?"#fff":"var(--text2)",border:`1px solid ${tab===id?"var(--accent)":"var(--border)"}`}}>{label}</button>)}</div>
    {tab==="admin"&&<div style={{display:"flex",flexDirection:"column",gap:13}}><div style={{background:"var(--accent-bg)",border:"1px solid var(--accent-bd)",borderRadius:9,padding:"10px 12px",fontSize:12,color:"var(--text2)"}}>Admin password — full edit access.</div><div><Lbl ch="Current admin password"/><Inp type="password" value={cur} onChange={setCur} placeholder="••••••••"/></div><div><Lbl ch="New password"/><Inp type="password" value={next} onChange={setNext} placeholder="••••••••"/></div><div><Lbl ch="Confirm"/><Inp type="password" value={conf} onChange={setConf} placeholder="••••••••"/></div>{err&&<div style={{fontSize:12,color:"var(--red)",background:"var(--red-bg)",borderRadius:8,padding:"8px 12px"}}>{err}</div>}<div style={{display:"flex",justifyContent:"flex-end",gap:10}}><button className="btn-g" onClick={onClose}>Cancel</button><button className="btn-p" onClick={saveA}>Update admin</button></div></div>}
    {tab==="viewer"&&<div style={{display:"flex",flexDirection:"column",gap:13}}><div style={{background:"var(--green-bg)",border:"1px solid rgba(48,209,88,.2)",borderRadius:9,padding:"10px 12px",fontSize:12,color:"var(--text2)"}}>Viewer password — read-only access.</div><div><Lbl ch="Current viewer password"/><Inp type="password" value={vcur} onChange={setVcur} placeholder="••••••••"/></div><div><Lbl ch="New password"/><Inp type="password" value={vnext} onChange={setVnext} placeholder="••••••••"/></div><div><Lbl ch="Confirm"/><Inp type="password" value={vconf} onChange={setVconf} placeholder="••••••••"/></div>{verr&&<div style={{fontSize:12,color:"var(--red)",background:"var(--red-bg)",borderRadius:8,padding:"8px 12px"}}>{verr}</div>}<div style={{display:"flex",justifyContent:"flex-end",gap:10}}><button className="btn-g" onClick={onClose}>Cancel</button><button className="btn-p" onClick={saveV}>Update viewer</button></div></div>}
  </Modal>);
}

/* ── ROOT APP ── */
export default function App(){
  const[role,setRole]=useState(()=>sessionStorage.getItem("frameOS_role")||null);
  const[splash,setSplash]=useState(()=>!sessionStorage.getItem("frameOS_splashDone"));
  const[password,setPassword]=usePersist("frameOS_password","frame2026");
  const[viewerPw,setViewerPw]=usePersist("frameOS_viewerPw","view2026");
  const[studioName,setStudioName]=usePersist("frameOS_studioName","Frame OS");
  const[expUrl,setExpUrl]=usePersist("frameOS_expUrl","");
  const[theme,setTheme]=usePersist("frameOS_theme","dark");
  useEffect(()=>{document.body.classList.toggle("light",theme==="light");},[theme]);
  const toggleTheme=()=>setTheme(t=>t==="dark"?"light":"dark");
  const[tab,setTab]=useState("projects");
  const[collapsed,setCollapsed]=useState(false);
  const[showChgPw,setShowChgPw]=useState(false);
  const[showExpUrl,setShowExpUrl]=useState(false);
  const[allCrew,setAllCrew,loadingCrew]=useDB("crew",mpC);
  const[allVendors,setAllVendors]=useDB("vendors",mpV);
  const[showVendors,setShowVendors]=useState(false);
  const isAdmin=role==="admin";const isViewer=role==="viewer";
  const NAV=isAdmin?NAV_A:NAV_V;
  const tryUnlock=pw=>{if(pw===password){sessionStorage.setItem("frameOS_role","admin");setRole("admin");return "admin";}if(pw===viewerPw){sessionStorage.setItem("frameOS_role","viewer");setRole("viewer");return "viewer";}return null;};
  const handleChgAdmin=(cur,next)=>{if(cur!==password){alert("Current admin password incorrect.");return;}setPassword(next);setShowChgPw(false);};
  const handleChgViewer=(cur,next)=>{if(cur!==viewerPw){alert("Current viewer password incorrect.");return;}setViewerPw(next);setShowChgPw(false);};
  const safeTab=isViewer&&!NAV_V.find(n=>n.id===tab)?"projects":tab;
  const sideW=collapsed?60:220;
  const pageTitle=NAV.find(n=>n.id===safeTab)?.label??"";
  if(splash)return <><style>{FONTS}{GS}</style><SplashScreen onDone={()=>{sessionStorage.setItem("frameOS_splashDone","1");setSplash(false);}} studioName={studioName}/></>;
  if(!role)return <><style>{FONTS}{GS}</style><LockScreen onUnlock={tryUnlock} studioName={studioName}/></>;
  if(loadingCrew)return <><style>{FONTS}{GS}</style><LoadingScreen msg="Syncing team data…"/></>;
  return(<>
    <style>{FONTS}{GS}</style>
    <div style={{display:"flex",minHeight:"100vh",background:"var(--bg)"}}>
      <Sidebar tab={safeTab} setTab={setTab} collapsed={collapsed} setCollapsed={setCollapsed} studioName={studioName} setStudioName={setStudioName} role={role}/>
      <div className="mc" style={{flex:1,marginLeft:sideW,display:"flex",flexDirection:"column",minHeight:"100vh",minWidth:0,transition:"margin-left .25s cubic-bezier(.32,.72,0,1)"}}>
        <header style={{position:"sticky",top:0,zIndex:40,height:"var(--header-h)",background:"rgba(14,14,16,0.9)",backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:14}} className="hpad" id="hdr">
          <style>{`#hdr{padding:0 28px;}`}</style>
          <div style={{flex:1,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>{pageTitle}</span>
            {isViewer&&<span style={{fontSize:11,fontFamily:"'Geist Mono',monospace",background:"var(--green-bg)",color:"var(--green)",border:"1px solid rgba(48,209,88,.2)",borderRadius:20,padding:"2px 10px"}}>View only</span>}
            <span className="hmob" style={{fontSize:12,color:"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>{new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {isAdmin&&<button onClick={()=>setShowVendors(true)} title="Manage Vendors" style={{display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,background:"var(--bg4)",border:"1px solid var(--border)",borderRadius:9,cursor:"pointer",fontSize:17,flexShrink:0}}>🏭</button>}
            {isAdmin&&expUrl&&<a href={expUrl} target="_blank" rel="noreferrer" title="Open Expense Tracker" style={{display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,background:"var(--amber-bg)",border:"1px solid rgba(255,214,10,.25)",borderRadius:9,cursor:"pointer",fontSize:17,textDecoration:"none",flexShrink:0}}>💲</a>}
            {isAdmin&&!expUrl&&<button onClick={()=>setShowExpUrl(true)} title="Link Expense Tracker" style={{display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,background:"var(--bg4)",border:"1px solid var(--border)",borderRadius:9,cursor:"pointer",fontSize:17,flexShrink:0}}>💲</button>}
            <button onClick={toggleTheme} title={theme==="dark"?"Switch to light":"Switch to dark"} style={{display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,background:"var(--bg4)",border:"1px solid var(--border)",borderRadius:9,cursor:"pointer",fontSize:15,flexShrink:0}}>{theme==="dark"?"☀️":"🌙"}</button>
            {isAdmin&&<button onClick={()=>setShowChgPw(true)} title="Passwords" style={{display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,background:"var(--bg4)",border:"1px solid var(--border)",borderRadius:9,cursor:"pointer",fontSize:15,flexShrink:0}}>🔒</button>}
            <button onClick={()=>{sessionStorage.removeItem("frameOS_role");setRole(null);}} title="Lock" style={{display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,background:"var(--bg4)",border:"1px solid var(--border)",borderRadius:9,cursor:"pointer",fontSize:15,flexShrink:0}}>↩</button>
          </div>
        </header>
        <main style={{flex:1,padding:"26px 28px",minWidth:0,overflow:"hidden"}}>
          {safeTab==="projects"&&<ProjectsView allCrew={allCrew} setAllCrew={setAllCrew} role={role} expTrackerUrl={expUrl} allVendors={allVendors}/>}
          {safeTab==="finance"&&isAdmin&&<FinanceView/>}
          {safeTab==="clients"&&<ClientsView role={role}/>}
          {safeTab==="crew"&&<CrewView allCrew={allCrew} setAllCrew={setAllCrew} projects={[]} role={role}/>}
          {safeTab==="quotes"&&isAdmin&&<QuotesView projects={[]}/>}
          {safeTab==="about"&&<AboutView role={role}/>}
        </main>
        {/* Mobile bottom nav */}
        <nav className="bnav">
          {NAV.map(n=><button key={n.id} className={`bni${safeTab===n.id?" active":""}`} onClick={()=>setTab(n.id)}>
            <span className="bni-ic">{n.icon}</span><span className="bni-lb">{n.label}</span>
          </button>)}
        </nav>
        <footer style={{borderTop:"1px solid var(--border)",padding:"12px 28px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>{studioName} · v2.2 · {isAdmin?"Synced with Supabase":"View only"}</span>
          {isAdmin&&<span style={{fontSize:11,color:"var(--text3)",fontFamily:"'Geist Mono',monospace"}}>Default: frame2026 / view2026</span>}
        </footer>
      </div>
    </div>
    {showChgPw&&<ChangePassModal onClose={()=>setShowChgPw(false)} onSave={handleChgAdmin} viewerPassword={viewerPw} onSaveViewer={handleChgViewer}/>}
    {showVendors&&<VendorModal onClose={()=>setShowVendors(false)} vendors={allVendors} setVendors={setAllVendors}/>}
    {showExpUrl&&<Modal title="Link Expense Tracker" onClose={()=>setShowExpUrl(false)}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:9,padding:13,fontSize:13,color:"var(--text2)",lineHeight:1.7}}>Paste the URL of your Expense Tracker HTML file (hosted on Netlify or opened locally). This enables the 💰 Expenses button in the header and auto-matches project expenses by client name.</div>
        <div><Lbl ch="Expense Tracker URL"/><Inp value={expUrl} onChange={setExpUrl} placeholder="https://your-tracker.netlify.app"/></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:4}}><button className="btn-g" onClick={()=>setShowExpUrl(false)}>Cancel</button><button className="btn-p" onClick={()=>setShowExpUrl(false)}>Save</button></div>
      </div>
    </Modal>}
  </>);
}
