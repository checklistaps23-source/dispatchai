import { useState, useEffect, useRef } from "react";
import React from "react";
import { db } from "./firebase";
import { dbChecklists } from "./firebaseChecklists";
import { doc, onSnapshot, setDoc, getDoc, getDocs, deleteDoc, collection, query, where, addDoc } from "firebase/firestore";
import emailjs from "@emailjs/browser";

// Hook générique : synchronise un state React avec un document Firestore
// (collection "dispatchai"), en temps réel, pour toutes les tablettes.
// Même signature qu'un useState classique -> remplace facilement les
// useState existants sans toucher au reste du code (setX(prev=>...) marche).
function useFirestoreState(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const firstSnapshot = useRef(true);

  useEffect(() => {
    const ref = doc(db, "dispatchai", key);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setValue(snap.data().data);
      } else if (firstSnapshot.current) {
        setDoc(ref, { data: initialValue }).catch(()=>{});
      }
      firstSnapshot.current = false;
    }, (err)=>{ console.error("Firestore sync error ("+key+"):", err); });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = (newValOrFn) => {
    setValue(prev => {
      const next = typeof newValOrFn === "function" ? newValOrFn(prev) : newValOrFn;
      setDoc(doc(db, "dispatchai", key), { data: sanitizeUndefined(next) }).catch((err)=>console.error("Firestore write error ("+key+"):", err));
      return next;
    });
  };

  return [value, update];
}

// Firestore refuse les valeurs `undefined` n'importe où dans un document —
// ça fait planter l'écriture. On les remplace récursivement par `null`
// avant d'envoyer, pour ne jamais faire crasher l'app (ex: double-clic
// rapide qui efface une valeur avant que l'état se soit stabilisé).
function sanitizeUndefined(obj) {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeUndefined);
  const clean = {};
  for (const k in obj) clean[k] = sanitizeUndefined(obj[k]);
  return clean;
}

// Hook dédié aux checklists : synchronise l'état de remplissage d'une
// checklist (véhicule + semaine) via le projet Firebase "check-list-peremption"
// (collection dispatchai_checklists). La clé inclut la semaine -> reset
// automatique chaque lundi (nouvelle clé = document vide).
function useChecklistDoc(docId, initialValue) {
  const [value, setValue] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);
  const firstSnapshot = useRef(true);

  useEffect(() => {
    setLoaded(false);
    const ref = doc(dbChecklists, "dispatchai_checklists", docId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setValue({ ...initialValue, ...snap.data() });
      } else if (firstSnapshot.current) {
        setValue(initialValue);
      }
      firstSnapshot.current = false;
      setLoaded(true);
    }, (err)=>{ console.error("Firestore checklist sync error ("+docId+"):", err); setLoaded(true); });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const update = (patch) => {
    setValue(prev => {
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      setDoc(doc(dbChecklists, "dispatchai_checklists", docId), sanitizeUndefined(next), { merge: true }).catch((err)=>console.error("Firestore checklist write error ("+docId+"):", err));
      return next;
    });
  };

  return [value, update, loaded];
}

const DARK_THEME = {
  bg:"#07090f", panel:"#0d1117", panel2:"#111827", panel3:"#141f30",
  border:"#1a2d45", accent:"#f97316", accentSoft:"rgba(249,115,22,0.11)",
  accentGlow:"rgba(249,115,22,0.25)", text:"#e8f0fa", muted:"#3d5a7a",
  mutedLight:"#5a7a9a", success:"#22c55e", successSoft:"rgba(34,197,94,0.11)",
  danger:"#ef4444", dangerSoft:"rgba(239,68,68,0.10)",
  warning:"#f59e0b", warningSoft:"rgba(245,158,11,0.10)",
  blue:"#38bdf8", blueSoft:"rgba(56,189,248,0.10)",
  purple:"#a78bfa", purpleSoft:"rgba(167,139,250,0.10)",
};
const LIGHT_THEME = {
  bg:"#f5f7fb", panel:"#ffffff", panel2:"#f0f3f9", panel3:"#e7ecf5",
  border:"#dbe3f0", accent:"#f97316", accentSoft:"rgba(249,115,22,0.10)",
  accentGlow:"rgba(249,115,22,0.18)", text:"#101828", muted:"#8a96ab",
  mutedLight:"#5e6b82", success:"#16a34a", successSoft:"rgba(22,163,74,0.10)",
  danger:"#dc2626", dangerSoft:"rgba(220,38,38,0.08)",
  warning:"#d97706", warningSoft:"rgba(217,119,6,0.10)",
  blue:"#0284c7", blueSoft:"rgba(2,132,199,0.10)",
  purple:"#7c3aed", purpleSoft:"rgba(124,58,237,0.10)",
};
const C = { ...DARK_THEME };
function applyThemeMode(mode){
  Object.assign(C, mode==="light"?LIGHT_THEME:DARK_THEME);
  try{ localStorage.setItem("aps_theme_mode", mode); }catch(e){}
}
function getStoredThemeMode(){
  try{ return localStorage.getItem("aps_theme_mode")||"dark"; }catch(e){ return "dark"; }
}
applyThemeMode(getStoredThemeMode());

// Persistance de la session Chauffeur dans le stockage local : si la
// tablette recharge la page (bug, wifi, batterie) ou perd la connexion,
// on retrouve automatiquement le chauffeur/véhicule/écran en cours, sans
// être "déconnecté" et renvoyé au menu principal.
function lsGet(key, fallback){
  try{ const v=localStorage.getItem(key); return v!==null?JSON.parse(v):fallback; }catch(e){ return fallback; }
}
function lsSet(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){}
}

const GS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;background:${C.bg};}
  button,input,select,textarea{font-family:'IBM Plex Sans',sans-serif;}
  input::placeholder,textarea::placeholder{color:#1e3050;}
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:#1a2d45;border-radius:2px;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pop{from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)}}
  @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
  @keyframes pinShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
`;

const INIT_VEHICLES = [
  {id:"T1",name:"TPMR 1",type:"TPMR",driver:"Dupont M.",  status:"disponible",active:true, x:28,y:35},
  {id:"T2",name:"TPMR 2",type:"TPMR",driver:"Martin L.",  status:"disponible",active:true, x:55,y:22},
  {id:"T3",name:"TPMR 3",type:"TPMR",driver:"Bernard K.", status:"disponible",active:true, x:72,y:55},
  {id:"T4",name:"TPMR 4",type:"TPMR",driver:"Leroy P.",   status:"disponible",active:true, x:40,y:68},
  {id:"T5",name:"TPMR 5",type:"TPMR",driver:"Simon A.",   status:"disponible",active:false,x:18,y:58},
  {id:"T6",name:"TPMR 6",type:"TPMR",driver:"Petit R.",   status:"disponible",active:true, x:82,y:28},
  {id:"T7",name:"TPMR 7",type:"TPMR",driver:"Garcia E.",  status:"disponible",active:false,x:62,y:78},
  {id:"T8",name:"TPMR 8",type:"TPMR",driver:"Moreau S.",  status:"disponible",active:true, x:33,y:18},
  {id:"V1",name:"VSL 1", type:"VSL", driver:"Lambert C.", status:"disponible",active:true, x:88,y:44},
  {id:"V2",name:"VSL 2", type:"VSL", driver:"Renard P.",  status:"disponible",active:false,x:14,y:80},
  {id:"A1",name:"ALPHA 1",type:"AMB",driver:"Rousseau T.",status:"disponible",active:true, x:50,y:44},
  {id:"A2",name:"ALPHA 2",type:"AMB",driver:"Blanc N.",   status:"disponible",active:true, x:22,y:82},
  {id:"A3",name:"ALPHA 3",type:"AMB",driver:"Faure J.",   status:"disponible",active:false,x:66,y:16},
  {id:"A4",name:"ALPHA 4",type:"AMB",driver:"Collin M.",  status:"disponible",active:false,x:30,y:64},
  {id:"A5",name:"ALPHA 5",type:"AMB",driver:"Picard L.",  status:"disponible",active:false,x:76,y:70},
  {id:"A6",name:"ALPHA 6",type:"AMB",driver:"Aubert S.",  status:"disponible",active:false,x:46,y:88},
  {id:"A7",name:"ALPHA 7",type:"AMB",driver:"Bonnet R.",  status:"disponible",active:false,x:91,y:20},
];

const INIT_DRIVERS_AMB = [
  "Aubert S.","Bernard K.","Blanc N.","Bonnet R.","Collin M.",
  "Dupont M.","Faure J.","Rousseau T.","Simon A.",
];
const INIT_DRIVERS_TPMR = [
  "Garcia E.","Lambert C.","Leroy P.",
  "Martin L.","Moreau S.","Petit R.","Picard L.","Renard P.",
];
const INIT_STAGIAIRES_AMB = ["Merci T."];
const INIT_FORMATION_TPMR = ["Noël A."];

const INIT_CONVENTIONS = [
  {id:"prive",label:"Privé",icon:"👤"},
  {id:"home",label:"Home",icon:"🏠"},
  {id:"epicura",label:"Épicura",icon:"🏥"},
  {id:"partenamut",label:"Partenamut",icon:"🤝"},
  {id:"mutas",label:"Mutas",icon:"🤝"},
  {id:"chwapi",label:"CHWAPI",icon:"🏨"},
  {id:"chm",label:"CHM",icon:"🏨"},
  {id:"prison",label:"Prison",icon:"🔒"},
  {id:"az_glorieux",label:"AZ Glorieux",icon:"🏥"},
  {id:"autre",label:"Autre",icon:"✏️"},
];

const INIT_EQUIPEMENTS = [
  {id:"perfusion",label:"Sous perfusion",icon:"💉",forceAmb:true},
  {id:"oxygene",label:"Sous oxygène",icon:"💨",forceAmb:true},
  {id:"chaise_evac",label:"Chaise d'évac",icon:"🪑",forceAmb:true},
];

const INIT_TRANSPORT_TYPES = [
  {id:"consultation",label:"Consultation",icon:"🏥"},
  {id:"hospitalisation",label:"Hospitalisation",icon:"🛏"},
  {id:"urgences",label:"Urgences",icon:"🚨"},
  {id:"transfert_inter",label:"Transfert inter-site",icon:"🔄"},
  {id:"transfert_extra",label:"Transfert extra-site",icon:"🚀"},
  {id:"radiotherapie",label:"Radiothérapie",icon:"☢️"},
  {id:"oncologie",label:"Oncologie",icon:"🎗"},
  {id:"dialyse",label:"Dialyse",icon:"💧"},
  {id:"retour_domicile",label:"Retour domicile",icon:"🏠"},
];

// Liste "Nature de mission" propre au Carnet de bord (séparée de celle du
// Formulaire), éditable dans Paramètres → Carnet de bord.
const INIT_CARNET_TYPES = [
  {id:"consultation",label:"Consultation",icon:"🏥"},
  {id:"retour_consultation",label:"Retour consultation",icon:"↩️"},
  {id:"radiotherapie",label:"Radiothérapie",icon:"☢️"},
  {id:"retour_radiotherapie",label:"Retour radiothérapie",icon:"↩️"},
  {id:"dialyse",label:"Dialyse",icon:"💧"},
  {id:"retour_dialyse",label:"Retour dialyse",icon:"↩️"},
  {id:"oncologie",label:"Oncologie",icon:"🎗"},
  {id:"retour_oncologie",label:"Retour oncologie",icon:"↩️"},
  {id:"hospitalisation",label:"Hospitalisation",icon:"🛏"},
  {id:"urgences",label:"Urgences",icon:"🚨"},
  {id:"transfert_inter",label:"Transfert inter-site",icon:"🔄"},
  {id:"transfert_extra",label:"Transfert extra-site",icon:"📍"},
  {id:"retour_base",label:"Retour base",icon:"🏠"},
  {id:"retour_domicile",label:"Retour domicile du chauffeur",icon:"🚗"},
];

const INIT_BASES = ["La Glanerie","Baudour","Ath"];
const INIT_CONTACTS = [
  {id:"c1",nom:"CHU Mons",tel:"065 38 21 11"},
  {id:"c2",nom:"Clinique Reine Astrid",tel:"065 75 35 11"},
  {id:"c3",nom:"Home Saint-Joseph",tel:"065 22 34 56"},
];
const INIT_PLANS = [];

const INIT_COURSES = [
  {id:1,vehicleId:"T1",patient:"Dubois Jean",   depart:"12 rue des Lilas, Mons",     arrivee:"CHU Mons — Cardio",    heure:"09:00",type:"consultation",statut:"planifie",convention:"epicura",   mobilite:"assis"},
  {id:2,vehicleId:"T2",patient:"Garcia Sophie",  depart:"3 impasse des Roses, Mons",  arrivee:"CHU Mons — Dialyse",   heure:"09:30",type:"dialyse",     statut:"planifie",convention:"partenamut",mobilite:"chaise_perso",oxygene:true,litrageO2:3},
  {id:3,vehicleId:"A1",patient:"Rousseau Michel",depart:"CHU Mons — Urgences",        arrivee:"Clinique Reine Astrid",heure:"10:00",type:"transfert_extra",statut:"planifie",convention:"chwapi",mobilite:"brancard",oxygene:true,litrageO2:6},
  {id:4,vehicleId:"T3",patient:"Lambert Jeanne", depart:"67 rue Bara, Frameries",     arrivee:"CHU Mons — Ophtalmo",  heure:"11:00",type:"consultation",statut:"planifie",convention:"home",    mobilite:"assis"},
].map(c=>({...c,dateISO:(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;})()}));

const vIcon  = t => t==="AMB"?"🚑":t==="VSL"?"🚗":"♿";
const vColor = t => t==="AMB"?C.danger:t==="VSL"?C.purple:C.blue;
const needsAmb = (mobilite, equip) => mobilite==="brancard"||(equip||[]).some(e=>["perfusion","oxygene","chaise_evac"].includes(e));

const CONV_MAP = {"epicura":"Épicura","partenamut":"Partenamut","home":"Home","chwapi":"CHWAPI","chm":"CHM","prive":"Privé","mutas":"Mutas","prison":"Prison","az_glorieux":"AZ Glorieux"};
const TYPE_MAP = {"consultation":"🏥","hospitalisation":"🛏","urgences":"🚨","transfert_inter":"🔄","transfert_extra":"🚀","radiotherapie":"☢️","oncologie":"🎗","dialyse":"💧","retour_domicile":"🏠"};

function Clock(){
  const [t,setT]=useState(new Date());
  useEffect(()=>{const id=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(id);},[]);
  return <span style={{fontSize:13,color:C.muted,fontFamily:"'IBM Plex Mono',monospace"}}>{t.toLocaleTimeString("fr-FR")}</span>;
}

function Badge({color,soft,children,pulse:p}){
  return(
    <div style={{background:soft,border:`1px solid ${color}`,borderRadius:20,padding:"3px 10px",fontSize:11,color,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
      {p&&<div style={{width:6,height:6,borderRadius:"50%",background:color,animation:"pulse 2s infinite"}}/>}
      {children}
    </div>
  );
}

function SectionTitle({icon,title}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
      <span style={{fontSize:16}}>{icon}</span>
      <span style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"1.2px"}}>{title}</span>
      <div style={{flex:1,height:1,background:C.border}}/>
    </div>
  );
}

function FieldWrap({label,error,touched,required,children}){
  const hasErr=touched&&error;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:10,fontWeight:700,color:hasErr?C.danger:C.mutedLight,letterSpacing:"0.8px",textTransform:"uppercase",display:"flex",gap:3}}>
        {label}{required&&<span style={{color:C.accent}}>*</span>}
      </label>
      {children}
      {hasErr&&<span style={{fontSize:10,color:C.danger}}>⚠ {error}</span>}
    </div>
  );
}

function TextInput({value,onChange,onBlur,placeholder,type="text",error,touched,style:sx}){
  const [focused,setFocused]=useState(false);
  const hasErr=touched&&error;
  return(
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      onFocus={()=>setFocused(true)} onBlur={()=>{setFocused(false);onBlur&&onBlur();}}
      style={{background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${hasErr?C.danger:focused?C.accent:C.border}`,borderRadius:9,padding:"10px 13px",outline:"none",width:"100%",boxSizing:"border-box",transition:"border-color 0.2s",boxShadow:focused?`0 0 0 3px ${hasErr?"rgba(239,68,68,0.08)":C.accentSoft}`:"none",fontFamily:"inherit",...sx}}/>
  );
}

function DateInput({value,onChange}){
  const handleChange=(e)=>{
    let v=e.target.value.replace(/\D/g,"");
    if(v.length>2) v=v.slice(0,2)+"/"+v.slice(2);
    if(v.length>5) v=v.slice(0,5)+"/"+v.slice(5);
    if(v.length>10) v=v.slice(0,10);
    onChange(v);
  };
  return(
    <input value={value} onChange={handleChange} placeholder="JJ/MM/AAAA" maxLength={10}
      style={{background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit"}}/>
  );
}

function HeureInput({value,onChange,placeholder="HHhMM"}){
  const handleChange=(e)=>{
    let v=e.target.value.replace(/\D/g,"");
    if(v.length>2) v=v.slice(0,2)+"h"+v.slice(2);
    if(v.length>5) v=v.slice(0,5);
    onChange(v);
  };
  return(
    <input value={value} onChange={handleChange} placeholder={placeholder} maxLength={5}
      style={{background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit"}}/>
  );
}

function SignaturePadInline({onSave,onCancel}){
  const ref=useRef(null);
  const drawing=useRef(false);
  const getPos=(e,c)=>{const r=c.getBoundingClientRect(),s=e.touches?e.touches[0]:e;return{x:s.clientX-r.left,y:s.clientY-r.top};};
  const start=(e)=>{drawing.current=true;const c=ref.current,ctx=c.getContext("2d"),p=getPos(e,c);ctx.beginPath();ctx.moveTo(p.x,p.y);};
  const move=(e)=>{if(!drawing.current)return;e.preventDefault();const c=ref.current,ctx=c.getContext("2d"),p=getPos(e,c);ctx.lineTo(p.x,p.y);ctx.strokeStyle="#e8f0fa";ctx.lineWidth=2.5;ctx.lineCap="round";ctx.stroke();};
  const end=()=>{drawing.current=false;};
  const clear=()=>ref.current.getContext("2d").clearRect(0,0,ref.current.width,ref.current.height);
  return(
    <div style={{textAlign:"center"}}>
      <canvas ref={ref} width={340} height={130} style={{background:"#0a1220",border:`1.5px solid ${C.border}`,borderRadius:10,touchAction:"none",display:"block",margin:"0 auto"}} onMouseDown={start} onMouseMove={move} onMouseUp={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end}/>
      <div style={{display:"flex",gap:8,marginTop:10,justifyContent:"center"}}>
        <button onClick={clear} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"7px 16px",fontSize:12,cursor:"pointer"}}>Effacer</button>
        <button onClick={onCancel} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"7px 16px",fontSize:12,cursor:"pointer"}}>Annuler</button>
        <button onClick={()=>onSave(ref.current.toDataURL())} style={{background:C.success,border:"none",borderRadius:8,color:"white",padding:"7px 20px",fontSize:12,fontWeight:800,cursor:"pointer"}}>✅ Valider</button>
      </div>
    </div>
  );
}

function PinModal({onSuccess,onCancel}){
  const [pin,setPin]=useState("");
  const [shake,setShake]=useState(false);
  const correct="112";
  const handleKey=(k)=>{
    if(k==="del"){setPin(p=>p.slice(0,-1));return;}
    if(pin.length>=3) return;
    const next=pin+k;
    setPin(next);
    if(next.length===3){
      if(next===correct){setTimeout(()=>onSuccess(),200);}
      else{setShake(true);setTimeout(()=>{setPin("");setShake(false);},600);}
    }
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:18,padding:"32px",width:320,textAlign:"center",animation:"pop 0.2s ease"}}>
        <style>{GS}</style>
        <div style={{fontSize:32,marginBottom:8}}>🔒</div>
        <div style={{fontWeight:800,fontSize:18,marginBottom:4}}>Paramètres</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:24}}>Entrez le code PIN</div>
        <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:28,animation:shake?"pinShake 0.3s ease":"none"}}>
          {[0,1,2].map(i=>(
            <div key={i} style={{width:14,height:14,borderRadius:"50%",background:pin.length>i?C.accent:C.border,border:`2px solid ${pin.length>i?C.accent:C.border}`,transition:"all 0.15s"}}/>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
          {["1","2","3","4","5","6","7","8","9","","0","del"].map((k,i)=>(
            <button key={i} onClick={()=>k&&handleKey(k)}
              style={{padding:"14px",borderRadius:10,border:`1px solid ${C.border}`,background:k?C.panel2:C.bg,color:k==="del"?C.danger:C.text,fontSize:k==="del"?18:20,fontWeight:700,cursor:k?"pointer":"default"}}>
              {k==="del"?"⌫":k}
            </button>
          ))}
        </div>
        <button onClick={onCancel} style={{width:"100%",background:"transparent",border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"10px",fontSize:13,cursor:"pointer"}}>Annuler</button>
      </div>
    </div>
  );
}

function ParametresView({driversAmb,setDriversAmb,driversTpmr,setDriversTpmr,stagiairesAmb,setStagiairesAmb,formationTpmr,setFormationTpmr,vehicles,setVehicles,conventions,setConventions,equipements,setEquipements,transportTypes,setTransportTypes,bases,setBases,contacts,setContacts,plans,setPlans,tarifs,setTarifs,checklistsData,setChecklistsData,checklistEmails,setChecklistEmails,o2Emails,setO2Emails,peremptionEmails,setPeremptionEmails,listeRouge,setListeRouge,carnetBordTypes,setCarnetBordTypes,onBack,themeMode,toggleTheme}){
  const [tab,setTab]=useState("chauffeurs");
  const [tpmrVslTemplate,setTpmrVslTemplate]=useFirestoreState("tpmrVslChecklistTemplate",{ sections:[] });
  const [newVal,setNewVal]=useState("");
  const [newVehName,setNewVehName]=useState("");
  const [newVehType,setNewVehType]=useState("TPMR");
  const [newConvLabel,setNewConvLabel]=useState("");
  const [newEquipLabel,setNewEquipLabel]=useState("");
  const [newEquipForceAmb,setNewEquipForceAmb]=useState(false);
  const [newTypeLabel,setNewTypeLabel]=useState("");
  const [newTypeIcon,setNewTypeIcon]=useState("🚑");
  const [subTab,setSubTab]=useState("amb");
  const [editingChecklist,setEditingChecklist]=useState(null); // {key, isNew, norme, edition, sections}
  const [editingDailyVehicle,setEditingDailyVehicle]=useState(null); // vehicle object being edited
  const [editingDailySections,setEditingDailySections]=useState([]);
  const [dailyNewItemLabel,setDailyNewItemLabel]=useState({});
  const [dailyNewSectionLabel,setDailyNewSectionLabel]=useState("");
  const [dailySaving,setDailySaving]=useState(false);
  const [newRougeName,setNewRougeName]=useState("");
  const [newRougeReason,setNewRougeReason]=useState("");
  const [newRougeBirthdate,setNewRougeBirthdate]=useState("");
  const [newCarnetLabel,setNewCarnetLabel]=useState("");
  const [newCarnetIcon,setNewCarnetIcon]=useState("📍");
  const [confirmDeleteChecklist,setConfirmDeleteChecklist]=useState(null); // vehicle name pending delete
  const [newEmail,setNewEmail]=useState("");
  const [newO2Email,setNewO2Email]=useState("");
  const [newPeremptionEmail,setNewPeremptionEmail]=useState("");

  const openNewChecklist=()=>{
    setEditingChecklist({key:"",origKey:null,isNew:true,norme:"",edition:"",sections:[]});
  };
  const openEditChecklist=(name)=>{
    const d=checklistsData[name];
    setEditingChecklist({key:name,origKey:name,isNew:false,norme:d.norme||"",edition:d.edition||"",sections:JSON.parse(JSON.stringify(d.sections||[]))});
  };
  const saveChecklist=()=>{
    if(!editingChecklist||!editingChecklist.key.trim()) return;
    const {key,origKey,norme,edition,sections}=editingChecklist;
    setChecklistsData(prev=>{
      const next={...prev};
      if(origKey&&origKey!==key) delete next[origKey];
      next[key]={norme,edition,sections};
      return next;
    });
    setEditingChecklist(null);
  };
  const addSection=()=>setEditingChecklist(p=>({...p,sections:[...p.sections,{id:String.fromCharCode(65+p.sections.length),label:"Nouvelle section",color:"#f97316",shelves:[]}]}));
  const removeSection=(sIdx)=>setEditingChecklist(p=>({...p,sections:p.sections.filter((_,i)=>i!==sIdx)}));
  const updateSection=(sIdx,field,val)=>setEditingChecklist(p=>({...p,sections:p.sections.map((s,i)=>i===sIdx?{...s,[field]:val}:s)}));
  const addShelf=(sIdx)=>setEditingChecklist(p=>({...p,sections:p.sections.map((s,i)=>i===sIdx?{...s,shelves:[...s.shelves,{id:`sh${s.shelves.length+1}`,label:"",items:[]}]}:s)}));
  const removeShelf=(sIdx,shIdx)=>setEditingChecklist(p=>({...p,sections:p.sections.map((s,i)=>i===sIdx?{...s,shelves:s.shelves.filter((_,j)=>j!==shIdx)}:s)}));
  const updateShelf=(sIdx,shIdx,field,val)=>setEditingChecklist(p=>({...p,sections:p.sections.map((s,i)=>i===sIdx?{...s,shelves:s.shelves.map((sh,j)=>j===shIdx?{...sh,[field]:val}:sh)}:s)}));
  const addItem=(sIdx,shIdx)=>setEditingChecklist(p=>({...p,sections:p.sections.map((s,i)=>i===sIdx?{...s,shelves:s.shelves.map((sh,j)=>j===shIdx?{...sh,items:[...sh.items,{n:"Nouvel article",q:1}]}:sh)}:s)}));
  const removeItem=(sIdx,shIdx,itIdx)=>setEditingChecklist(p=>({...p,sections:p.sections.map((s,i)=>i===sIdx?{...s,shelves:s.shelves.map((sh,j)=>j===shIdx?{...sh,items:sh.items.filter((_,k)=>k!==itIdx)}:sh)}:s)}));
  const updateItem=(sIdx,shIdx,itIdx,field,val)=>setEditingChecklist(p=>({...p,sections:p.sections.map((s,i)=>i===sIdx?{...s,shelves:s.shelves.map((sh,j)=>j===shIdx?{...sh,items:sh.items.map((it,k)=>k===itIdx?{...it,[field]:val}:it)}:sh)}:s)}));

  const TABS=[{id:"chauffeurs",icon:"👤",label:"Chauffeurs"},{id:"stagiaires",icon:"🎓",label:"Stag/Form."},{id:"vehicules",icon:"🚐",label:"Véhicules"},{id:"conventions",icon:"📞",label:"Conventions"},{id:"equipements",icon:"🏥",label:"Équipements"},{id:"transports",icon:"🔖",label:"Transports"},{id:"bases",icon:"🏠",label:"Bases"},{id:"contacts",icon:"📒",label:"Contacts"},{id:"plans",icon:"🗺️",label:"Plans"},{id:"tarifs",icon:"💶",label:"Tarifs"},{id:"checklists",icon:"📋",label:"Checklists"},{id:"daily",icon:"🚑",label:"APS Daily"},{id:"listerouge",icon:"🚫",label:"Liste rouge"},{id:"carnetbord",icon:"📓",label:"Carnet de bord"},{id:"emails",icon:"✉️",label:"Emails"}];
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>{if(editingChecklist){setEditingChecklist(null);}else{onBack();}}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:13,cursor:"pointer"}}>← Menu</button>
          <div style={{width:34,height:34,background:C.accent,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⚙️</div>
          <div><div style={{fontWeight:700,fontSize:14}}>Paramètres</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"1px"}}>Configuration</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}><Badge color={C.success} soft={C.successSoft} pulse>En ligne</Badge><Clock/><button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙 Sombre":"☀️ Clair"}</button></div>
      </div>
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        <div style={{width:180,background:C.panel,borderRight:`1px solid ${C.border}`,padding:"12px 8px",display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"11px 14px",borderRadius:9,border:"none",background:tab===t.id?C.accentSoft:"transparent",color:tab===t.id?C.accent:C.muted,fontWeight:tab===t.id?700:500,fontSize:13,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"24px"}}>
          {tab==="chauffeurs"&&(
            <div>
              <SectionTitle icon="👤" title="Chauffeurs"/>
              <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
                {[{id:"amb",label:"🚑 Ambulance"},{id:"tpmr",label:"♿ TPMR/VSL"},{id:"both",label:"🚑♿ AMB/TPMR"}].map(s=>(
                  <button key={s.id} onClick={()=>setSubTab(s.id)} style={{padding:"7px 14px",borderRadius:8,border:`1.5px solid ${subTab===s.id?C.accent:C.border}`,background:subTab===s.id?C.accentSoft:"transparent",color:subTab===s.id?C.accent:C.muted,fontWeight:subTab===s.id?700:500,fontSize:12,cursor:"pointer"}}>{s.label}</button>
                ))}
              </div>
              {subTab==="both"&&(
                <div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:10}}>🚑♿ Ajoute dans les deux listes automatiquement</div>
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <input value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newVal.trim()){const n=newVal.trim();setDriversAmb(p=>[...p,n].sort((a,b)=>a.localeCompare(b)));setDriversTpmr(p=>[...p,n].sort((a,b)=>a.localeCompare(b)));setNewVal("");}}} placeholder="Nom Prénom (AMB + TPMR)…" style={{background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.accent}`,borderRadius:9,padding:"10px 13px",outline:"none",width:"100%",fontFamily:"inherit"}}/>
                    <button onClick={()=>{if(newVal.trim()){const n=newVal.trim();setDriversAmb(p=>[...p,n].sort((a,b)=>a.localeCompare(b)));setDriversTpmr(p=>[...p,n].sort((a,b)=>a.localeCompare(b)));setNewVal("");}}} style={{background:C.accent,border:"none",borderRadius:9,color:"white",padding:"10px 18px",fontWeight:800,fontSize:16,cursor:"pointer",flexShrink:0}}>+</button>
                  </div>
                  <div style={{marginTop:14,fontSize:11,color:C.muted}}>Chauffeurs ajoutés dans AMB/TPMR :</div>
                  {[...new Set([...driversAmb,...driversTpmr])].sort((a,b)=>a.localeCompare(b)).filter(d=>driversAmb.includes(d)&&driversTpmr.includes(d)).map(d=>(
                    <div key={d} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",marginBottom:6,marginTop:6}}>
                      <span style={{fontSize:13,fontWeight:600}}>🚑♿ {d}</span>
                    </div>
                  ))}
                </div>
              )}
              {subTab==="amb"&&(
                <div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:10}}>Chauffeurs et convoyeurs ambulance</div>
                  {[...driversAmb].sort((a,b)=>a.localeCompare(b)).map(d=>(
                    <div key={d} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7}}>
                      <span style={{fontSize:14,fontWeight:600}}>🚑 {d}</span>
                      <button onClick={()=>setDriversAmb(p=>p.filter(x=>x!==d))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:7,color:C.danger,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Supprimer</button>
                    </div>
                  ))}
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <input value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newVal.trim()){setDriversAmb(p=>[...p,newVal.trim()].sort((a,b)=>a.localeCompare(b)));setNewVal("");}}} placeholder="Nom Prénom ambulancier…" style={{background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none",width:"100%",fontFamily:"inherit"}}/>
                    <button onClick={()=>{if(newVal.trim()){setDriversAmb(p=>[...p,newVal.trim()].sort((a,b)=>a.localeCompare(b)));setNewVal("");}}} style={{background:C.success,border:"none",borderRadius:9,color:"white",padding:"10px 18px",fontWeight:800,fontSize:16,cursor:"pointer",flexShrink:0}}>+</button>
                  </div>
                </div>
              )}
              {subTab==="tpmr"&&(
                <div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:10}}>Chauffeurs TPMR et VSL</div>
                  {[...driversTpmr].sort((a,b)=>a.localeCompare(b)).map(d=>(
                    <div key={d} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7}}>
                      <span style={{fontSize:14,fontWeight:600}}>♿ {d}</span>
                      <button onClick={()=>setDriversTpmr(p=>p.filter(x=>x!==d))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:7,color:C.danger,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Supprimer</button>
                    </div>
                  ))}
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <input value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newVal.trim()){setDriversTpmr(p=>[...p,newVal.trim()].sort((a,b)=>a.localeCompare(b)));setNewVal("");}}} placeholder="Nom Prénom chauffeur TPMR…" style={{background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none",width:"100%",fontFamily:"inherit"}}/>
                    <button onClick={()=>{if(newVal.trim()){setDriversTpmr(p=>[...p,newVal.trim()].sort((a,b)=>a.localeCompare(b)));setNewVal("");}}} style={{background:C.success,border:"none",borderRadius:9,color:"white",padding:"10px 18px",fontWeight:800,fontSize:16,cursor:"pointer",flexShrink:0}}>+</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {tab==="stagiaires"&&(
            <div>
              <SectionTitle icon="🎓" title="Stagiaires & Formation"/>
              <div style={{display:"flex",gap:6,marginBottom:16}}>
                {[{id:"amb",label:"🚑 Stagiaires AMB"},{id:"tpmr",label:"♿ Formation TPMR"}].map(s=>(
                  <button key={s.id} onClick={()=>setSubTab(s.id)} style={{padding:"7px 14px",borderRadius:8,border:`1.5px solid ${subTab===s.id?C.purple:C.border}`,background:subTab===s.id?C.purpleSoft:"transparent",color:subTab===s.id?C.purple:C.muted,fontWeight:subTab===s.id?700:500,fontSize:12,cursor:"pointer"}}>{s.label}</button>
                ))}
              </div>
              {subTab==="amb"&&(
                <div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:10}}>Stagiaires observateurs ambulance</div>
                  {[...stagiairesAmb].sort((a,b)=>a.localeCompare(b)).map(s=>(
                    <div key={s} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}><span>🎓</span><span style={{fontSize:14,fontWeight:600,color:C.purple}}>{s}</span><span style={{fontSize:10,color:C.purple}}>(stagiaire)</span></div>
                      <button onClick={()=>setStagiairesAmb(p=>p.filter(x=>x!==s))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:7,color:C.danger,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Supprimer</button>
                    </div>
                  ))}
                  {stagiairesAmb.length===0&&<div style={{textAlign:"center",padding:"16px 0",color:C.muted,fontSize:13}}>Aucun stagiaire</div>}
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <TextInput value={newVal} onChange={e=>setNewVal(e.target.value)} onBlur={()=>{}} placeholder="Nom Prénom stagiaire AMB…"/>
                    <button onClick={()=>{if(newVal.trim()){setStagiairesAmb(p=>[...p,newVal.trim()].sort((a,b)=>a.localeCompare(b)));setNewVal("");}}} style={{background:C.purple,border:"none",borderRadius:9,color:"white",padding:"10px 18px",fontWeight:800,fontSize:16,cursor:"pointer",flexShrink:0}}>+</button>
                  </div>
                </div>
              )}
              {subTab==="tpmr"&&(
                <div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:10}}>Personnes en formation TPMR/VSL</div>
                  {[...formationTpmr].sort((a,b)=>a.localeCompare(b)).map(s=>(
                    <div key={s} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}><span>📋</span><span style={{fontSize:14,fontWeight:600,color:C.blue}}>{s}</span><span style={{fontSize:10,color:C.blue}}>(formation)</span></div>
                      <button onClick={()=>setFormationTpmr(p=>p.filter(x=>x!==s))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:7,color:C.danger,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Supprimer</button>
                    </div>
                  ))}
                  {formationTpmr.length===0&&<div style={{textAlign:"center",padding:"16px 0",color:C.muted,fontSize:13}}>Aucune formation</div>}
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <TextInput value={newVal} onChange={e=>setNewVal(e.target.value)} onBlur={()=>{}} placeholder="Nom Prénom en formation TPMR…"/>
                    <button onClick={()=>{if(newVal.trim()){setFormationTpmr(p=>[...p,newVal.trim()].sort((a,b)=>a.localeCompare(b)));setNewVal("");}}} style={{background:C.blue,border:"none",borderRadius:9,color:"white",padding:"10px 18px",fontWeight:800,fontSize:16,cursor:"pointer",flexShrink:0}}>+</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {tab==="vehicules"&&(
            <div>
              <SectionTitle icon="🚐" title="Gestion des véhicules"/>
              {["TPMR","VSL","AMB"].map(type=>(
                <div key={type} style={{marginBottom:20}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:8,display:"flex",alignItems:"center",gap:7}}>
                    {vIcon(type)} {type==="AMB"?"Ambulances ALPHA":type}<div style={{flex:1,height:1,background:C.border}}/>
                  </div>
                  {vehicles.filter(v=>v.type===type).map(v=>(
                    <div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",marginBottom:6}}>
                      <span style={{fontSize:13,fontWeight:600}}>{vIcon(type)} {v.name} — {v.driver}</span>
                      <button onClick={()=>setVehicles(p=>p.filter(x=>x.id!==v.id))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:7,color:C.danger,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Supprimer</button>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <TextInput value={newVehName} onChange={e=>setNewVehName(e.target.value)} onBlur={()=>{}} placeholder="Nom du véhicule…"/>
                <select value={newVehType} onChange={e=>setNewVehType(e.target.value)} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px",color:C.text,fontSize:13,cursor:"pointer",flexShrink:0}}>
                  <option value="TPMR">TPMR</option><option value="VSL">VSL</option><option value="AMB">ALPHA</option>
                </select>
                <button onClick={()=>{if(newVehName.trim()){const id=`${newVehType[0]}${Date.now()}`;setVehicles(p=>[...p,{id,name:newVehName.trim(),type:newVehType,driver:"—",status:"disponible",active:false,x:50,y:50}]);setNewVehName("");}}} style={{background:C.success,border:"none",borderRadius:9,color:"white",padding:"10px 18px",fontWeight:800,fontSize:16,cursor:"pointer",flexShrink:0}}>+</button>
              </div>
            </div>
          )}
          {tab==="conventions"&&(
            <div>
              <SectionTitle icon="📞" title="Conventions / Appelants"/>
              <div style={{marginBottom:16}}>
                {conventions.map(c=>(
                  <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7}}>
                    <span style={{fontSize:14,fontWeight:600}}>{c.icon} {c.label}</span>
                    <button onClick={()=>setConventions(p=>p.filter(x=>x.id!==c.id))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:7,color:C.danger,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Supprimer</button>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <TextInput value={newConvLabel} onChange={e=>setNewConvLabel(e.target.value)} onBlur={()=>{}} placeholder="Nom de la convention…"/>
                <button onClick={()=>{if(newConvLabel.trim()){setConventions(p=>[...p,{id:`conv_${Date.now()}`,label:newConvLabel.trim(),icon:"🏥"}]);setNewConvLabel("");}}} style={{background:C.success,border:"none",borderRadius:9,color:"white",padding:"10px 18px",fontWeight:800,fontSize:16,cursor:"pointer",flexShrink:0}}>+</button>
              </div>
            </div>
          )}
          {tab==="equipements"&&(
            <div>
              <SectionTitle icon="🏥" title="Équipements médicaux"/>
              <div style={{marginBottom:16}}>
                {equipements.map(e=>(
                  <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:16}}>{e.icon}</span>
                      <span style={{fontSize:13,fontWeight:600}}>{e.label}</span>
                      {e.forceAmb&&<span style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,color:C.danger,borderRadius:5,padding:"2px 7px",fontSize:9,fontWeight:700}}>AMB obligatoire</span>}
                    </div>
                    <button onClick={()=>setEquipements(p=>p.filter(x=>x.id!==e.id))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:7,color:C.danger,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Supprimer</button>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{flex:1}}><TextInput value={newEquipLabel} onChange={e=>setNewEquipLabel(e.target.value)} onBlur={()=>{}} placeholder="Nom de l'équipement…"/></div>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.muted,cursor:"pointer",flexShrink:0}}>
                  <input type="checkbox" checked={newEquipForceAmb} onChange={e=>setNewEquipForceAmb(e.target.checked)} style={{accentColor:C.danger}}/>
                  Force ambulance
                </label>
                <button onClick={()=>{if(newEquipLabel.trim()){setEquipements(p=>[...p,{id:`eq_${Date.now()}`,label:newEquipLabel.trim(),icon:"🏥",forceAmb:newEquipForceAmb}]);setNewEquipLabel("");setNewEquipForceAmb(false);}}} style={{background:C.success,border:"none",borderRadius:9,color:"white",padding:"10px 18px",fontWeight:800,fontSize:16,cursor:"pointer",flexShrink:0}}>+</button>
              </div>
            </div>
          )}
          {tab==="transports"&&(
            <div>
              <SectionTitle icon="🔖" title="Types de transport"/>
              <div style={{marginBottom:16}}>
                {transportTypes.map(t=>(
                  <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7}}>
                    <span style={{fontSize:13,fontWeight:600}}>{t.icon} {t.label}</span>
                    <button onClick={()=>setTransportTypes(p=>p.filter(x=>x.id!==t.id))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:7,color:C.danger,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Supprimer</button>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <div style={{width:60}}><TextInput value={newTypeIcon} onChange={e=>setNewTypeIcon(e.target.value)} onBlur={()=>{}} placeholder="🚑"/></div>
                <div style={{flex:1}}><TextInput value={newTypeLabel} onChange={e=>setNewTypeLabel(e.target.value)} onBlur={()=>{}} placeholder="Nom du type…"/></div>
                <button onClick={()=>{if(newTypeLabel.trim()){setTransportTypes(p=>[...p,{id:`type_${Date.now()}`,label:newTypeLabel.trim(),icon:newTypeIcon||"🚑"}]);setNewTypeLabel("");setNewTypeIcon("🚑");}}} style={{background:C.success,border:"none",borderRadius:9,color:"white",padding:"10px 18px",fontWeight:800,fontSize:16,cursor:"pointer",flexShrink:0}}>+</button>
              </div>
            </div>
          )}
          {tab==="contacts"&&(
            <div>
              <SectionTitle icon="📒" title="Carnet de contacts"/>
              <div style={{marginBottom:16}}>
                {[...contacts].sort((a,b)=>a.nom.localeCompare(b.nom)).map(c=>(
                  <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7}}>
                    <div><div style={{fontSize:13,fontWeight:600}}>📒 {c.nom}</div><div style={{fontSize:11,color:C.muted}}>{c.tel}</div></div>
                    <button onClick={()=>setContacts(p=>p.filter(x=>x.id!==c.id))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:7,color:C.danger,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Supprimer</button>
                  </div>
                ))}
                {contacts.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:C.muted,fontSize:13}}>Aucun contact</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <input value={newVal} onChange={e=>setNewVal(e.target.value)} placeholder="Nom du contact…" style={{background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none",fontFamily:"inherit"}}/>
                <div style={{display:"flex",gap:8}}>
                  <input value={newConvLabel} onChange={e=>setNewConvLabel(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newVal.trim()&&newConvLabel.trim()){setContacts(p=>[...p,{id:`c_${Date.now()}`,nom:newVal.trim(),tel:newConvLabel.trim()}]);setNewVal("");setNewConvLabel("");}}} placeholder="Numéro de téléphone…" style={{background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none",flex:1,fontFamily:"inherit"}}/>
                  <button onClick={()=>{if(newVal.trim()&&newConvLabel.trim()){setContacts(p=>[...p,{id:`c_${Date.now()}`,nom:newVal.trim(),tel:newConvLabel.trim()}]);setNewVal("");setNewConvLabel("");}}} style={{background:C.success,border:"none",borderRadius:9,color:"white",padding:"10px 18px",fontWeight:800,fontSize:16,cursor:"pointer",flexShrink:0}}>+</button>
                </div>
              </div>
            </div>
          )}
          {tab==="plans"&&(
            <div>
              <SectionTitle icon="🗺️" title="Plans des sites"/>
              <div style={{marginBottom:16}}>
                {plans.map((p,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7}}>
                    <div><div style={{fontSize:13,fontWeight:600,color:C.text}}>🗺️ {p.nom}</div><div style={{fontSize:10,color:C.success}}>PDF chargé ✓</div></div>
                    <button onClick={()=>setPlans(prev=>prev.filter((_,j)=>j!==i))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:7,color:C.danger,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Supprimer</button>
                  </div>
                ))}
                {plans.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:C.muted,fontSize:13}}>Aucun plan</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <input value={newVal} onChange={e=>setNewVal(e.target.value)} placeholder="Nom du site (ex: CHU Mons)…" style={{background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none",fontFamily:"inherit"}}/>
                <label style={{display:"flex",alignItems:"center",gap:10,background:C.panel2,border:`1.5px dashed ${C.border}`,borderRadius:9,padding:"14px",cursor:"pointer"}}>
                  <span style={{fontSize:20}}>📄</span>
                  <div><div style={{fontSize:13,color:C.text,fontWeight:600}}>Choisir un PDF</div><div style={{fontSize:10,color:C.muted}}>Plan du site en format PDF</div></div>
                  <input type="file" accept=".pdf" style={{display:"none"}} onChange={e=>{
                    const file=e.target.files[0];
                    if(file&&newVal.trim()){
                      const reader=new FileReader();
                      reader.onload=ev=>setPlans(p=>[...p,{nom:newVal.trim(),data:ev.target.result,filename:file.name}].sort((a,b)=>a.nom.localeCompare(b.nom)));
                      reader.readAsDataURL(file);
                      setNewVal("");
                    }
                  }}/>
                </label>
              </div>
            </div>
          )}
          {tab==="tarifs"&&(
            <div>
              <SectionTitle icon="💶" title="Tarifs — Simulateur de devis"/>
              <div style={{fontSize:11,color:C.muted,marginBottom:18}}>Ces tarifs servent au simulateur de devis dans Dispatch. La prise en charge inclut les 10 premiers km. Modifie-les chaque année selon le barème en vigueur.</div>

              <div style={{marginBottom:22}}>
                <div style={{fontSize:12,fontWeight:800,color:C.blue,marginBottom:10}}>♿ TPMR</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[
                    {f:"priseEnCharge",l:"Prise en charge — 10 premiers km inclus (€)"},
                    {f:"kmAudela10",l:"Tarif €/km — au-delà de 10 km"},
                  ].map(f=>(
                    <div key={f.f}>
                      <div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>{f.l}</div>
                      <input type="text" inputMode="decimal" value={tarifs.tpmr[f.f]} onChange={e=>{
                        let v=e.target.value.replace(/[^0-9.]/g,"");
                        const parts=v.split(".");
                        if(parts.length>2) v=parts[0]+"."+parts.slice(1).join("");
                        setTarifs(p=>({...p,tpmr:{...p.tpmr,[f.f]:v}}));
                      }}
                        style={{width:"100%",background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none",fontFamily:"inherit"}}/>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{marginBottom:22}}>
                <div style={{fontSize:12,fontWeight:800,color:C.danger,marginBottom:10}}>🚑 Ambulance</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[
                    {f:"priseEnCharge",l:"Prise en charge — 10 premiers km inclus (€)"},
                    {f:"km11_20",l:"Tarif €/km — 11 à 20 km"},
                    {f:"km21plus",l:"Tarif €/km — 21 km et +"},
                    {f:"oxygeneDemiH",l:"Oxygène — forfait par demi-heure (€)"},
                  ].map(f=>(
                    <div key={f.f}>
                      <div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>{f.l}</div>
                      <input type="text" inputMode="decimal" value={tarifs.ambulance[f.f]} onChange={e=>{
                        let v=e.target.value.replace(/[^0-9.]/g,"");
                        const parts=v.split(".");
                        if(parts.length>2) v=parts[0]+"."+parts.slice(1).join("");
                        setTarifs(p=>({...p,ambulance:{...p.ambulance,[f.f]:v}}));
                      }}
                        style={{width:"100%",background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none",fontFamily:"inherit"}}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab==="checklists"&&(
            <div>
              <SectionTitle icon="📋" title="Checklists véhicules"/>
              {!editingChecklist?(
                <>
                  <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Ajoute, modifie ou supprime les checklists de contrôle matériel par véhicule.</div>
                  <button onClick={openNewChecklist} style={{background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:9,color:C.accent,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:16}}>+ Nouvelle checklist</button>
                  {Object.keys(checklistsData).sort((a,b)=>a.localeCompare(b)).map(name=>(
                    <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700}}>🚑 {name}</div>
                        <div style={{fontSize:10,color:C.muted}}>Norme {checklistsData[name].norme} · {(checklistsData[name].sections||[]).length} section(s)</div>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>openEditChecklist(name)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>✏️</button>
                        <button onClick={()=>setConfirmDeleteChecklist(name)} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>🗑</button>
                      </div>
                    </div>
                  ))}

                  <div style={{marginTop:28,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
                    <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:6}}>♿ Sac TPMR/VSL</div>
                    <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Modèle unique, partagé par les 10 véhicules TPMR/VSL — une seule modification s'applique à tous. Check mensuelle.</div>
                    {tpmrVslTemplate.sections.map((section,sIdx)=>(
                      <div key={sIdx} style={{border:`1px solid ${C.border}`,borderRadius:10,padding:"12px",marginBottom:10,background:C.panel}}>
                        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                          <input value={section.label} onChange={e=>setTpmrVslTemplate(p=>({...p,sections:p.sections.map((s,i)=>i===sIdx?{...s,label:e.target.value}:s)}))} placeholder="Nom de la section" style={{flex:1,background:C.bg,color:C.text,fontSize:12,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 10px"}}/>
                          <button onClick={()=>setTpmrVslTemplate(p=>({...p,sections:p.sections.filter((_,i)=>i!==sIdx)}))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"6px 9px",fontSize:11,cursor:"pointer"}}>🗑</button>
                        </div>
                        {(section.shelves[0]?.items||[]).map((item,itIdx)=>(
                          <div key={itIdx} style={{marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>
                            <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:5,flexWrap:"wrap"}}>
                              <input value={item.n} onChange={e=>setTpmrVslTemplate(p=>({...p,sections:p.sections.map((s,i)=>i!==sIdx?s:{...s,shelves:[{...s.shelves[0],items:s.shelves[0].items.map((it,j)=>j!==itIdx?it:{...it,n:e.target.value})}]})}))} placeholder="Nom de l'article" style={{flex:2,minWidth:120,background:C.bg,color:C.text,fontSize:11,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 9px"}}/>
                              <input type="number" min="1" value={item.q||1} onChange={e=>setTpmrVslTemplate(p=>({...p,sections:p.sections.map((s,i)=>i!==sIdx?s:{...s,shelves:[{...s.shelves[0],items:s.shelves[0].items.map((it,j)=>j!==itIdx?it:{...it,q:parseInt(e.target.value)||1})}]})}))} title="Quantité requise" style={{width:50,background:C.bg,color:C.text,fontSize:11,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px"}}/>
                              {[["t","TEST"],["s","SCELLÉ"],["p","PÉREMPT."],["container","CONTENANT"]].map(([f,l])=>(
                                <button key={f} onClick={()=>setTpmrVslTemplate(p=>({...p,sections:p.sections.map((s,i)=>i!==sIdx?s:{...s,shelves:[{...s.shelves[0],items:s.shelves[0].items.map((it,j)=>j!==itIdx?it:{...it,[f]:!it[f]})}]})}))} style={{padding:"4px 7px",borderRadius:5,border:`1px solid ${item[f]?C.accent:C.border}`,background:item[f]?C.accentSoft:"transparent",color:item[f]?C.accent:C.muted,fontSize:9,fontWeight:700,cursor:"pointer"}}>{l}</button>
                              ))}
                              <button onClick={()=>setTpmrVslTemplate(p=>({...p,sections:p.sections.map((s,i)=>i!==sIdx?s:{...s,shelves:[{...s.shelves[0],items:s.shelves[0].items.filter((_,j)=>j!==itIdx)}]})}))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:5,color:C.danger,padding:"4px 8px",fontSize:10,cursor:"pointer"}}>🗑</button>
                            </div>
                            {item.container&&(
                              <div style={{marginLeft:14,paddingLeft:10,borderLeft:`2px solid ${C.border}`}}>
                                <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Contenu (articles à l'intérieur, avec péremption individuelle)</div>
                                {(item.subItems||[]).map((sub,subIdx)=>(
                                  <div key={subIdx} style={{display:"flex",gap:6,marginBottom:4}}>
                                    <input value={sub.n} onChange={e=>setTpmrVslTemplate(p=>({...p,sections:p.sections.map((s,i)=>i!==sIdx?s:{...s,shelves:[{...s.shelves[0],items:s.shelves[0].items.map((it,j)=>j!==itIdx?it:{...it,subItems:it.subItems.map((su,k)=>k!==subIdx?su:{...su,n:e.target.value})})}]})}))} placeholder="Nom de l'article intérieur" style={{flex:1,background:C.bg,color:C.text,fontSize:11,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 8px"}}/>
                                    <button onClick={()=>setTpmrVslTemplate(p=>({...p,sections:p.sections.map((s,i)=>i!==sIdx?s:{...s,shelves:[{...s.shelves[0],items:s.shelves[0].items.map((it,j)=>j!==itIdx?it:{...it,subItems:it.subItems.filter((_,k)=>k!==subIdx)})}]})}))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:5,color:C.danger,padding:"4px 8px",fontSize:10,cursor:"pointer"}}>🗑</button>
                                  </div>
                                ))}
                                <button onClick={()=>setTpmrVslTemplate(p=>({...p,sections:p.sections.map((s,i)=>i!==sIdx?s:{...s,shelves:[{...s.shelves[0],items:s.shelves[0].items.map((it,j)=>j!==itIdx?it:{...it,subItems:[...(it.subItems||[]),{n:""}]})}]})}))} style={{background:"transparent",border:`1px dashed ${C.border}`,borderRadius:6,color:C.muted,padding:"5px 10px",fontSize:10,cursor:"pointer"}}>+ Article dans la trousse</button>
                              </div>
                            )}
                          </div>
                        ))}
                        <button onClick={()=>setTpmrVslTemplate(p=>({...p,sections:p.sections.map((s,i)=>i!==sIdx?s:{...s,shelves:[{...s.shelves[0],items:[...s.shelves[0].items,{n:"",p:false}]}]})}))} style={{background:"transparent",border:`1px dashed ${C.border}`,borderRadius:7,color:C.muted,padding:"7px 12px",fontSize:11,cursor:"pointer"}}>+ Article</button>
                      </div>
                    ))}
                    <button onClick={()=>setTpmrVslTemplate(p=>({...p,sections:[...p.sections,{id:"s"+Date.now(),label:"",color:"#dc2626",shelves:[{id:"A",label:"",items:[]}]}]}))} style={{width:"100%",background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:9,color:C.accent,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Nouvelle section</button>
                  </div>
                </>
              ):(
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
                    <div>
                      <div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>Nom du véhicule</div>
                      <input value={editingChecklist.key} onChange={e=>setEditingChecklist(p=>({...p,key:e.target.value}))} placeholder="ex: ALPHA 8" style={{width:"100%",background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"9px 12px",outline:"none"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>Norme</div>
                      <input value={editingChecklist.norme} onChange={e=>setEditingChecklist(p=>({...p,norme:e.target.value}))} placeholder="ATNUP" style={{width:"100%",background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"9px 12px",outline:"none"}}/>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>Édition</div>
                      <input value={editingChecklist.edition} onChange={e=>setEditingChecklist(p=>({...p,edition:e.target.value}))} placeholder="01/2026" style={{width:"100%",background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"9px 12px",outline:"none"}}/>
                    </div>
                  </div>

                  {editingChecklist.sections.map((section,sIdx)=>(
                    <div key={sIdx} style={{border:`1px solid ${C.border}`,borderRadius:10,padding:"12px",marginBottom:10,background:C.panel}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                        <input value={section.id} onChange={e=>updateSection(sIdx,"id",e.target.value)} placeholder="ID" style={{width:44,background:C.bg,color:C.text,fontSize:12,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px",textAlign:"center"}}/>
                        <input value={section.label} onChange={e=>updateSection(sIdx,"label",e.target.value)} placeholder="Nom de la section" style={{flex:1,background:C.bg,color:C.text,fontSize:12,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 10px"}}/>
                        <button onClick={()=>removeSection(sIdx)} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"6px 9px",fontSize:11,cursor:"pointer"}}>🗑</button>
                      </div>
                      {section.shelves.map((shelf,shIdx)=>(
                        <div key={shIdx} style={{marginLeft:10,marginBottom:8,paddingLeft:10,borderLeft:`2px solid ${C.border}`}}>
                          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                            <input value={shelf.label} onChange={e=>updateShelf(sIdx,shIdx,"label",e.target.value)} placeholder="Nom de l'étagère (optionnel)" style={{flex:1,background:C.bg,color:C.text,fontSize:11,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 9px"}}/>
                            <button onClick={()=>removeShelf(sIdx,shIdx)} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"5px 8px",fontSize:10,cursor:"pointer"}}>🗑</button>
                          </div>
                          {shelf.items.map((item,itIdx)=>(
                            <div key={itIdx} style={{display:"flex",gap:6,alignItems:"center",marginBottom:5,flexWrap:"wrap"}}>
                              <input value={item.n} onChange={e=>updateItem(sIdx,shIdx,itIdx,"n",e.target.value)} placeholder="Nom de l'article" style={{flex:2,minWidth:120,background:C.bg,color:C.text,fontSize:11,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 9px"}}/>
                              <input type="number" value={item.q||1} onChange={e=>updateItem(sIdx,shIdx,itIdx,"q",parseInt(e.target.value)||1)} style={{width:50,background:C.bg,color:C.text,fontSize:11,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px"}}/>
                              {[["t","TEST"],["s","SCELLÉ"],["p","PÉREMPT."],["okOnly","OK SEUL"]].map(([f,l])=>(
                                <button key={f} onClick={()=>updateItem(sIdx,shIdx,itIdx,f,!item[f])} style={{padding:"4px 7px",borderRadius:5,border:`1px solid ${item[f]?C.accent:C.border}`,background:item[f]?C.accentSoft:"transparent",color:item[f]?C.accent:C.muted,fontSize:9,fontWeight:700,cursor:"pointer"}}>{l}</button>
                              ))}
                              <button onClick={()=>removeItem(sIdx,shIdx,itIdx)} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:5,color:C.danger,padding:"4px 7px",fontSize:10,cursor:"pointer"}}>✕</button>
                            </div>
                          ))}
                          <button onClick={()=>addItem(sIdx,shIdx)} style={{background:"transparent",border:`1px dashed ${C.border}`,borderRadius:6,color:C.muted,padding:"5px 10px",fontSize:10,cursor:"pointer",marginTop:4}}>+ Article</button>
                        </div>
                      ))}
                      <button onClick={()=>addShelf(sIdx)} style={{background:"transparent",border:`1px dashed ${C.border}`,borderRadius:6,color:C.muted,padding:"6px 10px",fontSize:11,cursor:"pointer",marginLeft:10}}>+ Étagère</button>
                    </div>
                  ))}
                  <button onClick={addSection} style={{background:C.panel2,border:`1px dashed ${C.border}`,borderRadius:9,color:C.muted,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",marginBottom:20}}>+ Section</button>

                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setEditingChecklist(null)} style={{flex:1,background:C.panel2,border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Annuler</button>
                    <button onClick={saveChecklist} disabled={!editingChecklist.key.trim()} style={{flex:1,background:editingChecklist.key.trim()?C.success:C.panel2,border:"none",borderRadius:9,color:editingChecklist.key.trim()?"white":C.muted,padding:"11px",fontWeight:700,fontSize:13,cursor:editingChecklist.key.trim()?"pointer":"not-allowed"}}>✅ Enregistrer</button>
                  </div>
                </div>
              )}

              {confirmDeleteChecklist&&(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:350}}>
                  <div style={{background:C.panel,border:`1px solid ${C.danger}`,borderRadius:16,padding:"24px",width:360,maxWidth:"92vw"}}>
                    <div style={{fontWeight:800,fontSize:16,marginBottom:10}}>🗑 Supprimer la checklist ?</div>
                    <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Es-tu sûr de vouloir supprimer définitivement la checklist de <strong style={{color:C.text}}>{confirmDeleteChecklist}</strong> ? Cette action est irréversible.</div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setConfirmDeleteChecklist(null)} style={{flex:1,background:C.panel2,border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Annuler</button>
                      <button onClick={()=>{setChecklistsData(prev=>{const next={...prev};delete next[confirmDeleteChecklist];return next;});setConfirmDeleteChecklist(null);}} style={{flex:1,background:C.danger,border:"none",borderRadius:9,color:"white",padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer"}}>🗑 Supprimer</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {tab==="daily"&&!editingDailyVehicle&&(
            <div>
              <SectionTitle icon="🚑" title="APS Daily — Checklists journalières"/>
              <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Personnalise la checklist journalière de chaque véhicule (par défaut, le modèle standard Alpha/TPMR/VSL est utilisé).</div>
              {vehicles.map(v=>(
                <div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span>{v.type==="AMB"?"🚑":v.type==="TPMR"?"♿":"🚗"}</span>
                    <span style={{fontSize:13,fontWeight:600,color:C.text}}>{v.name}</span>
                  </div>
                  <button onClick={async()=>{
                    setEditingDailyVehicle(v);
                    try{
                      const ref=doc(dbChecklists,"dispatchai_daily_templates",v.id);
                      const snap=await getDoc(ref);
                      if(snap.exists()&&snap.data().sections){ setEditingDailySections(JSON.parse(JSON.stringify(snap.data().sections))); }
                      else{ setEditingDailySections(JSON.parse(JSON.stringify(DAILY_TEMPLATES_BASE[v.type]||DAILY_CHECKLIST_ALPHA))); }
                    }catch(e){ setEditingDailySections(JSON.parse(JSON.stringify(DAILY_TEMPLATES_BASE[v.type]||DAILY_CHECKLIST_ALPHA))); }
                  }} style={{padding:"5px 12px",background:C.dangerSoft,border:`1px solid ${C.danger}66`,borderRadius:7,color:C.danger,fontSize:12,cursor:"pointer"}}>Checklist</button>
                </div>
              ))}
              {vehicles.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:C.muted,fontSize:13}}>Aucun véhicule (ajoute-les dans l'onglet Véhicules)</div>}
            </div>
          )}
          {tab==="daily"&&editingDailyVehicle&&(
            <div style={{paddingBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                <button onClick={()=>{setEditingDailyVehicle(null);setEditingDailySections([]);setDailyNewItemLabel({});setDailyNewSectionLabel("");}} style={{background:C.panel,border:`1px solid ${C.border}`,color:C.text,padding:"8px 14px",borderRadius:10,cursor:"pointer"}}>Retour</button>
                <div><div style={{fontWeight:800,fontSize:18,color:C.danger}}>{editingDailyVehicle.name}</div><div style={{fontSize:12,color:C.muted}}>Édition de la checklist journalière</div></div>
              </div>
              {editingDailySections.map((section,sIdx)=>(
                <div key={sIdx} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:14,marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontWeight:700,fontSize:14,color:C.text}}>{section.section}</div>
                    <button onClick={()=>{ if(!window.confirm("Supprimer cette section ?")) return; const s=JSON.parse(JSON.stringify(editingDailySections)); s.splice(sIdx,1); setEditingDailySections(s); }} style={{background:"transparent",border:`1px solid ${C.danger}66`,color:C.danger,borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>Supprimer section</button>
                  </div>
                  {section.items.map((item,iIdx)=>(
                    <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`,gap:8}}>
                      <div style={{flex:1}}>
                        <span style={{fontSize:13,fontWeight:600,color:C.text}}>{item.label}</span>
                        <span style={{fontSize:11,color:C.muted,marginLeft:8}}>{item.type}</span>
                        {item.required&&<span style={{fontSize:10,color:C.danger,marginLeft:6}}>*</span>}
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={()=>{ const s=JSON.parse(JSON.stringify(editingDailySections)); const items=s[sIdx].items; if(iIdx===0)return; [items[iIdx-1],items[iIdx]]=[items[iIdx],items[iIdx-1]]; setEditingDailySections(s); }} disabled={iIdx===0} style={{background:"transparent",border:`1px solid ${C.border}`,color:iIdx===0?C.muted:C.text,borderRadius:6,padding:"3px 7px",fontSize:12,cursor:iIdx===0?"default":"pointer"}}>↑</button>
                        <button onClick={()=>{ const s=JSON.parse(JSON.stringify(editingDailySections)); const items=s[sIdx].items; if(iIdx===items.length-1)return; [items[iIdx],items[iIdx+1]]=[items[iIdx+1],items[iIdx]]; setEditingDailySections(s); }} disabled={iIdx===section.items.length-1} style={{background:"transparent",border:`1px solid ${C.border}`,color:iIdx===section.items.length-1?C.muted:C.text,borderRadius:6,padding:"3px 7px",fontSize:12,cursor:iIdx===section.items.length-1?"default":"pointer"}}>↓</button>
                        <button onClick={()=>{ const s=JSON.parse(JSON.stringify(editingDailySections)); s[sIdx].items.splice(iIdx,1); setEditingDailySections(s); }} style={{background:"transparent",border:`1px solid ${C.danger}66`,color:C.danger,borderRadius:6,padding:"3px 7px",fontSize:12,cursor:"pointer"}}>🗑</button>
                      </div>
                    </div>
                  ))}
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <input type="text" placeholder="Nouvel item..." value={dailyNewItemLabel[sIdx]||""} onChange={e=>setDailyNewItemLabel(prev=>({...prev,[sIdx]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"){const label=(dailyNewItemLabel[sIdx]||"").trim(); if(!label)return; const s=JSON.parse(JSON.stringify(editingDailySections)); s[sIdx].items.push({id:"custom_"+Date.now(),label,type:"ok_nok",required:true}); setEditingDailySections(s); setDailyNewItemLabel(prev=>({...prev,[sIdx]:""}));}}} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontSize:13}}/>
                    <button onClick={()=>{const label=(dailyNewItemLabel[sIdx]||"").trim(); if(!label)return; const s=JSON.parse(JSON.stringify(editingDailySections)); s[sIdx].items.push({id:"custom_"+Date.now(),label,type:"ok_nok",required:true}); setEditingDailySections(s); setDailyNewItemLabel(prev=>({...prev,[sIdx]:""}));}} style={{background:C.danger,border:"none",borderRadius:8,color:"white",padding:"7px 12px",fontWeight:700,cursor:"pointer"}}>+</button>
                  </div>
                </div>
              ))}
              <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:14,marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:C.text}}>Nouvelle section</div>
                <div style={{display:"flex",gap:8}}>
                  <input type="text" placeholder="Ex: Équipement spécial" value={dailyNewSectionLabel} onChange={e=>setDailyNewSectionLabel(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&dailyNewSectionLabel.trim()){setEditingDailySections(prev=>[...prev,{section:dailyNewSectionLabel.trim(),items:[]}]);setDailyNewSectionLabel("");}}} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text,fontSize:13}}/>
                  <button onClick={()=>{if(dailyNewSectionLabel.trim()){setEditingDailySections(prev=>[...prev,{section:dailyNewSectionLabel.trim(),items:[]}]);setDailyNewSectionLabel("");}}} style={{background:C.danger,border:"none",borderRadius:8,color:"white",padding:"9px 14px",fontWeight:700,cursor:"pointer"}}>+</button>
                </div>
              </div>
              <button onClick={async()=>{
                setDailySaving(true);
                await setDoc(doc(dbChecklists,"dispatchai_daily_templates",editingDailyVehicle.id), { vehiculeId:editingDailyVehicle.id, vehiculeNom:editingDailyVehicle.name, type:editingDailyVehicle.type, sections:editingDailySections, updatedAt:new Date().toISOString() });
                setDailySaving(false);
                alert("Checklist sauvegardée !");
                setEditingDailyVehicle(null); setEditingDailySections([]); setDailyNewItemLabel({}); setDailyNewSectionLabel("");
              }} disabled={dailySaving} style={{width:"100%",padding:14,background:dailySaving?C.muted:C.success,border:"none",borderRadius:12,color:"white",fontWeight:800,fontSize:16,cursor:"pointer"}}>
                {dailySaving?"Sauvegarde...":"Sauvegarder la checklist"}
              </button>
            </div>
          )}
          {tab==="listerouge"&&(
            <div>
              <SectionTitle icon="🚫" title="Liste rouge — patients à ne plus transporter"/>
              <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Toute création de course pour un patient de cette liste sera bloquée dans le Formulaire, avec la raison affichée. La date de naissance permet d'éviter les confusions entre homonymes (facultatif).</div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input value={newRougeName} onChange={e=>setNewRougeName(e.target.value)} placeholder="Nom du patient" style={{flex:1,background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none"}}/>
                <div style={{width:150}}><DateInput value={newRougeBirthdate} onChange={setNewRougeBirthdate}/></div>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <input value={newRougeReason} onChange={e=>setNewRougeReason(e.target.value)} placeholder="Raison (impayé, comportement...)" style={{flex:1,background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none"}}/>
                <button onClick={()=>{
                  if(!newRougeName.trim()) return;
                  setListeRouge(p=>[...p,{id:"lr"+Date.now(),name:newRougeName.trim(),birthdate:newRougeBirthdate||"",reason:newRougeReason.trim()||"Non précisée"}]);
                  setNewRougeName(""); setNewRougeReason(""); setNewRougeBirthdate("");
                }} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:9,color:C.danger,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>+ Ajouter</button>
              </div>
              {listeRouge.length===0&&<div style={{fontSize:12,color:C.muted,textAlign:"center",padding:"20px 0"}}>Aucun patient sur liste rouge</div>}
              {listeRouge.map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.dangerSoft,border:`1px solid ${C.danger}66`,borderRadius:9,padding:"10px 14px",marginBottom:7}}>
                  <div><span style={{fontSize:13,fontWeight:700,color:C.text}}>🚫 {p.name}</span>{p.birthdate&&<span style={{fontSize:11,color:C.muted,marginLeft:8}}>{p.birthdate}</span>}<div style={{fontSize:11,color:C.muted,marginTop:2}}>{p.reason}</div></div>
                  <button onClick={()=>setListeRouge(prev=>prev.filter(x=>x.id!==p.id))} style={{background:"transparent",border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"5px 9px",fontSize:11,cursor:"pointer"}}>🗑</button>
                </div>
              ))}
            </div>
          )}
          {tab==="carnetbord"&&(
            <div>
              <SectionTitle icon="📓" title="Carnet de bord — nature de mission"/>
              <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Liste propre au Carnet de bord (indépendante de celle du Formulaire). Change les icônes ou ajoute tes propres catégories.</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <input value={newCarnetIcon} onChange={e=>setNewCarnetIcon(e.target.value)} placeholder="📍" maxLength={4} style={{width:60,textAlign:"center",background:C.bg,color:C.text,fontSize:16,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 8px",outline:"none"}}/>
                <input value={newCarnetLabel} onChange={e=>setNewCarnetLabel(e.target.value)} placeholder="Nom de la catégorie" style={{flex:1,background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none"}}/>
                <button onClick={()=>{
                  if(!newCarnetLabel.trim()) return;
                  setCarnetBordTypes(p=>[...p,{id:"custom"+Date.now(),label:newCarnetLabel.trim(),icon:newCarnetIcon.trim()||"📍"}]);
                  setNewCarnetLabel(""); setNewCarnetIcon("📍");
                }} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:9,color:C.danger,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>+ Ajouter</button>
              </div>
              {carnetBordTypes.map((t,i)=>(
                <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",marginBottom:7}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                    <input value={t.icon} onChange={e=>setCarnetBordTypes(p=>p.map((x,j)=>j===i?{...x,icon:e.target.value}:x))} style={{width:40,textAlign:"center",background:C.bg,color:C.text,fontSize:15,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px"}}/>
                    <input value={t.label} onChange={e=>setCarnetBordTypes(p=>p.map((x,j)=>j===i?{...x,label:e.target.value}:x))} style={{flex:1,background:C.bg,color:C.text,fontSize:13,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 10px"}}/>
                  </div>
                  <button onClick={()=>setCarnetBordTypes(p=>p.filter((_,j)=>j!==i))} style={{background:"transparent",border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"5px 9px",fontSize:11,cursor:"pointer",marginLeft:8}}>🗑</button>
                </div>
              ))}
            </div>
          )}
          {tab==="emails"&&(
            <div>
              <SectionTitle icon="✉️" title="Emails — Rapports de manquants"/>
              <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Ces adresses reçoivent un email listant le matériel manquant/périmé à chaque checklist complétée.</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="exemple@aps.be" style={{flex:1,background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none"}}/>
                <button onClick={()=>{if(newEmail.trim()&&newEmail.includes("@")){setChecklistEmails(p=>[...p,newEmail.trim()]);setNewEmail("");}}} style={{background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:9,color:C.accent,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Ajouter</button>
              </div>
              {checklistEmails.length===0&&<div style={{fontSize:12,color:C.muted,textAlign:"center",padding:"20px 0"}}>Aucun destinataire configuré</div>}
              {checklistEmails.map((em,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",marginBottom:7}}>
                  <span style={{fontSize:13}}>✉️ {em}</span>
                  <button onClick={()=>setChecklistEmails(p=>p.filter((_,j)=>j!==i))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"5px 9px",fontSize:11,cursor:"pointer"}}>🗑</button>
                </div>
              ))}

              <div style={{marginTop:28,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
                <SectionTitle icon="🅾️" title="Emails — Alerte stock oxygène"/>
                <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Ces adresses reçoivent un email dès qu'une taille de bouteille (B2/B5/B10) tombe à 2, 1 ou 0 pleines en réserve. Liste séparée de celle des checklists.</div>
                <div style={{display:"flex",gap:8,marginBottom:16}}>
                  <input value={newO2Email} onChange={e=>setNewO2Email(e.target.value)} placeholder="exemple@aps.be" style={{flex:1,background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none"}}/>
                  <button onClick={()=>{if(newO2Email.trim()&&newO2Email.includes("@")){setO2Emails(p=>[...p,newO2Email.trim()]);setNewO2Email("");}}} style={{background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:9,color:C.accent,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Ajouter</button>
                </div>
                {o2Emails.length===0&&<div style={{fontSize:12,color:C.muted,textAlign:"center",padding:"20px 0"}}>Aucun destinataire configuré</div>}
                {o2Emails.map((em,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",marginBottom:7}}>
                    <span style={{fontSize:13}}>🅾️ {em}</span>
                    <button onClick={()=>setO2Emails(p=>p.filter((_,j)=>j!==i))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"5px 9px",fontSize:11,cursor:"pointer"}}>🗑</button>
                  </div>
                ))}
              </div>

              <div style={{marginTop:28,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
                <SectionTitle icon="🗓️" title="Emails — Alerte Péremption"/>
                <div style={{fontSize:11,color:C.muted,marginBottom:16}}>Ces adresses reçoivent un email 1 mois avant l'échéance d'un article périssable, sur n'importe quel véhicule. Liste séparée des autres.</div>
                <div style={{display:"flex",gap:8,marginBottom:16}}>
                  <input value={newPeremptionEmail} onChange={e=>setNewPeremptionEmail(e.target.value)} placeholder="exemple@aps.be" style={{flex:1,background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none"}}/>
                  <button onClick={()=>{if(newPeremptionEmail.trim()&&newPeremptionEmail.includes("@")){setPeremptionEmails(p=>[...p,newPeremptionEmail.trim()]);setNewPeremptionEmail("");}}} style={{background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:9,color:C.accent,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Ajouter</button>
                </div>
                {peremptionEmails.length===0&&<div style={{fontSize:12,color:C.muted,textAlign:"center",padding:"20px 0"}}>Aucun destinataire configuré</div>}
                {peremptionEmails.map((em,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",marginBottom:7}}>
                    <span style={{fontSize:13}}>🗓️ {em}</span>
                    <button onClick={()=>setPeremptionEmails(p=>p.filter((_,j)=>j!==i))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"5px 9px",fontSize:11,cursor:"pointer"}}>🗑</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab==="bases"&&(
            <div>
              <SectionTitle icon="🏠" title="Bases de départ"/>
              <div style={{marginBottom:16}}>
                {bases.map((b,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",marginBottom:7}}>
                    <span style={{fontSize:13,fontWeight:600}}>🏠 {b}</span>
                    <button onClick={()=>setBases(prev=>prev.filter((_,j)=>j!==i))} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:7,color:C.danger,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Supprimer</button>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <TextInput value={newVal} onChange={e=>setNewVal(e.target.value)} onBlur={()=>{}} placeholder="Nom de la base…"/>
                <button onClick={()=>{if(newVal.trim()){setBases(p=>[...p,newVal.trim()]);setNewVal("");}}} style={{background:C.success,border:"none",borderRadius:9,color:"white",padding:"10px 18px",fontWeight:800,fontSize:16,cursor:"pointer",flexShrink:0}}>+</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanningAccordion({vehicles,courses,vCourses}){
  const [openId,setOpenId]=useState(null);
  const toggle=id=>setOpenId(p=>p===id?null:id);
  const MOBILITE_MAP={"assis":"🧍 Assis valide","chaise_perso":"♿ Chaise personnelle","chaise_aps":"♿ Chaise APS","brancard":"🛏 Brancard"};
  return(
    <div style={{flex:1,overflowY:"auto",padding:"11px"}}>
      <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:11}}>Planning du jour</div>
      {vehicles.filter(v=>vCourses(v.id).length>0).map(v=>(
        <div key={v.id} style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <span style={{color:vColor(v.type),fontSize:12}}>{vIcon(v.type)}</span>
            <span style={{fontWeight:700,fontSize:11}}>{v.name}</span>
            <span style={{fontSize:10,color:C.muted}}>— {v.driver}</span>
            <div style={{flex:1,height:1,background:C.border}}/>
            <span style={{fontSize:10,color:C.accent,fontWeight:600}}>{vCourses(v.id).length}c</span>
          </div>
          {vCourses(v.id).map(c=>{
            const isOpen=openId===c.id;
            const heureAff=c.heurePC||(c.heures&&c.heures[0]?c.heures[0].heure:"")||c.heure||"—";
            return(
              <div key={c.id} onClick={()=>toggle(c.id)} style={{background:isOpen?C.panel2:C.panel3,border:`1px solid ${isOpen?C.accent:C.border}`,borderRadius:9,padding:"9px 11px",marginBottom:6,cursor:"pointer",transition:"all 0.2s"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:12}}>{TYPE_MAP[c.type]||"🚑"}</span>
                    <span style={{fontSize:11,fontWeight:700,color:isOpen?C.accent:C.text}}>{heureAff}</span>
                    <span style={{fontSize:11,fontWeight:600,color:C.text}}>— {c.patient}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:9,color:C.blue,fontWeight:700}}>Planifié</span>
                    <span style={{fontSize:11,color:isOpen?C.accent:C.muted,transition:"transform 0.2s",display:"inline-block",transform:isOpen?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
                  </div>
                </div>
                {isOpen&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`,animation:"fadeUp 0.2s ease"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                      <div style={{background:C.panel3,borderRadius:7,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",marginBottom:3}}>Départ</div>
                        <div style={{fontSize:11,fontWeight:600}}>📍 {c.depart}</div>
                      </div>
                      <div style={{background:C.panel3,borderRadius:7,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",marginBottom:3}}>Destination</div>
                        <div style={{fontSize:11,fontWeight:600}}>🏁 {c.arrivee}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                      {c.convention&&<span style={{background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:5,padding:"2px 8px",fontSize:10,color:C.accent,fontWeight:700}}>🤝 {CONV_MAP[c.convention]||c.convention}</span>}
                      {c.mobilite&&<span style={{background:C.blueSoft,border:`1px solid ${C.blue}`,borderRadius:5,padding:"2px 8px",fontSize:10,color:C.blue,fontWeight:600}}>{MOBILITE_MAP[c.mobilite]||c.mobilite}</span>}
                      {c.oxygene&&<span style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:5,padding:"2px 8px",fontSize:10,color:C.danger,fontWeight:700}}>💨 O² {c.litrageO2}L/min</span>}
                      {(c.equipSelected||[]).includes("perfusion")&&<span style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:5,padding:"2px 8px",fontSize:10,color:C.danger,fontWeight:700}}>💉 Perfusion</span>}
                      {(c.equipSelected||[]).includes("chaise_evac")&&<span style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:5,padding:"2px 8px",fontSize:10,color:C.danger,fontWeight:700}}>🪑 Chaise évac</span>}
                      {c.accompagnant&&<span style={{background:C.successSoft,border:`1px solid ${C.success}`,borderRadius:5,padding:"2px 8px",fontSize:10,color:C.success,fontWeight:600}}>👥 Accompagnant</span>}
                    </div>
                    {c.heures&&c.heures.length>0&&c.heures[0].heure&&(
                      <div style={{marginBottom:6}}>
                        <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",marginBottom:4}}>Rendez-vous</div>
                        {c.heures.map((h,i)=>h.heure&&(
                          <div key={i} style={{fontSize:10,color:C.text,marginBottom:2}}>⏰ {h.heure}{h.description?` — ${h.description}`:""}</div>
                        ))}
                      </div>
                    )}
                    {c.notes&&<div style={{fontSize:10,color:C.muted,fontStyle:"italic",background:C.panel3,borderRadius:6,padding:"6px 9px"}}>📝 {c.notes}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {courses.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.muted,fontSize:13}}>Aucune course planifiée</div>}
    </div>
  );
}

const MOIS_FR=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_FR=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function CalendarView({courses,setCourses,vehicles,pending,onAssignPending,patients,onGoFormulaire,onScheduleFromPatient}){
  const [cursor,setCursor]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1);});
  const [selectedISO,setSelectedISO]=useState(todayISO());
  const [groupMode,setGroupMode]=useState("tous"); // "tous" | "vehicule"
  const [showMonthPicker,setShowMonthPicker]=useState(false);
  const [pickerYear,setPickerYear]=useState(()=>new Date().getFullYear());
  const [showPatientPicker,setShowPatientPicker]=useState(false);
  const [pendingAssign,setPendingAssign]=useState({}); // {pendingId: vehicleId}
  const [schedHeure,setSchedHeure]=useState({}); // {patientId: heure override for this day}

  const year=cursor.getFullYear(), month=cursor.getMonth();
  const firstDay=new Date(year,month,1);
  const startOffset=(firstDay.getDay()+6)%7; // Monday=0
  const daysInMonth=new Date(year,month+1,0).getDate();
  const cells=[];
  for(let i=0;i<startOffset;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);

  const isoFor=(d)=>`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const coursesForDay=(iso)=>courses.filter(c=>(c.dateISO||todayISO())===iso);
  const pendingForDay=(iso)=>pending.filter(p=>(p.dateISO||todayISO())===iso);
  const selectedCourses=coursesForDay(selectedISO);
  const selectedPending=pendingForDay(selectedISO);

  const changeMonth=(delta)=>setCursor(c=>new Date(c.getFullYear(),c.getMonth()+delta,1));
  const removeCourse=(id)=>setCourses(p=>p.filter(c=>c.id!==id));
  const activeVehicles=vehicles.filter(v=>v.active);

  return(
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{flex:1,padding:"14px",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,position:"relative"}}>
          <button onClick={()=>changeMonth(-1)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"6px 12px",fontSize:13,cursor:"pointer"}}>←</button>
          <button onClick={()=>{setPickerYear(year);setShowMonthPicker(s=>!s);}} style={{fontWeight:800,fontSize:15,background:"transparent",border:"none",color:C.text,cursor:"pointer",padding:"4px 10px",borderRadius:7}}>{MOIS_FR[month]} {year} ▾</button>
          <button onClick={()=>changeMonth(1)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"6px 12px",fontSize:13,cursor:"pointer"}}>→</button>
          {showMonthPicker&&(
            <div style={{position:"absolute",top:"110%",left:"50%",transform:"translateX(-50%)",background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",zIndex:100,width:280,boxShadow:"0 8px 24px rgba(0,0,0,0.4)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <button onClick={()=>setPickerYear(y=>y-1)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>←</button>
                <div style={{fontWeight:700,fontSize:14}}>{pickerYear}</div>
                <button onClick={()=>setPickerYear(y=>y+1)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>→</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                {MOIS_FR.map((m,i)=>(
                  <button key={m} onClick={()=>{setCursor(new Date(pickerYear,i,1));setShowMonthPicker(false);}}
                    style={{padding:"8px 4px",borderRadius:7,border:`1px solid ${(i===month&&pickerYear===year)?C.accent:C.border}`,background:(i===month&&pickerYear===year)?C.accentSoft:C.panel2,color:(i===month&&pickerYear===year)?C.accent:C.text,fontSize:11,fontWeight:600,cursor:"pointer"}}>{m.slice(0,3)}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:6}}>
          {JOURS_FR.map(j=>(<div key={j} style={{textAlign:"center",fontSize:10,color:C.muted,fontWeight:700,textTransform:"uppercase"}}>{j}</div>))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
          {cells.map((d,i)=>{
            if(d===null) return <div key={i}/>;
            const iso=isoFor(d);
            const cnt=coursesForDay(iso).length+pendingForDay(iso).length;
            const isSel=iso===selectedISO;
            const isToday=iso===todayISO();
            return(
              <button key={i} onClick={()=>setSelectedISO(iso)}
                style={{aspectRatio:"1",background:isSel?C.accentSoft:C.panel,border:`1.5px solid ${isSel?C.accent:isToday?C.blue:C.border}`,borderRadius:9,color:isSel?C.accent:C.text,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,padding:4}}>
                <span style={{fontSize:12,fontWeight:isSel||isToday?800:500}}>{d}</span>
                {cnt>0&&<span style={{fontSize:9,background:isSel?C.accent:C.blueSoft,color:isSel?"white":C.blue,borderRadius:20,padding:"1px 5px",fontWeight:700}}>{cnt}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{width:320,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontWeight:700,fontSize:12,marginBottom:9}}>{isoToFR(selectedISO)}</div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={onGoFormulaire} style={{flex:1,background:C.blueSoft,border:`1px solid ${C.blue}`,borderRadius:7,color:C.blue,padding:"7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>📋 Formulaire</button>
            <button onClick={()=>setShowPatientPicker(s=>!s)} style={{flex:1,background:C.purpleSoft,border:`1px solid ${C.purple}`,borderRadius:7,color:C.purple,padding:"7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🗂️ Patient habituel</button>
          </div>
        </div>
        {showPatientPicker&&(
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}`,background:C.panel2,maxHeight:220,overflowY:"auto"}}>
            {patients.length===0&&<div style={{fontSize:11,color:C.muted,textAlign:"center",padding:"10px 0"}}>Aucune fiche patient habituel</div>}
            {patients.filter(p=>!p.statut||p.statut==="actif").map(p=>(
              <div key={p.id} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                  <div style={{fontSize:12,fontWeight:700}}>{p.prenom} {p.nom}</div>
                  <input value={schedHeure[p.id]!==undefined?schedHeure[p.id]:(p.heureHabituelle||"")} onChange={e=>setSchedHeure(s=>({...s,[p.id]:e.target.value}))} placeholder="HHhMM" style={{width:70,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 6px",color:C.text,fontSize:11}}/>
                </div>
                <button onClick={()=>{
                  const heure=schedHeure[p.id]!==undefined?schedHeure[p.id]:(p.heureHabituelle||"");
                  onScheduleFromPatient(p,isoToFR(selectedISO),heure);
                  setShowPatientPicker(false);
                }} style={{width:"100%",marginTop:6,background:C.purpleSoft,border:`1px solid ${C.purple}`,borderRadius:6,color:C.purple,padding:"5px",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Ajouter ce jour</button>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:6,padding:"9px 14px 0"}}>
          {[["tous","Tous véhicules"],["vehicule","Par véhicule"]].map(([m,l])=>(
            <button key={m} onClick={()=>setGroupMode(m)} style={{flex:1,padding:"6px",borderRadius:7,border:`1.5px solid ${groupMode===m?C.accent:C.border}`,background:groupMode===m?C.accentSoft:"transparent",color:groupMode===m?C.accent:C.muted,fontSize:10,fontWeight:700,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"10px"}}>
          {selectedPending.length>0&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:C.warning,textTransform:"uppercase",letterSpacing:"1px",marginBottom:7}}>⏳ En attente d'affectation</div>
              {selectedPending.map(pc=>(
                <div key={pc.id} style={{background:C.warningSoft,border:`1px solid ${C.warning}`,borderRadius:9,padding:"9px 11px",marginBottom:7}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.warning}}>{pc.heure}</div>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:6}}>{pc.patient}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                    {activeVehicles.filter(v=>{
                      if(v.status!=="disponible") return false;
                      const needsA=pc.oxygene||(pc.equipSelected||[]).some(e=>["perfusion","oxygene","chaise_evac"].includes(e))||pc.mobilite==="brancard";
                      if(needsA&&v.type!=="AMB") return false;
                      return true;
                    }).map(v=>(
                      <button key={v.id} onClick={()=>setPendingAssign(s=>({...s,[pc.id]:v.id}))} style={{padding:"4px 9px",borderRadius:6,border:`1.5px solid ${pendingAssign[pc.id]===v.id?C.accent:C.border}`,background:pendingAssign[pc.id]===v.id?C.accentSoft:C.panel,color:pendingAssign[pc.id]===v.id?C.accent:C.muted,fontSize:10,fontWeight:600,cursor:"pointer"}}>{vIcon(v.type)} {v.name}</button>
                    ))}
                  </div>
                  <button disabled={!pendingAssign[pc.id]} onClick={()=>{onAssignPending(pc,pendingAssign[pc.id]);setPendingAssign(s=>{const n={...s};delete n[pc.id];return n;});}} style={{width:"100%",background:pendingAssign[pc.id]?C.success:C.panel2,border:"none",borderRadius:6,color:pendingAssign[pc.id]?"white":C.muted,padding:"6px",fontSize:11,fontWeight:700,cursor:pendingAssign[pc.id]?"pointer":"not-allowed"}}>✅ Assigner</button>
                </div>
              ))}
            </div>
          )}
          {selectedCourses.length===0&&selectedPending.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:C.muted,fontSize:12}}>Aucune course ce jour</div>}
          {groupMode==="tous"?(
            selectedCourses.map(c=>{
              const v=vehicles.find(x=>x.id===c.vehicleId);
              return(
                <div key={c.id} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 11px",marginBottom:7}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:C.accent}}>{c.heure}{v?` · ${v.name}`:""}</div>
                      <div style={{fontSize:12,fontWeight:600}}>{c.patient}</div>
                      {c.arrivee&&<div style={{fontSize:10,color:C.muted}}>🏁 {c.arrivee}</div>}
                    </div>
                    <button onClick={()=>removeCourse(c.id)} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"3px 8px",fontSize:11,cursor:"pointer",flexShrink:0}}>🗑</button>
                  </div>
                </div>
              );
            })
          ):(
            vehicles.filter(v=>selectedCourses.some(c=>c.vehicleId===v.id)).map(v=>(
              <div key={v.id} style={{marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:12,color:vColor(v.type)}}>{vIcon(v.type)}</span>
                  <span style={{fontWeight:700,fontSize:11}}>{v.name}</span>
                  <div style={{flex:1,height:1,background:C.border}}/>
                </div>
                {selectedCourses.filter(c=>c.vehicleId===v.id).map(c=>(
                  <div key={c.id} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 11px",marginBottom:7}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:C.accent}}>{c.heure}</div>
                        <div style={{fontSize:12,fontWeight:600}}>{c.patient}</div>
                        {c.arrivee&&<div style={{fontSize:10,color:C.muted}}>🏁 {c.arrivee}</div>}
                      </div>
                      <button onClick={()=>removeCourse(c.id)} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"3px 8px",fontSize:11,cursor:"pointer",flexShrink:0}}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DevisModal({tarifs,onClose}){
  const [type,setType]=useState("tpmr");
  const [adresseDepart,setAdresseDepart]=useState("");
  const [adresseArrivee,setAdresseArrivee]=useState("");
  const [km,setKm]=useState("");
  const [allerRetour,setAllerRetour]=useState(false);
  const [oxygene,setOxygene]=useState(false);
  const [demiH,setDemiH]=useState(1);
  const [majoration,setMajoration]=useState(false);

  const raw=tarifs[type];
  const kmSaisi=parseFloat(km)||0;
  const kmNum=allerRetour?kmSaisi*2:kmSaisi;
  let breakdown, total;
  if(type==="tpmr"){
    const priseEnCharge=parseFloat(raw.priseEnCharge)||0;
    const kmAudela10=parseFloat(raw.kmAudela10)||0;
    const kmSupp=Math.max(0,kmNum-10);
    total=priseEnCharge+kmSupp*kmAudela10;
    breakdown=[["Prise en charge (10 premiers km inclus)",priseEnCharge],["Au-delà de 10 km"+(allerRetour?" (A/R)":""),kmSupp*kmAudela10]];
  }else{
    const priseEnCharge=parseFloat(raw.priseEnCharge)||0;
    const t11_20=parseFloat(raw.km11_20)||0;
    const t21plus=parseFloat(raw.km21plus)||0;
    const km11_20=Math.max(0,Math.min(kmNum,20)-10);
    const km21plus=Math.max(0,kmNum-20);
    total=priseEnCharge+km11_20*t11_20+km21plus*t21plus;
    breakdown=[["Prise en charge (10 premiers km inclus)",priseEnCharge],["11 à 20 km"+(allerRetour?" (A/R)":""),km11_20*t11_20],["21 km et +"+(allerRetour?" (A/R)":""),km21plus*t21plus]];
    if(oxygene){
      const tarifO2=parseFloat(raw.oxygeneDemiH)||0;
      const coutO2=demiH*tarifO2;
      total+=coutO2;
      breakdown.push([`Oxygène (${demiH} × ½h)`,coutO2]);
    }
  }
  if(majoration){
    const avantMajoration=total;
    total=total*1.2;
    breakdown.push(["Majoration nuit/dimanche/férié (+20%)",total-avantMajoration]);
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400}}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px",width:440,maxWidth:"92vw",maxHeight:"88vh",overflowY:"auto",animation:"pop 0.2s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:16}}>💶 Simulateur de devis</div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
        </div>

        <div style={{display:"flex",gap:8,marginBottom:10}}>
          {[["tpmr","♿ TPMR"],["ambulance","🚑 Ambulance"]].map(([k,l])=>(
            <button key={k} onClick={()=>setType(k)} style={{flex:1,padding:"10px",borderRadius:9,border:`1.5px solid ${type===k?(k==="ambulance"?C.danger:C.blue):C.border}`,background:type===k?(k==="ambulance"?C.dangerSoft:C.blueSoft):"transparent",color:type===k?(k==="ambulance"?C.danger:C.blue):C.muted,fontWeight:type===k?700:500,fontSize:13,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[[false,"➡️ Aller simple"],[true,"🔁 Aller-retour"]].map(([v,l])=>(
            <button key={String(v)} onClick={()=>setAllerRetour(v)} style={{flex:1,padding:"8px",borderRadius:9,border:`1.5px solid ${allerRetour===v?C.accent:C.border}`,background:allerRetour===v?C.accentSoft:"transparent",color:allerRetour===v?C.accent:C.muted,fontWeight:allerRetour===v?700:500,fontSize:12,cursor:"pointer"}}>{l}</button>
          ))}
        </div>

        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>Adresse de départ</div>
          <TextInput value={adresseDepart} onChange={e=>setAdresseDepart(e.target.value)} onBlur={()=>{}} placeholder="12 rue des Lilas, Mons"/>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>Destination</div>
          <TextInput value={adresseArrivee} onChange={e=>setAdresseArrivee(e.target.value)} onBlur={()=>{}} placeholder="CHU Mons…"/>
        </div>
        <div style={{marginBottom:6}}>
          <div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>Distance (km, aller simple) — saisie manuelle pour l'instant</div>
          <input type="number" step="0.1" value={km} onChange={e=>setKm(e.target.value)} placeholder="0"
            style={{width:"100%",background:C.bg,color:C.text,fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",outline:"none",fontFamily:"inherit"}}/>
          <div style={{fontSize:10,color:C.muted,marginTop:5}}>ℹ️ Calcul automatique via Google Maps à venir — pour l'instant entre les km manuellement.{allerRetour&&" Les km saisis sont doublés automatiquement pour l'aller-retour."}</div>
        </div>

        {type==="ambulance"&&(
          <div style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:9,padding:"12px",marginTop:10}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:oxygene?10:0}}>
              <input type="checkbox" checked={oxygene} onChange={e=>setOxygene(e.target.checked)} style={{width:16,height:16,cursor:"pointer"}}/>
              <span style={{fontSize:13,fontWeight:600,color:C.text}}>🫁 Oxygène (forfait par demi-heure)</span>
            </label>
            {oxygene&&(
              <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"center"}}>
                <button onClick={()=>setDemiH(d=>Math.max(1,d-1))} style={{width:34,height:34,borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:16,fontWeight:700,cursor:"pointer"}}>−</button>
                <span style={{fontSize:15,fontWeight:800,color:C.text,minWidth:60,textAlign:"center"}}>{demiH} × ½h</span>
                <button onClick={()=>setDemiH(d=>d+1)} style={{width:34,height:34,borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:16,fontWeight:700,cursor:"pointer"}}>+</button>
              </div>
            )}
          </div>
        )}

        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",background:C.warningSoft,border:`1px solid ${C.warning}`,borderRadius:9,padding:"12px",marginTop:10}}>
          <input type="checkbox" checked={majoration} onChange={e=>setMajoration(e.target.checked)} style={{width:16,height:16,cursor:"pointer"}}/>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>🌙 Majoration nuit (20h-6h) / dimanche / férié (+20%)</span>
        </label>

        <div style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",marginTop:16}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:10}}>Détail</div>
          {breakdown.map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",color:C.muted}}>
              <span>{l}</span><span style={{color:C.text,fontWeight:600}}>{v.toFixed(2)} €</span>
            </div>
          ))}
          <div style={{height:1,background:C.border,margin:"8px 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800}}>
            <span>Total estimé</span><span style={{color:C.accent}}>{total.toFixed(2)} €</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DispatcherView({vehicles,setVehicles,courses,setCourses,pending,onValidate,onRefuse,onBack,contacts,tarifs,themeMode,toggleTheme}){
  const [selectedV,setSelectedV]=useState(null);
  const [centerTab,setCenterTab]=useState("planning");
  const [filterType,setFilterType]=useState("tous");
  const [showGarage,setShowGarage]=useState(false);
  const [alertIdx,setAlertIdx]=useState(0);
  const [showPending,setShowPending]=useState(pending.length>0); // eslint-disable-line
  const [assignVehicle,setAssignVehicle]=useState(null);
  const [dispTransfer,setDispTransfer]=useState(null);
  const [dispConfirm,setDispConfirm]=useState(null);
  const [showContacts,setShowContacts]=useState(false);
  const [showDevis,setShowDevis]=useState(false);

  const pendingToday=pending.filter(p=>(p.dateISO||todayISO())===todayISO());
  const coursesToday=courses.filter(c=>(c.dateISO||todayISO())===todayISO());

  useEffect(()=>{if(pendingToday.length>0)setShowPending(true);},[pendingToday.length]);

  const activeVehicles=vehicles.filter(v=>v.active);
  const dailyActiveNames=useDailyActiveVehicleNames();
  // Liste latérale : véhicules "en service" (checklist du jour envoyée) en
  // haut, puis les autres véhicules actifs, puis les hors service (rouge) tout en bas.
  const sidebarV=vehicles.filter(v=>filterType==="tous"?true:v.type===filterType).sort((a,b)=>{
    const rank=v=>!v.active?2:(dailyActiveNames.has(v.name)?0:1);
    return rank(a)-rank(b);
  });
  const vCourses=id=>coursesToday.filter(c=>c.vehicleId===id);
  const selectedCourses=selectedV?vCourses(selectedV.id):[];
  const currentPending=pendingToday[alertIdx]||null;

  const stats={enCourse:activeVehicles.filter(v=>v.status==="en_course").length,disponible:activeVehicles.filter(v=>v.status==="disponible").length,courses:coursesToday.length,pending:pendingToday.length};

  const handleValidate=()=>{if(!assignVehicle||!currentPending)return;onValidate(currentPending,assignVehicle);setAssignVehicle(null);setAlertIdx(i=>Math.max(0,i-1));};

  return(
    <div style={{height:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:12,cursor:"pointer"}}>← Menu</button>
          <div style={{width:34,height:34,background:C.accent,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🚑</div>
          <div><div style={{fontWeight:700,fontSize:14}}>Centre de contrôle</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"1px"}}>A.P.S. · Temps réel</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {[{label:"En course",val:stats.enCourse,color:C.success},{label:"Disponible",val:stats.disponible,color:C.blue},{label:"Courses",val:stats.courses,color:C.accent}].map(s=>(
            <div key={s.label} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:7,padding:"4px 10px",textAlign:"center"}}>
              <div style={{fontSize:15,fontWeight:800,color:s.color,fontFamily:"'IBM Plex Mono',monospace"}}>{s.val}</div>
              <div style={{fontSize:8,color:C.muted,textTransform:"uppercase",letterSpacing:"0.5px"}}>{s.label}</div>
            </div>
          ))}
          {pendingToday.length>0&&<div onClick={()=>setShowPending(true)} style={{background:C.warningSoft,border:`1px solid ${C.warning}`,borderRadius:7,padding:"4px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><div style={{width:6,height:6,borderRadius:"50%",background:C.warning,animation:"blink 1.2s infinite"}}/><span style={{fontSize:11,color:C.warning,fontWeight:700}}>{pendingToday.length} en attente</span></div>}
          <button onClick={()=>setShowContacts(true)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"6px 11px",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>📒 Contacts</button>
          <button onClick={()=>setShowDevis(true)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"6px 11px",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>💶 Devis</button>
          <Clock/>
          <button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙 Sombre":"☀️ Clair"}</button>
        </div>
      </div>

      {showPending&&currentPending&&(
        <div style={{background:"rgba(245,158,11,0.06)",borderBottom:`1px solid ${C.warning}`,padding:"10px 18px",flexShrink:0,animation:"slideIn 0.3s ease"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10,flex:1}}>
              <div style={{width:32,height:32,background:C.warningSoft,border:`1px solid ${C.warning}`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>📋</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:12,color:C.warning,marginBottom:3}}>Course en attente ({alertIdx+1}/{pendingToday.length}) — {CONV_MAP[currentPending.convention]||currentPending.convention}</div>
                <div style={{fontSize:11,color:C.text,marginBottom:2}}><strong>{currentPending.patient}</strong> · {currentPending.heure} · {TYPE_MAP[currentPending.type]||currentPending.type}</div>
                <div style={{fontSize:10,color:C.muted,marginBottom:8}}>📍 {currentPending.depart} → 🏁 {currentPending.arrivee}</div>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:C.muted,fontWeight:600}}>Affecter à :</span>
                  {activeVehicles.filter(v=>{
                    if(v.status!=="disponible") return false;
                    const needsAmbu=currentPending?.oxygene||(currentPending?.equipSelected||[]).some(e=>["perfusion","oxygene","chaise_evac"].includes(e))||currentPending?.mobilite==="brancard";
                    if(needsAmbu&&v.type!=="AMB") return false;
                    return true;
                  }).map(v=>(
                    <button key={v.id} onClick={()=>setAssignVehicle(v.id)} style={{padding:"4px 10px",borderRadius:7,border:`1.5px solid ${assignVehicle===v.id?C.accent:C.border}`,background:assignVehicle===v.id?C.accentSoft:C.panel2,color:assignVehicle===v.id?C.accent:C.muted,fontSize:11,fontWeight:assignVehicle===v.id?700:500,cursor:"pointer"}}>
                      {vIcon(v.type)} {v.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"flex-start"}}>
              {pendingToday.length>1&&<button onClick={()=>setAlertIdx(i=>(i+1)%pendingToday.length)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"6px 10px",fontSize:11,cursor:"pointer"}}>→</button>}
              <button onClick={handleValidate} disabled={!assignVehicle} style={{background:assignVehicle?C.success:C.panel2,border:"none",borderRadius:7,color:assignVehicle?"white":C.muted,padding:"6px 14px",fontWeight:700,fontSize:12,cursor:assignVehicle?"pointer":"not-allowed",opacity:assignVehicle?1:0.5}}>✅ Valider</button>
              <button onClick={()=>onRefuse(currentPending)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"6px 11px",fontSize:12,cursor:"pointer"}}>✕</button>
              <button onClick={()=>setShowPending(false)} style={{background:"transparent",border:"none",color:C.muted,fontSize:16,cursor:"pointer",padding:"0 3px"}}>×</button>
            </div>
          </div>
        </div>
      )}

      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        <div style={{width:230,background:C.panel,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
          <div style={{padding:"9px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            <div style={{display:"flex",gap:3,background:C.panel2,borderRadius:7,padding:3,marginBottom:7}}>
              {[["tous","Tous"],["TPMR","♿"],["VSL","🚗"],["AMB","🚑"]].map(([f,l])=>(
                <button key={f} onClick={()=>setFilterType(f)} style={{flex:1,padding:"5px 2px",background:filterType===f?C.accent:"transparent",border:"none",borderRadius:5,color:filterType===f?"white":C.muted,fontWeight:700,fontSize:10,cursor:"pointer"}}>{l}</button>
              ))}
            </div>
            <button onClick={()=>setShowGarage(true)} style={{width:"100%",background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"6px",fontSize:10,fontWeight:600,cursor:"pointer"}}>🏚 Actifs ({activeVehicles.length}/{vehicles.length})</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"6px"}}>
            {sidebarV.map(v=>{
              const sc={en_course:{label:"En course",color:C.success},disponible:{label:"Disponible",color:C.blue},attente:{label:"En attente",color:C.warning}}[v.status]||{label:"—",color:C.muted};
              const isSelected=selectedV?.id===v.id;
              const cnt=vCourses(v.id).length;
              const enService=dailyActiveNames.has(v.name);
              const horsService=!v.active;
              return(
                <div key={v.id} onClick={()=>{if(!horsService)setSelectedV(isSelected?null:v);}}
                  style={{background:horsService?C.dangerSoft:isSelected?C.accentSoft:C.panel2,border:`1px solid ${horsService?C.danger:isSelected?C.accent:C.border}`,borderRadius:8,padding:"9px 10px",marginBottom:5,cursor:horsService?"not-allowed":"pointer",transition:"all 0.14s",opacity:horsService?0.7:1}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      {enService&&!horsService&&<div style={{width:6,height:6,borderRadius:"50%",background:C.success,animation:"pulse 2s infinite",flexShrink:0}} title="En service"/>}
                      <span style={{fontSize:13,color:horsService?C.danger:vColor(v.type)}}>{vIcon(v.type)}</span><span style={{fontWeight:700,fontSize:12,color:horsService?C.danger:C.text}}>{v.name}</span>
                    </div>
                    {!horsService&&<div style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:5,height:5,borderRadius:"50%",background:sc.color,animation:v.status==="en_course"?"pulse 2s infinite":"none"}}/><span style={{fontSize:9,color:sc.color,fontWeight:700}}>{sc.label}</span></div>}
                  </div>
                  {horsService?(
                    <div style={{fontSize:10,color:C.danger,fontWeight:700}}>Hors service</div>
                  ):v.horsBase?(
                    <div style={{fontSize:10,color:"#f59e0b",fontWeight:700}}>🚗 Hors base — chez {v.horsBase.driver}</div>
                  ):(
                    <div style={{fontSize:10,color:C.muted}}>{v.driver}</div>
                  )}
                  {!horsService&&<div style={{fontSize:10,color:C.accent,fontWeight:600,marginTop:2}}>{cnt} course{cnt>1?"s":""}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"7px 11px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:4,background:C.panel,flexShrink:0}}>
            {[["planning","📋 Planning"],["carte","🗺 Carte"]].map(([t,l])=>(
              <button key={t} onClick={()=>setCenterTab(t)} style={{padding:"5px 13px",background:centerTab===t?C.accent:"transparent",border:"none",borderRadius:6,color:centerTab===t?"white":C.muted,fontWeight:700,fontSize:11,cursor:"pointer"}}>{l}</button>
            ))}
          </div>
          {centerTab==="planning"?(
            <PlanningAccordion vehicles={vehicles} courses={coursesToday} vCourses={vCourses}/>
          ):(
            <div style={{flex:1,position:"relative",overflow:"hidden"}}>
              <svg width="100%" height="100%" style={{position:"absolute",inset:0}}>
                <defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke={C.border} strokeWidth="0.5" opacity="0.5"/></pattern></defs>
                <rect width="100%" height="100%" fill={C.bg}/>
                <rect width="100%" height="100%" fill="url(#g)"/>
                <line x1="5%" y1="50%" x2="95%" y2="50%" stroke={C.border} strokeWidth="2" opacity="0.4"/>
                <line x1="50%" y1="5%" x2="50%" y2="95%" stroke={C.border} strokeWidth="2" opacity="0.4"/>
                <circle cx="50%" cy="46%" r="8" fill={C.accentSoft} stroke={C.accent} strokeWidth="1.5"/>
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" fill={C.accent} fontSize="8" fontFamily="IBM Plex Sans" fontWeight="bold">CHU</text>
                {activeVehicles.map(v=>{
                  const sc={en_course:C.success,disponible:C.blue,attente:C.warning}[v.status]||C.muted;
                  const isSelected=selectedV?.id===v.id;
                  const col=isSelected?C.success:vColor(v.type);
                  return(
                    <g key={v.id} onClick={()=>setSelectedV(isSelected?null:v)} style={{cursor:"pointer"}}>
                      {isSelected&&<>
                        <circle cx={`${v.x}%`} cy={`${v.y}%`} r="28" fill="rgba(34,197,94,0.08)" stroke={C.success} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8"/>
                        <circle cx={`${v.x}%`} cy={`${v.y}%`} r="22" fill="rgba(34,197,94,0.06)" stroke={C.success} strokeWidth="2" opacity="0.6"/>
                      </>}
                      <circle cx={`${v.x}%`} cy={`${v.y}%`} r={isSelected?18:15} fill={isSelected?"rgba(34,197,94,0.18)":C.panel2} stroke={isSelected?C.success:col} strokeWidth={isSelected?3:1.5}/>
                      <text x={`${v.x}%`} y={`${v.y}%`} textAnchor="middle" dominantBaseline="central" fontSize={isSelected?13:11} fill={isSelected?"#fff":col} fontFamily="IBM Plex Sans">{vIcon(v.type)}</text>
                      <circle cx={`${v.x+1.3}%`} cy={`${v.y-1.7}%`} r="4.5" fill={isSelected?C.success:sc} stroke={C.bg} strokeWidth="1.5"/>
                      {isSelected&&<text x={`${v.x}%`} y={`${parseFloat(v.y)+3.5}%`} textAnchor="middle" fontSize="7" fill={C.success} fontFamily="IBM Plex Sans" fontWeight="bold">{v.name}</text>}
                    </g>
                  );
                })}
              </svg>
              <div style={{position:"absolute",bottom:12,left:12,background:C.panel+"ee",border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px"}}>
                {[{color:C.success,label:"En course"},{color:C.blue,label:"Disponible"},{color:C.warning,label:"Attente"}].map(l=>(
                  <div key={l.label} style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}><div style={{width:6,height:6,borderRadius:"50%",background:l.color}}/><span style={{fontSize:10,color:C.mutedLight}}>{l.label}</span></div>
                ))}
                {selectedV&&<div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${C.border}`,fontSize:10,color:C.success,fontWeight:700}}>🟢 {selectedV.name} sélectionné</div>}
              </div>
            </div>
          )}
        </div>

        <div style={{width:260,background:C.panel,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
          {selectedV?(
            <>
              <div style={{padding:"13px 15px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}><span style={{fontSize:18,color:vColor(selectedV.type)}}>{vIcon(selectedV.type)}</span><span style={{fontWeight:800,fontSize:15}}>{selectedV.name}</span></div>
                    <div style={{fontSize:11,color:C.muted,marginBottom:4}}>👤 {selectedV.driver}</div>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:{en_course:C.success,disponible:C.blue,attente:C.warning}[selectedV.status]||C.muted}}/>
                      <span style={{fontSize:10,color:{en_course:C.success,disponible:C.blue,attente:C.warning}[selectedV.status]||C.muted,fontWeight:600}}>{{en_course:"En course",disponible:"Disponible",attente:"En attente"}[selectedV.status]||"—"}</span>
                    </div>
                  </div>
                  <button onClick={()=>setSelectedV(null)} style={{background:"transparent",border:"none",color:C.muted,fontSize:18,cursor:"pointer"}}>×</button>
                </div>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"9px"}}>
                <div style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:7}}>{selectedCourses.length} course{selectedCourses.length>1?"s":""}</div>
                {selectedCourses.length===0?<div style={{textAlign:"center",padding:"24px 0",color:C.muted,fontSize:12}}>Aucune course</div>:selectedCourses.map(c=>(
                  <div key={c.id} style={{background:C.panel3,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 11px",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}><span>{TYPE_MAP[c.type]||"🚑"}</span><span style={{fontSize:11,fontWeight:700}}>{c.heure}</span></div>
                    <div style={{fontSize:11,fontWeight:700,marginBottom:3}}>{c.patient}</div>
                    <div style={{fontSize:10,color:C.muted,marginBottom:6}}>🏁 {c.arrivee}</div>
                    <button onClick={()=>setDispTransfer({course:c,fromVehicle:selectedV})} style={{width:"100%",background:C.panel2,border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,padding:"5px",fontSize:10,fontWeight:700,cursor:"pointer"}}>🔀 Transférer</button>
                  </div>
                ))}
              </div>
            </>
          ):(
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"18px",textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:8,opacity:0.2}}>♿</div>
              <div style={{fontSize:12,color:C.muted}}>Sélectionnez un véhicule</div>
              <div style={{fontSize:10,color:C.muted,marginTop:4}}>sur la liste ou la carte</div>
            </div>
          )}
        </div>
      </div>

      {dispTransfer&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px",width:440,maxWidth:"92vw",maxHeight:"85vh",display:"flex",flexDirection:"column",animation:"pop 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:16}}>🔀 Transférer la course</div>
              <button onClick={()=>setDispTransfer(null)} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            <div style={{fontSize:12,color:C.muted,marginBottom:4}}>Course : <strong style={{color:C.text}}>{dispTransfer.course.patient}</strong></div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>De : <strong style={{color:C.accent}}>{dispTransfer.fromVehicle.name}</strong></div>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:10}}>Choisir un véhicule :</div>
            <div style={{overflowY:"auto",flex:1}}>
              {activeVehicles.filter(v=>v.id!==dispTransfer.fromVehicle.id).map(v=>(
                <button key={v.id} onClick={()=>setDispConfirm({course:dispTransfer.course,toVehicle:v})}
                  style={{width:"100%",background:C.panel2,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:7,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:16,color:vColor(v.type)}}>{vIcon(v.type)}</span>
                  <div><div style={{fontWeight:700,fontSize:13}}>{v.name}</div><div style={{fontSize:10,color:C.muted}}>{v.driver} — <span style={{color:v.status==="disponible"?C.success:C.warning}}>{v.status==="disponible"?"Disponible":"En course"}</span></div></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {dispConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"28px",width:360,maxWidth:"92vw",textAlign:"center",animation:"pop 0.2s ease"}}>
            <div style={{fontSize:32,marginBottom:12}}>🔀</div>
            <div style={{fontWeight:800,fontSize:17,marginBottom:8}}>Confirmer le transfert</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:6}}>{dispConfirm.course.patient}</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:24}}>→ <strong style={{color:C.accent}}>{vIcon(dispConfirm.toVehicle.type)} {dispConfirm.toVehicle.name}</strong></div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setDispConfirm(null)} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:11,color:C.muted,padding:"13px",fontWeight:700,fontSize:15,cursor:"pointer"}}>Non</button>
              <button onClick={()=>{
                const newCourse={...dispConfirm.course,vehicleId:dispConfirm.toVehicle.id};
                setCourses&&setCourses(p=>p.map(c=>c.id===dispConfirm.course.id?newCourse:c));
                setDispConfirm(null);setDispTransfer(null);
              }} style={{flex:1,background:C.success,border:"none",borderRadius:11,color:"white",padding:"13px",fontWeight:800,fontSize:15,cursor:"pointer"}}>Oui</button>
            </div>
          </div>
        </div>
      )}

      {showGarage&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:15,padding:"24px",width:500,maxWidth:"92vw",maxHeight:"85vh",display:"flex",flexDirection:"column",animation:"pop 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:16}}>🏚 Véhicules en service</div>
              <button onClick={()=>setShowGarage(false)} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",flex:1}}>
              {["TPMR","VSL","AMB"].map(type=>(
                <div key={type} style={{marginBottom:16}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:8,display:"flex",alignItems:"center",gap:7}}>
                    {vIcon(type)} {type==="AMB"?"Ambulances ALPHA":type}<div style={{flex:1,height:1,background:C.border}}/><span style={{color:C.accent}}>{vehicles.filter(v=>v.type===type&&v.active).length}/{vehicles.filter(v=>v.type===type).length}</span>
                  </div>
                  {vehicles.filter(v=>v.type===type).map(v=>(
                    <div key={v.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:v.active?C.successSoft:C.panel2,border:`1px solid ${v.active?C.success:C.border}`,borderRadius:8,padding:"9px 13px",marginBottom:5}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:15,color:vColor(type)}}>{vIcon(type)}</span>
                        <div><div style={{fontWeight:700,fontSize:12}}>{v.name}</div><div style={{fontSize:10,color:C.muted}}>👤 {v.driver}</div></div>
                      </div>
                      <div onClick={()=>setVehicles(p=>p.map(x=>x.id===v.id?{...x,active:!x.active}:x))} style={{width:40,height:22,background:v.active?C.success:C.border,borderRadius:11,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
                        <div style={{position:"absolute",top:2,left:v.active?20:2,width:18,height:18,background:"white",borderRadius:"50%",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.3)"}}/>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <button onClick={()=>setShowGarage(false)} style={{marginTop:12,width:"100%",background:C.accent,border:"none",borderRadius:9,color:"white",padding:"11px",fontWeight:800,fontSize:13,cursor:"pointer"}}>✅ Confirmer</button>
          </div>
        </div>
      )}

      {showContacts&&<ContactsPickerModal contacts={contacts} onSelect={()=>{}} onClose={()=>setShowContacts(false)} pickMode={false}/>}
      {showDevis&&<DevisModal tarifs={tarifs} onClose={()=>setShowDevis(false)}/>}
    </div>
  );
}

function ContactsPickerModal({contacts,onSelect,onClose,pickMode}){
  const [bigContact,setBigContact]=useState(null);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400}}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px",width:480,maxWidth:"92vw",maxHeight:"85vh",display:"flex",flexDirection:"column",animation:"pop 0.2s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:17}}>📒 Carnet de contacts</div>
          <button onClick={()=>{setBigContact(null);onClose();}} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        {bigContact?(
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:14,color:C.muted,marginBottom:8}}>{bigContact.nom}</div>
            <div style={{fontSize:44,fontWeight:900,color:C.text,letterSpacing:"1px",marginBottom:24}}>{bigContact.tel}</div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              {pickMode&&<button onClick={()=>{onSelect(bigContact.tel);onClose();}} style={{background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:9,color:C.accent,padding:"10px 22px",fontSize:14,fontWeight:700,cursor:"pointer"}}>✅ Utiliser ce numéro</button>}
              <button onClick={()=>setBigContact(null)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"10px 20px",fontSize:14,cursor:"pointer"}}>← Retour</button>
            </div>
          </div>
        ):(
          <div style={{overflowY:"auto",flex:1}}>
            {contacts&&[...contacts].sort((a,b)=>a.nom.localeCompare(b.nom)).map(c=>(
              <button key={c.id} onClick={()=>setBigContact(c)}
                style={{width:"100%",background:C.panel2,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 16px",marginBottom:7,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:14,fontWeight:600,color:C.text}}>📒 {c.nom}</span>
                <span style={{fontSize:12,color:C.mutedLight}}>{c.tel}</span>
              </button>
            ))}
            {(!contacts||contacts.length===0)&&<div style={{textAlign:"center",padding:"30px 0",color:C.muted}}>Aucun contact enregistré</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// CHECKLIST JOURNALIÈRE — formulaire (portée depuis APS Daily, thème DispatchAI)
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// GARAGE — défauts véhicules (portée depuis APS Daily) + Mode TV
// ═══════════════════════════════════════
function DailyCarteVehicule({ vehicle, items, resolve, compact, themeC }){
  const [currentIdx,setCurrentIdx]=useState(0);
  useEffect(()=>{
    if(items.length<=1) return;
    const interval=setInterval(()=>{ setCurrentIdx(prev=>(prev+1)%items.length); }, 4000);
    return ()=>clearInterval(interval);
  },[items.length]);
  const d=items[currentIdx];
  return(
    <div style={{background:themeC.panel,border:`2px solid ${themeC.danger}66`,borderRadius:14,padding:compact?8:12,display:"flex",flexDirection:"column",height:"100%",boxSizing:"border-box",overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexShrink:0}}>
        <span style={{fontWeight:900,fontSize:compact?15:19,color:themeC.text}}>{vehicle}</span>
        <span style={{background:themeC.dangerSoft,color:themeC.danger,padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700}}>{currentIdx+1}/{items.length}</span>
      </div>
      <div style={{background:themeC.bg,borderRadius:8,padding:compact?8:10,borderLeft:`3px solid ${themeC.danger}`,flex:1,display:"flex",flexDirection:"column",justifyContent:"space-between",overflow:"hidden"}}>
        <div style={{fontSize:compact?12:14,fontWeight:600,wordBreak:"break-word",lineHeight:1.4,overflowY:"auto",flex:1,marginBottom:8,color:themeC.text}}>{d.description}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:11,color:themeC.muted}}>👤 {d.reportedBy}{d.source==="checklist"&&<span style={{color:themeC.warning,marginLeft:4}}>⚡</span>}{d.source==="manuel"&&<span style={{color:themeC.muted,marginLeft:4}}>✍️</span>}</span>
          <button onClick={()=>resolve(d.id)} style={{padding:compact?"4px 10px":"6px 14px",background:themeC.success,border:"none",borderRadius:6,color:"white",fontSize:compact?11:13,fontWeight:700,cursor:"pointer"}}>Résolu</button>
        </div>
      </div>
      {items.length>1&&(
        <div style={{display:"flex",justifyContent:"center",gap:5,marginTop:6,flexShrink:0}}>
          {items.map((_,i)=>(<div key={i} onClick={()=>setCurrentIdx(i)} style={{width:7,height:7,borderRadius:"50%",background:i===currentIdx?themeC.danger:themeC.muted,cursor:"pointer",flexShrink:0}}/>))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// SIGNALER (version complète, accès libre) — choix libre du véhicule
// ═══════════════════════════════════════
function SignalerCompletView({ onBack, vehicles, themeMode, toggleTheme }){
  const [signalVehicle,setSignalVehicle]=useState("");
  const [signalDesc,setSignalDesc]=useState("");
  const [signalNom,setSignalNom]=useState("");
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);

  const canSend = signalVehicle && signalDesc.trim() && signalNom.trim() && !sending;

  const handleSend = async () => {
    if(!canSend) return;
    setSending(true);
    const vObj=vehicles.find(v=>v.name===signalVehicle);
    await addDoc(collection(dbChecklists,"dispatchai_daily_defects"), {
      vehicle:signalVehicle, type:vObj?.type||"AMB", description:signalDesc.trim(),
      reportedBy:signalNom.trim(), source:"manuel", defectKey:signalVehicle+"_manuel_"+Date.now(),
      createdAt:Date.now(),
    });
    setSending(false);
    setSent(true);
    setTimeout(()=>{ setSignalVehicle(""); setSignalDesc(""); setSignalNom(""); setSent(false); }, 1500);
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>←</button>
          <div style={{fontWeight:800,fontSize:16,color:C.danger}}>🚨 Signaler un problème</div>
        </div>
        <button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{flex:1,padding:16,paddingBottom:100,maxWidth:520,margin:"0 auto",width:"100%"}}>
        {sent?(
          <div style={{background:C.successSoft,border:`1px solid ${C.success}`,borderRadius:12,padding:20,textAlign:"center",fontWeight:700,color:C.success,marginTop:20}}>✅ Problème signalé au Garage !</div>
        ):(
          <>
            <div style={{marginTop:16,marginBottom:16}}>
              {[["TPMR","TPMR"],["VSL","VSL"],["AMB","Ambulances ALPHA"]].map(([type,label])=>{
                const group=vehicles.filter(v=>v.type===type);
                if(group.length===0) return null;
                return(
                  <div key={type} style={{marginBottom:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8}}>{label}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                      {group.map(v=>(
                        <button key={v.id} onClick={()=>setSignalVehicle(v.name)} style={{padding:"8px 4px",borderRadius:9,textAlign:"center",cursor:"pointer",fontSize:12,fontWeight:700,background:signalVehicle===v.name?C.dangerSoft:C.panel,border:`1px solid ${signalVehicle===v.name?C.danger:C.border}`,color:signalVehicle===v.name?C.danger:C.muted}}>{v.name}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8}}>Description du problème*</div>
            <textarea value={signalDesc} onChange={e=>setSignalDesc(e.target.value)} placeholder="Décrivez le problème en détail..." style={{width:"100%",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px",color:C.text,fontSize:13,minHeight:90,resize:"vertical",marginBottom:16,fontFamily:"inherit"}}/>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8}}>Votre nom*</div>
            <input value={signalNom} onChange={e=>setSignalNom(e.target.value)} placeholder="Prénom Nom" style={{width:"100%",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px",color:C.text,fontSize:13,marginBottom:20,fontFamily:"inherit"}}/>
          </>
        )}
      </div>
      {!sent&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.panel,borderTop:`1px solid ${C.border}`,padding:"13px 16px"}}>
          <button disabled={!canSend} onClick={handleSend} style={{width:"100%",background:canSend?C.danger:C.panel2,border:"none",borderRadius:10,color:canSend?"white":C.muted,padding:14,fontWeight:800,fontSize:14,cursor:canSend?"pointer":"not-allowed",opacity:canSend?1:0.6}}>
            {sending?"Envoi…":"Envoyer le signalement"}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// PRÉVENTIF — postes de secours événementiels (section indépendante)
// ═══════════════════════════════════════
const PREVENTIF_GRADES=["Secouriste","ATNUP","AMU","Infirmier/ère","SISU","Médecin"];

function PreventifParametresView({ personnel, setPersonnel, materiel, setMateriel, onBack, themeMode, toggleTheme }){
  const [tab,setTab]=useState("personnel");
  const [newName,setNewName]=useState("");
  const [newGrade,setNewGrade]=useState(PREVENTIF_GRADES[0]);
  const [newMateriel,setNewMateriel]=useState("");
  const PTABS=[{id:"personnel",icon:"👥",label:"Personnel"},{id:"materiel",icon:"🎒",label:"Matériel"}];
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>←</button>
          <div style={{fontWeight:800,fontSize:16,color:C.purple}}>⚙️ Paramètres Préventif</div>
        </div>
        <button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        <div style={{width:180,background:C.panel,borderRight:`1px solid ${C.border}`,padding:"12px 8px",display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
          {PTABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"11px 14px",borderRadius:9,border:"none",background:tab===t.id?C.purpleSoft:"transparent",color:tab===t.id?C.purple:C.muted,fontWeight:tab===t.id?700:500,fontSize:13,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:24}}>
          {tab==="personnel"&&(
            <div>
              <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:6}}>👥 Personnel</div>
              <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Organisé par grade sanitaire.</div>
              <div style={{display:"flex",gap:8,marginBottom:20}}>
                <select value={newGrade} onChange={e=>setNewGrade(e.target.value)} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 10px",color:C.text,fontSize:12}}>
                  {PREVENTIF_GRADES.map(g=>(<option key={g} value={g}>{g}</option>))}
                </select>
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Prénom Nom" style={{flex:1,background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 12px",color:C.text,fontSize:13}}/>
                <button onClick={()=>{
                  if(!newName.trim()) return;
                  setPersonnel(p=>[...p,{id:"pp"+Date.now(),name:newName.trim(),grade:newGrade}]);
                  setNewName("");
                }} style={{background:C.purpleSoft,border:`1px solid ${C.purple}`,borderRadius:9,color:C.purple,padding:"9px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Ajouter</button>
              </div>
              {PREVENTIF_GRADES.map(grade=>{
                const group=personnel.filter(p=>p.grade===grade);
                if(group.length===0) return null;
                return(
                  <div key={grade} style={{marginBottom:18}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>{grade}</div>
                    {group.map(p=>(
                      <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",marginBottom:6}}>
                        <span style={{fontSize:13,color:C.text}}>{p.name}</span>
                        <button onClick={()=>setPersonnel(prev=>prev.filter(x=>x.id!==p.id))} style={{background:"transparent",border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"4px 9px",fontSize:11,cursor:"pointer"}}>🗑</button>
                      </div>
                    ))}
                  </div>
                );
              })}
              {personnel.length===0&&<div style={{textAlign:"center",color:C.muted,fontSize:13,padding:"20px 0"}}>Aucun personnel enregistré</div>}
            </div>
          )}
          {tab==="materiel"&&(
            <div>
              <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:6}}>🎒 Matériel</div>
              <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Liste utilisée pour toutes les fiches événements.</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <input value={newMateriel} onChange={e=>setNewMateriel(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newMateriel.trim()){setMateriel(p=>[...p,{id:"pm"+Date.now(),name:newMateriel.trim()}]);setNewMateriel("");}}} placeholder="Ex: Table, Chaise, Défibrillateur..." style={{flex:1,background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 12px",color:C.text,fontSize:13}}/>
                <button onClick={()=>{if(newMateriel.trim()){setMateriel(p=>[...p,{id:"pm"+Date.now(),name:newMateriel.trim()}]);setNewMateriel("");}}} style={{background:C.purpleSoft,border:`1px solid ${C.purple}`,borderRadius:9,color:C.purple,padding:"9px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Ajouter</button>
              </div>
              {materiel.map(m=>(
                <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",marginBottom:6}}>
                  <span style={{fontSize:13,color:C.text}}>{m.name}</span>
                  <button onClick={()=>setMateriel(prev=>prev.filter(x=>x.id!==m.id))} style={{background:"transparent",border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"4px 9px",fontSize:11,cursor:"pointer"}}>🗑</button>
                </div>
              ))}
              {materiel.length===0&&<div style={{textAlign:"center",color:C.muted,fontSize:13,padding:"20px 0"}}>Aucun article enregistré</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const PREVENTIF_HEURE_FIELDS=["heureDepartBase","heureDebutPrestation","heureFinPrestation","heureRetourBase"];

function calcTotalHeures(p){
  const parse=(h)=>{ if(!h) return null; const m=h.match(/(\d{1,2})h(\d{2})/); if(!m) return null; return parseInt(m[1])*60+parseInt(m[2]); };
  const d=parse(p.heureDepartBase), f=parse(p.heureRetourBase);
  if(d===null||f===null) return "";
  let diff=f-d; if(diff<0) diff+=24*60;
  const h=Math.floor(diff/60), m=diff%60;
  return `${h}h${String(m).padStart(2,"0")}`;
}

function PreventifFicheForm({ vehicles, driversAmb, driversTpmr, materiel, onSave, onCancel }){
  const [form,setForm]=useState({
    nomEvenement:"", date:todayISO(), lieu:"", adresse:"", nature:"", subsistance:false, dispositif:"",
    responsableOrga:"", gsmOrga:"",
    responsableMission:"", departBaseAuPlusTard:"", canalRadio:"",
    vehiculesEngages:[], materielChecked:[],
  });
  const allDrivers=[...(driversAmb||[]),...(driversTpmr||[])];

  const toggleVehicule=(v)=>{
    setForm(f=>{
      const exists=f.vehiculesEngages.find(x=>x.vehicleId===v.id);
      if(exists) return {...f,vehiculesEngages:f.vehiculesEngages.filter(x=>x.vehicleId!==v.id)};
      return {...f,vehiculesEngages:[...f.vehiculesEngages,{vehicleId:v.id,vehicleName:v.name,chauffeur:""}]};
    });
  };
  const setChauffeur=(vehicleId,chauffeur)=>setForm(f=>({...f,vehiculesEngages:f.vehiculesEngages.map(x=>x.vehicleId===vehicleId?{...x,chauffeur}:x)}));
  const toggleMateriel=(id)=>setForm(f=>({...f,materielChecked:f.materielChecked.includes(id)?f.materielChecked.filter(x=>x!==id):[...f.materielChecked,id]}));

  const canSave=form.nomEvenement.trim()&&form.date&&form.responsableMission.trim();

  const handleSave=()=>{
    if(!canSave) return;
    onSave({
      ...form,
      id:"prev"+Date.now(),
      departEffectif:"", heureSurPlace:"", heureFinMission:"", heureRetourBaseMission:"",
      personnel:[{id:"pers"+Date.now(),nom:form.responsableMission.trim(),prenom:"",fonction:"Responsable de mission",heureDepartBase:"",heureDebutPrestation:"",heureFinPrestation:"",heureRetourBase:""}],
      remarque:"", signature:"",
      createdAt:Date.now(),
    });
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onCancel} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>←</button>
          <div style={{fontWeight:800,fontSize:16,color:C.purple}}>+ Nouvelle fiche événement</div>
        </div>
      </div>
      <div style={{flex:1,padding:20,paddingBottom:100,maxWidth:640,margin:"0 auto",width:"100%"}}>

        <div style={{fontSize:12,fontWeight:800,color:C.purple,textTransform:"uppercase",marginBottom:10}}>Ordre et rapport de mission</div>
        {[["nomEvenement","Nom de l'événement"],["lieu","Lieu"],["adresse","Adresse"],["nature","Nature (ex: soirée chapiteau)"]].map(([f,l])=>(
          <div key={f} style={{marginBottom:10}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>{l}</div>
            <input value={form[f]} onChange={e=>setForm(x=>({...x,[f]:e.target.value}))} style={{width:"100%",background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:13,boxSizing:"border-box"}}/>
          </div>
        ))}
        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Date</div>
          <input type="date" value={form.date} onChange={e=>setForm(x=>({...x,date:e.target.value}))} style={{width:"100%",background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:13,boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Subsistance</div>
          <div style={{display:"flex",gap:8}}>
            {[[true,"Oui"],[false,"Non"]].map(([v,l])=>(
              <button key={l} onClick={()=>setForm(x=>({...x,subsistance:v}))} style={{flex:1,padding:"9px",borderRadius:8,border:`1.5px solid ${form.subsistance===v?C.purple:C.border}`,background:form.subsistance===v?C.purpleSoft:"transparent",color:form.subsistance===v?C.purple:C.muted,fontWeight:700,fontSize:12,cursor:"pointer"}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Dispositif</div>
          <textarea value={form.dispositif} onChange={e=>setForm(x=>({...x,dispositif:e.target.value}))} placeholder="Ex: 1 PS sous toit, 1 ambu AMU, 2 PAPS" style={{width:"100%",minHeight:60,background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:13,boxSizing:"border-box",resize:"vertical",fontFamily:"inherit"}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
          <div>
            <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Responsable organisation</div>
            <input value={form.responsableOrga} onChange={e=>setForm(x=>({...x,responsableOrga:e.target.value}))} style={{width:"100%",background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:13,boxSizing:"border-box"}}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>GSM</div>
            <input value={form.gsmOrga} onChange={e=>setForm(x=>({...x,gsmOrga:e.target.value}))} style={{width:"100%",background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:13,boxSizing:"border-box"}}/>
          </div>
        </div>

        <div style={{fontSize:12,fontWeight:800,color:C.purple,textTransform:"uppercase",marginBottom:10}}>Logistique équipe</div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Responsable de mission</div>
          <select value={form.responsableMission} onChange={e=>setForm(x=>({...x,responsableMission:e.target.value}))} style={{width:"100%",background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:13}}>
            <option value="">— Choisir —</option>
            {allDrivers.map(d=>(<option key={d} value={d}>{d}</option>))}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
          <div>
            <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Départ base au plus tard</div>
            <HeureInput value={form.departBaseAuPlusTard} onChange={v=>setForm(x=>({...x,departBaseAuPlusTard:v}))}/>
          </div>
          <div>
            <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Canal radio</div>
            <input value={form.canalRadio} onChange={e=>setForm(x=>({...x,canalRadio:e.target.value}))} style={{width:"100%",background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:13,boxSizing:"border-box"}}/>
          </div>
        </div>

        <div style={{fontSize:12,fontWeight:800,color:C.purple,textTransform:"uppercase",marginBottom:10}}>Véhicules engagés</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
          {(vehicles||[]).map(v=>{
            const active=form.vehiculesEngages.some(x=>x.vehicleId===v.id);
            return(<button key={v.id} onClick={()=>toggleVehicule(v)} style={{padding:"8px 4px",borderRadius:8,border:`1px solid ${active?C.purple:C.border}`,background:active?C.purpleSoft:"transparent",color:active?C.purple:C.muted,fontSize:12,fontWeight:700,cursor:"pointer"}}>{v.name}</button>);
          })}
        </div>
        {form.vehiculesEngages.map(v=>(
          <div key={v.vehicleId} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{fontSize:12,color:C.muted,width:70}}>{v.vehicleName}</span>
            <select value={v.chauffeur} onChange={e=>setChauffeur(v.vehicleId,e.target.value)} style={{flex:1,background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",color:C.text,fontSize:12}}>
              <option value="">— Chauffeur —</option>
              {allDrivers.map(d=>(<option key={d} value={d}>{d}</option>))}
            </select>
          </div>
        ))}

        <div style={{fontSize:12,fontWeight:800,color:C.purple,textTransform:"uppercase",marginTop:20,marginBottom:10}}>Matériel à embarquer</div>
        {(materiel||[]).map(m=>{
          const active=form.materielChecked.includes(m.id);
          return(
            <label key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",cursor:"pointer"}}>
              <input type="checkbox" checked={active} onChange={()=>toggleMateriel(m.id)} style={{width:16,height:16,cursor:"pointer"}}/>
              <span style={{fontSize:13,color:C.text}}>{m.name}</span>
            </label>
          );
        })}
        {(!materiel||materiel.length===0)&&<div style={{fontSize:12,color:C.muted}}>Aucun article défini (Paramètres → Matériel)</div>}
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.panel,borderTop:`1px solid ${C.border}`,padding:"13px 16px"}}>
        <button disabled={!canSave} onClick={handleSave} style={{width:"100%",background:canSave?C.purple:C.panel2,border:"none",borderRadius:10,color:canSave?"white":C.muted,padding:14,fontWeight:800,fontSize:15,cursor:canSave?"pointer":"not-allowed"}}>✅ Créer la fiche</button>
      </div>
    </div>
  );
}

function PreventifFicheDetail({ fiche, materiel, onSave, onBack }){
  const [f,setF]=useState(fiche);
  const [newNom,setNewNom]=useState(""); const [newPrenom,setNewPrenom]=useState(""); const [newFonction,setNewFonction]=useState("");

  const save=(next)=>{ setF(next); onSave(next); };
  const updatePersonnel=(id,field,val)=>{
    const personnel=f.personnel.map(p=>p.id===id?{...p,[field]:val}:p);
    save({...f,personnel});
  };
  const addPersonnel=()=>{
    if(!newNom.trim()) return;
    save({...f,personnel:[...f.personnel,{id:"pers"+Date.now(),nom:newNom.trim(),prenom:newPrenom.trim(),fonction:newFonction.trim(),heureDepartBase:"",heureDebutPrestation:"",heureFinPrestation:"",heureRetourBase:""}]});
    setNewNom("");setNewPrenom("");setNewFonction("");
  };
  const removePersonnel=(id)=>save({...f,personnel:f.personnel.filter(p=>p.id!==id)});
  const toggleMateriel=(id)=>{
    const checked=f.materielChecked||[];
    save({...f,materielChecked:checked.includes(id)?checked.filter(x=>x!==id):[...checked,id]});
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 18px",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:50}}>
        <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>←</button>
        <div><div style={{fontWeight:800,fontSize:15,color:C.purple}}>{f.nomEvenement}</div><div style={{fontSize:10,color:C.muted}}>{f.lieu} — {new Date(f.date+"T00:00:00").toLocaleDateString("fr-FR")}</div></div>
      </div>
      <div style={{flex:1,padding:16,paddingBottom:60,maxWidth:700,margin:"0 auto",width:"100%"}}>

        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:C.purple,textTransform:"uppercase",marginBottom:8}}>Infos mission</div>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.8}}>
            <div><b style={{color:C.text}}>Adresse :</b> {f.adresse||"—"}</div>
            <div><b style={{color:C.text}}>Nature :</b> {f.nature||"—"}</div>
            <div><b style={{color:C.text}}>Dispositif :</b> {f.dispositif||"—"}</div>
            <div><b style={{color:C.text}}>Subsistance :</b> {f.subsistance?"Oui":"Non"}</div>
            <div><b style={{color:C.text}}>Organisation :</b> {f.responsableOrga||"—"} {f.gsmOrga&&`(${f.gsmOrga})`}</div>
            <div><b style={{color:C.text}}>Canal radio :</b> {f.canalRadio||"—"}</div>
            <div><b style={{color:C.text}}>Véhicules :</b> {f.vehiculesEngages.map(v=>`${v.vehicleName} (${v.chauffeur||"?"})`).join(", ")||"—"}</div>
          </div>
        </div>

        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:C.purple,textTransform:"uppercase",marginBottom:10}}>Horaires mission</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[["departEffectif","Départ effectif"],["heureSurPlace","Heure sur place"],["heureFinMission","Heure de fin"],["heureRetourBaseMission","Retour base"]].map(([field,label])=>(
              <div key={field}>
                <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>{label}</div>
                <HeureInput value={f[field]||""} onChange={v=>save({...f,[field]:v})}/>
              </div>
            ))}
          </div>
        </div>

        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:16,overflowX:"auto"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.purple,textTransform:"uppercase",marginBottom:10}}>Feuille de prestation</div>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:640}}>
            <thead>
              <tr>{["Nom","Prénom","Fonction","Départ base","Début prest.","Fin prest.","Retour base","Total",""].map(h=>(<th key={h} style={{fontSize:10,color:C.muted,textAlign:"left",padding:"4px 6px",borderBottom:`1px solid ${C.border}`}}>{h}</th>))}</tr>
            </thead>
            <tbody>
              {f.personnel.map(p=>(
                <tr key={p.id}>
                  <td style={{padding:"4px 6px"}}><input value={p.nom} onChange={e=>updatePersonnel(p.id,"nom",e.target.value)} style={{width:70,background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 6px",color:C.text,fontSize:11}}/></td>
                  <td style={{padding:"4px 6px"}}><input value={p.prenom} onChange={e=>updatePersonnel(p.id,"prenom",e.target.value)} style={{width:70,background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 6px",color:C.text,fontSize:11}}/></td>
                  <td style={{padding:"4px 6px"}}><input value={p.fonction} onChange={e=>updatePersonnel(p.id,"fonction",e.target.value)} style={{width:90,background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 6px",color:C.text,fontSize:11}}/></td>
                  {PREVENTIF_HEURE_FIELDS.map(hf=>(
                    <td key={hf} style={{padding:"4px 6px"}}><div style={{width:70}}><HeureInput value={p[hf]||""} onChange={v=>updatePersonnel(p.id,hf,v)}/></div></td>
                  ))}
                  <td style={{padding:"4px 6px",fontSize:11,fontWeight:700,color:C.text}}>{calcTotalHeures(p)}</td>
                  <td style={{padding:"4px 6px"}}>{f.personnel.length>1&&<button onClick={()=>removePersonnel(p.id)} style={{background:"transparent",border:`1px solid ${C.danger}`,borderRadius:5,color:C.danger,padding:"2px 6px",fontSize:10,cursor:"pointer"}}>🗑</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{display:"flex",gap:6,marginTop:10}}>
            <input value={newNom} onChange={e=>setNewNom(e.target.value)} placeholder="Nom" style={{width:80,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 8px",color:C.text,fontSize:12}}/>
            <input value={newPrenom} onChange={e=>setNewPrenom(e.target.value)} placeholder="Prénom" style={{width:80,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 8px",color:C.text,fontSize:12}}/>
            <input value={newFonction} onChange={e=>setNewFonction(e.target.value)} placeholder="Fonction" style={{width:100,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 8px",color:C.text,fontSize:12}}/>
            <button onClick={addPersonnel} style={{background:C.purpleSoft,border:`1px solid ${C.purple}`,borderRadius:6,color:C.purple,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Ajouter</button>
          </div>
        </div>

        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:C.purple,textTransform:"uppercase",marginBottom:10}}>Matériel</div>
          {(materiel||[]).map(m=>{
            const active=(f.materielChecked||[]).includes(m.id);
            return(
              <label key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",cursor:"pointer"}}>
                <input type="checkbox" checked={active} onChange={()=>toggleMateriel(m.id)} style={{width:16,height:16,cursor:"pointer"}}/>
                <span style={{fontSize:13,color:C.text}}>{m.name}</span>
              </label>
            );
          })}
        </div>

        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:C.purple,textTransform:"uppercase",marginBottom:8}}>Remarque</div>
          <textarea value={f.remarque||""} onChange={e=>save({...f,remarque:e.target.value})} style={{width:"100%",minHeight:70,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:13,boxSizing:"border-box",resize:"vertical",fontFamily:"inherit"}}/>
        </div>

        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:14}}>
          <div style={{fontSize:11,fontWeight:700,color:C.purple,textTransform:"uppercase",marginBottom:8}}>Signature du responsable de mission</div>
          <input value={f.signature||""} onChange={e=>save({...f,signature:e.target.value})} placeholder="Nom du responsable pour valider" style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:13,boxSizing:"border-box"}}/>
        </div>
      </div>
    </div>
  );
}

function PreventifHistorique({ fiches, materiel, onSave, onBack, themeMode, toggleTheme }){
  const [selected,setSelected]=useState(null);
  if(selected) return <PreventifFicheDetail fiche={selected} materiel={materiel} onSave={(next)=>{onSave(next);setSelected(next);}} onBack={()=>setSelected(null)}/>;
  const sorted=[...fiches].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>←</button>
          <div style={{fontWeight:800,fontSize:16,color:C.purple}}>📅 Historique Préventif</div>
        </div>
        <button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{flex:1,padding:16,maxWidth:640,margin:"0 auto",width:"100%"}}>
        {sorted.length===0&&<div style={{textAlign:"center",color:C.muted,padding:40}}>Aucun événement enregistré</div>}
        {sorted.map(f=>(
          <button key={f.id} onClick={()=>setSelected(f)} style={{width:"100%",background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",marginBottom:8,cursor:"pointer",textAlign:"left"}}>
            <div style={{fontWeight:700,fontSize:14,color:C.text}}>{f.nomEvenement}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{f.lieu} — {new Date(f.date+"T00:00:00").toLocaleDateString("fr-FR")}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PreventifView({ onBack, vehicles, driversAmb, driversTpmr, themeMode, toggleTheme }){
  const [bureau,setBureau]=useState(false);
  const [screen,setScreen]=useState("home"); // home | parametres | nouvelle | historique
  const [personnel,setPersonnel]=useFirestoreState("preventifPersonnel", []);
  const [materiel,setMateriel]=useFirestoreState("preventifMateriel", []);
  const [fiches,setFiches]=useFirestoreState("preventifFiches", []);
  const [openFiche,setOpenFiche]=useState(null);

  const saveFiche=(next)=>setFiches(prev=>{
    const exists=prev.find(x=>x.id===next.id);
    return exists?prev.map(x=>x.id===next.id?next:x):[...prev,next];
  });

  if(screen==="parametres") return <PreventifParametresView personnel={personnel} setPersonnel={setPersonnel} materiel={materiel} setMateriel={setMateriel} onBack={()=>setScreen("home")} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(screen==="nouvelle") return <PreventifFicheForm vehicles={vehicles} driversAmb={driversAmb} driversTpmr={driversTpmr} materiel={materiel} onCancel={()=>setScreen("home")} onSave={(f)=>{saveFiche(f);setScreen("home");}}/>;
  if(screen==="historique") return <PreventifHistorique fiches={fiches} materiel={materiel} onSave={saveFiche} onBack={()=>setScreen("home")} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(openFiche) return <PreventifFicheDetail fiche={openFiche} materiel={materiel} onSave={(next)=>{saveFiche(next);setOpenFiche(next);}} onBack={()=>setOpenFiche(null)}/>;

  const todayFiches=fiches.filter(f=>f.date===todayISO());

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>←</button>
          <div style={{fontWeight:800,fontSize:16,color:C.purple}}>🚑 Préventif</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setBureau(b=>!b)} style={{background:bureau?C.purple:C.panel2,border:`1px solid ${bureau?C.purple:C.border}`,borderRadius:8,color:bureau?"white":C.muted,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🏢 Bureau{bureau?" ✓":""}</button>
          {bureau&&<button onClick={()=>setScreen("parametres")} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 10px",fontSize:13,cursor:"pointer"}}>⚙️</button>}
          <button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
        </div>
      </div>
      <div style={{flex:1,padding:20,maxWidth:640,margin:"0 auto",width:"100%"}}>
        {bureau&&(
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            <button onClick={()=>setScreen("nouvelle")} style={{flex:1,background:C.purpleSoft,border:`1.5px dashed ${C.purple}`,borderRadius:12,padding:"14px",color:C.purple,fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Nouvelle fiche</button>
            <button onClick={()=>setScreen("historique")} style={{flex:1,background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",color:C.text,fontWeight:700,fontSize:13,cursor:"pointer"}}>📅 Historique</button>
          </div>
        )}
        {todayFiches.length===0?(
          <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
            <div style={{fontSize:48,marginBottom:14}}>🚑</div>
            <div style={{fontSize:14}}>Aucun événement Préventif prévu aujourd'hui</div>
          </div>
        ):todayFiches.map(f=>(
          <button key={f.id} onClick={()=>setOpenFiche(f)} style={{width:"100%",background:C.panel,border:`1.5px solid ${C.purple}`,borderRadius:12,padding:"16px",marginBottom:10,cursor:"pointer",textAlign:"left"}}>
            <div style={{fontWeight:800,fontSize:15,color:C.text}}>{f.nomEvenement}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:3}}>{f.lieu}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// BONS DE TRANSPORT — réception (archive permanente, indépendante des sessions chauffeur)
// ═══════════════════════════════════════
function loadExternalScript(src, globalCheck){
  return new Promise((resolve,reject)=>{
    if(globalCheck()) return resolve();
    const existing=document.querySelector(`script[src="${src}"]`);
    if(existing){ existing.addEventListener("load",()=>resolve()); existing.addEventListener("error",reject); return; }
    const s=document.createElement("script");
    s.src=src; s.async=true;
    s.onload=()=>resolve();
    s.onerror=reject;
    document.head.appendChild(s);
  });
}

function printBon(bon){
  const lignes=[
    ["Véhicule",bon.vehicule],["Chauffeur",bon.chauffeurLabel||bon.chauffeur],["Convoyeur",bon.convoyeurLabel||""],
    ["Patient",bon.patient],["Départ",bon.depart],["Arrivée",bon.arrivee],
    ["Convention",bon.convention],["Type",bon.type],
    ["Base",bon.base],["Heure PEC",bon.heurePC],["Départ 1",bon.heureDep1],["Arrivée 1",bon.heureArr1],
    ["Temps d'attente",bon.tempsAttente],["Départ 2",bon.heureDep2],["Arrivée 2",bon.heureArr2],
    ["Km départ",bon.kmDepart],["Observations",bon.observations],["Remarques",bon.remarques],
  ].filter(([,v])=>v);
  const html=`<html><head><title>Bon de transport</title><style>
    body{font-family:Arial,sans-serif;padding:30px;color:#111}
    h1{font-size:18px;border-bottom:2px solid #111;padding-bottom:8px}
    table{width:100%;border-collapse:collapse;margin-top:14px}
    td{padding:6px 8px;border-bottom:1px solid #ddd;font-size:13px}
    td:first-child{font-weight:700;width:180px}
  </style></head><body>
    <h1>Bon de transport — ${new Date(bon.date).toLocaleDateString("fr-FR")}</h1>
    <table>${lignes.map(([l,v])=>`<tr><td>${l}</td><td>${String(v).replace(/</g,"&lt;")}</td></tr>`).join("")}</table>
  </body></html>`;

  let iframe=document.getElementById("aps-print-frame");
  if(iframe) iframe.remove();
  iframe=document.createElement("iframe");
  iframe.id="aps-print-frame";
  iframe.style.position="fixed";
  iframe.style.right="0"; iframe.style.bottom="0";
  iframe.style.width="0"; iframe.style.height="0";
  iframe.style.border="0";
  document.body.appendChild(iframe);
  const doc=iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  iframe.onload=()=>{
    setTimeout(()=>{
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    },250);
  };
}

async function exportBonsZip(bons){
  await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", ()=>!!window.JSZip);
  await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", ()=>!!(window.jspdf&&window.jspdf.jsPDF));
  const { jsPDF }=window.jspdf;
  const zip=new window.JSZip();
  bons.forEach(bon=>{
    const d=new Date(bon.date);
    const year=String(d.getFullYear()), month=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
    const doc=new jsPDF();
    let y=15;
    doc.setFontSize(14); doc.text("Bon de transport — "+d.toLocaleDateString("fr-FR"),10,y); y+=10;
    doc.setFontSize(10);
    const lignes=[
      ["Véhicule",bon.vehicule],["Chauffeur",bon.chauffeurLabel||bon.chauffeur],["Convoyeur",bon.convoyeurLabel||""],
      ["Patient",bon.patient],["Départ",bon.depart],["Arrivée",bon.arrivee],
      ["Convention",bon.convention],["Type",bon.type],
      ["Base",bon.base],["Heure PEC",bon.heurePC],["Départ 1",bon.heureDep1],["Arrivée 1",bon.heureArr1],
      ["Temps d'attente",bon.tempsAttente],["Départ 2",bon.heureDep2],["Arrivée 2",bon.heureArr2],
      ["Km départ",bon.kmDepart],["Observations",bon.observations],["Remarques",bon.remarques],
    ].filter(([,v])=>v);
    lignes.forEach(([l,v])=>{ doc.text(`${l}: ${String(v)}`,10,y); y+=7; if(y>280){doc.addPage();y=15;} });
    const pdfBlob=doc.output("blob");
    const safeName=(bon.patient||bon.id).toString().replace(/[^a-z0-9]/gi,"_");
    zip.folder(year).folder(month).folder(day).file(`bon_${safeName}_${bon.id}.pdf`, pdfBlob);
  });
  const content=await zip.generateAsync({type:"blob"});
  const url=URL.createObjectURL(content);
  const a=document.createElement("a");
  a.href=url; a.download="bons_de_transport.zip";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function BonsListView({ traite, bases, onBack, themeMode, toggleTheme }){
  const [bons,setBons]=useState([]);
  const [openBon,setOpenBon]=useState(null);
  const [exporting,setExporting]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(collection(dbChecklists,"dispatchai_bons_archive"), snap=>{
      const data=snap.docs.map(d=>d.data()).filter(b=>!!b.traite===traite);
      data.sort((a,b)=>new Date(b.date)-new Date(a.date));
      setBons(data);
    });
    return ()=>unsub();
  },[traite]);

  const marquerTraite=(bon,e)=>{
    if(e) e.stopPropagation();
    saveBonArchive({...bon, traite:!traite});
  };

  if(openBon){
    const vehicleGuess={ name:openBon.vehicule, type:/TPMR|VSL/i.test(openBon.vehicule||"")?"TPMR":"AMB" };
    return <BonView bon={openBon} onSave={(b)=>{saveBonArchive(b);setOpenBon(null);}} onBack={()=>setOpenBon(null)} vehicle={vehicleGuess} driver={openBon.chauffeurLabel} bases={bases}/>;
  }

  const groups={};
  bons.forEach(b=>{ const c=b.convention||"Non précisé"; if(!groups[c]) groups[c]=[]; groups[c].push(b); });

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>←</button>
          <div style={{fontWeight:800,fontSize:16,color:C.success}}>{traite?"📅 Historique":"🧾 Bons à traiter"}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {traite&&bons.length>0&&(
            <button disabled={exporting} onClick={async()=>{setExporting(true); try{await exportBonsZip(bons);}catch(e){console.error("Erreur export ZIP:",e);} setExporting(false);}} style={{background:C.successSoft,border:`1px solid ${C.success}`,borderRadius:8,color:C.success,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{exporting?"Génération…":"📦 Exporter ZIP"}</button>
          )}
          <button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
        </div>
      </div>
      <div style={{flex:1,padding:16,paddingBottom:40,maxWidth:700,margin:"0 auto",width:"100%"}}>
        {bons.length===0&&<div style={{textAlign:"center",color:C.muted,padding:40}}>{traite?"Aucun bon traité":"Aucun bon en attente"}</div>}
        {Object.entries(groups).map(([conv,items])=>(
          <div key={conv} style={{marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:700,color:C.success,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>{conv} ({items.length})</div>
            {items.map(b=>(
              <div key={b.id} onClick={()=>setOpenBon(b)} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 15px",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:C.text}}>{b.patient||"Bon vierge"}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{b.vehicule} — {new Date(b.date).toLocaleDateString("fr-FR")} — {b.chauffeurLabel||b.chauffeur}</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={(e)=>{e.stopPropagation();printBon(b);}} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"7px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🖨️</button>
                  <button onClick={(e)=>marquerTraite(b,e)} style={{background:traite?C.panel2:C.successSoft,border:`1px solid ${traite?C.border:C.success}`,borderRadius:8,color:traite?C.muted:C.success,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{traite?"↩️ Retraiter":"✅ Traité"}</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BonsMenuView({ bases, onBack, themeMode, toggleTheme }){
  const [screen,setScreen]=useState("home"); // home | traiter | historique

  if(screen==="traiter") return <BonsListView traite={false} bases={bases} onBack={()=>setScreen("home")} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(screen==="historique") return <BonsListView traite={true} bases={bases} onBack={()=>setScreen("home")} themeMode={themeMode} toggleTheme={toggleTheme}/>;

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>←</button>
          <div style={{fontWeight:800,fontSize:16,color:C.success}}>🧾 Bons de transport</div>
        </div>
        <button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{flex:1,padding:20,maxWidth:480,margin:"0 auto",width:"100%",display:"flex",flexDirection:"column",gap:12}}>
        <button onClick={()=>setScreen("traiter")} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:20,color:C.text,display:"flex",alignItems:"center",gap:14,cursor:"pointer",textAlign:"left"}}>
          <div style={{fontSize:28}}>🧾</div>
          <div><div style={{fontWeight:800,fontSize:15}}>Bons à traiter</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Envoyés par les chauffeurs, pas encore traités</div></div>
        </button>
        <button onClick={()=>setScreen("historique")} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:20,color:C.text,display:"flex",alignItems:"center",gap:14,cursor:"pointer",textAlign:"left"}}>
          <div style={{fontSize:28}}>📅</div>
          <div><div style={{fontWeight:800,fontSize:15}}>Historique</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Bons déjà traités</div></div>
        </button>
      </div>
    </div>
  );
}

function GarageView({ onBack, themeMode, toggleTheme }){
  const [defects,setDefects]=useState([]);
  const [tvMode,setTvMode]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(collection(dbChecklists,"dispatchai_daily_defects"), snap=>{
      const data=snap.docs.map(d=>({id:d.id,...d.data()}));
      data.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      setDefects(data);
    });
    return ()=>unsub();
  },[]);

  const resolve=(id)=>resolveDailyDefect(id);
  const formatDate=(ts)=>{ if(!ts) return ""; return new Date(ts).toLocaleDateString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); };

  const grouped={};
  defects.forEach(d=>{ if(!grouped[d.vehicle]) grouped[d.vehicle]=[]; grouped[d.vehicle].push(d); });
  const openCount=defects.length;
  const vehiculesTouches=Object.keys(grouped).length;

  if(tvMode){
    const cols=vehiculesTouches<=1?1:vehiculesTouches<=4?2:vehiculesTouches<=9?3:4;
    const rows=Math.ceil(vehiculesTouches/cols);
    const compact=vehiculesTouches>6;
    return(
      <div style={{position:"fixed",inset:0,background:C.bg,display:"flex",flexDirection:"column",zIndex:999,padding:12,boxSizing:"border-box"}}>
        <style>{GS}</style>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{fontSize:22,fontWeight:900,color:C.danger}}>🔧 GARAGE</div>
            <div style={{background:C.dangerSoft,border:`1px solid ${C.danger}66`,borderRadius:10,padding:"3px 10px"}}><span style={{fontSize:16,fontWeight:900,color:C.danger}}>{openCount}</span><span style={{fontSize:11,color:C.muted,marginLeft:6}}>défauts</span></div>
            <div style={{background:C.warningSoft,border:`1px solid ${C.warning}66`,borderRadius:10,padding:"3px 10px"}}><span style={{fontSize:16,fontWeight:900,color:C.warning}}>{vehiculesTouches}</span><span style={{fontSize:11,color:C.muted,marginLeft:6}}>véhicules</span></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:11,color:C.muted}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div>
            <button onClick={()=>setTvMode(false)} style={{padding:"5px 10px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:11,cursor:"pointer"}}>Quitter TV</button>
          </div>
        </div>
        {defects.length===0?(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:80,marginBottom:20}}>✅</div>
            <div style={{fontSize:28,fontWeight:700,color:C.success}}>Aucun défaut en cours</div>
          </div>
        ):(
          <div style={{flex:1,display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gridTemplateRows:`repeat(${rows},1fr)`,gap:10,overflow:"hidden"}}>
            {Object.entries(grouped).map(([vehicle,items])=>(
              <DailyCarteVehicule key={vehicle} vehicle={vehicle} items={items} resolve={resolve} compact={compact} themeC={C}/>
            ))}
          </div>
        )}
      </div>
    );
  }

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>←</button>
          <div style={{fontWeight:800,fontSize:16,color:C.danger}}>🔧 Garage</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setTvMode(true)} style={{padding:"7px 14px",background:C.dangerSoft,border:`1px solid ${C.danger}66`,borderRadius:9,color:C.danger,fontSize:12,fontWeight:700,cursor:"pointer"}}>📺 Mode TV</button>
          <button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
        </div>
      </div>
      <div style={{flex:1,padding:"16px",paddingBottom:60,maxWidth:640,margin:"0 auto",width:"100%"}}>
        <div style={{display:"flex",gap:10,marginBottom:20}}>
          <div style={{flex:1,background:C.dangerSoft,border:`1px solid ${C.danger}66`,borderRadius:12,padding:"12px 16px"}}>
            <div style={{fontSize:32,fontWeight:900,color:C.danger}}>{openCount}</div>
            <div style={{fontSize:12,color:C.muted}}>Défauts actifs</div>
          </div>
          <div style={{flex:1,background:C.warningSoft,border:`1px solid ${C.warning}66`,borderRadius:12,padding:"12px 16px"}}>
            <div style={{fontSize:32,fontWeight:900,color:C.warning}}>{vehiculesTouches}</div>
            <div style={{fontSize:12,color:C.muted}}>Véhicules touchés</div>
          </div>
        </div>
        {defects.length===0&&(
          <div style={{textAlign:"center",padding:48,color:C.muted}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <p>Aucun défaut en cours</p>
          </div>
        )}
        {Object.entries(grouped).map(([vehicle,items])=>(
          <div key={vehicle} style={{background:C.panel,border:`1px solid ${C.danger}66`,borderRadius:16,padding:16,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{background:C.bg,borderRadius:8,padding:"4px 12px",fontWeight:800,fontSize:16,color:C.text}}>{vehicle}</span>
              <span style={{padding:"4px 10px",borderRadius:8,fontSize:12,fontWeight:700,background:C.dangerSoft,color:C.danger}}>{items.length} défaut{items.length>1?"s":""}</span>
            </div>
            {items.map((d,idx)=>(
              <div key={d.id} style={{borderTop:idx>0?`1px solid ${C.border}`:"none",paddingTop:idx>0?10:0,marginTop:idx>0?10:0}}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:4,wordBreak:"break-word",color:C.text}}>{d.description}</div>
                <div style={{fontSize:12,color:C.muted,display:"flex",gap:12,flexWrap:"wrap",marginBottom:8}}>
                  <span>👤 {d.reportedBy}</span><span>📅 {formatDate(d.createdAt)}</span>
                  {d.source==="checklist"&&<span style={{color:C.warning}}>⚡ Via checklist</span>}
                </div>
                <button onClick={()=>resolve(d.id)} style={{width:"100%",padding:10,background:C.success,border:"none",borderRadius:10,color:"white",fontSize:14,fontWeight:700,cursor:"pointer"}}>Problème résolu</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// CARNET DE BORD — modal accessible pendant le service (Chauffeur)
// Fonctionnement en 2 temps : Départ (heure/km/lieu) puis Arrivée (lieu/km/litres)
// ═══════════════════════════════════════
function capitalizeCity(s){
  if(!s) return s;
  return s.charAt(0).toUpperCase()+s.slice(1).toLowerCase();
}
function capitalizeWords(s){
  if(!s) return s;
  return s.split(" ").map(w=>w.length?w.charAt(0).toUpperCase()+w.slice(1).toLowerCase():w).join(" ");
}
function NumKeyboardField({ value, onConfirm, allowDecimal, placeholder, danger }){
  return(
    <input type="text" inputMode={allowDecimal?"decimal":"numeric"} value={value||""}
      onChange={e=>{
        let v=e.target.value.replace(allowDecimal?/[^0-9,]/g:/[^0-9]/g,"");
        onConfirm(v);
      }}
      placeholder={placeholder} style={{width:"100%",background:C.bg,border:`1px solid ${danger&&!value?C.danger:C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:14,boxSizing:"border-box"}}/>
  );
}

function CarnetBordModal({ vehicle, driver, myCourses, carnetBordTypes, onClose, forcedMission, onForcedSaved }){
  const [entries,setEntries]=useState([]);
  const [mode,setMode]=useState(forcedMission?"fin_service":"list"); // list | depart | arrivee | fin_service | plein
  const [arrivingEntry,setArrivingEntry]=useState(null);
  const [selectedCourseId,setSelectedCourseId]=useState("");
  const nowHeure=()=>new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});

  const [departForm,setDepartForm]=useState({heureDepart:nowHeure(),kmDepart:"",lieuDepart:"",natureMission:""});
  const [arriveeForm,setArriveeForm]=useState({destination:"",kmFin:""});
  const [finForm,setFinForm]=useState({kmFin:"",destination:""});
  const [pleinLitres,setPleinLitres]=useState("");
  const [saving,setSaving]=useState(false);

  const types=(carnetBordTypes&&carnetBordTypes.length)?carnetBordTypes:INIT_CARNET_TYPES;

  useEffect(()=>{
    const unsub=onSnapshot(collection(dbChecklists,"dispatchai_carnet_bord"), snap=>{
      const today=todayISO();
      const data=snap.docs.map(d=>d.data()).filter(e=>e.vehicle===vehicle.name && e.date===today);
      data.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      setEntries(data);
    });
    return ()=>unsub();
  },[vehicle.name]);

  const startDepart=()=>{
    setSelectedCourseId("");
    setDepartForm({heureDepart:nowHeure(),kmDepart:"",lieuDepart:"",natureMission:""});
    setMode("depart");
  };
  const startDepartFromCourse=(course)=>{
    setSelectedCourseId(course.id);
    setDepartForm({heureDepart:course.heure||nowHeure(),kmDepart:"",lieuDepart:capitalizeCity(course.adresseDepart||""),natureMission:course.typeTransport||""});
    setMode("depart");
  };
  const startArrivee=(entry)=>{
    setArrivingEntry(entry);
    const linkedCourse=entry.courseId?(myCourses||[]).find(c=>c.id===entry.courseId):null;
    setArriveeForm({destination:linkedCourse?capitalizeCity(linkedCourse.adresseArrivee||""):"",kmFin:"",litres:""});
    setMode("arrivee");
  };

  const canSaveDepart=departForm.heureDepart&&departForm.kmDepart&&departForm.lieuDepart.trim()&&departForm.natureMission;
  const saveDepart=async()=>{
    if(!canSaveDepart) return;
    setSaving(true);
    await saveCarnetBordEntry({
      vehicle:vehicle.name, date:todayISO(), dateISO:new Date().toISOString(),
      status:"open",
      heureDepart:departForm.heureDepart, kmDepart:departForm.kmDepart, lieuDepart:departForm.lieuDepart.trim(),
      natureMission:departForm.natureMission, chauffeur:driver, courseId:selectedCourseId||null,
    });
    setSaving(false);
    setMode("list");
  };

  const canSaveArrivee=arriveeForm.destination.trim()&&arriveeForm.kmFin;
  const saveArrivee=async()=>{
    if(!canSaveArrivee||!arrivingEntry) return;
    setSaving(true);
    await saveCarnetBordEntry({
      ...arrivingEntry,
      status:"closed",
      destination:arriveeForm.destination.trim(), kmFin:arriveeForm.kmFin,
    });
    setSaving(false);
    setArrivingEntry(null);
    setMode("list");
  };

  // Plein d'essence : s'inscrit sur la ligne "en cours" s'il y en a une,
  // sinon sur la dernière ligne enregistrée aujourd'hui (aucun calcul, juste
  // la valeur qui remplace l'existante). On relit Firestore au moment de
  // sauvegarder pour être sûr d'avoir la toute dernière version de la ligne.
  const canSavePlein=!!pleinLitres;
  const savePlein=async()=>{
    if(!canSavePlein) return;
    setSaving(true);
    try{
      const snap=await getDocs(query(collection(dbChecklists,"dispatchai_carnet_bord"), where("vehicle","==",vehicle.name), where("date","==",todayISO())));
      const all=snap.docs.map(d=>d.data());
      all.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      const target=all.find(e=>e.status==="open")||all[0];
      if(target){
        await saveCarnetBordEntry({ ...target, litres:pleinLitres });
      }
    }catch(e){ console.error("Erreur enregistrement plein:", e); }
    setSaving(false);
    setPleinLitres("");
    setMode("list");
  };

  const canSaveFin=!!finForm.kmFin && (forcedMission!=="retour_domicile" || finForm.destination.trim());
  const saveFin=async()=>{
    if(!canSaveFin) return;
    setSaving(true);
    const finDestination=forcedMission==="retour_domicile"?(finForm.destination.trim()||"Domicile du chauffeur"):"Base";
    try{
      const snap=await getDocs(query(collection(dbChecklists,"dispatchai_carnet_bord"), where("vehicle","==",vehicle.name), where("date","==",todayISO()), where("status","==","open")));
      const openEntry=snap.docs.map(d=>d.data())[0];
      if(openEntry){
        await saveCarnetBordEntry({
          ...openEntry,
          status:"closed",
          destination:finDestination,
          kmFin:finForm.kmFin,
          heureRetour:nowHeure(),
        });
      }else{
        await saveCarnetBordEntry({
          vehicle:vehicle.name, date:todayISO(), dateISO:new Date().toISOString(),
          status:"closed",
          heureDepart:nowHeure(), kmDepart:null, lieuDepart:null,
          destination:finDestination,
          natureMission:forcedMission, chauffeur:driver, kmFin:finForm.kmFin, litres:null,
          heureRetour:nowHeure(),
        });
      }
    }catch(e){ console.error("Erreur clôture fin de service:", e); }
    setSaving(false);
    if(onForcedSaved) onForcedSaved();
  };

  const natureLabel=(id)=>types.find(t=>t.id===id)?.label||id;
  const natureIcon=(id)=>types.find(t=>t.id===id)?.icon||"📍";
  const openEntries=entries.filter(e=>e.status==="open");
  const closedEntries=entries.filter(e=>e.status==="closed");

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:240}}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:460,maxWidth:"92vw",maxHeight:"90vh",overflowY:"auto",animation:"pop 0.2s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:16}}>📓 Carnet de bord{forcedMission&&" — Fin de service"}</div>
          {!forcedMission&&mode==="list"&&<button onClick={onClose} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>}
        </div>

        {mode==="fin_service"&&(
          <>
            <div style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:9,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.text}}>
              {forcedMission==="retour_domicile"?"🚗 Retour domicile du chauffeur":"🏠 Retour base"} — heure {nowHeure()}. Le km de fin est requis pour clôturer.
            </div>
            {forcedMission==="retour_domicile"&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Lieu (ville du domicile)</div>
                <input value={finForm.destination} onChange={e=>setFinForm(f=>({...f,destination:capitalizeCity(e.target.value)}))} style={{width:"100%",background:C.bg,border:`1px solid ${finForm.destination.trim()?C.border:C.danger}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:13,boxSizing:"border-box"}}/>
              </div>
            )}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Km de fin (obligatoire)</div>
              <NumKeyboardField value={finForm.kmFin} onConfirm={v=>setFinForm(f=>({...f,kmFin:v}))} danger/>
            </div>
            <button disabled={!canSaveFin||saving} onClick={saveFin} style={{width:"100%",background:canSaveFin?C.success:C.panel2,border:"none",borderRadius:9,color:canSaveFin?"white":C.muted,padding:"13px",fontWeight:800,fontSize:14,cursor:canSaveFin?"pointer":"not-allowed"}}>{saving?"Enregistrement…":"✅ Clôturer le service"}</button>
          </>
        )}

        {mode==="list"&&(
          <>
            {openEntries.length>0&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,marginBottom:8,textTransform:"uppercase"}}>⏳ En cours — à clôturer</div>
                {openEntries.map(e=>(
                  <button key={e.id} onClick={()=>startArrivee(e)} style={{width:"100%",background:"#f59e0b18",border:"1.5px solid #f59e0b",borderRadius:11,padding:"13px",marginBottom:8,cursor:"pointer",textAlign:"left"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontWeight:700,fontSize:13,color:C.text}}>{natureIcon(e.natureMission)} {e.heureDepart} — {e.lieuDepart}</span>
                      <span style={{background:C.success,borderRadius:7,color:"white",padding:"6px 14px",fontSize:12,fontWeight:800}}>🏁 Arrivée</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={startDepart} style={{width:"100%",marginBottom:10,background:openEntries.length>0?"transparent":C.successSoft,border:openEntries.length>0?`1px dashed ${C.border}`:`1.5px dashed ${C.success}`,borderRadius:11,padding:openEntries.length>0?"10px":"13px",color:openEntries.length>0?C.muted:C.success,fontWeight:700,fontSize:openEntries.length>0?12:13,cursor:"pointer"}}>🚗 {openEntries.length>0?"Nouveau départ":"Départ"}</button>
            {entries.length>0&&<button onClick={()=>{setPleinLitres("");setMode("plein");}} style={{width:"100%",marginBottom:14,background:C.blueSoft,border:`1px dashed ${C.blue}`,borderRadius:10,padding:"10px",color:C.blue,fontWeight:700,fontSize:12,cursor:"pointer"}}>⛽ Faire le plein</button>}
            {myCourses&&myCourses.length>0&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:6,textTransform:"uppercase"}}>Ou partir depuis une course</div>
                <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:100,overflowY:"auto"}}>
                  {myCourses.map(c=>(
                    <button key={c.id} onClick={()=>startDepartFromCourse(c)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontSize:11,textAlign:"left",cursor:"pointer"}}>{c.heure} — {c.patient||c.nom}</button>
                  ))}
                </div>
              </div>
            )}
            {closedEntries.length>0&&(
              <div>
                <div style={{fontSize:10,color:C.muted,fontWeight:700,marginBottom:6,textTransform:"uppercase"}}>Terminées aujourd'hui</div>
                {closedEntries.map(e=>(
                  <div key={e.id} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",marginBottom:7}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontWeight:700,fontSize:12,color:C.text}}>{natureIcon(e.natureMission)} {natureLabel(e.natureMission)}</span>
                      {e.kmDepart&&e.kmFin&&<span style={{fontSize:11,color:C.muted}}>{e.kmDepart}→{e.kmFin} km</span>}
                    </div>
                    {(e.lieuDepart||e.destination)&&<div style={{fontSize:11,color:C.muted,marginTop:3}}>{e.lieuDepart||"—"} → {e.destination||"—"}</div>}
                  </div>
                ))}
              </div>
            )}
            {entries.length===0&&<div style={{textAlign:"center",color:C.muted,fontSize:12,padding:"14px 0"}}>Aucune ligne aujourd'hui pour ce véhicule</div>}
          </>
        )}

        {mode==="depart"&&(
          <>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Heure de départ</div>
              <HeureInput value={departForm.heureDepart} onChange={v=>setDepartForm(f=>({...f,heureDepart:v}))}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Km de départ</div>
              <NumKeyboardField value={departForm.kmDepart} onConfirm={v=>setDepartForm(f=>({...f,kmDepart:v}))}/>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Lieu de départ</div>
              <input value={departForm.lieuDepart} onChange={e=>setDepartForm(f=>({...f,lieuDepart:capitalizeCity(e.target.value)}))} placeholder="Adresse ou ville de départ" style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:13,boxSizing:"border-box"}}/>
            </div>
            <div style={{fontSize:10,color:C.muted,marginBottom:6,textTransform:"uppercase"}}>Nature de la mission</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16}}>
              {types.map(t=>(
                <button key={t.id} onClick={()=>setDepartForm(f=>({...f,natureMission:t.id}))} style={{padding:"8px 6px",borderRadius:8,textAlign:"center",cursor:"pointer",fontSize:11,fontWeight:700,background:departForm.natureMission===t.id?C.dangerSoft:C.bg,border:`1px solid ${departForm.natureMission===t.id?C.danger:C.border}`,color:departForm.natureMission===t.id?C.danger:C.muted}}>{t.icon} {t.label}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setMode("list")} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"11px",fontSize:13,cursor:"pointer"}}>Annuler</button>
              <button disabled={!canSaveDepart||saving} onClick={saveDepart} style={{flex:2,background:canSaveDepart?C.success:C.panel2,border:"none",borderRadius:9,color:canSaveDepart?"white":C.muted,padding:"11px",fontWeight:700,fontSize:13,cursor:canSaveDepart?"pointer":"not-allowed"}}>{saving?"…":"✅ Départ enregistré"}</button>
            </div>
          </>
        )}

        {mode==="arrivee"&&arrivingEntry&&(
          <>
            <div style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",marginBottom:14,fontSize:12,color:C.muted}}>
              Départ {arrivingEntry.heureDepart} — {arrivingEntry.lieuDepart} ({arrivingEntry.kmDepart} km)
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Lieu d'arrivée</div>
              <input value={arriveeForm.destination} onChange={e=>setArriveeForm(f=>({...f,destination:capitalizeCity(e.target.value)}))} placeholder="Adresse ou ville d'arrivée" style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontSize:13,boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Km d'arrivée</div>
              <NumKeyboardField value={arriveeForm.kmFin} onConfirm={v=>setArriveeForm(f=>({...f,kmFin:v}))}/>
            </div>
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button onClick={()=>{setMode("list");setArrivingEntry(null);}} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"11px",fontSize:13,cursor:"pointer"}}>Annuler</button>
              <button disabled={!canSaveArrivee||saving} onClick={saveArrivee} style={{flex:2,background:canSaveArrivee?C.success:C.panel2,border:"none",borderRadius:9,color:canSaveArrivee?"white":C.muted,padding:"11px",fontWeight:700,fontSize:13,cursor:canSaveArrivee?"pointer":"not-allowed"}}>{saving?"…":"✅ Clôturer la ligne"}</button>
            </div>
          </>
        )}

        {mode==="plein"&&(
          <>
            <div style={{background:C.blueSoft,border:`1px solid ${C.blue}`,borderRadius:9,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.text}}>
              ⛽ Le litrage s'inscrit sur {openEntries.length>0?"la ligne en cours":"la dernière ligne enregistrée aujourd'hui"}.
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>Litres</div>
              <NumKeyboardField value={pleinLitres} onConfirm={setPleinLitres} allowDecimal/>
              {pleinLitres&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>{pleinLitres} Litres</div>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setMode("list")} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"11px",fontSize:13,cursor:"pointer"}}>Annuler</button>
              <button disabled={!canSavePlein||saving} onClick={savePlein} style={{flex:2,background:canSavePlein?C.success:C.panel2,border:"none",borderRadius:9,color:canSavePlein?"white":C.muted,padding:"11px",fontWeight:700,fontSize:13,cursor:canSavePlein?"pointer":"not-allowed"}}>{saving?"…":"✅ Enregistrer"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DailyChecklistView({ vehicle, driverName, onComplete, themeMode, toggleTheme }){
  const vType = vehicle?.type || "AMB";
  const template = DAILY_TEMPLATES_BASE[vType] || DAILY_CHECKLIST_ALPHA;
  const [values, setValues] = useState({ nom1: driverName||"" });
  const [sending, setSending] = useState(false);
  const [yesterdayEntry, setYesterdayEntry] = useState(undefined); // undefined=chargement, null=aucune, sinon l'entrée

  useEffect(()=>{
    let cancelled=false;
    findYesterdayDailyChecklist(vehicle.name).then(y=>{ if(!cancelled) setYesterdayEntry(y||null); });
    return ()=>{ cancelled=true; };
  },[vehicle.name]);

  const sameDriverAsYesterday = !!(yesterdayEntry && yesterdayEntry.values && driverName && yesterdayEntry.values.nom1 && yesterdayEntry.values.nom1.trim().toLowerCase()===driverName.trim().toLowerCase());

  const set = (id,val) => setValues(v=>({ ...v, [id]:val }));

  const missingRequired = () => {
    const missing=[];
    template.forEach(s=>s.items.forEach(item=>{
      if(item.required && !values[item.id] && item.type!=="textarea") missing.push(item.id);
    }));
    return missing;
  };

  const scrollToMissing = () => {
    const missing = missingRequired();
    if(missing.length===0) return;
    const el = document.getElementById("dfield_"+missing[0]);
    if(el){ el.scrollIntoView({behavior:"smooth",block:"center"}); el.style.outline=`3px solid ${C.danger}`; setTimeout(()=>{el.style.outline="";},3000); }
  };

  const handleChauffeurIdentique = () => {
    if(!sameDriverAsYesterday||!yesterdayEntry||!yesterdayEntry.values) return;
    setValues({ ...yesterdayEntry.values, nom1:driverName||yesterdayEntry.values.nom1||"" });
  };

  const handleSkip = async () => {
    setSending(true);
    await submitDailyChecklist({ vehicle:vehicle.name, vType, values:{nom1:driverName||""}, template, skipped:true });
    setSending(false);
    onComplete();
  };

  const handleSubmit = async () => {
    const missing = missingRequired();
    if(missing.length>0){ scrollToMissing(); return; }
    setSending(true);
    await submitDailyChecklist({ vehicle:vehicle.name, vType, values, template, skipped:false });
    setSending(false);
    onComplete();
  };

  const renderItem = (item) => {
    const val = values[item.id] || "";
    const req = item.required ? <span style={{color:C.danger}}> *</span> : null;
    let control = null;
    const inStyle={width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px",color:C.text,fontSize:13,fontFamily:"inherit"};

    if(item.type==="fuel"){
      const opts=[["full","Plein",C.success],["75","3/4",C.success],["50","1/2",C.warning],["25","1/4",C.danger],["0","0",C.danger]];
      control=(
        <div style={{display:"flex",gap:6}}>
          {opts.map(([v,label,col])=>(
            <div key={v} onClick={()=>set(item.id,v)} style={{flex:1,padding:"9px 4px",borderRadius:9,textAlign:"center",cursor:"pointer",fontSize:12,fontWeight:700,background:val===v?col+"22":C.bg,border:`1px solid ${val===v?col:C.border}`,color:val===v?col:C.muted}}>{label}</div>
          ))}
        </div>
      );
    }else if(["ok_nok","ok_insuf","pneus","propre_sale","vide_pleine","ok_nok_np"].includes(item.type)){
      const optMap={
        ok_nok:[["ok","OK",C.success],["nok","NOK",C.danger]],
        ok_insuf:[["ok","OK",C.success],["insuf","Insuffisant",C.warning]],
        pneus:[["bon","Bon état",C.success],["usure","Usure",C.warning],["remplacer","Remplacer",C.danger]],
        propre_sale:[["propre","Propre",C.success],["sale","Sale",C.danger]],
        vide_pleine:[["vide","Vide",C.success],["pleine","Pleine",C.danger]],
        ok_nok_np:[["ok","OK",C.success],["nok","Défectueux",C.danger],["np","Absent",C.purple]],
      };
      control=(
        <div style={{display:"flex",gap:8}}>
          {optMap[item.type].map(([v,label,col])=>(
            <div key={v} onClick={()=>set(item.id,v)} style={{flex:1,padding:10,borderRadius:9,textAlign:"center",cursor:"pointer",fontSize:13,fontWeight:700,background:val===v?col+"22":C.bg,border:`1px solid ${val===v?col:C.border}`,color:val===v?col:C.muted}}>{label}</div>
          ))}
        </div>
      );
    }else if(item.type==="o2"){
      const num=parseInt(val)||0;
      const col=num/300>0.5?C.success:num/300>0.2?C.warning:C.danger;
      control=(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:12,color:C.muted}}>{item.label}</span>
            <span style={{fontSize:14,fontWeight:700,color:col}}>{num} bar</span>
          </div>
          <input type="range" min="0" max="300" step="10" value={num} onChange={e=>set(item.id,e.target.value)} style={{width:"100%",cursor:"pointer"}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginTop:4}}>
            <span style={{color:C.danger}}>0</span><span style={{color:C.muted}}>100</span><span style={{color:C.muted}}>200</span><span style={{color:C.success}}>300 bar</span>
          </div>
        </div>
      );
    }else if(item.type==="date"){
      control=<input type="date" value={val} onChange={e=>set(item.id,e.target.value)} style={inStyle}/>;
    }else if(item.type==="number"){
      control=<input type="number" placeholder="Ex: 125430" value={val} onChange={e=>set(item.id,e.target.value)} style={inStyle}/>;
    }else if(item.type==="textarea"){
      control=<textarea placeholder="Aucune remarque..." value={val} onChange={e=>set(item.id,e.target.value)} style={{...inStyle,minHeight:80,resize:"vertical"}}/>;
    }else if(item.type==="text"){
      control=<input type="text" placeholder="Prénom Nom" value={val} onChange={e=>set(item.id,e.target.value)} style={inStyle}/>;
    }

    const hasIssue = val==="nok"||val==="remplacer"||val==="insuf";
    return(
      <div id={"dfield_"+item.id} key={item.id} style={{background:C.panel,border:`1px solid ${hasIssue?C.danger:C.border}`,borderRadius:12,padding:14,marginBottom:8}}>
        <div style={{fontSize:14,fontWeight:500,marginBottom:10,color:C.text}}>{item.label}{req}</div>
        {control}
      </div>
    );
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,background:C.accent,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📋</div>
          <div><div style={{fontWeight:800,fontSize:15}}>{vehicle?.name}</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"1px"}}>Checklist journalière</div></div>
        </div>
        <button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>

      <div style={{padding:"14px 16px 0",display:"flex",gap:8}}>
        <button onClick={handleChauffeurIdentique} disabled={!sameDriverAsYesterday} style={{flex:1,background:sameDriverAsYesterday?C.blueSoft:C.panel2,border:`1px solid ${sameDriverAsYesterday?C.blue:C.border}`,borderRadius:10,color:sameDriverAsYesterday?C.blue:C.muted,padding:"10px",fontSize:12,fontWeight:700,cursor:sameDriverAsYesterday?"pointer":"not-allowed",opacity:sameDriverAsYesterday?1:0.6}}>{yesterdayEntry===undefined?"Vérification…":"👤 Chauffeur identique"}</button>
        <button onClick={handleSkip} disabled={sending} style={{flex:1,background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:10,color:C.danger,padding:"10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>⚠️ Passer (urgence)</button>
      </div>

      <div style={{flex:1,padding:"16px",paddingBottom:120,maxWidth:640,margin:"0 auto",width:"100%"}}>
        <div style={{fontSize:12,color:C.muted,marginBottom:14}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div>
        {template.map(section=>(
          <div key={section.section} style={{marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:700,letterSpacing:"1.5px",color:C.muted,textTransform:"uppercase",marginBottom:10}}>{section.section}</div>
            {section.items.map(item=>renderItem(item))}
          </div>
        ))}
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.panel,borderTop:`1px solid ${C.border}`,padding:"13px 16px"}}>
        <button onClick={handleSubmit} disabled={sending} style={{width:"100%",background:C.accent,border:"none",borderRadius:10,color:"white",padding:14,fontWeight:800,fontSize:15,cursor:"pointer"}}>
          {sending?"Envoi…":"✅ Soumettre la checklist"}
        </button>
      </div>
    </div>
  );
}

function ChauffeurView({driversAmb,driversTpmr,stagiairesAmb,formationTpmr,vehicles,setVehicles,contacts,plans,driver,setDriver,vehicle,setVehicle,screen,setScreen,course,setCourse,statuts,setStatut,myCourses,myActives,myTermines,bons,saveBon,bases,carnetBordTypes,onBack,onEndService,themeMode,toggleTheme}){
  const [showBons,setShowBons]=useState(false);
  const [showContacts,setShowContacts]=useState(false);
  const [showPlans,setShowPlans]=useState(false);
  const [showSignaler,setShowSignaler]=useState(false);
  const [showChangeConvoyeur,setShowChangeConvoyeur]=useState(false);
  const [showEndChoice,setShowEndChoice]=useState(false);
  const [todaySkipped,setTodaySkipped]=useState(false);

  useEffect(()=>{
    if(screen!=="planning"||!vehicle) return;
    let cancelled=false;
    findLatestDailyChecklist(vehicle.name).then(latest=>{
      if(cancelled) return;
      setTodaySkipped(!!(latest && latest.date===todayISO() && latest.skipped));
    });
    return ()=>{ cancelled=true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[screen, vehicle?.name]);
  const [showCarnetBord,setShowCarnetBord]=useState(false);
  const [endCarnetMission,setEndCarnetMission]=useState(null); // "retour_base" | "retour_domicile" | null
  const [signalVehicle,setSignalVehicle]=useState("");
  const [signalDesc,setSignalDesc]=useState("");
  const [signalNom,setSignalNom]=useState("");
  const [signalSending,setSignalSending]=useState(false);
  const [signalSent,setSignalSent]=useState(false);
  const [viewingPlan,setViewingPlan]=useState(null);
  const [bigContact,setBigContact]=useState(null);
  const [showTransfer,setShowTransfer]=useState(null);
  const [confirmTransfer,setConfirmTransfer]=useState(null);
  const [transferDone,setTransferDone]=useState(null);
  const [currentBon,setCurrentBon]=useState(null);

  const [convoyeur,setConvoyeur]=useState(null);
  const [stagiaireSelec,setStagiaireSelec]=useState(null);
  const [roleSwapped,setRoleSwapped]=useState(false);


  const getStatut=id=>statuts[id]||"planifie";
  const isAmb=vehicle?.type==="AMB";

  const initBon=(c)=>({
    id:c?c.id:`vierge_${Date.now()}`,
    courseId:c?c.id:null,
    isVierge:!c,
    vehicule:vehicle?vehicle.name:"",
    chauffeur:driver||"",
    patient:c?c.patient:"",
    depart:c?c.depart:"",
    arrivee:c?c.arrivee:"",
    convention:c?(CONV_MAP[c.convention]||c.convention):"",
    type:c?(TYPE_MAP[c.type]||c.type):"",
    convoyeur:convoyeur||"",
    stagiaire:stagiaireSelec||null,
    chauffeurLabel:driver||"",
    convoyeurLabel:convoyeur||"",
    roleSwapped:roleSwapped,
    date:new Date().toISOString(),
    base:"",heurePC:"",heureDep1:"",heureArr1:"",tempsAttente:"",heureDep2:"",heureArr2:"",kmDepart:"",patientAssis:false,deplInutile:false,deplMotif:"",observations:"",consommables:"",raisonUrgence:"",evolution:"",remarques:"",signature:null,valide:false,parametres:[{heure:"PEC",fc:"",ta:"",spo2:"",glycemie:"",temp:""}],
  });

  const openBon=(c)=>{const existing=bons.find(b=>b.id===(c?c.id:null));setCurrentBon(existing||initBon(c));setScreen("bon");};
  const openVierge=()=>{setCurrentBon(initBon(null));setScreen("bon");};

  const exportMensuel=()=>{
    const now=new Date();
    const mois=now.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
    const groupes={};
    bons.forEach(b=>{
      const d=b.date?new Date(b.date):now;
      const key=d.toLocaleDateString("fr-FR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
      if(!groupes[key])groupes[key]=[];
      groupes[key].push(b);
    });
    const rows=Object.keys(groupes).map(jour=>`
      <h2>${jour}</h2>
      <table>
        <thead><tr><th>Patient</th><th>Véhicule</th><th>Chauffeur</th><th>Départ</th><th>Destination</th><th>Statut</th></tr></thead>
        <tbody>
          ${groupes[jour].map(b=>`<tr>
            <td>${b.isVierge?"Bon vierge":(b.patient||"—")}</td>
            <td>${b.vehicule||"—"}</td>
            <td>${b.chauffeurLabel||b.chauffeur||"—"}</td>
            <td>${b.depart||"—"}</td>
            <td>${b.arrivee||"—"}</td>
            <td>${b.valide?"Validé":"Brouillon"}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    `).join("");
    const html=`<!doctype html><html><head><meta charset="utf-8"/><title>Export bons — ${mois}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111;}
        h1{font-size:20px;margin-bottom:4px;}
        .sub{color:#666;font-size:12px;margin-bottom:24px;}
        h2{font-size:14px;margin-top:24px;margin-bottom:8px;text-transform:capitalize;border-bottom:1px solid #ccc;padding-bottom:4px;}
        table{width:100%;border-collapse:collapse;margin-bottom:12px;}
        th,td{border:1px solid #ddd;padding:6px 8px;font-size:11px;text-align:left;}
        th{background:#f3f3f3;}
        @media print{ body{padding:0;} }
      </style></head><body>
      <h1>Export mensuel des bons de transport</h1>
      <div class="sub">A.P.S. · ${mois} · ${bons.length} bon(s)</div>
      ${rows||"<p>Aucun bon enregistré.</p>"}
      <script>window.onload=()=>window.print();</script>
      </body></html>`;
    const w=window.open("","_blank");
    if(w){w.document.write(html);w.document.close();}
  };

  const HeaderC=({title,sub,showBack,showEnd})=>(
    <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50,flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {showBack
          ?<button onClick={()=>{if(screen==="choix_vehicule")setScreen("choix_nom");else setScreen("planning");}} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>←</button>
          :<button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:12,cursor:"pointer"}}>← Menu</button>
        }
        <div style={{width:36,height:36,background:C.accent,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🚑</div>
        <div><div style={{fontWeight:700,fontSize:14}}>{title}</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"1px"}}>{sub}</div></div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {driver&&vehicle&&<div style={{textAlign:"right"}}><div style={{fontSize:12,fontWeight:700}}>{vIcon(vehicle.type)} {vehicle.name}</div><div style={{fontSize:10,color:C.muted}}>👤 {driver}</div></div>}
        <Badge color={C.success} soft={C.successSoft} pulse>En ligne</Badge>
        <Clock/>
        <button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙 Sombre":"☀️ Clair"}</button>
        {showEnd&&<button onClick={async()=>{
          try{
            const snap=await getDocs(query(collection(dbChecklists,"dispatchai_carnet_bord"), where("vehicle","==",vehicle.name), where("date","==",todayISO()), where("status","==","open")));
            const openWithMission=snap.docs.map(d=>d.data()).find(e=>e.natureMission==="retour_base"||e.natureMission==="retour_domicile");
            if(openWithMission){ setEndCarnetMission(openWithMission.natureMission); return; }
          }catch(e){ console.error("Erreur vérification fin de service:", e); }
          setShowEndChoice(true);
        }} style={{background:C.danger,border:"none",borderRadius:7,color:"white",padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🔴 Fin de service</button>}
      </div>
    </div>
  );

  if(screen==="choix_nom") return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <HeaderC title="Prise de service" sub="A.P.S."/>
      <div style={{flex:1,padding:"24px 20px",maxWidth:640,margin:"0 auto",width:"100%"}}>
        <div style={{fontSize:26,fontWeight:800,marginBottom:4}}>Bonjour 👋</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:24}}>Choisissez votre véhicule</div>
        {["TPMR","VSL","AMB"].map(type=>{
          const group=vehicles.filter(v=>v.type===type);
          if(!group.length) return null;
          return(
            <div key={type} style={{marginBottom:22}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:18,color:vColor(type)}}>{vIcon(type)}</span>
                <span style={{fontSize:11,fontWeight:800,color:vColor(type),textTransform:"uppercase",letterSpacing:"1px"}}>{type==="AMB"?"Ambulances ALPHA":type}</span>
                <div style={{flex:1,height:1,background:C.border}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>
                {group.map(v=>(
                  <button key={v.id} onClick={()=>{if(v.active){setVehicle(v);setScreen("choix_vehicule");window.scrollTo(0,0);}}} disabled={!v.active}
                    style={{background:v.active?C.panel:C.dangerSoft,border:`1.5px solid ${v.active?C.border:C.danger}`,borderRadius:13,padding:"18px 10px",color:v.active?C.text:C.danger,textAlign:"center",cursor:v.active?"pointer":"not-allowed",display:"flex",flexDirection:"column",alignItems:"center",gap:7,opacity:v.active?1:0.7}}>
                    <span style={{fontSize:28,color:v.active?vColor(type):C.danger}}>{vIcon(type)}</span>
                    <span style={{fontWeight:700,fontSize:13}}>{v.name}</span>
                    {!v.active&&<span style={{fontSize:9,fontWeight:700,textTransform:"uppercase"}}>Hors service</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if(screen==="choix_vehicule"){
    const vType=vehicle?.type;
    const isAmbType=vType==="AMB";
    const driversList=isAmbType?[...driversAmb].sort((a,b)=>a.localeCompare(b)):[...driversTpmr].sort((a,b)=>a.localeCompare(b));
    const extraList=isAmbType?[...stagiairesAmb].sort((a,b)=>a.localeCompare(b)):[...formationTpmr].sort((a,b)=>a.localeCompare(b));
    const canContinue=driver&&(vType!=="AMB"||convoyeur);
    return(
      <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
        <style>{GS}</style>
        <HeaderC title={`${vIcon(vType)} ${vehicle?.name}`} sub="Choisissez le personnel" showBack/>
        <div style={{flex:1,padding:"20px 20px 100px",maxWidth:640,margin:"0 auto",width:"100%"}}>

          <div style={{marginBottom:24}}>
            <div style={{fontSize:11,fontWeight:800,color:C.accent,textTransform:"uppercase",letterSpacing:"1px",marginBottom:12}}>🚗 Chauffeur</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {driversList.map(d=>{const active=driver===d;return(
                <button key={d} onClick={()=>setDriver(d)}
                  style={{background:active?C.accentSoft:C.panel,border:`1.5px solid ${active?C.accent:C.border}`,borderRadius:11,padding:"12px 14px",color:active?C.accent:C.text,display:"flex",alignItems:"center",gap:10,cursor:"pointer",transition:"all 0.15s"}}>
                  <div style={{width:34,height:34,background:active?C.accent:C.panel2,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>👤</div>
                  <span style={{fontWeight:active?700:500,fontSize:13}}>{d}</span>
                </button>
              );})}
            </div>
          </div>

          {isAmbType&&(
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:800,color:C.danger,textTransform:"uppercase",letterSpacing:"1px",marginBottom:12}}>🚑 Convoyeur (obligatoire)</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {driversList.filter(d=>d!==driver).map(d=>{const active=convoyeur===d;return(
                  <button key={d} onClick={()=>setConvoyeur(d)}
                    style={{background:active?C.dangerSoft:C.panel,border:`1.5px solid ${active?C.danger:C.border}`,borderRadius:11,padding:"12px 14px",color:active?C.danger:C.text,display:"flex",alignItems:"center",gap:10,cursor:"pointer",transition:"all 0.15s"}}>
                    <div style={{width:34,height:34,background:active?C.danger:C.panel2,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🚑</div>
                    <span style={{fontWeight:active?700:500,fontSize:13}}>{d}</span>
                  </button>
                );})}
              </div>
            </div>
          )}

          {extraList.length>0&&(
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:700,color:isAmbType?C.purple:C.blue,textTransform:"uppercase",letterSpacing:"1px",marginBottom:10}}>
                {isAmbType?"🎓 Stagiaire observateur (optionnel)":"📋 Formation (optionnel)"}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <button onClick={()=>setStagiaireSelec(null)} style={{background:!stagiaireSelec?C.panel2:"transparent",border:`1.5px solid ${C.border}`,borderRadius:11,padding:"10px 14px",color:C.muted,fontSize:12,cursor:"pointer"}}>— Aucun</button>
                {extraList.map(s=>{const active=stagiaireSelec===s;const col=isAmbType?C.purple:C.blue;return(
                  <button key={s} onClick={()=>setStagiaireSelec(active?null:s)}
                    style={{background:active?`${col}22`:C.panel,border:`1.5px solid ${active?col:C.border}`,borderRadius:11,padding:"10px 14px",color:active?col:C.muted,display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                    <span>{isAmbType?"🎓":"📋"}</span>
                    <div><div style={{fontWeight:active?700:500,fontSize:12}}>{s}</div><div style={{fontSize:9,color:col}}>{isAmbType?"(stagiaire)":"(formation)"}</div></div>
                  </button>
                );})}
              </div>
            </div>
          )}
        </div>
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.panel,borderTop:`1px solid ${C.border}`,padding:"12px 20px"}}>
          {!canContinue&&vType==="AMB"&&<div style={{fontSize:11,color:C.warning,textAlign:"center",marginBottom:8}}>⚠ Sélectionnez un chauffeur ET un convoyeur</div>}
          <button onClick={()=>{
            if(!canContinue) return;
            if(setVehicles) setVehicles(p=>p.map(v=>v.id===vehicle.id?{...v,horsBase:null}:v));
            setScreen("daily_checklist");
          }} disabled={!canContinue}
            style={{width:"100%",background:canContinue?C.success:C.panel2,border:"none",borderRadius:11,color:canContinue?"white":C.muted,padding:"13px",fontWeight:800,fontSize:15,cursor:canContinue?"pointer":"not-allowed",opacity:canContinue?1:0.6}}>
            ✅ Commencer le service
          </button>
        </div>
      </div>
    );
  }

  if(screen==="daily_checklist"){
    return <DailyChecklistView vehicle={vehicle} driverName={driver} onComplete={()=>setScreen("planning")} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  }

  if(screen==="planning") return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <HeaderC title="Planning du jour" sub={`${vehicle?.name} · ${driver}`} showEnd/>
      <div style={{flex:1,padding:"16px 16px 100px",maxWidth:640,margin:"0 auto",width:"100%"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:18}}>
          {[{val:myCourses.length,label:"Total",color:C.accent},{val:myActives.length,label:"Restantes",color:C.blue},{val:myTermines.length,label:"Terminées",color:C.success},{val:bons.length,label:"Bons",color:C.purple}].map(s=>(
            <div key={s.label} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:11,padding:"10px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:s.color}}>{s.val}</div>
              <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
        {(isAmb&&convoyeur)||stagiaireSelec?(
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",marginBottom:3}}>🚑 CHAUFFEUR{!isAmb&&roleSwapped&&stagiaireSelec?"-FORMATION":""}</div>
                  <div style={{fontSize:13,fontWeight:700}}>{isAmb?(roleSwapped?convoyeur:driver):(!isAmb&&roleSwapped&&stagiaireSelec?stagiaireSelec:driver)}</div>
                </div>
                {isAmb&&convoyeur&&(
                  <div>
                    <div style={{fontSize:9,color:C.muted,textTransform:"uppercase",marginBottom:3}}>👥 CONVOYEUR</div>
                    <div style={{fontSize:13,fontWeight:700}}>{roleSwapped?driver:convoyeur}</div>
                  </div>
                )}
                {stagiaireSelec&&isAmb&&(
                  <div>
                    <div style={{fontSize:9,color:C.purple,textTransform:"uppercase",marginBottom:3}}>🎓 STAGIAIRE</div>
                    <div style={{fontSize:13,fontWeight:700,color:C.purple}}>{stagiaireSelec}</div>
                  </div>
                )}
                {stagiaireSelec&&!isAmb&&(
                  <div>
                    <div style={{fontSize:9,color:roleSwapped?C.muted:C.blue,textTransform:"uppercase",marginBottom:3}}>{roleSwapped?"👨‍🏫 FORMATEUR":"📋 FORMATION"}</div>
                    <div style={{fontSize:13,fontWeight:700,color:roleSwapped?C.text:C.blue}}>{roleSwapped?driver:stagiaireSelec}</div>
                  </div>
                )}
              </div>
              {(isAmb&&convoyeur)||stagiaireSelec?(
                <div style={{display:"flex",gap:6}}>
                  {isAmb&&convoyeur&&(
                    <button onClick={()=>setShowChangeConvoyeur(true)}
                      style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                      👥 Changer
                    </button>
                  )}
                  <button onClick={()=>setRoleSwapped(r=>!r)}
                    style={{background:roleSwapped?C.successSoft:C.accentSoft,border:`1px solid ${roleSwapped?C.success:C.accent}`,borderRadius:8,color:roleSwapped?C.success:C.accent,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                    🔄 Switch
                  </button>
                </div>
              ):null}
            </div>
          </div>
        ):null}
        {todaySkipped?(
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <button onClick={()=>{setSignalVehicle(vehicle.name);setSignalNom(isAmb?[driver,convoyeur].filter(Boolean).join(" / "):driver);setShowSignaler(true);}} style={{flex:1,background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:10,color:C.danger,padding:"11px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>🚨 Signaler</button>
            <button onClick={()=>setScreen("daily_checklist")} style={{flex:1,background:C.successSoft,border:`1px solid ${C.success}`,borderRadius:10,color:C.success,padding:"11px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>✅ Effectuer checklist</button>
          </div>
        ):(
          <button onClick={()=>{setSignalVehicle(vehicle.name);setSignalNom(isAmb?[driver,convoyeur].filter(Boolean).join(" / "):driver);setShowSignaler(true);}} style={{width:"100%",marginBottom:8,background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:10,color:C.danger,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>🚨 Signaler un problème</button>
        )}
        <button onClick={()=>setShowCarnetBord(true)} style={{width:"100%",marginBottom:8,background:C.panel2,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>📓 Carnet de bord</button>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <button onClick={()=>setShowPlans(true)} style={{flex:1,background:C.blueSoft,border:`1px solid ${C.blue}`,borderRadius:10,color:C.blue,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>🗺️ Plans</button>
          <button onClick={()=>setShowContacts(true)} style={{flex:1,background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:10,color:C.accent,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>📞 Contacts</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:18}}>
          <button onClick={openVierge} style={{flex:1,background:C.panel2,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>📄 Bon vierge</button>
          <button onClick={()=>setShowBons(true)} style={{flex:1,background:bons.length>0?C.purpleSoft:C.panel2,border:`1px solid ${bons.length>0?C.purple:C.border}`,borderRadius:10,color:bons.length>0?C.purple:C.muted,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>📋 Mes bons ({bons.length})</button>
        </div>
        <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:12}}>📋 Mes courses</div>
        {myActives.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.muted,fontSize:13}}>Aucune course assignée</div>}
        {myActives.map((c)=>{
          const st=getStatut(c.id);
          const isEnCours=st==="en_cours";
          const hasBon=bons.find(b=>b.courseId===c.id);
          return(
            <div key={c.id} style={{background:C.panel,border:`1.5px solid ${isEnCours?C.accent:C.border}`,borderRadius:15,padding:"16px",marginBottom:10,position:"relative",overflow:"hidden"}}>
              {isEnCours&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.accent},#fbbf24)`}}/>}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:22}}>{TYPE_MAP[c.type]||"🚑"}</span>
                  <div style={{fontSize:18,fontWeight:900}}>{c.heure}</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {hasBon&&<span style={{background:C.purpleSoft,border:`1px solid ${C.purple}`,color:C.purple,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>Bon ✓</span>}
                  <div style={{background:isEnCours?C.accentSoft:C.panel2,border:`1px solid ${isEnCours?C.accent:C.border}`,borderRadius:20,padding:"4px 10px",display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:isEnCours?C.accent:C.blue}}/>
                    <span style={{fontSize:11,color:isEnCours?C.accent:C.blue,fontWeight:700}}>{isEnCours?"En cours":"Planifié"}</span>
                  </div>
                </div>
              </div>
              <div style={{fontSize:15,fontWeight:800,marginBottom:6}}>👤 {c.patient}</div>
              {c.convention&&<div style={{fontSize:10,color:C.accent,fontWeight:600,marginBottom:8}}>🤝 {CONV_MAP[c.convention]||c.convention}</div>}
              {(c.oxygene||c.perfusion)&&(
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  {c.oxygene&&<span style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,color:C.danger,borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700}}>💨 O² {c.litrageO2}L/min</span>}
                  {c.perfusion&&<span style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,color:C.danger,borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700}}>💉 Perfusion</span>}
                </div>
              )}
              <div style={{background:C.panel2,borderRadius:10,padding:"10px 12px",marginBottom:12}}>
                <div style={{display:"flex",gap:8,marginBottom:6}}><span>📍</span><div><div style={{fontSize:9,color:C.muted,fontWeight:700,textTransform:"uppercase"}}>Départ</div><div style={{fontSize:13,fontWeight:600}}>{c.depart}</div></div></div>
                <div style={{height:1,background:C.border,margin:"5px 0"}}/>
                <div style={{display:"flex",gap:8}}><span>🏁</span><div><div style={{fontSize:9,color:C.muted,fontWeight:700,textTransform:"uppercase"}}>Destination</div><div style={{fontSize:13,fontWeight:600}}>{c.arrivee}</div></div></div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(isEnCours?c.arrivee:c.depart)}`} target="_blank" rel="noreferrer" style={{flex:1,background:C.blueSoft,border:`1px solid ${C.blue}`,borderRadius:9,color:C.blue,padding:"11px",fontWeight:700,fontSize:13,textAlign:"center",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>🗺 GPS</a>
                {st==="planifie"&&<button onClick={()=>setStatut(c.id,"en_cours")} style={{flex:3,background:C.accentSoft,border:`1.5px solid ${C.accent}`,borderRadius:9,color:C.accent,padding:"11px",fontWeight:800,fontSize:13,cursor:"pointer"}}>▶ Démarrer</button>}
                {st==="en_cours"&&<button onClick={()=>{setCourse(c);openBon(c);}} style={{flex:3,background:C.successSoft,border:`1.5px solid ${C.success}`,borderRadius:9,color:C.success,padding:"11px",fontWeight:800,fontSize:13,cursor:"pointer"}}>📄 Bon de transport</button>}
                <button onClick={()=>setShowTransfer(c)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"11px 10px",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>🔀 Transférer</button>
              </div>
            </div>
          );
        })}
        {myTermines.length>0&&myTermines.map(c=>(
          <div key={c.id} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:11,padding:"11px 14px",marginBottom:7,opacity:0.4}}>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,fontWeight:700,color:C.muted}}>{c.heure} · {c.patient}</span><span style={{color:C.success}}>✓</span></div>
          </div>
        ))}
      </div>

      {showContacts&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px",width:480,maxWidth:"92vw",maxHeight:"85vh",display:"flex",flexDirection:"column",animation:"pop 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:17}}>📒 Carnet de contacts</div>
              <button onClick={()=>{setShowContacts(false);setBigContact(null);}} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            {bigContact?(
              <div style={{textAlign:"center",padding:"20px 0"}}>
                <div style={{fontSize:14,color:C.muted,marginBottom:8}}>{bigContact.nom}</div>
                <div style={{fontSize:52,fontWeight:900,color:C.text,letterSpacing:"2px",marginBottom:24}}>{bigContact.tel}</div>
                <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                  <a href={`tel:${bigContact.tel.replace(/\s/g,"")}`} style={{background:C.successSoft,border:`1px solid ${C.success}`,borderRadius:9,color:C.success,padding:"10px 24px",fontSize:14,fontWeight:700,textDecoration:"none"}}>📞 Appeler</a>
                  <button onClick={()=>setBigContact(null)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"10px 24px",fontSize:14,cursor:"pointer"}}>← Retour</button>
                </div>
              </div>
            ):(
              <div style={{overflowY:"auto",flex:1}}>
                {contacts&&[...contacts].sort((a,b)=>a.nom.localeCompare(b.nom)).map(c=>(
                  <button key={c.id} onClick={()=>setBigContact(c)}
                    style={{width:"100%",background:C.panel2,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 16px",marginBottom:7,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:14,fontWeight:600,color:C.text}}>📒 {c.nom}</span>
                    <span style={{fontSize:12,color:C.mutedLight}}>{c.tel}</span>
                  </button>
                ))}
                {(!contacts||contacts.length===0)&&<div style={{textAlign:"center",padding:"30px 0",color:C.muted}}>Aucun contact enregistré</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {showEndChoice&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:230}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:380,maxWidth:"92vw",animation:"pop 0.2s ease"}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:6}}>🔴 Fin de service</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Le véhicule {vehicle?.name} reste où ce soir ?</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={()=>{ setShowEndChoice(false); setEndCarnetMission("retour_base"); }} style={{background:C.successSoft,border:`1.5px solid ${C.success}`,borderRadius:12,padding:"14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left"}}>
                <span style={{fontSize:24}}>🏠</span>
                <div><div style={{fontWeight:700,fontSize:14,color:C.success}}>Retour base</div><div style={{fontSize:11,color:C.muted}}>Le véhicule reste au dépôt</div></div>
              </button>
              <button onClick={()=>{ setShowEndChoice(false); setEndCarnetMission("retour_domicile"); }} style={{background:C.dangerSoft,border:`1.5px solid ${C.danger}`,borderRadius:12,padding:"14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left"}}>
                <span style={{fontSize:24}}>🚗</span>
                <div><div style={{fontWeight:700,fontSize:14,color:C.danger}}>Retour domicile</div><div style={{fontSize:11,color:C.muted}}>Je le ramène chez moi</div></div>
              </button>
            </div>
            <button onClick={()=>setShowEndChoice(false)} style={{width:"100%",marginTop:14,background:"transparent",border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"10px",fontSize:13,cursor:"pointer"}}>Annuler</button>
          </div>
        </div>
      )}

      {endCarnetMission&&(
        <CarnetBordModal vehicle={vehicle} driver={driver} myCourses={myCourses} carnetBordTypes={carnetBordTypes} forcedMission={endCarnetMission}
          onForcedSaved={()=>{
            if(setVehicles) setVehicles(p=>p.map(v=>v.id===vehicle.id?{...v,horsBase:endCarnetMission==="retour_domicile"?{driver,since:Date.now()}:null}:v));
            setEndCarnetMission(null);
            onEndService();
          }}
          onClose={()=>setEndCarnetMission(null)}/>
      )}

      {showCarnetBord&&(
        <CarnetBordModal vehicle={vehicle} driver={driver} myCourses={myCourses} carnetBordTypes={carnetBordTypes} onClose={()=>setShowCarnetBord(false)}/>
      )}

      {showChangeConvoyeur&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:220}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:420,maxWidth:"92vw",maxHeight:"90vh",overflowY:"auto",animation:"pop 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:16}}>👥 Changer de convoyeur</div>
              <button onClick={()=>setShowChangeConvoyeur(false)} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:10}}>Nouveau convoyeur (relève d'équipe)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[...driversAmb].sort((a,b)=>a.localeCompare(b)).filter(d=>d!==driver).map(d=>(
                <button key={d} onClick={()=>{setConvoyeur(d);setShowChangeConvoyeur(false);}}
                  style={{background:convoyeur===d?C.dangerSoft:C.panel2,border:`1.5px solid ${convoyeur===d?C.danger:C.border}`,borderRadius:11,padding:"12px 14px",color:convoyeur===d?C.danger:C.text,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                  <div style={{width:30,height:30,background:convoyeur===d?C.danger:C.panel,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🚑</div>
                  <span style={{fontWeight:600,fontSize:13}}>{d}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSignaler&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:210}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:420,maxWidth:"92vw",maxHeight:"90vh",overflowY:"auto",animation:"pop 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:16,color:C.danger}}>🚨 Signaler un problème</div>
              <button onClick={()=>{setShowSignaler(false);setSignalVehicle("");setSignalDesc("");setSignalNom("");setSignalSent(false);}} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            {signalSent?(
              <div style={{background:C.successSoft,border:`1px solid ${C.success}`,borderRadius:10,padding:16,textAlign:"center",fontWeight:700,color:C.success}}>✅ Problème signalé au Garage !</div>
            ):(
              <>
                <div style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between"}}>
                  <div><div style={{fontSize:10,color:C.muted,textTransform:"uppercase"}}>Véhicule</div><div style={{fontWeight:700,fontSize:14,color:C.text}}>{signalVehicle}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:10,color:C.muted,textTransform:"uppercase"}}>Signalé par</div><div style={{fontWeight:700,fontSize:14,color:C.text}}>{signalNom}</div></div>
                </div>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:8}}>Description du problème*</div>
                <textarea value={signalDesc} onChange={e=>setSignalDesc(e.target.value)} placeholder="Décrivez le problème en détail..." style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px",color:C.text,fontSize:13,minHeight:90,resize:"vertical",marginBottom:20,fontFamily:"inherit"}}/>
                <button disabled={signalSending||!signalDesc.trim()} onClick={async()=>{
                  setSignalSending(true);
                  const vObj=vehicles.find(v=>v.name===signalVehicle);
                  await addDoc(collection(dbChecklists,"dispatchai_daily_defects"), {
                    vehicle:signalVehicle, type:vObj?.type||"AMB", description:signalDesc.trim(),
                    reportedBy:signalNom, source:"manuel", defectKey:signalVehicle+"_manuel_"+Date.now(),
                    createdAt:Date.now(),
                  });
                  setSignalSending(false);
                  setSignalSent(true);
                  setTimeout(()=>{setShowSignaler(false);setSignalVehicle("");setSignalDesc("");setSignalNom("");setSignalSent(false);},1500);
                }} style={{width:"100%",background:C.danger,border:"none",borderRadius:10,color:"white",padding:14,fontWeight:800,fontSize:14,cursor:"pointer",opacity:(signalSending||!signalDesc.trim())?0.6:1}}>
                  {signalSending?"Envoi…":"Envoyer le signalement"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showPlans&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px",width:420,maxWidth:"92vw",maxHeight:"90vh",display:"flex",flexDirection:"column",animation:"pop 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:17}}>🗺️ Plans des sites</div>
              <button onClick={()=>setShowPlans(false)} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",flex:1}}>
              {(!plans||plans.length===0)
                ?<div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>
                  <div style={{fontSize:32,marginBottom:12}}>🗺️</div>
                  <div style={{fontSize:14}}>Aucun plan disponible</div>
                  <div style={{fontSize:12,marginTop:8,color:C.muted}}>Ajoutez des plans dans Paramètres</div>
                </div>
                :plans.map((p,i)=>(
                  <button key={i} onClick={()=>setViewingPlan(p)} style={{width:"100%",background:C.panel2,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:8,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:20}}>🗺️</span>
                      <span style={{fontWeight:700,fontSize:14,color:C.text}}>{p.nom}</span>
                    </div>
                    <span style={{color:C.blue,fontSize:12,fontWeight:700}}>🔍 Ouvrir</span>
                  </button>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {viewingPlan&&(
        <div style={{position:"fixed",inset:0,background:"#000",zIndex:250,display:"flex",flexDirection:"column"}}>
          <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontWeight:800,fontSize:15,color:C.text}}>🗺️ {viewingPlan.nom}</div>
            <button onClick={()=>setViewingPlan(null)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>✕ Fermer</button>
          </div>
          <iframe src={viewingPlan.data} style={{flex:1,width:"100%",border:"none",background:"#fff"}} title={viewingPlan.nom}/>
        </div>
      )}

      {showTransfer&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px",width:440,maxWidth:"92vw",animation:"pop 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:16}}>🔀 Transférer la course</div>
              <button onClick={()=>setShowTransfer(null)} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            <div style={{fontSize:12,color:C.muted,marginBottom:14}}>Course : <strong style={{color:C.text}}>{showTransfer.patient}</strong></div>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:10}}>Choisir un véhicule :</div>
            {vehicles.filter(v=>v.id!==vehicle?.id).map(v=>(
              <button key={v.id} onClick={()=>{if(v.active)setConfirmTransfer({course:showTransfer,vehicle:v});}} disabled={!v.active}
                style={{width:"100%",background:v.active?C.panel2:C.dangerSoft,border:`1px solid ${v.active?C.border:C.danger}`,borderRadius:10,padding:"12px 14px",marginBottom:7,textAlign:"left",cursor:v.active?"pointer":"not-allowed",display:"flex",alignItems:"center",gap:10,opacity:v.active?1:0.7}}>
                <span style={{fontSize:16,color:v.active?vColor(v.type):C.danger}}>{vIcon(v.type)}</span>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:v.active?C.text:C.danger}}>{v.name}</div><div style={{fontSize:10,color:C.muted}}>{v.active?v.driver:"Hors service"}</div></div>
              </button>
            ))}
          </div>
        </div>
      )}

      {confirmTransfer&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"28px",width:380,maxWidth:"92vw",textAlign:"center",animation:"pop 0.2s ease"}}>
            <div style={{fontSize:32,marginBottom:12}}>🔀</div>
            <div style={{fontWeight:800,fontSize:17,marginBottom:8}}>Confirmer le transfert</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:6}}>Course : <strong style={{color:C.text}}>{confirmTransfer.course.patient}</strong></div>
            <div style={{fontSize:13,color:C.muted,marginBottom:24}}>Vers : <strong style={{color:C.accent}}>{vIcon(confirmTransfer.vehicle.type)} {confirmTransfer.vehicle.name}</strong></div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmTransfer(null)} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:11,color:C.muted,padding:"13px",fontWeight:700,fontSize:15,cursor:"pointer"}}>Non</button>
              <button onClick={()=>{setStatut(confirmTransfer.course.id,"planifie");setTransferDone(confirmTransfer.vehicle.name);setConfirmTransfer(null);setShowTransfer(null);setTimeout(()=>setTransferDone(null),3000);}}
                style={{flex:1,background:C.success,border:"none",borderRadius:11,color:"white",padding:"13px",fontWeight:800,fontSize:15,cursor:"pointer"}}>Oui</button>
            </div>
          </div>
        </div>
      )}
      {transferDone&&(
        <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:C.success,borderRadius:12,padding:"12px 24px",fontSize:14,fontWeight:700,color:"white",zIndex:300,animation:"pop 0.2s ease"}}>
          ✅ Course transférée à {transferDone}
        </div>
      )}

      {showBons&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px",width:520,maxWidth:"92vw",maxHeight:"85vh",display:"flex",flexDirection:"column",animation:"pop 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:17}}>📋 Mes bons du jour</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={exportMensuel} style={{background:C.blueSoft,border:`1px solid ${C.blue}`,borderRadius:8,color:C.blue,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📤 Export mensuel PDF</button>
                <button onClick={()=>setShowBons(false)} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
              </div>
            </div>
            {bons.length===0?<div style={{textAlign:"center",padding:"30px 0",color:C.muted}}>Aucun bon pour l'instant</div>:
            <div style={{overflowY:"auto",flex:1}}>
              {bons.map(b=>(
                <div key={b.id} style={{background:b.valide?C.successSoft:C.panel2,border:`1px solid ${b.valide?C.success:C.border}`,borderRadius:11,padding:"13px 16px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14}}>{b.isVierge?"📄 Bon vierge":b.patient}</div>
                      <div style={{fontSize:11,color:C.muted}}>{b.vehicule} · {b.base||"Base non définie"}</div>
                    </div>
                    {b.valide?<span style={{background:C.successSoft,border:`1px solid ${C.success}`,color:C.success,borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700}}>✅ Validé</span>
                    :<span style={{background:C.warningSoft,border:`1px solid ${C.warning}`,color:C.warning,borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700}}>⏳ Brouillon</span>}
                  </div>
                  <button onClick={()=>{setCurrentBon(b);setShowBons(false);setScreen("bon");}} style={{background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:8,color:C.accent,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>✏️ Modifier</button>
                </div>
              ))}
            </div>}
            {bons.some(b=>!b.valide)&&<div style={{marginTop:14,fontSize:12,color:C.muted,textAlign:"center"}}>⚠ Validez tous les bons avant la fin de service</div>}
          </div>
        </div>
      )}
    </div>
  );

  if(screen==="bon"&&currentBon) return(
    <BonView bon={currentBon} setBon={setCurrentBon} onSave={(b)=>{saveBon(b);if(b.courseId)setStatut(b.courseId,"termine");setScreen("planning");}} onBack={()=>setScreen("planning")} vehicle={vehicle} driver={driver} bases={bases}/>
  );

  return null;
}

function TaInput({value,onChange}){
  const handleChange=(e)=>{
    let v=e.target.value.replace(/[^\d/]/g,"");
    const digits=v.replace(/\//g,"");
    if(digits.length<=3) v=digits;
    else v=digits.slice(0,3)+"/"+digits.slice(3,5);
    onChange(v);
  };
  return(
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <input value={value} onChange={handleChange} placeholder="140/88" maxLength={6}
        style={{background:"#07090f",color:"#e8f0fa",fontSize:13,border:"1.5px solid #1a2d45",borderRadius:9,padding:"10px 13px",outline:"none",width:"100%",fontFamily:"inherit"}}/>
      <span style={{fontSize:11,color:"#3d5a7a",whiteSpace:"nowrap"}}>mmHg</span>
    </div>
  );
}

function ParamInput({value,onChange,placeholder,unit}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"—"}
        style={{background:"#07090f",color:"#e8f0fa",fontSize:13,border:"1.5px solid #1a2d45",borderRadius:9,padding:"10px 13px",outline:"none",width:"100%",fontFamily:"inherit"}}/>
      {value&&<span style={{fontSize:11,color:"#3d5a7a",whiteSpace:"nowrap"}}>{unit}</span>}
    </div>
  );
}

function BonView({bon,onSave,onBack,vehicle,driver,bases}){
  const [sig,setSig]=useState(bon.signature||null);
  const [showSig,setShowSig]=useState(false);
  const [b,setB]=useState(bon);
  const [parametres,setParametres]=useState(bon.parametres||[{heure:"PEC",fc:"",ta:"",spo2:"",glycemie:"",temp:""}]);
  const [consommables,setConsommables]=useState(bon.consommables||[""]);
  const set=(k,v)=>setB(p=>({...p,[k]:v}));
  const setParam=(i,k,v)=>setParametres(p=>p.map((col,j)=>j===i?{...col,[k]:v}:col));
  const addParamCol=()=>{
    const now=new Date();
    const heure=`${String(now.getHours()).padStart(2,'0')}h${String(now.getMinutes()).padStart(2,'0')}`;
    setParametres(p=>[...p,{heure,fc:"",ta:"",spo2:"",glycemie:"",temp:""}]);
  };
  const addConso=()=>setConsommables(p=>[...p,""]);
  const setConso=(i,v)=>setConsommables(p=>p.map((x,j)=>j===i?v:x));
  const isAmb=vehicle?.type==="AMB";
  const isTpmr=vehicle?.type==="TPMR"||vehicle?.type==="VSL";
  const isUrgences=b.type==="urgences"||b.type==="Urgences";
  const handleSend=(validate)=>onSave({...b,signature:sig,valide:validate,parametres,consommables});
  const inStyle={width:"100%",background:"#07090f",border:"1px solid #1a2d45",borderRadius:8,padding:"9px 12px",color:"#e8f0fa",fontSize:13,fontFamily:"inherit"};
  const chaufLabel=b.chauffeurLabel||driver||b.chauffeur||"";
  const convLabel=b.convoyeurLabel||"";
  const roleSwapped=b.roleSwapped||false;

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>←</button>
          <div style={{width:36,height:36,background:C.accent,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📄</div>
          <div><div style={{fontWeight:700,fontSize:14}}>Bon de transport</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"1px"}}>{b.isVierge?"Bon vierge":b.patient}</div></div>
        </div>
        <Clock/>
      </div>
      <div style={{flex:1,padding:"16px 16px 120px",maxWidth:600,margin:"0 auto",width:"100%"}}>

        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:13,padding:"16px 18px",marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:800,color:C.accent,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:12}}>Véhicule & Équipe</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div><div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>Véhicule</div><div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,fontWeight:600}}>{vehicle?.name||b.vehicule}</div></div>
            <div>
              <div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>{!isAmb&&roleSwapped&&b.stagiaire?"🚗 Chauffeur-formation":"🚗 Chauffeur"}</div>
              <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,fontWeight:600}}>{!isAmb&&roleSwapped&&b.stagiaire?b.stagiaire:chaufLabel}</div>
            </div>
            {convLabel&&<div>
              <div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>🚑 Convoyeur</div>
              <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,fontWeight:600}}>{roleSwapped?chaufLabel:convLabel}</div>
            </div>}
            {b.stagiaire&&isAmb&&<div>
              <div style={{fontSize:10,color:C.purple,marginBottom:5,textTransform:"uppercase"}}>🎓 Stagiaire</div>
              <div style={{background:C.bg,border:`1px solid ${C.purple}`,borderRadius:8,padding:"9px 12px",color:C.purple,fontSize:13,fontWeight:600}}>{b.stagiaire}</div>
            </div>}
            {b.stagiaire&&!isAmb&&<div>
              <div style={{fontSize:10,color:roleSwapped?C.muted:C.blue,marginBottom:5,textTransform:"uppercase"}}>{roleSwapped?"👨‍🏫 Formateur":"📋 Formation"}</div>
              <div style={{background:C.bg,border:`1px solid ${roleSwapped?C.border:C.blue}`,borderRadius:8,padding:"9px 12px",color:roleSwapped?C.text:C.blue,fontSize:13,fontWeight:600}}>{roleSwapped?chaufLabel:b.stagiaire}</div>
            </div>}
          </div>
          <div>
            <div style={{fontSize:10,color:C.mutedLight,marginBottom:8,textTransform:"uppercase"}}>Base de départ</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {bases.map(base=>{const active=b.base===base;return(
                <button key={base} onClick={()=>set("base",base)} style={{padding:"8px 14px",borderRadius:8,border:`1.5px solid ${active?C.accent:C.border}`,background:active?C.accentSoft:"transparent",color:active?C.accent:C.muted,fontSize:12,fontWeight:active?700:500,cursor:"pointer"}}>🏠 {base}</button>
              );})}
            </div>
          </div>
        </div>

        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:13,padding:"16px 18px",marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:800,color:C.accent,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:12}}>Patient</div>
          {b.isVierge?(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              {[{k:"patient",l:"Nom & Prénom complet",p:"DUPONT Jean"},{k:"dateNaissance",l:"Date de naissance",p:"JJ/MM/AAAA"},{k:"depart",l:"Adresse départ",p:"12 rue..."},{k:"arrivee",l:"Destination",p:"CHU Mons..."},{k:"convention",l:"Convention",p:"Épicura"},{k:"type",l:"Type transport",p:"Consultation"}].map(f=>(
                <div key={f.k}><div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>{f.l}</div><input value={b[f.k]||""} onChange={e=>set(f.k,e.target.value)} placeholder={f.p} style={inStyle}/></div>
              ))}
            </div>
          ):(
            <>
              {[["Patient",b.patient||b.nomComplet],["Date naissance",b.dateNaissance||"—"],["Convention",b.convention],["Type",b.type],["Départ",b.depart],["Destination",b.arrivee]].map(([k,v])=>v&&(
                <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{color:C.muted}}>{k}</span><span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </>
          )}
          {isAmb&&(
            <div style={{marginTop:12}}>
              <button onClick={()=>set("patientAssis",!b.patientAssis)} style={{display:"flex",alignItems:"center",gap:10,background:b.patientAssis?C.successSoft:"transparent",border:`1.5px solid ${b.patientAssis?C.success:C.border}`,borderRadius:9,padding:"10px 14px",cursor:"pointer",width:"100%"}}>
                <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${b.patientAssis?C.success:C.muted}`,background:b.patientAssis?C.success:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{b.patientAssis&&<span style={{color:"white",fontSize:11,fontWeight:800}}>✓</span>}</div>
                <div><div style={{fontSize:13,fontWeight:b.patientAssis?700:500,color:b.patientAssis?C.success:C.text}}>🧍 Patient transporté assis</div><div style={{fontSize:10,color:C.muted}}>Facturation différente du brancard</div></div>
              </button>
            </div>
          )}
          <div style={{marginTop:12}}>
            <button onClick={()=>set("deplInutile",!b.deplInutile)} style={{display:"flex",alignItems:"center",gap:10,background:b.deplInutile?C.warningSoft:"transparent",border:`1.5px solid ${b.deplInutile?C.warning:C.border}`,borderRadius:9,padding:"10px 14px",cursor:"pointer",width:"100%"}}>
              <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${b.deplInutile?C.warning:C.muted}`,background:b.deplInutile?C.warning:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{b.deplInutile&&<span style={{color:"white",fontSize:11,fontWeight:800}}>✓</span>}</div>
              <div><div style={{fontSize:13,fontWeight:b.deplInutile?700:500,color:b.deplInutile?C.warning:C.text}}>🚫 Déplacement inutile</div><div style={{fontSize:10,color:C.muted}}>Patient absent, sorti… — déplacement facturable</div></div>
            </button>
            {b.deplInutile&&<div style={{marginTop:8}}><div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>Motif</div><input value={b.deplMotif||""} onChange={e=>set("deplMotif",e.target.value)} placeholder="Patient sorti, décédé, non prévenu…" style={inStyle}/></div>}
          </div>
        </div>

        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:13,padding:"16px 18px",marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:800,color:C.accent,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:16}}>Heures & Kilométrage</div>
          <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
            <div style={{width:"48%"}}>
              <div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase",textAlign:"center"}}>Km départ</div>
              <input placeholder="12450" value={b.kmDepart||""} onChange={e=>set("kmDepart",e.target.value)} style={{...inStyle,textAlign:"center"}}/>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
            <div style={{width:"48%"}}>
              <div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase",textAlign:"center"}}>Prise en charge</div>
              <HeureInput value={b.heurePC||""} onChange={v=>set("heurePC",v)}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div><div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>Départ (1er trajet)</div><HeureInput value={b.heureDep1||""} onChange={v=>set("heureDep1",v)}/></div>
            <div><div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>Arrivée (1er trajet)</div><HeureInput value={b.heureArr1||""} onChange={v=>set("heureArr1",v)}/></div>
          </div>
          <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
            <div style={{width:"80%"}}>
              <div style={{fontSize:10,color:C.mutedLight,marginBottom:8,textTransform:"uppercase",textAlign:"center"}}>Attente</div>
              <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:8}}>
                {["Oui","Non"].map(opt=>{const active=(opt==="Oui")?b.attente===true:b.attente===false;return(
                  <button key={opt} onClick={()=>set("attente",opt==="Oui")}
                    style={{flex:1,padding:"9px",borderRadius:8,border:`1.5px solid ${active?(opt==="Oui"?C.accent:C.muted):C.border}`,background:active?(opt==="Oui"?C.accentSoft:C.panel2):"transparent",color:active?(opt==="Oui"?C.accent:C.text):C.muted,fontWeight:active?700:500,fontSize:13,cursor:"pointer"}}>
                    {opt}
                  </button>
                );})}
              </div>
              {b.attente===true&&(
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <input type="number" placeholder="30" value={b.tempsAttente||""} onChange={e=>set("tempsAttente",e.target.value)} style={{...inStyle,textAlign:"center"}}/>
                  {b.tempsAttente&&<span style={{fontSize:11,color:C.muted,whiteSpace:"nowrap"}}>min</span>}
                </div>
              )}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>Départ (2e trajet)</div><HeureInput value={b.heureDep2||""} onChange={v=>set("heureDep2",v)}/></div>
            <div><div style={{fontSize:10,color:C.mutedLight,marginBottom:5,textTransform:"uppercase"}}>Arrivée (2e trajet)</div><HeureInput value={b.heureArr2||""} onChange={v=>set("heureArr2",v)}/></div>
          </div>
        </div>

        {isAmb&&(
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:13,padding:"16px 18px",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:800,color:C.accent,textTransform:"uppercase",letterSpacing:"1.2px"}}>📦 Consommables (facturable)</div>
              <button onClick={addConso} style={{background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:7,color:C.accent,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+</button>
            </div>
            {consommables.map((c,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{color:C.accent,fontWeight:800,fontSize:16,flexShrink:0}}>—</span>
                <input value={c} onChange={e=>setConso(i,e.target.value)} placeholder="Masque à oxygène, compresses…" style={{...inStyle,flex:1}}/>
              </div>
            ))}
          </div>
        )}

        {isTpmr&&isUrgences&&(
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:13,padding:"16px 18px",marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:800,color:C.warning,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:12}}>🚨 Raison de l'entrée aux urgences</div>
            <textarea value={b.raisonUrgence||""} onChange={e=>set("raisonUrgence",e.target.value)} placeholder="Raison de l'entrée aux urgences…" rows={3} style={{...inStyle,resize:"none"}}/>
          </div>
        )}

        {isTpmr&&(
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:13,padding:"16px 18px",marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:800,color:C.accent,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:12}}>📝 Remarques</div>
            <textarea value={b.remarques||""} onChange={e=>set("remarques",e.target.value)} placeholder="Remarques…" rows={3} style={{...inStyle,resize:"none"}}/>
          </div>
        )}

        {isAmb&&(
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:13,padding:"16px 18px",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:800,color:C.danger,textTransform:"uppercase",letterSpacing:"1.2px"}}>📊 Paramètres patient</div>
              <button onClick={addParamCol} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:7,color:C.danger,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Colonne</button>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:280}}>
                <thead>
                  <tr>
                    <td style={{fontSize:9,color:C.muted,padding:"4px 8px",textTransform:"uppercase",whiteSpace:"nowrap"}}>Paramètre</td>
                    {parametres.map((col,i)=>(
                      <td key={i} style={{padding:"4px 6px",minWidth:100}}>
                        {i===0
                          ?<div style={{fontSize:10,fontWeight:700,color:C.accent,textAlign:"center",padding:"8px 0"}}>PEC</div>
                          :<HeureInput value={col.heure} onChange={v=>setParam(i,"heure",v)}/>
                        }
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {k:"fc",l:"❤️ F.C.",unit:"BPM",ph:"75"},
                    {k:"ta",l:"🩺 T.A.",unit:"mmHg",isTa:true},
                    {k:"spo2",l:"🫁 SPO²",unit:"%",ph:"99"},
                    {k:"glycemie",l:"🩸 Glycémie",unit:"mg/dl",ph:"140"},
                    {k:"temp",l:"🌡️ Temp.",unit:"°C",ph:"36"},
                  ].map(row=>(
                    <tr key={row.k} style={{borderTop:`1px solid ${C.border}`}}>
                      <td style={{padding:"6px 8px",fontSize:11,color:C.muted,whiteSpace:"nowrap"}}>{row.l}<br/><span style={{fontSize:9}}>{row.unit}</span></td>
                      {parametres.map((col,i)=>(
                        <td key={i} style={{padding:"4px 6px"}}>
                          {row.isTa
                            ?<TaInput value={col[row.k]||""} onChange={v=>setParam(i,row.k,v)}/>
                            :<ParamInput value={col[row.k]||""} onChange={v=>setParam(i,row.k,v)} placeholder={row.ph} unit={row.unit}/>
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{marginTop:14}}>
              <div style={{fontSize:10,fontWeight:700,color:C.danger,textTransform:"uppercase",marginBottom:8}}>🚨 Raison urgence</div>
              <textarea value={b.raisonUrgence||""} onChange={e=>set("raisonUrgence",e.target.value)} placeholder="Raison de l'urgence…" rows={2} style={{...inStyle,resize:"none",marginBottom:8}}/>
              <div style={{fontSize:10,fontWeight:700,color:C.accent,textTransform:"uppercase",marginBottom:8}}>📈 Évolution</div>
              <textarea value={b.evolution||""} onChange={e=>set("evolution",e.target.value)} placeholder="Évolution du patient…" rows={2} style={{...inStyle,resize:"none",marginBottom:8}}/>
              <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",marginBottom:8}}>📝 Remarques</div>
              <textarea value={b.remarques||""} onChange={e=>set("remarques",e.target.value)} placeholder="Remarques…" rows={2} style={{...inStyle,resize:"none"}}/>
            </div>
          </div>
        )}

        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:13,padding:"16px 18px",marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:800,color:C.accent,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:12}}>Signature du patient (optionnelle)</div>
          {sig?(<div style={{textAlign:"center"}}><img src={sig} alt="sig" style={{maxWidth:"100%",borderRadius:9,border:`1px solid ${C.border}`}}/><button onClick={()=>setSig(null)} style={{marginTop:9,background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 14px",fontSize:12,cursor:"pointer"}}>Refaire</button></div>)
          :showSig?(<SignaturePadInline onSave={d=>{setSig(d);setShowSig(false);}} onCancel={()=>setShowSig(false)}/>)
          :(<button onClick={()=>setShowSig(true)} style={{width:"100%",background:C.panel2,border:`2px dashed ${C.border}`,borderRadius:11,color:C.muted,padding:"24px",fontSize:14,fontWeight:600,cursor:"pointer"}}>✍️ Appuyer pour signer</button>)}
        </div>
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.panel,borderTop:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",gap:8}}>
        <button onClick={()=>handleSend(false)} style={{flex:1,background:C.panel2,border:`1px solid ${C.border}`,borderRadius:11,color:C.muted,padding:"13px",fontWeight:700,fontSize:14,cursor:"pointer"}}>💾 Brouillon</button>
        <button onClick={()=>handleSend(true)} style={{flex:2,background:C.success,border:"none",borderRadius:11,color:"white",padding:"13px",fontWeight:800,fontSize:14,cursor:"pointer"}}>✅ Valider & Envoyer</button>
      </div>
    </div>
  );
}


const CK_DARK = {
  bg:"#0b1120",panel:"#111827",panel2:"#1a2540",border:"#1f2f4a",
  accent:"#f97316",accentSoft:"rgba(249,115,22,0.1)",
  text:"#f0f4ff",muted:"#4d6a8a",
  success:"#22c55e",successSoft:"rgba(34,197,94,0.12)",
  danger:"#ef4444",dangerSoft:"rgba(239,68,68,0.1)",
  warning:"#f59e0b",blue:"#38bdf8",
  red:"#dc2626",darkBlue:"#1d4ed8",
};
const CK_LIGHT = {
  bg:"#f5f7fb",panel:"#ffffff",panel2:"#f0f3f9",border:"#dbe3f0",
  accent:"#f97316",accentSoft:"rgba(249,115,22,0.10)",
  text:"#101828",muted:"#8a96ab",
  success:"#16a34a",successSoft:"rgba(22,163,74,0.10)",
  danger:"#dc2626",dangerSoft:"rgba(220,38,38,0.08)",
  warning:"#d97706",blue:"#0284c7",
  red:"#dc2626",darkBlue:"#0284c7",
};
const CK_C = { ...CK_DARK };
function applyCkThemeMode(mode){ Object.assign(CK_C, mode==="light"?CK_LIGHT:CK_DARK); }
applyCkThemeMode(getStoredThemeMode());

const CK_GS=`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap'); *{box-sizing:border-box;} button{cursor:pointer;font-family:inherit;} input,textarea{font-family:inherit;} input::placeholder{color:#4d6a8a;}`;

// ═══════════════════════════════════════════════
// DONNÉES DES 7 CHECKLISTS
// ═══════════════════════════════════════════════

const INIT_CHECKLISTS = {
"ALPHA 1":{edition:"12/2025",norme:"ATNUP",sections:[
{id:1,label:"Soins et oxygénothérapie",color:"#dc2626",shelves:[
{id:"A",label:"Étagère A",items:[{n:"Set de pansement",q:1,p:true},{n:"Rouleau de sparadrap",q:2},{n:"Couverture Isotherme",q:5},{n:"Bandage triangulaire + épingle",q:4},{n:"Esculape",q:1}]},
{id:"B",label:"Étagère B",items:[{n:"Compresse 5x5cm",q:10,p:true},{n:"Compresse 7,5x7,5cm",q:10,p:true},{n:"Compresse 10x10cm",q:10,p:true},{n:"Compresse absorbante 20x10cm",q:5,p:true},{n:"Solution désinfectante Hibidil®",q:10,p:true},{n:"Sérum physiologique unidose",q:10,p:true},{n:"Iso-Bétadine® dermique 10%",q:5,p:true},{n:"Champ stérile 90x70",q:4,p:true},{n:"Kit pansement autocollant",q:1}]},
{id:"C",label:"Étagère C",items:[{n:"Bandage élastique 5 ou 7cm",q:5,p:true},{n:"Bandage élastique 10cm",q:5,p:true},{n:"Bandage élastique 15cm",q:4,p:true},{n:"Cool Pack",q:5}]},
{id:"D",label:"Oxygénothérapie Adulte",items:[{n:"Masque O² 100% Adulte",q:1,p:true},{n:"Lunette O² Adulte",q:2,p:true},{n:"Masque aérosol Adulte",q:1,p:true},{n:"Tubulure + Raccord Biconique",q:1,p:true}]},
{id:"E",label:"Oxygénothérapie Enfant",items:[{n:"Masque O² 100% Enfant",q:1,p:true},{n:"Lunette O² Enfant",q:2,p:true},{n:"Masque aérosol Enfant",q:1,p:true}]},
{id:"F",label:"Aspiration",items:[{n:"Sac récupérateur de mucosité",q:1},{n:"Tubulure aspirateur de mucosité",q:1},{n:"Bassin réniforme UU",q:10},{n:"Sac vomitoire",q:5}]},
]},
{id:2,label:"Paramétrage",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},{n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},{n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},{n:"Glucomètre",q:1,t:true},{n:"Lancettes",q:10},{n:"Tigettes",q:10,p:true},{n:"Compresse 5x5cm",q:2,p:true},{n:"Pile AA / AAA",q:8},{n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1}]}]},
{id:3,label:"Divers",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Couverture anti feu",q:1}]}]},
{id:4,label:"Eau potable",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Bouteille d'eau potable 50cl",q:6,p:true}]}]},
{id:5,label:"Hygiène — Spray",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Spray désinfectant surface",q:2,p:true}]}]},
{id:7,label:"Hygiène",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Spray désodorisant citron",q:1},{n:"Rouleau sac poubelle ambulance",q:1},{n:"Sac à linge jaune",q:2},{n:"Sac à linge blanc",q:2},{n:"Alèze UU",q:2},{n:"Lange adulte",q:3},{n:"Paquet de lingette désinfectante",q:1,p:true},{n:"Microfibres",q:4}]}]},
{id:8,label:"Ballon REA et canules",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Ballon REA adulte complet UU",q:1,p:true},{n:"Masque pour ballon N°4",q:1,p:true},{n:"Masque pour ballon N°5",q:1,p:true},{n:"Filtre antibactérien ballon REA",q:1,p:true},{n:"Set de 9 canules de T000 à T5",q:1}]}]},
{id:9,label:"RDOH",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Pane",q:1},{n:"Urinal",q:1}]}]},
{id:10,label:"Kits Burning",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Kit Burning",q:1,s:true,p:true}]}]},
{id:11,label:"Kit de protection individuel",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},{n:"Charlotte",q:2},{n:"Masque chirurgical",q:5},{n:"Masque KN95/FFP2",q:5}]}]},
{id:12,label:"Kit de rechange brancard",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Kit de linge brancard",q:3}]}]},
{id:13,label:"Cabine sanitaire",color:"#dc2626",shelves:[
{id:"A",label:"Cabine sanitaire",items:[{n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},{n:"Gel hydroalcoolique",q:2,p:true},{n:"Sonde d'aspiration CH 8",q:3,p:true},{n:"Sonde d'aspiration CH 12",q:3,p:true},{n:"Sonde d'aspiration CH 14",q:3,p:true},{n:"Aspirateur de mucosité",q:1,t:true},{n:"Appareil multi paramétrage",q:1,t:true},{n:"Oxylog",q:1,t:true},{n:"Gant nitrile taille M (boite)",q:1},{n:"Gant nitrile taille L (boite)",q:1},{n:"Gant nitrile taille XL (boite)",q:1},{n:"Sac d'Intervention",q:1,s:true,p:true},{n:"DEA + Electrode",q:1,t:true,p:true},{n:"Electrode de réserve",q:1,p:true},{n:"Collier cervical adulte",q:1},{n:"Collier cervical pédiatrique",q:1}]},
{id:"B",label:"Cabine sanitaire suite",items:[{n:"Bouteille O² 2L",q:1,bar:true},{n:"Extincteur 6Kg",q:1,p:true},{n:"Planche Rollboard",q:1},{n:"Tarif TMS",q:1},{n:"Tablette support monitoring",q:1}]},
]},
{id:14,label:"Porte Extérieur — Traumatologie",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Matelas à dépression",q:1,t:true},{n:"Pompe pour matelas",q:1},{n:"Scoop",q:1,t:true},{n:"Planche d'Olivier",q:1},{n:"Chaise d'évacuation",q:1,t:true},{n:"KED",q:1},{n:"Head block complet",q:1},{n:"Sac d'atèle",q:1},{n:"Atèle grande",q:1,t:true},{n:"Atèle moyenne",q:1,t:true},{n:"Atèle petite",q:1,t:true},{n:"Pompe pour atèle",q:1},{n:"Marche pieds",q:1,t:true},{n:"Bouteille O² 2L",q:1,bar:true},{n:"Bouteille O² 10L",q:1,bar:true},{n:"Bouteille O² 10L (2)",q:1,bar:true}]}]},
{id:15,label:"Cabine chauffeur",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Lampe de pré signalisation",q:2,t:true},{n:"Coupe ceinture / Brise glace",q:1},{n:"Carte ADR",q:1},{n:"Carte Hainaut",q:1}]}]},
]},
"ALPHA 2":{edition:"12/2024",norme:"112/ATNUP",sections:[
{id:1,label:"Soin et Oxygénothérapie",color:"#dc2626",shelves:[
{id:"A",label:"Étagère A",items:[{n:"Compresse 5x5cm",q:10,p:true},{n:"Compresse 7,5x7,5cm",q:10,p:true},{n:"Compresse 10x10cm",q:10,p:true},{n:"Compresse absorbante 20x10cm",q:5,p:true},{n:"Bandage élastique 15cm",q:2,p:true},{n:"Bandage élastique 20cm",q:2,p:true},{n:"Rouleau de sparadrap 2cm",q:2}]},
{id:"B",label:"Étagère B",items:[{n:"Bandage triangulaire + épingle",q:4},{n:"Couverture Isotherme",q:5},{n:"Esculape",q:1},{n:"Kit pansement autocollant",q:1},{n:"Bandage élastique 5 ou 7cm",q:5,p:true},{n:"Bandage élastique 10cm",q:5,p:true},{n:"Champ stérile 90x71",q:4,p:true},{n:"Bande pansement autocollant",q:1}]},
{id:"C",label:"Étagère C",items:[{n:"Set de pansement",q:1,p:true},{n:"Rouleau Urgoderme",q:1},{n:"Bouchon fermeture robinet 3 voies",q:1,p:true},{n:"Solution désinfectante Hibidil®",q:10,p:true},{n:"Sérum physiologique unidose",q:10,p:true},{n:"Bétadine® dermique 10%",q:5,p:true},{n:"Cold Pack",q:5}]},
{id:"D",label:"Oxygénothérapie Adulte",items:[{n:"Masque O² 100% Adulte",q:1,p:true},{n:"Lunette O² Adulte",q:2,p:true},{n:"Masque aérosol Adulte",q:1,p:true},{n:"Tubulure + Raccord Biconique",q:1,p:true}]},
{id:"E",label:"Oxygénothérapie Enfant",items:[{n:"Masque O² 100% Enfant",q:1,p:true},{n:"Lunette O² Enfant",q:2,p:true},{n:"Masque aérosol Enfant",q:1,p:true}]},
{id:"F",label:"Divers",items:[{n:"Bassin réniforme UU",q:10},{n:"Sac vomitoire",q:5},{n:"Sac récupérateur de mucosité",q:1},{n:"Tubulure aspirateur de mucosité",q:1},{n:"Bouteille d'eau potable 50cl",q:6,p:true}]},
]},
{id:2,label:"Oxygénothérapie — Ballons",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Ballon REA adulte complet UU",q:1,p:true},{n:"Filtre antibactérien ballon REA",q:1,p:true},{n:"Set de 9 canules de T000 à T6",q:1}]}]},
{id:3,label:"Electrode DEA + Divers",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Electrode DEA réserve",q:1,p:true}]}]},
{id:4,label:"Kits: Linge brancard / Padding",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Kit de linge brancard",q:3},{n:"Kit Padding",q:1},{n:"Oreiller de réserve (lavable)",q:1}]}]},
{id:5,label:"Pochette paramétrage",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},{n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},{n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},{n:"Glucomètre",q:1,t:true},{n:"Lancette",q:10},{n:"Tigette",q:10,p:true},{n:"Compresse 5x5cm",q:2,p:true},{n:"Pile AA / AAA",q:8},{n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1},{n:"Détecteur CO",q:1,p:true}]}]},
{id:9,label:"Kits: Burning",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Kit Burning",q:1,s:true,p:true}]}]},
{id:10,label:"Set de perfusions",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Poche Sérum Physiologique 500ml",q:4,p:true},{n:"Trousse à perfusion",q:2,p:true},{n:"Cathéter 16G",q:2,p:true},{n:"Cathéter 18G",q:2,p:true},{n:"Cathéter 20G",q:2,p:true},{n:"Cathéter 22G",q:2,p:true},{n:"Tégaderme",q:2,p:true},{n:"Garrot",q:1},{n:"Gants stériles 6,5",q:2,p:true},{n:"Gants stériles 7,5",q:2,p:true},{n:"Gants stériles 8,5",q:2,p:true}]}]},
{id:13,label:"Hygiène",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Spray désinfectant surface",q:2,p:true},{n:"Spray désodorisant citron",q:1},{n:"Rouleau sac poubelle ambulance",q:1},{n:"Sac à linge blanc",q:2},{n:"Sac à linge jaune",q:2},{n:"Alèze UU",q:3},{n:"Lange adulte",q:3},{n:"Paquet de lingette désinfectante",q:1,p:true},{n:"Microfibres",q:4},{n:"Mouchoir UU (boite)",q:1},{n:"Blouse d'opéré",q:1}]}]},
{id:15,label:"Aspirateur de mucosité",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Aspirateur de mucosité",q:1,t:true}]}]},
{id:16,label:"Sac: KATA et Pédiatrique",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Sac KATA (Rouge)",q:1,s:true,p:true},{n:"Sac Pédia./Accou.(bleu)",q:1,s:true,p:true}]}]},
{id:17,label:"Matelas à dépression",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Matelas à dépression",q:1,t:true},{n:"Pompe pour matelas",q:1}]}]},
{id:18,label:"RDOH / Kit protection / Speed Block",color:"#dc2626",shelves:[
{id:"A",label:"RDOH",items:[{n:"Pane",q:1},{n:"Urinal",q:1}]},
{id:"B",label:"Kit de protection individuelle",items:[{n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},{n:"Charlotte",q:2},{n:"Masque chirurgical",q:5},{n:"Masque KN95 / FFP3",q:5}]},
{id:"C",label:"Kit Speed Block",items:[{n:"Kit Speed Block",q:1}]},
]},
{id:19,label:"Oxygène",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Bouteille O² 10L",q:1,bar:true},{n:"Bouteille O² 10L (2)",q:1,bar:true},{n:"Bouteille O² 2L",q:1,bar:true}]}]},
{id:20,label:"Cabine sanitaire",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},{n:"Gel hydroalcoolique",q:1,p:true},{n:"Sonde d'aspiration CH 6 ou 8",q:3,p:true},{n:"Sonde d'aspiration CH 10 ou 12",q:2,p:true},{n:"Sonde d'aspiration CH 14 ou 16",q:2,p:true},{n:"Appareil multi paramétrage",q:1,t:true},{n:"Tarif ATNUP",q:1},{n:"Couverture anti feu",q:1},{n:"Planche d'Olivier + base Speed Block",q:1},{n:"Collier cervical adulte",q:1},{n:"Collier cervical pédiatrique",q:1},{n:"Gant nitrile taille S (boite)",q:1},{n:"Gant nitrile taille M (boite)",q:1},{n:"Gant nitrile taille L (boite)",q:1},{n:"Gant nitrile taille XL (boite)",q:1},{n:"Container à aiguille",q:1},{n:"Tensiomètre mural",q:1},{n:"Ciseau multifonctions d'urgence",q:1},{n:"Sac Intervention + DEA",q:1,t:true,p:true}]}]},
{id:21,label:"Porte Ext. Arrière — Traumatologie",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Scoop",q:1,t:true},{n:"Chaise d'évacuation",q:1,t:true},{n:"Sac d'atèle",q:1},{n:"Atèle grande",q:1,t:true},{n:"Atèle moyenne",q:1,t:true},{n:"Atèle petite",q:1,t:true},{n:"Pompe (pour atèle)",q:1,t:true},{n:"Bouteille O² 2L",q:1,bar:true},{n:"Sangle araignée",q:1},{n:"KED",q:1,t:true},{n:"Marche pieds",q:1,t:true},{n:"Extincteur 6Kg",q:1,p:true},{n:"Corde semi statique",q:1},{n:"Pelle pliable (US)",q:1},{n:"Gant de sécurité",q:1},{n:"Pied de biche",q:1}]}]},
{id:22,label:"Cabine chauffeur",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Casque",q:2},{n:"Lampe pour casque",q:2,t:true},{n:"Coupe ceinture",q:1},{n:"Brise vitre",q:1},{n:"Carte routière Hainaut",q:1},{n:"Carte ADR",q:1}]}]},
]},
"ALPHA 3":{edition:"07/2025",norme:"112/ATNUP",sections:[
{id:1,label:"Soin et Oxygénothérapie",color:"#dc2626",shelves:[
{id:"A",label:"Étagère A",items:[{n:"Set de pansement",q:1,p:true},{n:"Rouleau de sparadrap",q:2},{n:"Couverture Isotherme",q:5},{n:"Bandage triangulaire + épingle",q:4},{n:"Compresse 5x5cm",q:10,p:true},{n:"Compresse 7,5x7,5cm",q:10,p:true},{n:"Compresse 10x10cm",q:10,p:true},{n:"Compresse absorbante 20x10cm",q:5,p:true},{n:"Bandage élastique 5 ou 7cm",q:5,p:true}]},
{id:"B",label:"Étagère B",items:[{n:"Bandage élastique 10cm",q:5,p:true},{n:"Bandage élastique 15cm ou 20cm",q:5},{n:"Rouleau Urgoderme",q:1},{n:"Solution désinfectante Hibidil®",q:10,p:true},{n:"Sérum physiologique unidose",q:10,p:true},{n:"Iso-Bétadine® dermique 10%",q:5,p:true},{n:"Champ stérile 90x69",q:4,p:true},{n:"Kit pansement autocollant",q:1},{n:"Bande pansement autocollant",q:1}]},
{id:"C",label:"Oxygénothérapie Adulte",items:[{n:"Masque O² 100% Adulte",q:1,p:true},{n:"Lunette O² Adulte",q:2,p:true},{n:"Masque aérosol Adulte",q:1,p:true},{n:"Tubulure + Raccord Biconique",q:1,p:true}]},
{id:"D",label:"Oxygénothérapie Enfant",items:[{n:"Masque O² 100% Enfant",q:1,p:true},{n:"Lunette O² Enfant",q:2,p:true},{n:"Masque aérosol Enfant",q:1,p:true},{n:"Bouchon fermeture robinet 3 voies",q:3,p:true},{n:"Bassin réniforme UU",q:10},{n:"Sac vomitoire",q:5},{n:"Container à aiguille",q:1}]},
{id:"E",label:"Ballons REA",items:[{n:"Ballon REA adulte complet UU",q:1,p:true},{n:"Masque pour ballon N°4",q:1,p:true},{n:"Masque pour ballon N°5",q:1,p:true},{n:"Filtre antibactérien ballon REA",q:1,p:true},{n:"Set de 9 canules de T000 à T5",q:1}]},
{id:"F",label:"Divers",items:[{n:"Sac récupérateur de mucosité",q:1},{n:"Tubulure aspirateur de mucosité",q:1},{n:"Cool Pack",q:5}]},
]},
{id:2,label:"Divers",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Manchette à pression",q:1},{n:"Bouteille d'eau potable 50cl",q:6,p:true}]}]},
{id:3,label:"Pochette paramétrage",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},{n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},{n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},{n:"Glucomètre",q:1,t:true},{n:"Lancette",q:10},{n:"Tigettes",q:10,p:true},{n:"Compresse 5x5cm",q:2,p:true},{n:"Pile AA / AAA",q:8},{n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1},{n:"Détecteur CO",q:1,p:true}]}]},
{id:4,label:"Set de perfusions",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Poche Sérum Physiologique 500ml",q:4,p:true},{n:"Trousse à perfusion",q:2,p:true},{n:"Cathéter 16G",q:2,p:true},{n:"Cathéter 18G",q:2,p:true},{n:"Cathéter 20G",q:2,p:true},{n:"Cathéter 22G",q:2,p:true},{n:"Tégaderme",q:2,p:true},{n:"Garrot",q:1},{n:"Gants stériles 6,5",q:2,p:true},{n:"Gants stériles 7,5",q:2,p:true},{n:"Gants stériles 8,5",q:2,p:true}]}]},
{id:5,label:"Kit de protection individuelle",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},{n:"Charlotte",q:2},{n:"Masque chirurgical",q:5},{n:"Masque KN95 / FFP2",q:5}]}]},
{id:6,label:"Kits Burning",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Kit Burning",q:1,s:true,p:true}]}]},
{id:"7-8",label:"Kits: Linge brancard / Padding",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Kit de linge brancard",q:3},{n:"Kit Padding",q:1}]}]},
{id:11,label:"Sac KATA / Oreiller",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Oreiller lavable",q:1},{n:"Sac KATA",q:1,s:true,p:true}]}]},
{id:12,label:"Gant nitrile / Mouchoir UU",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Gant nitrile taille S (boite)",q:1},{n:"Gant nitrile taille M (boite)",q:1},{n:"Gant nitrile taille L (boite)",q:1},{n:"Gant nitrile taille XL (boite)",q:1},{n:"Mouchoir UU (boite)",q:1}]}]},
{id:13,label:"Kit COVID Colliers cervicaux",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Kit COVID",q:1},{n:"Collier cervical adulte",q:1},{n:"Collier cervical pédiatrique",q:1}]}]},
{id:14,label:"Sac Intervention + DEA / Pédiatrique",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Sac d'Intervention",q:1,s:true,p:true},{n:"DEA + Electrode",q:1,t:true,p:true},{n:"Electrode de réserve",q:1,p:true},{n:"Sac Pédiatrique",q:2,s:true,p:true}]}]},
{id:15,label:"Hygiène",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Spray désinfectant surface",q:2,p:true},{n:"Spray désodorisant citron",q:2},{n:"Rouleau sac poubelle ambulance",q:1},{n:"Sac à linge blanc",q:2},{n:"Sac à linge jaune",q:2},{n:"Alèze UU",q:3},{n:"Lange adulte",q:3},{n:"Paquet de lingette désinfectante",q:1,p:true},{n:"Microfibres",q:4}]}]},
{id:16,label:"RDOH",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Pane",q:1},{n:"Urinal",q:1}]}]},
{id:17,label:"Oxygène",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Bouteille O² 10L",q:1,bar:true},{n:"Bouteille O² 10L (2)",q:1,bar:true},{n:"Bouteille O² 2L",q:1,bar:true}]}]},
{id:18,label:"Cabine sanitaire",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},{n:"Gel hydroalcoolique",q:1,p:true},{n:"Sonde d'aspiration CH 8",q:3,p:true},{n:"Sonde d'aspiration CH 12",q:3,p:true},{n:"Sonde d'aspiration CH 14",q:3,p:true},{n:"Aspirateur de mucosité",q:1,t:true},{n:"Appareil multi paramétrage",q:1,t:true},{n:"Tarif TMS",q:1},{n:"Couverture anti feu",q:1}]}]},
{id:19,label:"Porte Ext. — Traumatologie",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Matelas à dépression",q:1,t:true},{n:"Pompe pour matelas",q:1},{n:"Scoop",q:1,t:true},{n:"Planche d'Olivier",q:1},{n:"Chaise d'évacuation",q:1,t:true},{n:"KED",q:1},{n:"Speed block complet",q:1},{n:"Sac d'atèle",q:1},{n:"Atèle grande",q:1,t:true},{n:"Atèle moyenne",q:1,t:true},{n:"Atèle petite",q:1,t:true},{n:"Pompe (pour atèle)",q:1,t:true},{n:"Sangle araignée",q:1},{n:"Marche pieds",q:1,t:true}]}]},
{id:20,label:"Porte Ext. Avant — Matériels divers",color:"#1d4ed8",shelves:[
{id:"A",label:"Planche A",items:[{n:"Corde semi statique",q:1},{n:"Pelle pliable (US)",q:1},{n:"Casque",q:2},{n:"Lampe pour casque",q:2,t:true},{n:"Gant de sécurité",q:1},{n:"Pied de biche",q:1}]},
{id:"C",label:"Planche C + Extincteur",items:[{n:"Extincteur 6Kg",q:1,p:true},{n:"Bouteille O² 2L",q:1,bar:true}]},
]},
{id:"CC",label:"Cabine chauffeur",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Lampe de présignalisation",q:2,t:true},{n:"Coupe ceinture / Brise glace",q:1}]}]},
]},
"ALPHA 4":{edition:"09/2025",norme:"112/ATNUP",sections:[
{id:1,label:"Soin",color:"#dc2626",shelves:[
{id:"A",label:"Étagère A",items:[{n:"Bandage triangulaire + épingle",q:4},{n:"Couverture Isotherme",q:5},{n:"Esculape",q:1},{n:"Rouleau Urgoderme",q:1},{n:"Rouleau de sparadrap 2cm",q:2},{n:"Solution désinfectante Hibidil®",q:10,p:true},{n:"Sérum physiologique unidose",q:10,p:true},{n:"Iso-Bétadine® dermique 10%",q:5,p:true},{n:"Cold Pack",q:5},{n:"Kit pansement autocollant",q:1}]},
{id:"B",label:"Étagère B",items:[{n:"Compresse 10x10cm",q:10,p:true},{n:"Compresse absorbante 20x10cm",q:5,p:true},{n:"Compresse 5x5cm",q:10,p:true},{n:"Compresse 7,5x7,5cm",q:10,p:true},{n:"Bandage élastique 5 ou 7cm",q:5,p:true},{n:"Bandage élastique 10cm",q:5,p:true}]},
{id:"C",label:"Étagère C",items:[{n:"Bandage élastique 15cm",q:2,p:true},{n:"Bandage élastique 20cm",q:2,p:true},{n:"Champ stérile 75x90cm",q:4,p:true}]},
]},
{id:2,label:"Oxygénothérapie",color:"#1d4ed8",shelves:[
{id:"A",label:"Adulte",items:[{n:"Masque O² 100% Adulte",q:1,p:true},{n:"Lunette O² Adulte",q:2,p:true},{n:"Masque aérosol Adulte",q:1,p:true},{n:"Tubulure + Raccord Biconique",q:1,p:true}]},
{id:"B",label:"Enfant",items:[{n:"Masque O² 100% Enfant",q:1,p:true},{n:"Lunette O² Enfant",q:2,p:true},{n:"Masque aérosol Enfant",q:1,p:true}]},
]},
{id:3,label:"BR, Sac vomitoir, Mouchoir UU",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Bassin réniforme UU",q:10},{n:"Sac vomitoire",q:5},{n:"Mouchoir UU (boite)",q:1}]}]},
{id:4,label:"Bouteille eau",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Bouteille d'eau potable 50cl",q:6,p:true}]}]},
{id:5,label:"Kit paramétrage / Kit Burning",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},{n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},{n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},{n:"Glucomètre",q:1,t:true},{n:"Lancette",q:10},{n:"Tigette",q:2,p:true},{n:"Compresse 5x5cm",q:2,p:true},{n:"Pile AA / AAA",q:8},{n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1},{n:"Kit Burning",q:1,s:true,p:true}]}]},
{id:7,label:"Kits Padding / Divers",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Kit Padding",q:1},{n:"Spray désinfectant surface",q:2,p:true},{n:"Oreiller de réserve (lavable)",q:1},{n:"Blouse d'opéré",q:1}]}]},
{id:8,label:"Set de perfusions",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Poche Sérum Physiologique 500ml",q:4,p:true},{n:"Trousse à perfusion",q:2,p:true},{n:"Cathéter 16G",q:2,p:true},{n:"Cathéter 18G",q:2,p:true},{n:"Cathéter 20G",q:2,p:true},{n:"Cathéter 22G",q:2,p:true},{n:"Tégaderme",q:2,p:true},{n:"Garrot",q:1},{n:"Gants stériles 6,5",q:2,p:true},{n:"Gants stériles 7,5",q:2,p:true},{n:"Gants stériles 8,5",q:2,p:true},{n:"Bouchon robinet 3 voies",q:3,p:true}]}]},
{id:9,label:"Kits: Linge brancard / Jeu d'Atèle",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Kit de linge brancard",q:3},{n:"Sac d'atèle",q:1},{n:"Atèle grande",q:1,t:true},{n:"Atèle moyenne",q:1,t:true},{n:"Atèle petite",q:1,t:true},{n:"Pompe (pour atèle)",q:1,t:true}]}]},
{id:10,label:"Hygiène",color:"#dc2626",shelves:[
{id:"A",label:"Étagère A",items:[{n:"Spray désodorisant citron",q:1},{n:"Rouleau sac poubelle ambulance",q:1},{n:"Sac à linge blanc",q:2},{n:"Sac à linge jaune",q:2},{n:"Alèze UU",q:3},{n:"Lange adulte",q:3},{n:"Paquet de lingette désinfectante",q:1,p:true},{n:"Microfibres",q:4}]},
{id:"B",label:"Étagère B",items:[{n:"Ballon REA adulte complet UU",q:1,p:true},{n:"Masque ballon N°4",q:1,p:true},{n:"Masque ballon N°5",q:1,p:true},{n:"Filtre antibactérien ballon REA",q:1,p:true},{n:"Set de 8 canules de T000 à T5",q:1},{n:"Sac récupérateur de mucosité",q:1},{n:"Tubulure aspirateur de mucosité",q:1}]},
]},
{id:11,label:"Kit de protection individuel",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},{n:"Charlotte",q:2},{n:"Masque chirurgical",q:5},{n:"Masque KN95 / FFP3",q:5}]}]},
{id:12,label:"Matelas à dépression",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Matelas à dépression",q:1,t:true},{n:"Pompe pour matelas",q:1}]}]},
{id:13,label:"RDOH",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Pane",q:1},{n:"Urinal",q:1}]}]},
{id:14,label:"Sac Intervention",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Sac Intervention",q:1,p:true},{n:"DEA + Electrodes",q:1,t:true,p:true},{n:"Electrodes de réserve",q:1,p:true},{n:"Détecteur CO",q:1,p:true},{n:"Ciseau multifonction d'URGENCE",q:1}]}]},
{id:15,label:"Sac: KATA et Pédiatrique",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Sac KATA (rouge)",q:1,s:true,p:true},{n:"Sac Pédia./Accou.(bleu)",q:1,s:true,p:true}]}]},
{id:16,label:"Scoop",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Scoop + 3 sangles velcro",q:1,t:true}]}]},
{id:17,label:"Porte Ext. Traumatologie / O²",color:"#1d4ed8",shelves:[
{id:"A",label:"Étagère A",items:[{n:"Planche d'Olivier",q:1},{n:"Chaise d'évacuation",q:1,t:true},{n:"Extincteur 6kg",q:1,t:true},{n:"Sangle araignée",q:1},{n:"KED",q:1,t:true}]},
{id:"B",label:"Étagère B",items:[{n:"Corde semi statique",q:1},{n:"Pelle pliable (US)",q:1},{n:"Pied de sécurité",q:1},{n:"Casque",q:2},{n:"Lampe pour casque",q:2,t:true},{n:"Kit Speed Block",q:1,t:true},{n:"Bouteille O² 10L",q:1,bar:true},{n:"Bouteille O² 10L (2)",q:1,bar:true},{n:"Bouteille O² 2L",q:1,bar:true},{n:"Marche pieds",q:1,t:true}]},
]},
{id:18,label:"Cabine sanitaire",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},{n:"Gel hydroalcoolique",q:1,p:true},{n:"Sonde d'aspiration CH 8",q:3,p:true},{n:"Sonde d'aspiration CH 12",q:3,p:true},{n:"Sonde d'aspiration CH 14",q:3,p:true},{n:"Appareil multi paramétrage",q:1,t:true},{n:"Aspirateur de mucosité",q:1,t:true},{n:"Gant nitrile taille S (boite)",q:1},{n:"Gant nitrile taille M (boite)",q:1},{n:"Gant nitrile taille L (boite)",q:1},{n:"Gant nitrile taille XL (boite)",q:1},{n:"Container à aiguille",q:1},{n:"Poubelle",q:1},{n:"Tarif ATNUP",q:1},{n:"Couverture anti feu",q:1},{n:"Bouteille O² 2L",q:1,bar:true}]}]},
{id:19,label:"Cabine chauffeur",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Lampe de présignalisation",q:2,t:true},{n:"Coupe ceinture",q:1},{n:"Brise vitre",q:1},{n:"Carte routière Hainaut",q:1},{n:"Carte ADR",q:1}]}]},
]},
"ALPHA 5":{edition:"09/2025",norme:"112/ATNUP",sections:[
{id:1,label:"Container à aiguille",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Container à aiguille",q:1}]}]},
{id:2,label:"Bouteilles d'eau potable",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Bouteille d'eau potable 50cl",q:6,p:true}]}]},
{id:4,label:"Kits de linge brancard",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Kit de linge brancard",q:3}]}]},
{id:6,label:"Appareil multi paramétrage",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Appareil multi paramétrage",q:1,t:true}]}]},
{id:9,label:"Soin",color:"#1d4ed8",shelves:[{id:"A",label:"Étagère A",items:[{n:"Solution désinfectante Hibidil®",q:10,p:true},{n:"Sérum physiologique unidose",q:10,p:true},{n:"Iso-Bétadine® dermique 10%",q:5,p:true},{n:"Compresse 5x5cm",q:10,p:true},{n:"Compresse 7,5x7,5cm",q:10,p:true},{n:"Compresse 10x10cm",q:10,p:true},{n:"Esculape",q:1},{n:"Rouleau Urgoderme",q:1},{n:"Rouleau de sparadrap 2cm",q:2},{n:"Bandage élastique 5cm",q:5,p:true},{n:"Bandage élastique 7cm",q:5,p:true},{n:"Bandage élastique 10cm",q:5,p:true},{n:"Bandage élastique 15cm",q:4,p:true},{n:"Bandage triangulaire + épingle",q:4},{n:"Couverture Isotherme",q:5},{n:"Sac vomitoir",q:5},{n:"Cold Pack",q:5},{n:"Kit pansement autocollant",q:1},{n:"Compresse absorbante 20x10cm",q:5,p:true},{n:"Champ stérile 40x45cm",q:4,p:true}]}]},
{id:10,label:"Oxygénothérapie / Ballons",color:"#dc2626",shelves:[
{id:"A",label:"Adulte",items:[{n:"Masque O² 100% Adulte",q:1,p:true},{n:"Lunette O² Adulte",q:2,p:true},{n:"Masque aérosol Adulte",q:1,p:true},{n:"Tubulure + Raccord Biconique",q:1,p:true}]},
{id:"B",label:"Enfant",items:[{n:"Masque O² 100% Enfant",q:1,p:true},{n:"Lunette O² Enfant",q:2,p:true},{n:"Masque aérosol Enfant",q:1,p:true}]},
{id:"C",label:"Ballons REA",items:[{n:"Ballon REA adulte complet UU",q:1,p:true},{n:"Masque REA N°4 Rouge",q:1,p:true},{n:"Masque REA N°5 Bleu",q:1,p:true},{n:"Filtre antibactérien ballon REA",q:1,p:true},{n:"Set de 8 canules de T000 à T5",q:1}]},
]},
{id:11,label:"Set de perfusions",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Poche Sérum Physiologique 500ml",q:4,p:true},{n:"Trousse à perfusion",q:2,p:true},{n:"Cathéter 16G",q:2,p:true},{n:"Cathéter 18G",q:2,p:true},{n:"Cathéter 20G",q:2,p:true},{n:"Cathéter 22G",q:2,p:true},{n:"Tégaderme",q:2,p:true},{n:"Garrot",q:1},{n:"Gants stériles 6,5",q:2,p:true},{n:"Gants stériles 7,5",q:2,p:true},{n:"Gants stériles 8,5",q:2,p:true},{n:"Bouchon robinet 3 voies",q:4}]}]},
{id:12,label:"Kit padding",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Kit Padding 3 pièces",q:1}]}]},
{id:13,label:"Divers",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Bassin réniforme UU",q:10},{n:"Sac récupérateur de mucosité",q:1},{n:"Tubulure aspirateur de mucosité",q:1}]}]},
{id:14,label:"Kit d'atèles / Pochette paramétrage",color:"#dc2626",shelves:[
{id:"A",label:"Atèles",items:[{n:"Sac d'attelle + pompe",q:1},{n:"Attelle grande",q:1,t:true},{n:"Attelle moyenne",q:1,t:true},{n:"Attelle petite",q:1,t:true}]},
{id:"B",label:"Paramétrage",items:[{n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},{n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},{n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},{n:"Glucomètre",q:1,t:true},{n:"Lancette",q:5},{n:"Tigette minimum",q:10,p:true},{n:"Compresse 5x5cm",q:2,p:true},{n:"Sérum physiologique unidose",q:1,p:true},{n:"Pile AA / AAA",q:8},{n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1}]},
]},
{id:16,label:"Hygiène",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Spray désinfectant surface",q:2,p:true},{n:"Paquet de lingette désinfectante",q:1,p:true},{n:"Spray désodorisant citron",q:1},{n:"Rouleau sac poubelle ambulance",q:2},{n:"Sac à linge blanc",q:2},{n:"Sac à linge jaune",q:2},{n:"Alèze UU",q:4},{n:"Lange adulte",q:3},{n:"Microfibres",q:4},{n:"Mouchoir UU (boite)",q:1},{n:"Blouse d'opéré",q:1}]}]},
{id:17,label:"Kit de protection individuel",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},{n:"Charlotte",q:2},{n:"Masque chirurgical",q:5},{n:"Masque KN95 / FFP3",q:5}]}]},
{id:18,label:"RDOH",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Pane + 2 sacs récupérateurs UU",q:1},{n:"Urinal + 2 sacs récupérateurs UU",q:1},{n:"Oreiller de réserve (lavable)",q:1}]}]},
{id:19,label:"Cabine sanitaire",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},{n:"Gel hydroalcoolique",q:2,p:true},{n:"Sonde d'aspiration CH 8",q:3,p:true},{n:"Sonde d'aspiration CH 12",q:3,p:true},{n:"Sonde d'aspiration CH 14",q:3,p:true},{n:"Aspirateur de mucosité",q:1,t:true},{n:"Gant nitrile taille S (boite)",q:1},{n:"Gant nitrile taille M (boite)",q:1},{n:"Gant nitrile taille L (boite)",q:1},{n:"Gant nitrile taille XL (boite)",q:1},{n:"Tarif ATNUP",q:1},{n:"Couverture anti feu",q:1},{n:"Brise vitre et coupe ceinture",q:1},{n:"Ciseau multifonction d'URGENCE",q:1},{n:"Sac Intervention",q:1,s:true,p:true},{n:"DEA + Electrodes",q:1,t:true,p:true},{n:"Electrodes de réserve",q:1,p:true},{n:"Détecteur CO",q:1,p:true}]}]},
{id:20,label:"Face arrière portes ouvertes",color:"#1d4ed8",shelves:[
{id:"B",label:"",items:[{n:"Chaise d'évacuation",q:1,t:true}]},
{id:"C",label:"",items:[{n:"Sac Pédia. / Accou. (bleu)",q:1,s:true,p:true}]},
{id:"E",label:"",items:[{n:"Sac KATA (rouge)",q:1,s:true,p:true}]},
{id:"F",label:"",items:[{n:"Bouteille O² 2L",q:1,bar:true},{n:"Bouteille O² 2L (2)",q:1,bar:true}]},
]},
{id:21,label:"Porte Ext. Traumatologie / O²",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Scoop + 3 sangles velcro",q:1},{n:"Planche d'Olivier",q:1},{n:"KED",q:1,t:true},{n:"Matelas à dépression",q:1,t:true},{n:"Pompe pour matelas",q:1,t:true},{n:"Sangle araignée",q:1},{n:"Corde semi statique",q:1},{n:"Pelle pliable (US)",q:1},{n:"Gant de sécurité",q:1},{n:"Pied de biche",q:1},{n:"Kit HEAD Block",q:1},{n:"Bouteille O² 5L",q:1,bar:true},{n:"Bouteille O² 5L (2)",q:1,bar:true},{n:"Extincteur 6Kg",q:1,p:true},{n:"Marche pieds",q:1,t:true},{n:"Planche de transfert Rollbord®",q:1}]}]},
{id:22,label:"Cabine chauffeur",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Casque",q:2},{n:"Lampe pour casque",q:2,t:true},{n:"Lampe de présignalisation",q:2,t:true},{n:"Brise vitre / Coupe ceinture",q:1},{n:"Carte routière Hainaut",q:1},{n:"Carte ADR",q:1}]}]},
]},
"ALPHA 6":{edition:"09/2025",norme:"112/ATNUP",sections:[
{id:2,label:"Soins et Oxygénothérapie",color:"#1d4ed8",shelves:[
{id:"A",label:"Étagère A",items:[{n:"Bandage élastique 5cm",q:5,p:true},{n:"Bandage élastique 7cm",q:5,p:true},{n:"Bandage élastique 10cm",q:5,p:true},{n:"Bandage élastique 15cm",q:5,p:true},{n:"Bandage élastique 20cm",q:2,p:true},{n:"Cold Pack",q:5},{n:"Pansement autocollant",q:1}]},
{id:"B",label:"Étagère B",items:[{n:"Solution désinfectante Hibidil®",q:10,p:true},{n:"Sérum physiologique unidose",q:10,p:true},{n:"Iso-Bétadine® dermique 10%",q:5,p:true},{n:"Compresse 5x5cm",q:10,p:true},{n:"Compresse 7,5x7,5cm",q:10,p:true},{n:"Compresse 10x10cm",q:10,p:true},{n:"Esculape",q:1},{n:"Compresse absorbante 20x10cm",q:5,p:true},{n:"Rouleau Urgoderme",q:1},{n:"Rouleau de sparadrap 2cm",q:2},{n:"Bandage triangulaire + épingle",q:4},{n:"Couverture Isotherme",q:5}]},
{id:"C",label:"Étagère C",items:[{n:"Bassin réniforme UU",q:10},{n:"Sac vomitoire",q:5},{n:"Champ stérile 75x90cm",q:4,p:true}]},
{id:"D",label:"Oxygénothérapie Adulte",items:[{n:"Masque O² 100% Adulte",q:1,p:true},{n:"Lunette O² Adulte",q:2,p:true},{n:"Masque aérosol Adulte",q:1,p:true},{n:"Tubulure + Raccord Biconique",q:1,p:true}]},
{id:"EE",label:"Oxygénothérapie Enfant + Ballons REA",items:[{n:"Masque O² 100% Enfant",q:1,p:true},{n:"Lunette O² Enfant",q:2,p:true},{n:"Masque aérosol Enfant",q:1,p:true},{n:"Ballon REA adulte complet UU",q:1,p:true},{n:"Masque REA N°4 rouge",q:1,p:true},{n:"Masque REA N°5 bleu",q:1,p:true},{n:"Filtre antibactérien ballon REA",q:1,p:true}]},
{id:"F",label:"Étagère F",items:[{n:"Bouteille d'eau potable 50cl",q:6,p:true},{n:"Sac récupérateur de mucosité",q:1},{n:"Tubulure aspirateur de mucosité",q:1}]},
]},
{id:3,label:"Kits de linge brancard / Padding",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Kit de linge brancard",q:3},{n:"Kit Padding 3 pièces",q:1},{n:"Oreiller de réserve (lavable)",q:1}]}]},
{id:4,label:"Kit paramétrage",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},{n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},{n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},{n:"Glucomètre",q:1,t:true},{n:"Lancette",q:10},{n:"Tigette",q:10,p:true},{n:"Compresse 5x5cm",q:2,p:true},{n:"Sérum physiologique unidose",q:1,p:true},{n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1},{n:"Pile AA / AAA",q:8}]}]},
{id:5,label:"Set de perfusions",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Poche Sérum Physiologique 500ml",q:4,p:true},{n:"Trousse à perfusion",q:2,p:true},{n:"Cathéter 16G",q:2,p:true},{n:"Cathéter 18G",q:2,p:true},{n:"Cathéter 20G",q:2,p:true},{n:"Cathéter 22G",q:2,p:true},{n:"Tégaderme",q:2,p:true},{n:"Garrot",q:1},{n:"Gants stériles 6,5 ou S",q:2,p:true},{n:"Gants stériles 7,5 ou M",q:2,p:true},{n:"Gants stériles 8,5 ou L",q:2,p:true},{n:"Bouchon robinet 3 voies",q:3,p:true}]}]},
{id:6,label:"Kit de protection individuelle",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},{n:"Charlotte",q:2},{n:"Masque chirurgical",q:5},{n:"Masque KN95 / FFP3",q:5}]}]},
{id:7,label:"Kit Burning",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Kit Burning",q:1,s:true,p:true}]}]},
{id:8,label:"RDOH",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Pane + 2 sacs UU",q:1},{n:"Urinal + 2 sacs UU",q:1}]}]},
{id:9,label:"Hygiène",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Spray désodorisant citron",q:1},{n:"Rouleau sac poubelle ambulance",q:1},{n:"Sac à linge blanc",q:2},{n:"Sac à linge jaune",q:2},{n:"Alèze UU",q:3},{n:"Lange adulte",q:3},{n:"Paquet de lingette désinfectante",q:1,p:true},{n:"Microfibres",q:4},{n:"Spray désinfectant surface",q:2,p:true},{n:"Blouse d'opéré",q:1}]}]},
{id:13,label:"Gant nitrile / Mouchoir UU",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Gant nitrile taille S (boite)",q:1},{n:"Gant nitrile taille M (boite)",q:1},{n:"Gant nitrile taille L (boite)",q:1},{n:"Gant nitrile taille XL (boite)",q:1},{n:"Mouchoir UU (boite)",q:1}]}]},
{id:15,label:"Sac Pédia. / Accou.",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Sac Pédia./Accou.(bleu)",q:1,s:true,p:true}]}]},
{id:16,label:"Sac Intervention + DEA / Sac KATA",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Sac Intervention",q:1,s:true,p:true},{n:"Détecteur CO",q:1,p:true},{n:"DEA + Electrodes",q:1,t:true,p:true},{n:"Electrodes de réserve",q:1,p:true},{n:"Ciseau multifonction d'URGENCE",q:1},{n:"Sac KATA (rouge)",q:1,s:true,p:true},{n:"Bouteille O² 2L",q:1,bar:true}]}]},
{id:17,label:"Cabine sanitaire",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},{n:"Gel hydroalcoolique",q:1,p:true},{n:"Sonde d'aspiration CH 8",q:3,p:true},{n:"Sonde d'aspiration CH 12",q:3,p:true},{n:"Sonde d'aspiration CH 14",q:3,p:true},{n:"Container à aiguille",q:1},{n:"Poubelle",q:1},{n:"Tarif ATNUP",q:1},{n:"Couverture anti feu",q:1},{n:"Appareil multi paramétrage",q:1,t:true},{n:"Aspirateur de mucosité",q:1,t:true}]}]},
{id:19,label:"O² / Extincteur 6Kg",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Bouteille O² 10L",q:1,bar:true},{n:"Bouteille O² 10L (2)",q:1,bar:true},{n:"Bouteille O² 2L",q:1,bar:true},{n:"Extincteur 6Kg",q:1,p:true}]}]},
{id:20,label:"Porte Ext. Traumatologie",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Chaise d'évacuation",q:1,t:true},{n:"Matelas à dépression",q:1,t:true},{n:"Pompe pour matelas",q:1},{n:"KED",q:1},{n:"Sac d'atèle",q:1},{n:"Atèle grande",q:1,t:true},{n:"Atèle moyenne",q:1,t:true},{n:"Atèle petite",q:1,t:true},{n:"Pompe (pour atèle)",q:1,t:true},{n:"Scoop + 3 sangles velcro",q:1,t:true},{n:"Pied de biche",q:1}]}]},
{id:21,label:"Porte arrière",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Planche d'Olivier",q:1}]}]},
{id:22,label:"Cabine chauffeur",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Lampe de présignalisation",q:2,t:true},{n:"Brise vitre / Coupe ceinture",q:1},{n:"Carte routière Hainaut",q:1},{n:"Carte ADR",q:1},{n:"Casque",q:2},{n:"Lampe pour casque F2",q:2,t:true}]}]},
]},
"ALPHA 7":{edition:"Nov/2025",norme:"112/ATNUP",sections:[
{id:1,label:"Oxygénothérapie / Divers",color:"#dc2626",shelves:[
{id:"A",label:"Étagère A — Ballons REA",items:[{n:"Ballon REA adulte complet UU4",q:1},{n:"Masque REA N°5",q:1},{n:"Filtre antibactérien ballon REA",q:1,p:true},{n:"Set de 8 canules de T000 à T5",q:1}]},
{id:"B",label:"Étagère B — Oxygénothérapie Adulte",items:[{n:"Masque O² 100% Adulte",q:1,p:true},{n:"Lunette O² Adulte",q:2,p:true},{n:"Masque aérosol Adulte",q:1,p:true},{n:"Tubulure + Raccord Biconique",q:1,p:true}]},
{id:"C",label:"Étagère C — Eau + Divers",items:[{n:"Bouteille d'eau potable 50cl",q:6,p:true},{n:"Sac récupérateur de mucosité",q:1},{n:"Tubulure aspirateur de mucosité",q:1}]},
{id:"D",label:"Étagère D — Oxygénothérapie Enfant",items:[{n:"Masque O² 100% Enfant",q:1,p:true},{n:"Lunette O² Enfant",q:2,p:true},{n:"Masque aérosol Enfant",q:1,p:true}]},
{id:"E",label:"Divers",items:[{n:"Bassin réniforme UU",q:10},{n:"Sac vomitoire",q:5}]},
]},
{id:2,label:"Soins",color:"#1d4ed8",shelves:[
{id:"A",label:"Étagère A",items:[{n:"Solution désinfectante Hibidil®",q:10,p:true},{n:"Sérum physiologique unidose",q:10,p:true},{n:"Iso-Bétadine® dermique 10%",q:5,p:true},{n:"Compresse 5x5cm",q:10,p:true},{n:"Compresse 7,5x7,5cm",q:10,p:true},{n:"Compresse 10x10cm",q:10,p:true},{n:"Compresse absorbante 20x10cm",q:5,p:true}]},
{id:"B",label:"Étagère B",items:[{n:"Rouleau Urgoderme",q:1},{n:"Rouleau de sparadrap 2cm",q:2},{n:"Kit pansement autocollant",q:1},{n:"Bandage élastique 5cm",q:5,p:true},{n:"Esculape",q:1},{n:"Bandage élastique 7cm",q:5,p:true},{n:"Bandage élastique 10cm",q:5,p:true}]},
{id:"C",label:"Étagère C",items:[{n:"Bandage élastique 15cm",q:2,p:true},{n:"Bandage élastique 20cm",q:2,p:true},{n:"Champ stérile 75x90cm",q:4,p:true}]},
{id:"D",label:"Étagère D",items:[{n:"Bandage triangulaire + épingle",q:4},{n:"Couverture Isotherme",q:5},{n:"Cold Pack",q:5}]},
]},
{id:3,label:"Kits de linge brancard / Padding",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Kit de linge brancard",q:3},{n:"Kit Padding 3 pièces",q:1},{n:"Oreiller de réserve (lavable)",q:1}]}]},
{id:4,label:"Kit paramétrage",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},{n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},{n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},{n:"Glucomètre",q:1,t:true},{n:"Lancette",q:10},{n:"Tigette",q:10,p:true},{n:"Compresse 5x5cm",q:2,p:true},{n:"Sérum physiologique unidose",q:1,p:true},{n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1},{n:"Pile AA / AAA",q:8}]}]},
{id:5,label:"Set de perfusions",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Poche Sérum Physiologique 500ml",q:4,p:true},{n:"Trousse à perfusion",q:2,p:true},{n:"Cathéter 16G",q:2,p:true},{n:"Cathéter 18G",q:2,p:true},{n:"Cathéter 20G",q:2,p:true},{n:"Cathéter 22G",q:2,p:true},{n:"Tégaderme",q:2,p:true},{n:"Garrot",q:1},{n:"Gants stériles 6,5 ou S",q:2,p:true},{n:"Gants stériles 7,5 ou M",q:2,p:true},{n:"Gants stériles 8,5 ou L",q:2,p:true},{n:"Bouchon robinet 3 voies",q:3,p:true}]}]},
{id:8,label:"Sac d'atèles",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Atèle grande",q:1,t:true},{n:"Atèle moyenne",q:1,t:true},{n:"Atèle petite",q:1,t:true},{n:"Pompe (pour atèle)",q:1,t:true}]}]},
{id:9,label:"Hygiène",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Spray désodorisant citron",q:1},{n:"Rouleau sac poubelle ambulance",q:1},{n:"Sac à linge blanc",q:2},{n:"Sac à linge jaune",q:2},{n:"Alèze UU",q:3},{n:"Lange adulte",q:3},{n:"Paquet de lingette désinfectante",q:1,p:true},{n:"Microfibres",q:1},{n:"Mouchoir UU (boite)",q:1},{n:"Blouse d'opéré",q:1},{n:"Spray désinfectant surface",q:2,p:true}]}]},
{id:10,label:"Sacs Pédia. / Accou. / KATA",color:"#1d4ed8",shelves:[
{id:"A",label:"",items:[{n:"Sac KATA (rouge)",q:1,s:true,p:true},{n:"Sac Pédia./Accou.(bleu)",q:1,s:true,p:true}]},
{id:"B",label:"Boite",items:[{n:"Corde semi statique",q:1},{n:"Pelle pliable (US)",q:1},{n:"Gant de sécurité",q:1},{n:"Sangle araignée",q:1}]},
]},
{id:11,label:"Sac Intervention / O²",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Sac Intervention avec DEA",q:1,s:true,p:true},{n:"DEA",q:1,t:true,p:true},{n:"Electrode DEA réserve",q:1,p:true},{n:"Détecteur CO",q:1,p:true},{n:"Ciseau multifonction d'URGENCE",q:1},{n:"Bouteille O² 2L",q:1,bar:true},{n:"Pied de biche",q:1}]}]},
{id:12,label:"Cabine sanitaire",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},{n:"Gel hydroalcoolique",q:1,p:true},{n:"Sonde d'aspiration CH 8",q:3,p:true},{n:"Sonde d'aspiration CH 12",q:3,p:true},{n:"Sonde d'aspiration CH 14",q:3,p:true},{n:"Appareil multi paramétrage",q:1,t:true},{n:"Aspirateur de mucosité",q:1,t:true},{n:"Gant nitrile taille S (boite)",q:1},{n:"Gant nitrile taille M (boite)",q:1},{n:"Gant nitrile taille L (boite)",q:1},{n:"Gant nitrile taille XL (boite)",q:1},{n:"Container à aiguille",q:1},{n:"Poubelle",q:1},{n:"Tarif ATNUP",q:1},{n:"Couverture anti feu",q:1},{n:"Ciseau multifonction d'URGENCE",q:1}]}]},
{id:13,label:"Kit protec. Indiv. / HEAD B-LOCK",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},{n:"Charlotte",q:2},{n:"Masque chirurgical",q:5},{n:"Masque KN95 / FFP3",q:5},{n:"HEAD B-LOCK",q:1}]}]},
{id:14,label:"RDOH / Kit Burning",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Pane + 2 sacs UU",q:1},{n:"Urinal + 2 sacs UU",q:1},{n:"Kit Burning",q:1,s:true,p:true}]}]},
{id:15,label:"O²",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Bouteille O² 2L",q:1,bar:true},{n:"Pompe à matelas à dépression",q:1}]}]},
{id:16,label:"Divers",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Matelas à dépression",q:1,t:true}]}]},
{id:17,label:"Porte Ext. Traumatologie",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Planche d'Olivier",q:1},{n:"Chaise d'évacuation",q:1,t:true},{n:"KED",q:1,t:true},{n:"Bouteille O² 5L",q:1,bar:true},{n:"Bouteille O² 5L (2)",q:1,bar:true},{n:"Extincteur 6Kg",q:1,p:true},{n:"Scoop + 3 sangles velcro",q:1,t:true},{n:"Pied de biche",q:1}]}]},
{id:18,label:"Cabine chauffeur",color:"#1d4ed8",shelves:[{id:"A",label:"",items:[{n:"Lampe de présignalisation",q:2,t:true},{n:"Brise vitre / Coupe ceinture",q:1},{n:"Carte routière Hainaut",q:1},{n:"Carte ADR",q:1},{n:"Casque F2",q:2},{n:"Lampe pour casque F2",q:2,t:true}]}]},
{id:20,label:"Couverture",color:"#dc2626",shelves:[{id:"A",label:"",items:[{n:"Couverture",q:0,okOnly:true}]}]},
]},
};

// ═══════════════════════════════════════════════
// COMPOSANT CHECKLIST GÉNÉRIQUE
// ═══════════════════════════════════════════════
// Sélecteur mois/année ultra-rapide (2 menus déroulants), remplace le
// calendrier complet — utilisé pour les dates de péremption/scellé.
function monthYearLabel(ym){
  if(!ym) return "";
  const [y,m]=ym.split("-");
  const idx=parseInt(m,10)-1;
  return (MOIS_FR[idx]||m)+" "+y;
}
function MonthYearPicker({ value, onChange, danger }){
  const now=new Date();
  const [y,m]=value?value.split("-"):["",""];
  const years=Array.from({length:8},(_,i)=>now.getFullYear()-1+i);
  const months=[["01","Jan"],["02","Fév"],["03","Mar"],["04","Avr"],["05","Mai"],["06","Jun"],["07","Jul"],["08","Aoû"],["09","Sep"],["10","Oct"],["11","Nov"],["12","Déc"]];
  const selStyle={ background:danger?CK_C.dangerSoft:CK_C.bg, border:`1px solid ${danger?CK_C.danger:CK_C.border}`, borderRadius:6, padding:"5px 6px", color:danger?CK_C.danger:CK_C.text, fontSize:11, fontWeight:danger?700:400 };
  return(
    <div style={{ display:"flex", gap:5 }}>
      <select value={m} onChange={e=>onChange(`${y||now.getFullYear()}-${e.target.value}`)} style={selStyle}>
        <option value="">Mois</option>
        {months.map(([mm,lbl])=>(<option key={mm} value={mm}>{lbl}</option>))}
      </select>
      <select value={y} onChange={e=>onChange(`${e.target.value}-${m||String(now.getMonth()+1).padStart(2,"0")}`)} style={selStyle}>
        <option value="">Année</option>
        {years.map(yy=>(<option key={yy} value={yy}>{yy}</option>))}
      </select>
    </div>
  );
}

// ═══════════════════════════════════════
// SAC TPMR/VSL — checklist mensuelle, modèle unique partagé par tous les véhicules TPMR/VSL
// ═══════════════════════════════════════
function TpmrVslChecklistView({ vehicleName, template, onBack, emails, themeMode, toggleTheme }){
  const monthKey=getChecklistMonthKey();
  const docId=`TPMRVSL_${vehicleName}_${monthKey}`;
  const [doc_, updateDoc_]=useChecklistDoc(docId, { checks:{}, amb1:"", remarks:"" });
  const checks=doc_.checks||{};
  const amb1=doc_.amb1||"";
  const remarks=doc_.remarks||"";
  const [expanded,setExpanded]=useState({ [template.sections[0]?.id]:true });
  const [submitted,setSubmitted]=useState(false);
  const [sending,setSending]=useState(false);
  const peremptionMap=usePeremptionMap();

  const isMonthExpired=(ym)=>{ if(!ym) return false; const now=new Date(); const cur=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`; return ym<=cur; };

  const setField=(key,field,value)=>updateDoc_({...doc_, checks:{...checks,[key]:{...(checks[key]||{}),[field]:value}}});

  let total=0, checkedCount=0, missingValidations=[], issues=[];
  template.sections.forEach(sec=>sec.shelves.forEach(sh=>sh.items.forEach(item=>{
    if(item.okOnly) return;
    total++;
    const key=`${sec.id}__${sh.id}__${item.n}`;
    const state=checks[key]||{};
    if(state.found!=null) checkedCount++; else missingValidations.push(item.n);
    if(item.t && state.testOk==null) missingValidations.push(item.n+" (test)");
    if(item.s && state.sealOk==null) missingValidations.push(item.n+" (scellé)");
    if(state.found===0) issues.push({ name:item.n, type:"missing", missing:item.q||1 });
    if(item.t && state.testOk===false) issues.push({ name:item.n, type:"nok_test", missing:1 });
    if(item.s && state.sealOk===false) issues.push({ name:item.n, type:"nok_seal", missing:1 });
  })));
  const progress=total>0?Math.round((checkedCount/total)*100):0;
  const hasAmbulancier=amb1.trim().length>0;
  const canSubmit=hasAmbulancier && missingValidations.length===0 && !sending;

  const sendMissingReport=async()=>{
    if(!emails||emails.length===0||issues.length===0) return;
    const lines=issues.map(iss=>`- ${iss.name} : ${iss.type==="missing"?`manque ${iss.missing}`:iss.type==="nok_test"?"test NOK":"scellé NOK"}`).join("\n");
    for(const to of emails){
      try{
        await emailjs.send("service_mrs8v2l","template_2sxsq4j",{ to_email:to, title:`Checklist ${vehicleName} — Matériel manquant`, content:`Rempli par: ${amb1}\n\n${lines}` },"Fhdx1kTE7vFmh4z07");
      }catch(e){ console.error("Erreur envoi email checklist:", e); }
    }
  };

  if(submitted){
    return(
      <div style={{ minHeight:"100vh", background:CK_C.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, color:CK_C.text, fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ fontSize:56 }}>✅</div>
        <div style={{ fontSize:18, fontWeight:800 }}>Checklist envoyée</div>
        <button onClick={onBack} style={{ background:CK_C.red, border:"none", borderRadius:10, color:"white", padding:"12px 24px", fontWeight:700, fontSize:14, cursor:"pointer" }}>Retour</button>
      </div>
    );
  }

  return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
          <div><div style={{ fontWeight:800, fontSize:16 }}>{vehicleName}</div><div style={{ fontSize:10, color:CK_C.muted, textTransform:"uppercase" }}>Sac TPMR/VSL — {monthYearLabel(monthKey)}</div></div>
        </div>
        <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{ padding:"12px 18px", background:CK_C.panel2 }}>
        <input value={amb1} onChange={e=>updateDoc_({...doc_,amb1:e.target.value})} placeholder="Nom du chauffeur" style={{ width:"100%", background:CK_C.bg, border:`1px solid ${CK_C.border}`, borderRadius:8, padding:"9px 12px", color:CK_C.text, fontSize:13, boxSizing:"border-box" }}/>
      </div>
      <div style={{ flex:1, padding:14, paddingBottom:100, overflowY:"auto" }}>
        {template.sections.length===0&&<div style={{ textAlign:"center", color:CK_C.muted, padding:40 }}>Aucun modèle défini — configure-le dans Paramètres → Checklists → Sac TPMR/VSL</div>}
        {template.sections.map(sec=>(
          <div key={sec.id} style={{ marginBottom:10 }}>
            <button onClick={()=>setExpanded(p=>({...p,[sec.id]:!p[sec.id]}))} style={{ width:"100%", background:sec.color||CK_C.red, border:"none", borderRadius:10, color:"white", padding:"11px 14px", fontWeight:800, fontSize:13, textAlign:"left", cursor:"pointer", display:"flex", justifyContent:"space-between" }}>
              <span>{sec.label}</span><span>{expanded[sec.id]?"▲":"▼"}</span>
            </button>
            {expanded[sec.id]&&sec.shelves.map(sh=>(
              <div key={sh.id} style={{ marginTop:8 }}>
                {sh.label&&<div style={{ fontSize:11, fontWeight:700, color:CK_C.muted, marginBottom:6 }}>{sh.label}</div>}
                {sh.items.map(item=>{
                  const key=`${sec.id}__${sh.id}__${item.n}`;
                  const state=checks[key]||{};
                  const centralPeremptionDate=item.p?getSoonestDate(peremptionMap[peremptionKey(vehicleName,item.n)]?.lots):"";
                  const peremptionExpired=item.p&&isMonthExpired(centralPeremptionDate);
                  return(
                    <div key={key} style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:10, padding:12, marginBottom:8 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{item.n}{item.container&&<span style={{ marginLeft:6, fontSize:9, fontWeight:700, color:CK_C.muted, background:CK_C.panel2, borderRadius:5, padding:"2px 6px" }}>CONTENU DÉTAILLÉ</span>}</div>
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={()=>setField(key,"found",1)} style={{ background:state.found===1?CK_C.success:"transparent", border:`1px solid ${state.found===1?CK_C.success:CK_C.border}`, borderRadius:7, color:state.found===1?"white":CK_C.muted, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>OK</button>
                          <button onClick={()=>setField(key,"found",0)} style={{ background:state.found===0?CK_C.danger:"transparent", border:`1px solid ${state.found===0?CK_C.danger:CK_C.border}`, borderRadius:7, color:state.found===0?"white":CK_C.muted, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>NOK</button>
                        </div>
                      </div>
                      {item.t&&(
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
                          <div style={{ fontSize:11, color:CK_C.muted }}>Test</div>
                          <div style={{ display:"flex", gap:6 }}>
                            <button onClick={()=>setField(key,"testOk",true)} style={{ background:state.testOk===true?CK_C.success:"transparent", border:`1px solid ${state.testOk===true?CK_C.success:CK_C.border}`, borderRadius:7, color:state.testOk===true?"white":CK_C.muted, padding:"4px 10px", fontSize:10, fontWeight:700, cursor:"pointer" }}>OK</button>
                            <button onClick={()=>setField(key,"testOk",false)} style={{ background:state.testOk===false?CK_C.danger:"transparent", border:`1px solid ${state.testOk===false?CK_C.danger:CK_C.border}`, borderRadius:7, color:state.testOk===false?"white":CK_C.muted, padding:"4px 10px", fontSize:10, fontWeight:700, cursor:"pointer" }}>NOK</button>
                          </div>
                        </div>
                      )}
                      {item.s&&(
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
                          <div style={{ fontSize:11, color:CK_C.muted }}>Scellé</div>
                          <div style={{ display:"flex", gap:6 }}>
                            <button onClick={()=>setField(key,"sealOk",true)} style={{ background:state.sealOk===true?CK_C.success:"transparent", border:`1px solid ${state.sealOk===true?CK_C.success:CK_C.border}`, borderRadius:7, color:state.sealOk===true?"white":CK_C.muted, padding:"4px 10px", fontSize:10, fontWeight:700, cursor:"pointer" }}>OK</button>
                            <button onClick={()=>setField(key,"sealOk",false)} style={{ background:state.sealOk===false?CK_C.danger:"transparent", border:`1px solid ${state.sealOk===false?CK_C.danger:CK_C.border}`, borderRadius:7, color:state.sealOk===false?"white":CK_C.muted, padding:"4px 10px", fontSize:10, fontWeight:700, cursor:"pointer" }}>NOK</button>
                          </div>
                        </div>
                      )}
                      {item.p&&(
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
                          <div style={{ fontSize:11, color:peremptionExpired?CK_C.danger:"#fbbf24" }}>Péremption</div>
                          <div style={{ fontSize:11, fontWeight:700, color:peremptionExpired?CK_C.danger:CK_C.text, background:CK_C.bg, border:`1px solid ${peremptionExpired?CK_C.danger:CK_C.border}`, borderRadius:7, padding:"4px 10px" }}>
                            {centralPeremptionDate?monthYearLabel(centralPeremptionDate):"Non renseignée (bureau)"}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
        <div style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:14, marginTop:6 }}>
          <div style={{ fontSize:11, fontWeight:700, color:CK_C.muted, textTransform:"uppercase", marginBottom:8 }}>📝 Remarques</div>
          <textarea value={remarks} onChange={e=>updateDoc_({...doc_,remarks:e.target.value})} placeholder="Matériel manquant, observations..." rows={3} style={{ width:"100%", background:CK_C.bg, border:`1px solid ${CK_C.border}`, borderRadius:8, padding:"10px 12px", color:CK_C.text, fontSize:13, resize:"none", boxSizing:"border-box" }}/>
        </div>
      </div>
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:CK_C.panel, borderTop:`1px solid ${CK_C.border}`, padding:"13px 16px" }}>
        {!canSubmit&&(
          <div style={{ background:CK_C.dangerSoft, border:`1px solid ${CK_C.danger}`, borderRadius:8, padding:"8px 12px", marginBottom:8, fontSize:11, color:CK_C.danger, fontWeight:600 }}>
            {!hasAmbulancier?"⚠ Indique le nom du chauffeur":`⚠ ${missingValidations.length} validation(s) manquante(s)`}
          </div>
        )}
        <button disabled={!canSubmit} onClick={async()=>{
          if(!canSubmit) return;
          setSending(true);
          await sendMissingReport();
          await saveChecklistHistorique({
            id:`${vehicleName}_${monthKey}_${Date.now()}`,
            vehicle:vehicleName, date:new Date().toLocaleDateString("fr-FR"), dateISO:new Date().toISOString(),
            amb1, amb2:"", remarks:remarks||"", complete:progress===100, timestamp:Date.now(),
            issues:issues.map(iss=>({ ...iss, remaining:iss.missing, resupplied:0 })),
          });
          setSending(false);
          setSubmitted(true);
        }} style={{ width:"100%", background:!canSubmit?CK_C.border:progress===100?CK_C.success:CK_C.accent, border:"none", borderRadius:10, color:"white", padding:"14px", fontWeight:800, fontSize:15, opacity:canSubmit?1:0.85, cursor:canSubmit?"pointer":"not-allowed" }}>
          {sending?"Envoi…":canSubmit?"✅ Envoyer au responsable":`⚠ ${!hasAmbulancier?"Chauffeur requis":missingValidations.length+" oubli(s)"}`}
        </button>
      </div>
    </div>
  );
}

function ChecklistView({ vehicleName, onBack, checklists, emails, themeMode, toggleTheme }) {
  const data = checklists[vehicleName];
  const weekKey = getChecklistWeekKey();
  const docId = `${vehicleName}_${weekKey}`;
  const [doc_, updateDoc_, loaded] = useChecklistDoc(docId, { checks:{}, amb1:"", amb2:"", semaine:"", remarks:"" });
  const checks = doc_.checks || {};
  const amb1 = doc_.amb1 || "";
  const amb2 = doc_.amb2 || "";
  const semaine = doc_.semaine || String(getChecklistWeekNumber());
  const remarks = doc_.remarks || "";
  const [expanded, setExpanded] = useState({ [data.sections[0]?.id]: true });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const peremptionMap = usePeremptionMap();

  // "YYYY-MM" <= mois actuel ? (périmé ou en cours = à considérer comme expiré)
  const isMonthExpired = (ym) => {
    if(!ym) return false;
    const now=new Date();
    const cur=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    return ym<=cur;
  };

  const gk = (sId, shId, name) => `${sId}__${shId}__${name}`;
  // Présence : si le nombre trouvé < requis, on considère l'article "NOK" et
  // on bascule automatiquement test/scellé sur NOK (impossible à vérifier
  // si l'article n'est pas là).
  const setCF = (key, found, required, item) => updateDoc_(prev=>{
    const isMissing = found!=null && found<required;
    const next = { ...prev.checks?.[key], found, required };
    if(isMissing){
      if(item?.t) next.testOk=false;
      if(item?.s) next.sealOk=false;
    }
    return { checks:{ ...prev.checks, [key]: next } };
  });
  const setC = (key, field, value) => updateDoc_(prev=>({ checks:{ ...prev.checks, [key]:{ ...prev.checks?.[key], [field]:value } } }));
  const setTest = (key, val) => updateDoc_(prev=>({ checks:{ ...prev.checks, [key]:{ ...prev.checks?.[key], testOk:val } } }));
  const setSeal = (key, val) => updateDoc_(prev=>({ checks:{ ...prev.checks, [key]:{ ...prev.checks?.[key], sealOk:val } } }));
  // Date de péremption ou de scellé : si le mois saisi est dépassé/actuel,
  // l'article passe direct en NOK au chiffre max (found=0), modifiable ensuite.
  const setDateField = (key, field, value, item) => updateDoc_(prev=>{
    const next = { ...prev.checks?.[key], [field]: value };
    if(isMonthExpired(value)){ next.found=0; next.required=item.q; }
    return { checks:{ ...prev.checks, [key]: next } };
  });
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const firstWeek = isFirstWeekOfMonth();

  // Nombre de "cases" à valider pour un article : présence (+1), test (+1 si
  // TEST), scellé (+1 si SCELLÉ), péremption (+1 si PÉREMPTION, seulement
  // pendant la 1ère semaine du mois).
  const itemSlots = (item) => {
    if(item.okOnly) return 1;
    let n=1;
    if(item.t) n++;
    if(item.s) n++;
    if(item.p && firstWeek) n++;
    return n;
  };
  const itemCheckedSlots = (item, state) => {
    if(item.okOnly) return state?.found!=null?1:0;
    let n=0;
    if(state?.found!=null) n++;
    if(item.t && state?.testOk!=null) n++;
    if(item.s && state?.sealOk!=null) n++;
    if(item.p && firstWeek && state?.date) n++;
    return n;
  };

  let totalItems=0, checkedItems=0;
  data.sections.forEach(sec=>sec.shelves.forEach(sh=>sh.items.forEach(item=>{
    const key=gk(sec.id,sh.id,item.n);
    const state=checks[key]||{};
    totalItems += itemSlots(item);
    checkedItems += itemCheckedSlots(item,state);
  })));
  const progress = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  // Toutes les validations requises pour pouvoir envoyer : présence de
  // chaque article, test/scellé (toujours), niveau bar (toujours), date de
  // péremption/scellé (1ère semaine du mois uniquement, et seulement si
  // l'article est bien présent — sinon impossible à vérifier).
  const getMissingValidations = () => {
    const missing = [];
    data.sections.forEach(sec => sec.shelves.forEach(sh => sh.items.forEach(item => {
      if (item.okOnly) return;
      const key = gk(sec.id, sh.id, item.n);
      const state = checks[key] || {};
      if (state.found == null) { missing.push(item.n + " (Présence)"); return; }
      const isMissing = state.found < item.q;
      if (item.t && state.testOk == null) missing.push(item.n + " (Fonctionnel)");
      if (item.s && state.sealOk == null) missing.push(item.n + " (Scellé)");
      if (item.bar && state.bar==null) missing.push(item.n + " (Niveau bar)");
      if (!isMissing) {
        if (item.p && firstWeek && !state.date) missing.push(item.n + " (Date péremption)");
        if (item.s && !item.p && firstWeek && state.sealOk!==false && !state.sealDate) missing.push(item.n + " (Date scellé)");
      }
    })));
    return missing;
  };
  const missingValidations = getMissingValidations();
  const hasAmbulancier = amb1.trim().length>0 || amb2.trim().length>0;
  const canSubmit = missingValidations.length===0 && hasAmbulancier;

  // Fait défiler jusqu'au premier oubli (en dépliant sa section si besoin).
  const scrollToFirstMissing = () => {
    if(!hasAmbulancier){
      const el=document.getElementById("ckitem-ambulancier");
      if(el) el.scrollIntoView({behavior:"smooth", block:"center"});
      return;
    }
    if(missingValidations.length===0) return;
    const firstName = missingValidations[0].split(" (")[0];
    let targetSectionId=null;
    for(const sec of data.sections){
      if(sec.shelves.some(sh=>sh.items.some(it=>it.n===firstName))){ targetSectionId=sec.id; break; }
    }
    if(targetSectionId!==null && !expanded[targetSectionId]) setExpanded(p=>({...p,[targetSectionId]:true}));
    setTimeout(()=>{
      const el=document.getElementById("ckitem-"+firstName.replace(/[^a-zA-Z0-9]/g,"-"));
      if(el) el.scrollIntoView({behavior:"smooth", block:"center"});
    }, targetSectionId!==null?150:0);
  };

  // Liste des problèmes réels (manques, test/scellé NOK) — utilisée pour
  // l'écran récap et pour le contenu de l'email envoyé au responsable.
  const buildIssues = () => {
    const issues=[];
    data.sections.forEach(sec=>sec.shelves.forEach(sh=>sh.items.forEach(item=>{
      const key=gk(sec.id,sh.id,item.n);
      const state=checks[key]||{};
      if(state.found!=null && state.found<item.q){
        const dueToExpiry=(item.p&&isMonthExpired(state.date))||(item.s&&state.sealOk!==false&&isMonthExpired(state.sealDate));
        issues.push({name:item.n, type:"missing", missing:item.q-state.found, required:item.q, expired:dueToExpiry});
      }
      if(item.t && state.testOk===false) issues.push({name:item.n, type:"nok_test"});
      if(item.s && state.sealOk===false) issues.push({name:item.n, type:"nok_seal"});
      if(item.bar && state.bar!=null && state.bar<50) issues.push({name:item.n, type:"low_bar", bar:state.bar});
    })));
    return issues;
  };
  const issues = buildIssues();
  const nokItems = issues.filter(i=>i.type==="missing").map(i=>[i.name,{found:i.required-i.missing,required:i.required}]);

  const sendMissingReport = async () => {
    if(!emails || emails.length===0) return;
    setSending(true);
    let missingLines;
    if(issues.length===0){
      missingLines = "✅ Aucun manque — véhicule complet.";
    }else{
      missingLines = issues.map(iss=>{
        if(iss.type==="missing") return `- ${iss.name} : manque ${iss.missing}/${iss.required}${iss.expired?" (périmé — retiré du véhicule)":""}`;
        if(iss.type==="nok_test") return `- ${iss.name} : test NOK (non fonctionnel)`;
        if(iss.type==="nok_seal") return `- ${iss.name} : scellé NOK (rompu)`;
        if(iss.type==="low_bar") return `- ${iss.name} : niveau bas (${iss.bar} bar, < 50)`;
        return `- ${iss.name}`;
      }).join("\n");
    }
    missingLines = `Rempli par : ${[amb1,amb2].filter(Boolean).join(" / ")||"—"}\n\n` + missingLines;
    if(remarks.trim()) missingLines += `\n\nRemarques : ${remarks.trim()}`;
    try{
      for(const to of emails){
        await emailjs.send("service_mrs8v2l","template_2sxsq4j",{
          to_email: to,
          title: `Checklist ${vehicleName} — Matériel manquant`,
          content: missingLines,
        }, "Fhdx1kTE7vFmh4z07");
      }
    }catch(e){ console.error("Erreur envoi email checklist:", e); }
    setSending(false);
  };

  if (!loaded) return (
    <div style={{ minHeight:"100vh", background:CK_C.bg, display:"flex", alignItems:"center", justifyContent:"center", color:CK_C.muted, fontFamily:"'DM Sans',sans-serif" }}>Chargement…</div>
  );

  if (submitted) return (
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text }}>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => setSubmitted(false)} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14 }}>←</button>
        <div style={{ fontWeight:800, fontSize:16 }}>📋 Rapport {vehicleName}</div>
      </div>
      <div style={{ padding:"20px", maxWidth:560, margin:"0 auto" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
          {[{val:`${checkedItems}/${totalItems}`,label:"Vérifié",color:CK_C.accent},{val:checkedItems-nokItems.length,label:"OK",color:CK_C.success},{val:nokItems.length,label:"Manques",color:nokItems.length>0?CK_C.danger:CK_C.muted}].map(s=>(
            <div key={s.label} style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:10, padding:"12px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:10, color:CK_C.muted, textTransform:"uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:"16px", marginBottom:14 }}>
          {[["Véhicule",vehicleName],["Ambulancier 1",amb1||"—"],["Ambulancier 2",amb2||"—"],["Semaine",semaine||"—"],["Date",new Date().toLocaleDateString("fr-FR")]].map(([k,v])=>(
            <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:7, paddingBottom:7, borderBottom:`1px solid ${CK_C.border}` }}>
              <span style={{ color:CK_C.muted }}>{k}</span><span style={{ fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
        {issues.length>0&&(
          <div style={{ background:CK_C.dangerSoft, border:`1px solid ${CK_C.danger}`, borderRadius:12, padding:"16px", marginBottom:14 }}>
            <div style={{ fontWeight:800, color:CK_C.danger, marginBottom:12, fontSize:14 }}>⚠ Problèmes signalés ({issues.length})</div>
            {issues.map((iss,i)=>(
              <div key={i} style={{ borderLeft:`2px solid ${CK_C.danger}`, paddingLeft:10, marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{iss.name}</span>
                  <span style={{ color:CK_C.danger, fontWeight:700, fontSize:12 }}>
                    {iss.type==="missing"?`Manque ${iss.missing}/${iss.required}`:iss.type==="nok_test"?"Test NOK":iss.type==="nok_seal"?"Scellé NOK":`Niveau bas (${iss.bar} bar)`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {remarks&&<div style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:"16px", marginBottom:14 }}><div style={{ fontSize:11, fontWeight:700, color:CK_C.muted, textTransform:"uppercase", marginBottom:8 }}>Remarques</div><div style={{ fontSize:13 }}>{remarks}</div></div>}
        <div style={{ background:CK_C.successSoft, border:`1px solid ${CK_C.success}`, borderRadius:10, padding:"14px", textAlign:"center", fontWeight:700, color:CK_C.success }}>
          {issues.length>0?(emails&&emails.length>0?`✅ Email de manquants envoyé (${emails.length} destinataire${emails.length>1?"s":""})`:"⚠️ Aucun email destinataire configuré (Paramètres)"):"✅ Checklist complète, rien à signaler"}
        </div>
        <button onClick={onBack} style={{ width:"100%", marginTop:12, background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:10, color:CK_C.muted, padding:"12px", fontWeight:700, fontSize:14 }}>← Retour à la liste</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"13px 16px", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"5px 10px", fontSize:14 }}>←</button>
            <div style={{ width:34, height:34, background:CK_C.red, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>🚑</div>
            <div>
              <div style={{ fontWeight:800, fontSize:15 }}>{vehicleName} — Checklist</div>
              <div style={{ fontSize:10, color:CK_C.muted, textTransform:"uppercase", letterSpacing:"0.8px" }}>Norme {data.norme}</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:20, fontWeight:800, color:progress===100?CK_C.success:CK_C.accent }}>{progress}%</div>
              <div style={{ fontSize:10, color:CK_C.muted }}>{checkedItems}/{totalItems}</div>
            </div>
            <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
          </div>
        </div>
        <div style={{ height:4, background:CK_C.border, borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progress}%`, background:progress===100?CK_C.success:CK_C.accent, borderRadius:4, transition:"width 0.3s" }}/>
        </div>
      </div>

      {firstWeek&&(()=>{ const permCount=missingValidations.filter(m=>m.includes("Date péremption")).length; return(
        <div style={{ background:"#f59e0b20", borderBottom:`1px solid #f59e0b`, padding:"9px 16px", fontSize:12, fontWeight:700, color:"#fbbf24" }}>
          📅 1ère semaine du mois — les dates de péremption sont obligatoires ({permCount} restante{permCount!==1?"s":""})
        </div>
      );})()}

      <div id="ckitem-ambulancier" style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"12px 16px", display:"flex", gap:8 }}>
        <input value={amb1} onChange={e=>updateDoc_({amb1:e.target.value})} placeholder="Ambulancier 1" style={{ flex:1, background:CK_C.bg, border:`1px solid ${hasAmbulancier?CK_C.border:CK_C.danger}`, borderRadius:8, padding:"8px 12px", color:CK_C.text, fontSize:13 }}/>
        <input value={amb2} onChange={e=>updateDoc_({amb2:e.target.value})} placeholder="Ambulancier 2" style={{ flex:1, background:CK_C.bg, border:`1px solid ${hasAmbulancier?CK_C.border:CK_C.danger}`, borderRadius:8, padding:"8px 12px", color:CK_C.text, fontSize:13 }}/>
        <input value={semaine} onChange={e=>updateDoc_({semaine:e.target.value})} style={{ width:75, background:CK_C.bg, border:`1px solid ${CK_C.border}`, borderRadius:8, padding:"8px 10px", color:CK_C.text, fontSize:13 }}/>
      </div>

      <div style={{ flex:1, padding:"12px 12px 100px" }}>
        {data.sections.filter(s=>s.shelves.some(sh=>sh.items.length>0)).map(section=>{
          const sectionItems=section.shelves.flatMap(sh=>sh.items.map(item=>({item,key:gk(section.id,sh.id,item.n)})));
          const sTotal=sectionItems.reduce((sum,{item})=>sum+itemSlots(item),0);
          const sChecked=sectionItems.reduce((sum,{item,key})=>sum+itemCheckedSlots(item,checks[key]||{}),0);
          const sNOK=sectionItems.filter(({item,key})=>{
            const c=checks[key];
            if(!c) return false;
            if(c.found!=null&&c.found<c.required) return true;
            if(c.testOk===false) return true;
            if(c.sealOk===false) return true;
            return false;
          }).length;
          const isExp=expanded[section.id];
          return(
            <div key={section.id} style={{ marginBottom:8, border:`1px solid ${CK_C.border}`, borderRadius:12, overflow:"hidden" }}>
              <button onClick={()=>toggle(section.id)} style={{ width:"100%", background:section.color, border:"none", padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", color:"white" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ background:"rgba(0,0,0,0.25)", borderRadius:6, padding:"2px 7px", fontSize:11, fontWeight:700 }}>{section.id}</span>
                  <span style={{ fontWeight:700, fontSize:13 }}>{section.label}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  {sNOK>0&&<span style={{ background:CK_C.danger, borderRadius:20, padding:"2px 7px", fontSize:10, fontWeight:700 }}>⚠{sNOK}</span>}
                  <span style={{ fontSize:11, opacity:0.8 }}>{sChecked}/{sTotal}</span>
                  <span style={{ fontSize:14, opacity:0.7 }}>{isExp?"▲":"▼"}</span>
                </div>
              </button>
              {isExp&&section.shelves.map(shelf=>(
                <div key={shelf.id}>
                  {shelf.label&&shelf.items.length>0&&<div style={{ background:"#1a1f2e", padding:"7px 14px", fontSize:10, fontWeight:700, color:section.color, textTransform:"uppercase", letterSpacing:"1px", borderTop:`1px solid ${CK_C.border}` }}>{shelf.label}</div>}
                  {shelf.items.map((item,idx)=>{
                    const key=gk(section.id,shelf.id,item.n);
                    const state=checks[key]||{};
                    const found=state.found;
                    const isChecked=found!=null;
                    const isMissing=isChecked&&found<item.q;
                    const isOk=isChecked&&found>=item.q;
                    const isBinary=item.t||item.s||item.okOnly;
                    const centralPeremptionDate=item.p?getSoonestDate(peremptionMap[peremptionKey(vehicleName,item.n)]?.lots):"";
                    const peremptionExpired=item.p&&isMonthExpired(centralPeremptionDate);
                    const sealDateMissingHere=item.s&&firstWeek&&!isMissing&&state.sealOk!==false&&!state.sealDate;
                    const sealDateExpired=item.s&&state.sealOk!==false&&isMonthExpired(state.sealDate);
                    const barMissingHere=item.bar&&state.bar==null;
                    return(
                      <div key={idx} id={"ckitem-"+item.n.replace(/[^a-zA-Z0-9]/g,"-")} style={{ background:isMissing?"rgba(239,68,68,0.06)":isOk?"rgba(34,197,94,0.04)":CK_C.panel, borderTop:`1px solid ${CK_C.border}`, padding:"11px 14px" }}>
                        <div style={{ fontSize:13, fontWeight:600, color:CK_C.text, display:"flex", alignItems:"center", gap:5, flexWrap:"wrap", marginBottom:8 }}>
                          {item.n}
                          {item.t&&<span style={{ background:"#1d4ed820", border:"1px solid #1d4ed8", color:"#60a5fa", borderRadius:4, padding:"1px 5px", fontSize:9, fontWeight:700 }}>TEST</span>}
                          {item.s&&<span style={{ background:"#7c3aed20", border:"1px solid #7c3aed", color:"#a78bfa", borderRadius:4, padding:"1px 5px", fontSize:9, fontWeight:700 }}>SCELLÉ</span>}
                          {item.p&&<span style={{ background:peremptionExpired?"#ef444420":"#f59e0b20", border:`1px solid ${peremptionExpired?"#ef4444":"#f59e0b"}`, color:peremptionExpired?"#f87171":"#fbbf24", borderRadius:4, padding:"1px 5px", fontSize:9, fontWeight:700 }}>PÉREMPTION{peremptionExpired?" ⚠":""}</span>}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:(item.t||item.s||item.bar)?6:0 }}>
                          <div style={{ fontSize:11, color:CK_C.muted, minWidth:80 }}>{item.okOnly?"État":"Présence"+(!isBinary?" (requis: "+item.q+")":"")}</div>
                          <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                            <button onClick={()=>setCF(key,state.found===item.q?undefined:item.q,item.q,item)} style={{ padding:"6px 12px", borderRadius:8, border:isOk?`2px solid ${CK_C.success}`:`1px solid ${CK_C.border}`, background:isOk?CK_C.successSoft:"transparent", color:isOk?CK_C.success:CK_C.muted, fontWeight:700, fontSize:12 }}>OK</button>
                            {!item.okOnly&&<button onClick={()=>setCF(key,state.found===0?undefined:0,item.q,item)} style={{ padding:"6px 10px", borderRadius:8, border:(isChecked&&!isOk)?`2px solid ${CK_C.danger}`:`1px solid ${CK_C.border}`, background:(isChecked&&!isOk)?CK_C.dangerSoft:"transparent", color:(isChecked&&!isOk)?CK_C.danger:CK_C.muted, fontWeight:700, fontSize:12 }}>NOK</button>}
                            {!isBinary&&!item.bar&&<div style={{ display:"flex", alignItems:"center", background:CK_C.bg, border:`1px solid ${isMissing?CK_C.danger:isOk?CK_C.success:CK_C.border}`, borderRadius:10, overflow:"hidden" }}>
                              <button onClick={()=>setCF(key,Math.max(0,(found!=null?found:item.q)-1),item.q,item)} style={{ width:30, height:32, background:"transparent", border:"none", color:CK_C.muted, fontSize:16 }}>−</button>
                              <div style={{ minWidth:28, textAlign:"center", fontSize:13, fontWeight:800, color:isMissing?CK_C.danger:isOk?CK_C.success:CK_C.text, borderLeft:`1px solid ${CK_C.border}`, borderRight:`1px solid ${CK_C.border}`, height:32, display:"flex", alignItems:"center", justifyContent:"center" }}>{found!=null?found:"?"}</div>
                              <button onClick={()=>setCF(key,(found!=null?found:0)+1,item.q,item)} style={{ width:30, height:32, background:"transparent", border:"none", color:CK_C.muted, fontSize:16 }}>+</button>
                            </div>}
                          </div>
                        </div>
                        {item.bar&&(
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:6, paddingTop:5, borderTop:`1px dashed ${CK_C.border}` }}>
                          <div style={{ fontSize:11, color:barMissingHere?CK_C.danger:(state.bar<50?CK_C.danger:CK_C.blue), minWidth:80, fontWeight:(barMissingHere||state.bar<50)?700:400 }}>Niveau (bar){(barMissingHere||state.bar<50)?" ⚠":""}</div>
                          <select value={state.bar!=null?state.bar:""} onChange={e=>setC(key,"bar",e.target.value===""?undefined:parseInt(e.target.value))} style={{ background:barMissingHere?CK_C.dangerSoft:(state.bar<50?CK_C.dangerSoft:CK_C.bg), border:`1px solid ${(barMissingHere||state.bar<50)?CK_C.danger:CK_C.border}`, borderRadius:8, padding:"6px 10px", color:(barMissingHere||state.bar<50)?CK_C.danger:CK_C.text, fontSize:13, fontWeight:(barMissingHere||state.bar<50)?700:400 }}>
                            <option value="">— bar —</option>
                            {Array.from({length:31},(_,i)=>i*10).map(v=>(<option key={v} value={v}>{v} bar</option>))}
                          </select>
                        </div>
                        )}
                        {item.t&&(<div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:item.s?6:0, paddingTop:5, borderTop:`1px dashed ${CK_C.border}` }}>
                          <div style={{ fontSize:11, color:CK_C.blue, minWidth:80 }}>Fonctionnel</div>
                          <div style={{ display:"flex", gap:5 }}>
                            <button onClick={()=>setTest(key,state.testOk===true?undefined:true)} style={{ padding:"6px 12px", borderRadius:8, border:state.testOk===true?`2px solid ${CK_C.success}`:`1px solid ${CK_C.border}`, background:state.testOk===true?CK_C.successSoft:"transparent", color:state.testOk===true?CK_C.success:CK_C.muted, fontWeight:700, fontSize:12 }}>OK</button>
                            <button onClick={()=>setTest(key,state.testOk===false?undefined:false)} style={{ padding:"6px 10px", borderRadius:8, border:state.testOk===false?`2px solid ${CK_C.danger}`:`1px solid ${CK_C.border}`, background:state.testOk===false?CK_C.dangerSoft:"transparent", color:state.testOk===false?CK_C.danger:CK_C.muted, fontWeight:700, fontSize:12 }}>NOK</button>
                          </div>
                        </div>)}
                        {item.s&&(<div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:6, paddingTop:5, borderTop:`1px dashed ${CK_C.border}` }}>
                          <div style={{ fontSize:11, color:"#a78bfa", minWidth:80 }}>Scellé intact</div>
                          <div style={{ display:"flex", gap:5 }}>
                            <button onClick={()=>setSeal(key,state.sealOk===true?undefined:true)} style={{ padding:"6px 12px", borderRadius:8, border:state.sealOk===true?`2px solid ${CK_C.success}`:`1px solid ${CK_C.border}`, background:state.sealOk===true?CK_C.successSoft:"transparent", color:state.sealOk===true?CK_C.success:CK_C.muted, fontWeight:700, fontSize:12 }}>OK</button>
                            <button onClick={()=>setSeal(key,state.sealOk===false?undefined:false)} style={{ padding:"6px 10px", borderRadius:8, border:state.sealOk===false?`2px solid ${CK_C.danger}`:`1px solid ${CK_C.border}`, background:state.sealOk===false?CK_C.dangerSoft:"transparent", color:state.sealOk===false?CK_C.danger:CK_C.muted, fontWeight:700, fontSize:12 }}>NOK</button>
                          </div>
                        </div>)}
                        {item.s&&!item.p&&state.sealOk!==false&&(
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, paddingTop:2 }}>
                          <div style={{ fontSize:11, color:sealDateExpired?CK_C.danger:"#a78bfa", minWidth:80 }}>Date scellé</div>
                          <MonthYearPicker value={state.sealDate||""} onChange={v=>setDateField(key,"sealDate",v,item)} danger={sealDateMissingHere||sealDateExpired}/>
                        </div>
                        )}
                        {item.p&&(
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginTop:6 }}>
                          <div style={{ fontSize:11, color:peremptionExpired?CK_C.danger:"#fbbf24", minWidth:80 }}>Péremption</div>
                          <div style={{ fontSize:12, fontWeight:700, color:peremptionExpired?CK_C.danger:CK_C.text, background:CK_C.bg, border:`1px solid ${peremptionExpired?CK_C.danger:CK_C.border}`, borderRadius:8, padding:"6px 12px" }}>
                            {centralPeremptionDate?monthYearLabel(centralPeremptionDate):"Non renseignée (bureau)"}
                          </div>
                        </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
        <div style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:"14px", marginTop:6 }}>
          <div style={{ fontSize:11, fontWeight:700, color:CK_C.muted, textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 }}>📝 Remarques</div>
          <textarea value={remarks} onChange={e=>updateDoc_({remarks:e.target.value})} placeholder="Matériel manquant, observations..." rows={3} style={{ width:"100%", background:CK_C.bg, border:`1px solid ${CK_C.border}`, borderRadius:8, padding:"10px 12px", color:CK_C.text, fontSize:13, resize:"none" }}/>
        </div>
      </div>
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:CK_C.panel, borderTop:`1px solid ${CK_C.border}`, padding:"13px 16px" }}>
        {!canSubmit&&(
          <div style={{ background:CK_C.dangerSoft, border:`1px solid ${CK_C.danger}`, borderRadius:8, padding:"8px 12px", marginBottom:8, fontSize:11, color:CK_C.danger, fontWeight:600 }}>
            {!hasAmbulancier?"⚠ Indique au moins un ambulancier":`⚠ ${missingValidations.length} validation(s) manquante(s)`}
          </div>
        )}
        <button disabled={sending} onClick={()=>{
          if(!canSubmit){ scrollToFirstMissing(); return; }
          sendMissingReport();
          saveChecklistHistorique({
            id:`${vehicleName}_${weekKey}_${Date.now()}`,
            vehicle:vehicleName, date:new Date().toLocaleDateString("fr-FR"), dateISO:new Date().toISOString(),
            weekNumber:getChecklistWeekNumber(), semaine:semaine||String(getChecklistWeekNumber()),
            amb1, amb2, remarks:remarks||"", complete:progress===100, timestamp:Date.now(),
            issues:issues.map(iss=>({
              ...iss,
              remaining: iss.type==="missing"?iss.missing:(iss.type==="low_bar"?(iss.bar===0?1:0):1),
              resupplied:0,
            })),
          });
          setSubmitted(true);
        }} style={{ width:"100%", background:!canSubmit?CK_C.border:progress===100?CK_C.success:CK_C.accent, border:"none", borderRadius:10, color:"white", padding:"14px", fontWeight:800, fontSize:15, opacity:canSubmit?1:0.85, cursor:sending?"not-allowed":"pointer" }}>
          {canSubmit?"✅ Envoyer au responsable":`⚠ ${!hasAmbulancier?"Ambulancier requis — toucher pour y aller":missingValidations.length+" oubli(s) — toucher pour y aller"}`}
        </button>
      </div>
    </div>
  );
}
// ═══════════════════════════════════════
// HISTORIQUE — liste des checklists envoyées (24 mois glissants)
// ═══════════════════════════════════════
function HistoriqueView({ onBack, vehicles, carnetBordTypes, themeMode, toggleTheme }){
  const [screen,setScreen]=useState("home"); // home | checklists | o2 | daily_date | daily | carnet_date | carnet_vehicles | carnet_detail
  const [carnetVehicle,setCarnetVehicle]=useState(null);
  const [carnetDate,setCarnetDate]=useState(null);
  const [dailyDate,setDailyDate]=useState(null);

  if(screen==="checklists") return <ChecklistHistoriqueSubView onBack={()=>setScreen("home")} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(screen==="o2") return <O2HistoriqueSubView onBack={()=>setScreen("home")} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(screen==="daily_date") return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={()=>setScreen("home")} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
          <div style={{ fontWeight:800, fontSize:16 }}>🚑 Choisir une date</div>
        </div>
        <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{ flex:1, padding:18, maxWidth:420, margin:"0 auto", width:"100%" }}>
        <SimpleDatePicker themeC={CK_C} onSelect={(d)=>{setDailyDate(d);setScreen("daily");}}/>
      </div>
    </div>
  );
  if(screen==="daily") return <DailyHistoriqueSubView onBack={()=>setScreen("daily_date")} filterDate={dailyDate} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(screen==="carnet_date") return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={()=>setScreen("home")} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
          <div style={{ fontWeight:800, fontSize:16 }}>📓 Choisir une date</div>
        </div>
        <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{ flex:1, padding:18, maxWidth:420, margin:"0 auto", width:"100%" }}>
        <SimpleDatePicker themeC={CK_C} onSelect={(d)=>{setCarnetDate(d);setScreen("carnet_vehicles");}}/>
      </div>
    </div>
  );
  if(screen==="carnet_vehicles") return <CarnetBordDateVehiclePicker vehicles={vehicles} date={carnetDate} onSelect={(v)=>{setCarnetVehicle(v);setScreen("carnet_detail");}} onBack={()=>setScreen("carnet_date")} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(screen==="carnet_detail") return <CarnetBordDateDetail vehicle={carnetVehicle} date={carnetDate} carnetBordTypes={carnetBordTypes} onBack={()=>setScreen("carnet_vehicles")} themeMode={themeMode} toggleTheme={toggleTheme}/>;

  return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
          <div style={{ fontWeight:800, fontSize:16 }}>📅 Historique</div>
        </div>
        <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{ flex:1, padding:"20px", maxWidth:420, margin:"0 auto", width:"100%", display:"flex", flexDirection:"column", gap:12 }}>
        <button onClick={()=>setScreen("checklists")} style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:14, padding:"20px", color:CK_C.text, display:"flex", alignItems:"center", gap:14, cursor:"pointer", textAlign:"left" }}>
          <div style={{ fontSize:28 }}>📋</div>
          <div><div style={{ fontWeight:800, fontSize:15 }}>Historique checklists</div><div style={{ fontSize:11, color:CK_C.muted, marginTop:2 }}>Toutes les checklists envoyées</div></div>
        </button>
        <button onClick={()=>setScreen("o2")} style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:14, padding:"20px", color:CK_C.text, display:"flex", alignItems:"center", gap:14, cursor:"pointer", textAlign:"left" }}>
          <div style={{ fontSize:28, color:"#3b82f6", fontWeight:900 }}>O₂</div>
          <div><div style={{ fontWeight:800, fontSize:15 }}>Historique bouteilles O²</div><div style={{ fontSize:11, color:CK_C.muted, marginTop:2 }}>Échanges véhicules et livraisons fournisseur</div></div>
        </button>
        <button onClick={()=>setScreen("daily_date")} style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:14, padding:"20px", color:CK_C.text, display:"flex", alignItems:"center", gap:14, cursor:"pointer", textAlign:"left" }}>
          <div style={{ fontSize:28 }}>🚑</div>
          <div><div style={{ fontWeight:800, fontSize:15 }}>Historique APS Daily</div><div style={{ fontSize:11, color:CK_C.muted, marginTop:2 }}>Checklists journalières par véhicule</div></div>
        </button>
        <button onClick={()=>setScreen("carnet_date")} style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:14, padding:"20px", color:CK_C.text, display:"flex", alignItems:"center", gap:14, cursor:"pointer", textAlign:"left" }}>
          <div style={{ fontSize:28 }}>📓</div>
          <div><div style={{ fontWeight:800, fontSize:15 }}>Carnet de bord</div><div style={{ fontSize:11, color:CK_C.muted, marginTop:2 }}>Historique des trajets par véhicule (3 ans)</div></div>
        </button>
      </div>
    </div>
  );
}

// Petit calendrier réutilisable (choix d'une date, sans dépendance aux courses).
function SimpleDatePicker({ onSelect, themeC }){
  const [viewDate,setViewDate]=useState(new Date());
  const year=viewDate.getFullYear(), month=viewDate.getMonth();
  const firstDay=new Date(year,month,1);
  const startOffset=(firstDay.getDay()+6)%7; // lundi=0
  const daysInMonth=new Date(year,month+1,0).getDate();
  const monthLabel=viewDate.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  const cells=[];
  for(let i=0;i<startOffset;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);
  const todayStr=todayISO();
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <button onClick={()=>setViewDate(new Date(year,month-1,1))} style={{background:themeC.panel2,border:`1px solid ${themeC.border}`,borderRadius:8,color:themeC.text,padding:"6px 12px",cursor:"pointer"}}>←</button>
        <div style={{fontWeight:800,fontSize:14,textTransform:"capitalize",color:themeC.text}}>{monthLabel}</div>
        <button onClick={()=>setViewDate(new Date(year,month+1,1))} style={{background:themeC.panel2,border:`1px solid ${themeC.border}`,borderRadius:8,color:themeC.text,padding:"6px 12px",cursor:"pointer"}}>→</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:6}}>
        {["L","M","M","J","V","S","D"].map((d,i)=>(<div key={i} style={{textAlign:"center",fontSize:10,color:themeC.muted,fontWeight:700}}>{d}</div>))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
        {cells.map((d,i)=>{
          if(d===null) return <div key={i}/>;
          const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const isToday=dateStr===todayStr;
          return(
            <button key={i} onClick={()=>onSelect(dateStr)} style={{aspectRatio:"1",background:isToday?themeC.accent:themeC.panel2,border:`1px solid ${isToday?themeC.accent:themeC.border}`,borderRadius:8,color:isToday?"white":themeC.text,fontSize:12,fontWeight:isToday?800:500,cursor:"pointer"}}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}

function CarnetBordDateVehiclePicker({ vehicles, date, onSelect, onBack, themeMode, toggleTheme }){
  const [vehicleNames,setVehicleNames]=useState(null); // null=chargement, sinon Set
  useEffect(()=>{
    if(!date) return;
    cleanOldCarnetBord();
    const unsub=onSnapshot(collection(dbChecklists,"dispatchai_carnet_bord"), snap=>{
      const set=new Set();
      snap.forEach(d=>{ const data=d.data(); if(data.date===date) set.add(data.vehicle); });
      setVehicleNames(set);
    });
    return ()=>unsub();
  },[date]);

  const dateLabel=date?new Date(date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"";
  const available=(vehicles||[]).filter(v=>vehicleNames&&vehicleNames.has(v.name));

  return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
          <div><div style={{ fontWeight:800, fontSize:16 }}>📓 Carnet de bord</div><div style={{ fontSize:11, color:CK_C.muted, textTransform:"capitalize" }}>{dateLabel}</div></div>
        </div>
        <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{ flex:1, padding:"16px", maxWidth:480, margin:"0 auto", width:"100%" }}>
        {vehicleNames===null&&<div style={{ textAlign:"center", color:CK_C.muted, padding:40 }}>Chargement…</div>}
        {vehicleNames!==null&&available.length===0&&<div style={{ textAlign:"center", color:CK_C.muted, padding:40 }}>Aucun véhicule n'a roulé ce jour-là</div>}
        {[["TPMR","TPMR"],["VSL","VSL"],["AMB","Ambulances ALPHA"]].map(([type,label])=>{
          const group=available.filter(v=>v.type===type);
          if(group.length===0) return null;
          return(
            <div key={type} style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, fontWeight:700, color:CK_C.muted, textTransform:"uppercase", marginBottom:8 }}>{label}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {group.map(v=>(
                  <button key={v.id} onClick={()=>onSelect(v)} style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:"16px 10px", color:CK_C.text, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CarnetBordDateDetail({ vehicle, date, carnetBordTypes, onBack, themeMode, toggleTheme }){
  const [entries,setEntries]=useState([]);
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(collection(dbChecklists,"dispatchai_carnet_bord"), snap=>{
      const data=snap.docs.map(d=>d.data()).filter(e=>e.vehicle===vehicle.name && e.date===date);
      data.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
      setEntries(data);
      setLoaded(true);
    }, ()=>setLoaded(true));
    return ()=>unsub();
  },[vehicle.name,date]);

  const cbTypes=(carnetBordTypes&&carnetBordTypes.length)?carnetBordTypes:INIT_CARNET_TYPES;
  const natureLabel=(id)=>cbTypes.find(t=>t.id===id)?.label||id;
  const dateLabel=date?new Date(date+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"";

  return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
          <div><div style={{ fontWeight:800, fontSize:16 }}>📓 {vehicle.name}</div><div style={{ fontSize:11, color:CK_C.muted, textTransform:"capitalize" }}>{dateLabel}</div></div>
        </div>
        <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{ flex:1, padding:"14px", overflowY:"auto" }}>
        {!loaded&&<div style={{ textAlign:"center", color:CK_C.muted, padding:40 }}>Chargement…</div>}
        {loaded&&entries.length===0&&<div style={{ textAlign:"center", color:CK_C.muted, padding:40 }}>Aucune ligne pour ce véhicule ce jour-là</div>}
        {entries.map(e=>(
          <div key={e.id} style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:14, marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:700, fontSize:13, color:CK_C.text }}>{e.heureDepart} — {natureLabel(e.natureMission)}</span>
              {e.kmDepart&&e.kmFin&&<span style={{ fontSize:11, color:CK_C.muted }}>{e.kmDepart} → {e.kmFin} km</span>}
            </div>
            <div style={{ fontSize:12, color:CK_C.muted, marginTop:4 }}>{e.lieuDepart} → {e.destination}</div>
            <div style={{ fontSize:11, color:CK_C.muted, marginTop:6, display:"flex", gap:12, flexWrap:"wrap" }}>
              <span>👤 {e.chauffeur}</span>
              {e.litres&&<span>⛽ {e.litres} L</span>}
              {e.heureRetour&&<span>🏠 Retour {e.heureRetour}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistHistoriqueSubView({ onBack, themeMode, toggleTheme }){
  const [entries,setEntries]=useState([]);
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    cleanOldHistorique();
    const unsub=onSnapshot(collection(dbChecklists,"dispatchai_historique"), snap=>{
      const docs=snap.docs.map(d=>d.data());
      docs.sort((a,b)=>b.timestamp-a.timestamp);
      setEntries(docs);
      setLoaded(true);
    }, ()=>setLoaded(true));
    return ()=>unsub();
  },[]);

  return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
          <div style={{ fontWeight:800, fontSize:16 }}>📋 Historique checklists</div>
        </div>
        <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{ flex:1, padding:"14px", overflowY:"auto" }}>
        {!loaded&&<div style={{ textAlign:"center", color:CK_C.muted, padding:"40px" }}>Chargement…</div>}
        {loaded&&entries.length===0&&<div style={{ textAlign:"center", color:CK_C.muted, padding:"40px" }}>Aucune checklist envoyée pour l'instant</div>}
        {entries.map(entry=>{
          const allIssues=entry.issues||[];
          const openIssues=allIssues.filter(i=>i.remaining>0);
          const color=openIssues.length===0?CK_C.success:CK_C.danger;
          return(
            <div key={entry.id} style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderLeft:`4px solid ${color}`, borderRadius:12, padding:"14px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:14 }}>🚑 {entry.vehicle}</div>
                  <div style={{ fontSize:11, color:CK_C.muted, marginTop:2 }}>{entry.date} · Sem. {entry.semaine||entry.weekNumber} · {entry.amb1||"—"} / {entry.amb2||"—"}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:18 }}>{openIssues.length===0?"✅":"🔴"}</div>
                  <div style={{ fontSize:10, color, fontWeight:700 }}>{allIssues.length===0?"Tout OK":openIssues.length===0?"Réappro OK":`${openIssues.length} en attente`}</div>
                </div>
              </div>
              {allIssues.length>0&&(
                <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${CK_C.border}` }}>
                  {allIssues.map((iss,i)=>(
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, padding:"4px 0" }}>
                      <span style={{ color:CK_C.text }}>{iss.name}</span>
                      <span style={{ display:"flex", gap:6, alignItems:"center" }}>
                        {iss.remaining>0&&<span style={{ color:CK_C.danger, fontWeight:700 }}>{iss.type==="missing"?`reste ${iss.remaining}`:"en attente"}</span>}
                        {iss.remaining===0&&<span style={{ color:CK_C.success, fontWeight:700 }}>✓ résolu</span>}
                        {iss.resupplied>0&&<span style={{ background:CK_C.successSoft, border:`1px solid ${CK_C.success}`, color:CK_C.success, borderRadius:5, padding:"1px 6px", fontSize:10, fontWeight:700 }}>+{iss.resupplied}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {entry.remarks&&<div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${CK_C.border}`, fontSize:11, color:CK_C.muted }}><strong style={{ color:CK_C.text }}>Remarques :</strong> {entry.remarks}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function O2HistoriqueSubView({ onBack, themeMode, toggleTheme }){
  const [entries,setEntries]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [reserve,setReserve]=useState(O2_EMPTY_RESERVE);
  const [confirmDelete,setConfirmDelete]=useState(null);

  useEffect(()=>{
    cleanOldO2Historique();
    const unsub=onSnapshot(collection(dbChecklists,"dispatchai_o2_historique"), snap=>{
      const docs=snap.docs.map(d=>d.data());
      docs.sort((a,b)=>b.timestamp-a.timestamp); // plus récent en haut
      setEntries(docs);
      setLoaded(true);
    }, ()=>setLoaded(true));
    return ()=>unsub();
  },[]);

  useEffect(()=>{
    const unsub=onSnapshot(doc(dbChecklists,"dispatchai_o2","reserve"), snap=>{
      const d=snap.exists()?snap.data():O2_EMPTY_RESERVE;
      setReserve({ pleines:{...O2_EMPTY_RESERVE.pleines,...d.pleines}, vides:{...O2_EMPTY_RESERVE.vides,...d.vides} });
    });
    return ()=>unsub();
  },[]);

  return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
          <div style={{ fontWeight:800, fontSize:16 }}><span style={{color:"#3b82f6"}}>O₂</span> Historique bouteilles</div>
        </div>
        <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{ display:"flex", gap:8, padding:"14px 14px 0" }}>
        {O2_SIZES.map(s=>{
          const low=(reserve.pleines[s]||0)<=2;
          return(
            <div key={s} style={{ flex:1, background:low?CK_C.dangerSoft:CK_C.panel, border:`1px solid ${low?CK_C.danger:CK_C.border}`, borderRadius:12, padding:"10px", textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:900, color:low?CK_C.danger:"#3b82f6" }}>{reserve.pleines[s]||0}</div>
              <div style={{ fontSize:9, color:low?CK_C.danger:CK_C.muted, fontWeight:700 }}>{s} pleines</div>
              <div style={{ fontSize:14, fontWeight:800, color:CK_C.muted, marginTop:4 }}>{reserve.vides[s]||0}</div>
              <div style={{ fontSize:9, color:CK_C.muted, fontWeight:700 }}>{s} vides</div>
            </div>
          );
        })}
      </div>
      <div style={{ flex:1, padding:"14px", overflowY:"auto" }}>
        {!loaded&&<div style={{ textAlign:"center", color:CK_C.muted, padding:"40px" }}>Chargement…</div>}
        {loaded&&entries.length===0&&<div style={{ textAlign:"center", color:CK_C.muted, padding:"40px" }}>Aucun mouvement pour l'instant</div>}
        {entries.map(entry=>{
          const isFournisseur=entry.type==="fournisseur";
          const sortieLines=O2_SIZES.filter(s=>(entry.sortie?.[s]||0)>0);
          const entreeLines=O2_SIZES.filter(s=>(entry.entree?.[s]||0)>0);
          return(
            <div key={entry.id} style={{ background:CK_C.panel, border:`1px solid ${isFournisseur?"#3b82f6":CK_C.border}`, borderLeft:`4px solid ${isFournisseur?"#3b82f6":CK_C.muted}`, borderRadius:12, padding:"14px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ fontWeight:isFournisseur?900:800, fontSize:isFournisseur?15:14, color:isFournisseur?"#3b82f6":CK_C.text, textTransform:isFournisseur?"uppercase":"none", letterSpacing:isFournisseur?"0.5px":"normal" }}>
                  {isFournisseur?"🚚 Livraison fournisseur":(entry.vehicle==="Préventif"?"🧰 Préventif":`🚑 ${entry.vehicle}`)}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ fontSize:11, color:CK_C.muted }}>{entry.date}</div>
                  <button onClick={()=>setConfirmDelete(entry)} style={{ background:CK_C.dangerSoft, border:`1px solid ${CK_C.danger}`, borderRadius:6, color:CK_C.danger, padding:"4px 8px", fontSize:11, cursor:"pointer" }}>🗑</button>
                </div>
              </div>
              <div style={{ marginTop:8, fontSize:12 }}>
                <div style={{ color:CK_C.danger, fontWeight:700, marginBottom:2 }}>Sortie :</div>
                {sortieLines.length===0?<div style={{color:CK_C.muted,marginLeft:6}}>—</div>:sortieLines.map(s=>(<div key={s} style={{marginLeft:6}}>{s} : {entry.sortie[s]}</div>))}
                <div style={{ color:CK_C.success, fontWeight:700, marginTop:6, marginBottom:2 }}>Entrée :</div>
                {entreeLines.length===0?<div style={{color:CK_C.muted,marginLeft:6}}>—</div>:entreeLines.map(s=>(<div key={s} style={{marginLeft:6}}>{s} : {entry.entree[s]}</div>))}
              </div>
              {entry.name&&<div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${CK_C.border}`, fontSize:11, color:CK_C.muted }}>Par : <strong style={{color:CK_C.text}}>{entry.name}</strong></div>}
            </div>
          );
        })}
      </div>

      {confirmDelete&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400}}>
          <div style={{background:CK_C.panel,border:`1px solid ${CK_C.danger}`,borderRadius:16,padding:"24px",width:360,maxWidth:"92vw"}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:10}}>🗑 Supprimer ce mouvement ?</div>
            <div style={{fontSize:13,color:CK_C.muted,marginBottom:20}}>
              Cette action supprime définitivement l'entrée et <strong style={{color:CK_C.text}}>annule son effet</strong> sur les compteurs de réserve (les quantités seront recalculées comme si ce mouvement n'avait jamais eu lieu).
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConfirmDelete(null)} style={{flex:1,background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:9,color:CK_C.muted,padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Annuler</button>
              <button onClick={async()=>{await deleteO2HistoriqueEntry(confirmDelete);setConfirmDelete(null);}} style={{flex:1,background:CK_C.danger,border:"none",borderRadius:9,color:"white",padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer"}}>🗑 Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DailyHistoriqueSubView({ onBack, filterDate, themeMode, toggleTheme }){
  const [checklists,setChecklists]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [filter,setFilter]=useState("all");
  const [selectMode,setSelectMode]=useState(false);
  const [selected,setSelected]=useState([]);
  const [detail,setDetail]=useState(null);

  useEffect(()=>{
    const unsub=onSnapshot(collection(dbChecklists,"dispatchai_daily_checklists"), snap=>{
      const data=snap.docs.map(d=>({id:d.id,...d.data()}));
      data.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      setChecklists(data);
      setLoaded(true);
    }, ()=>setLoaded(true));
    return ()=>unsub();
  },[]);

  const deleteSelected=async()=>{
    if(!window.confirm("Supprimer "+selected.length+" checklist(s) ?")) return;
    for(const id of selected) await deleteDoc(doc(dbChecklists,"dispatchai_daily_checklists",id));
    setSelected([]); setSelectMode(false);
  };
  const toggleSelect=(id)=>setSelected(prev=>prev.includes(id)?prev.filter(i=>i!==id):[...prev,id]);

  const formatDate=(ts)=>{ if(!ts) return ""; return new Date(ts).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); };
  const formatTime=(ts)=>{ if(!ts) return ""; return new Date(ts).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}); };

  const renderValue=(val)=>{
    if(val===null||val===undefined||val==="") return { text:"Non rempli", color:CK_C.muted };
    const v=String(val).toLowerCase();
    if(v==="ok") return { text:"OK", color:CK_C.success };
    if(v==="nok") return { text:"NOK", color:CK_C.danger };
    if(v==="np") return { text:"N/P", color:CK_C.muted };
    if(v==="propre"||v==="bon") return { text:val, color:CK_C.success };
    if(v==="sale"||v==="remplacer") return { text:val, color:CK_C.danger };
    if(v==="insuf"||v==="usure") return { text:val, color:"#f59e0b" };
    if(v==="vide") return { text:"Vide", color:CK_C.success };
    if(v==="pleine") return { text:"Pleine", color:CK_C.danger };
    if(v==="full") return { text:"Plein", color:CK_C.success };
    if(v==="75") return { text:"3/4", color:CK_C.success };
    if(v==="50") return { text:"1/2", color:"#f59e0b" };
    if(v==="25") return { text:"1/4", color:CK_C.danger };
    if(v==="0") return { text:"Vide", color:CK_C.danger };
    return { text:String(val), color:CK_C.muted };
  };

  const filtered=checklists.filter(c=>(filter==="all"?true:c.type===filter)&&(!filterDate||c.date===filterDate));
  const groups={};
  filtered.forEach(c=>{ const date=c.createdAt?formatDate(c.createdAt):"Date inconnue"; if(!groups[date]) groups[date]=[]; groups[date].push(c); });

  if(detail){
    const template=DAILY_TEMPLATES_BASE[detail.type]||DAILY_CHECKLIST_ALPHA;
    const values=detail.values||{};
    return(
      <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
        <style>{CK_GS}</style>
        <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={()=>setDetail(null)} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
            <div><div style={{ fontWeight:800, fontSize:15 }}>{detail.vehicle}</div><div style={{ fontSize:10, color:CK_C.muted }}>{formatDate(detail.createdAt)} à {formatTime(detail.createdAt)}</div></div>
          </div>
          <span style={{ padding:"4px 10px", borderRadius:8, fontSize:11, fontWeight:700, background:detail.skipped?"#f59e0b22":detail.hasDefects?CK_C.dangerSoft:CK_C.successSoft, color:detail.skipped?"#f59e0b":detail.hasDefects?CK_C.danger:CK_C.success }}>
            {detail.skipped?"Sautée (urgence)":detail.hasDefects?"Défaut":"RAS"}
          </span>
        </div>
        <div style={{ flex:1, padding:14, overflowY:"auto" }}>
          <div style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:14, padding:14, marginBottom:14 }}>
            <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
              <div><div style={{ fontSize:11, color:CK_C.muted, marginBottom:2 }}>Ambulancier(s)</div><div style={{ fontWeight:700 }}>{detail.submittedBy||"Non renseigné"}</div></div>
              {values.km&&<div><div style={{ fontSize:11, color:CK_C.muted, marginBottom:2 }}>Kilométrage</div><div style={{ fontWeight:700 }}>{values.km} km</div></div>}
            </div>
            {values.remarques&&<div style={{ marginTop:10, padding:10, background:CK_C.bg, borderRadius:9 }}><div style={{ fontSize:11, color:CK_C.muted, marginBottom:4 }}>Remarques</div><div style={{ color:CK_C.text, fontSize:13 }}>{values.remarques}</div></div>}
          </div>
          {detail.skipped?(
            <div style={{ textAlign:"center", padding:30, color:CK_C.muted }}>⚠️ Checklist non effectuée (accès d'urgence)</div>
          ):template.map((section,sIdx)=>(
            <div key={sIdx} style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:14, padding:14, marginBottom:12 }}>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:CK_C.muted }}>{section.section}</div>
              {section.items.map((item,iIdx)=>{
                const val=values[item.id]; const rendered=renderValue(val);
                return(
                  <div key={iIdx} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${CK_C.border}` }}>
                    <span style={{ fontSize:13, flex:1, paddingRight:8, color:CK_C.text }}>{item.label}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:rendered.color, background:CK_C.panel2, padding:"3px 10px", borderRadius:6, whiteSpace:"nowrap" }}>{rendered.text}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
          <div><div style={{ fontWeight:800, fontSize:16 }}>🚑 Historique APS Daily</div>{filterDate&&<div style={{ fontSize:10, color:CK_C.muted, textTransform:"capitalize" }}>{new Date(filterDate+"T00:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>}</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>{setSelectMode(!selectMode);setSelected([]);}} style={{ padding:"6px 12px", background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:selectMode?CK_C.danger:CK_C.muted, fontSize:11, cursor:"pointer" }}>{selectMode?"Annuler":"Sélectionner"}</button>
          <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
        </div>
      </div>
      <div style={{ flex:1, padding:14, overflowY:"auto" }}>
        {selectMode&&selected.length>0&&(
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:CK_C.dangerSoft, border:`1px solid ${CK_C.danger}`, borderRadius:12, padding:"10px 14px", marginBottom:12 }}>
            <span style={{ fontSize:13, color:CK_C.text }}>{selected.length} sélectionné(s)</span>
            <button onClick={deleteSelected} style={{ padding:"7px 14px", background:CK_C.danger, border:"none", borderRadius:8, color:"white", fontSize:13, fontWeight:700, cursor:"pointer" }}>Supprimer</button>
          </div>
        )}
        <div style={{ display:"flex", gap:8, marginBottom:16, overflowX:"auto" }}>
          {[["all","Tout"],["AMB","Alpha"],["TPMR","TPMR"],["VSL","VSL"]].map(([val,label])=>(
            <button key={val} onClick={()=>setFilter(val)} style={{ padding:"7px 14px", borderRadius:20, border:`1px solid ${filter===val?CK_C.danger:CK_C.border}`, background:filter===val?CK_C.danger:"transparent", color:filter===val?"white":CK_C.muted, fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>{label}</button>
          ))}
        </div>
        {!loaded&&<div style={{ textAlign:"center", color:CK_C.muted, padding:40 }}>Chargement…</div>}
        {loaded&&filtered.length===0&&<div style={{ textAlign:"center", padding:48, color:CK_C.muted }}><div style={{ fontSize:48, marginBottom:12 }}>📋</div><p>Aucune checklist enregistrée</p></div>}
        {Object.entries(groups).map(([date,items])=>(
          <div key={date} style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, letterSpacing:2, color:CK_C.muted, textTransform:"uppercase", marginBottom:8 }}>📅 {date}</div>
            {items.map(c=>(
              <div key={c.id} onClick={()=>selectMode?toggleSelect(c.id):setDetail(c)}
                style={{ background:selected.includes(c.id)?CK_C.dangerSoft:CK_C.panel, border:`1px solid ${selected.includes(c.id)?CK_C.danger:CK_C.border}`, borderRadius:14, padding:14, marginBottom:8, cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  {selectMode&&<div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${selected.includes(c.id)?CK_C.danger:CK_C.border}`, background:selected.includes(c.id)?CK_C.danger:"transparent", marginRight:10, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:12 }}>{selected.includes(c.id)?"✓":""}</div>}
                  <span style={{ background:CK_C.panel2, borderRadius:8, padding:"4px 10px", fontWeight:700, fontSize:14, color:CK_C.text }}>{c.vehicle}</span>
                  <span style={{ padding:"4px 10px", borderRadius:8, fontSize:11, fontWeight:700, background:c.skipped?"#f59e0b22":c.hasDefects?CK_C.dangerSoft:CK_C.successSoft, color:c.skipped?"#f59e0b":c.hasDefects?CK_C.danger:CK_C.success }}>{c.skipped?"Sautée":c.hasDefects?"Défaut":"RAS"}</span>
                </div>
                <div style={{ fontSize:12, color:CK_C.muted, marginTop:6, display:"flex", gap:12 }}>
                  <span>🕐 {formatTime(c.createdAt)}</span><span>👤 {c.submittedBy}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// PÉREMPTION — vue d'ensemble bureau : tous les articles, tous les véhicules
// ═══════════════════════════════════════
async function checkAndSendPeremptionAlerts(checklistsData, peremptionEmails){
  if(!peremptionEmails||peremptionEmails.length===0) return;
  try{
    const snap=await getDocs(collection(dbChecklists,"dispatchai_peremption_dates"));
    const now=new Date();
    const oneMonthOut=new Date(now.getFullYear(),now.getMonth()+1,now.getDate());
    for(const d of snap.docs){
      const data=d.data();
      const soonest=getSoonestDate(data.lots);
      if(!soonest) continue;
      if(data.alertSentForDate===soonest) continue; // déjà alerté pour cette date précise
      const expDate=new Date(soonest+"-01T00:00:00");
      if(expDate<=oneMonthOut){
        for(const to of peremptionEmails){
          try{
            await emailjs.send("service_mrs8v2l","template_2sxsq4j",{
              to_email:to, title:"Alerte Péremption — "+data.vehicle,
              content:`L'article "${data.itemName}" du véhicule ${data.vehicle} arrive à échéance : ${monthYearLabel(soonest)}.`,
            },"Fhdx1kTE7vFmh4z07");
          }catch(e){ console.error("Erreur envoi email péremption:", e); }
        }
        await setDoc(doc(dbChecklists,"dispatchai_peremption_dates",d.id), {...data, alertSentForDate:soonest});
      }
    }
  }catch(e){ console.error("Erreur vérification alertes péremption:", e); }
}

function PeremptionView({ onBack, checklists, tpmrVslTemplate, peremptionEmails, themeMode, toggleTheme }){
  const peremptionMap=usePeremptionMap();
  const [filter,setFilter]=useState("");
  const [newLotForm,setNewLotForm]=useState({}); // key -> {qty,date}

  useEffect(()=>{ checkAndSendPeremptionAlerts(checklists, peremptionEmails); },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const rowsMap={};
  const addItemRows=(vehicleName,item)=>{
    if(item.p){
      const k=peremptionKey(vehicleName,item.n);
      if(!rowsMap[k]) rowsMap[k]={ vehicleName, itemName:item.n, key:k, lots:sortLots(peremptionMap[k]?.lots) };
    }
    if(item.container){
      (item.subItems||[]).forEach(sub=>{
        if(!sub.n) return;
        const subLabel=`${item.n} — ${sub.n}`;
        const k=peremptionKey(vehicleName,subLabel);
        if(!rowsMap[k]) rowsMap[k]={ vehicleName, itemName:subLabel, key:k, lots:sortLots(peremptionMap[k]?.lots), isSubItem:true, parentName:item.n };
      });
    }
  };
  Object.keys(checklists).sort((a,b)=>a.localeCompare(b)).forEach(vehicleName=>{
    const data=checklists[vehicleName];
    data.sections.forEach(sec=>sec.shelves.forEach(sh=>sh.items.forEach(item=>addItemRows(vehicleName,item))));
  });
  if(tpmrVslTemplate){
    TPMR_VSL_VEHICLES.forEach(vehicleName=>{
      (tpmrVslTemplate.sections||[]).forEach(sec=>sec.shelves.forEach(sh=>sh.items.forEach(item=>addItemRows(vehicleName,item))));
    });
  }
  const rows=Object.values(rowsMap);
  const vehicleNames=[...new Set(rows.map(r=>r.vehicleName))];
  const isExpired=(ym)=>{ if(!ym) return false; const now=new Date(); const cur=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`; return ym<=cur; };
  const rowExpired=(r)=>r.lots.length>0 && isExpired(getSoonestDate(r.lots));
  const filtered=filter
    ?[...rows.filter(r=>r.vehicleName===filter)].sort((a,b)=>(rowExpired(b)?1:0)-(rowExpired(a)?1:0))
    :[...rows].sort((a,b)=>{
        const expDiff=(rowExpired(b)?1:0)-(rowExpired(a)?1:0);
        if(expDiff!==0) return expDiff;
        return a.itemName.localeCompare(b.itemName,"fr")||a.vehicleName.localeCompare(b.vehicleName,"fr");
      });

  const addLot=(r)=>{
    const f=newLotForm[r.key];
    if(!f||!f.qty||!f.date) return;
    savePeremptionLots(r.vehicleName,r.itemName,[...r.lots,{id:"lot"+Date.now(),quantite:parseInt(f.qty),date:f.date}]);
    setNewLotForm(p=>({...p,[r.key]:{qty:"",date:""}}));
  };
  const removeLot=(r,lotId)=>savePeremptionLots(r.vehicleName,r.itemName,r.lots.filter(l=>l.id!==lotId));

  return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
          <div style={{ fontWeight:800, fontSize:16 }}>🗓️ Péremption — vue d'ensemble</div>
        </div>
        <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{ flex:1, padding:16, maxWidth:700, margin:"0 auto", width:"100%" }}>
        <div style={{ display:"flex", gap:8, marginBottom:16, overflowX:"auto" }}>
          <button onClick={()=>setFilter("")} style={{ padding:"7px 14px", borderRadius:20, border:`1px solid ${!filter?CK_C.red:CK_C.border}`, background:!filter?CK_C.red:"transparent", color:!filter?"white":CK_C.muted, fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>Tous</button>
          {vehicleNames.map(v=>(
            <button key={v} onClick={()=>setFilter(v)} style={{ padding:"7px 14px", borderRadius:20, border:`1px solid ${filter===v?CK_C.red:CK_C.border}`, background:filter===v?CK_C.red:"transparent", color:filter===v?"white":CK_C.muted, fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>{v}</button>
          ))}
        </div>
        {filtered.length===0&&<div style={{ textAlign:"center", color:CK_C.muted, padding:40 }}>Aucun article de péremption défini</div>}
        {filtered.map(r=>{
          const soonest=r.lots[0];
          return(
          <div key={r.key} style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:"13px 15px", marginBottom:10 }}>
            <div style={{ fontWeight:700, fontSize:14, color:CK_C.text, marginBottom:2 }}>{r.itemName}{r.isSubItem&&<span style={{ marginLeft:6, fontSize:9, fontWeight:700, color:CK_C.muted, background:CK_C.panel2, borderRadius:5, padding:"2px 6px" }}>DANS {r.parentName}</span>}</div>
            <div style={{ fontSize:11, color:CK_C.muted, marginBottom:10 }}>{r.vehicleName}</div>
            {r.lots.length===0&&<div style={{ fontSize:12, color:CK_C.muted, marginBottom:10 }}>Aucun lot enregistré</div>}
            {r.lots.map(lot=>{
              const isSoonest=soonest&&lot.id===soonest.id;
              return(
                <div key={lot.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, background:isExpired(lot.date)?"#ef444412":isSoonest?"#f59e0b12":CK_C.bg, border:`1px solid ${isExpired(lot.date)?"#ef4444":isSoonest?"#f59e0b":CK_C.border}`, borderRadius:8, padding:"7px 10px", marginBottom:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {isSoonest&&<span title="À utiliser en premier" style={{ width:9, height:9, borderRadius:"50%", background:isExpired(lot.date)?"#ef4444":"#f59e0b", flexShrink:0 }}/>}
                    <span style={{ fontSize:12, fontWeight:700, color:CK_C.text }}>{lot.quantite}×</span>
                    <span style={{ fontSize:12, color:isExpired(lot.date)?"#ef4444":isSoonest?"#f59e0b":CK_C.muted, fontWeight:isSoonest?700:400 }}>{monthYearLabel(lot.date)}</span>
                    {isSoonest&&<span style={{ fontSize:9, fontWeight:700, color:isExpired(lot.date)?"#ef4444":"#f59e0b", textTransform:"uppercase" }}>{isExpired(lot.date)?"Périmé":"À utiliser en 1er"}</span>}
                  </div>
                  <button onClick={()=>removeLot(r,lot.id)} style={{ background:"transparent", border:`1px solid ${CK_C.danger}`, borderRadius:6, color:CK_C.danger, padding:"3px 7px", fontSize:10, cursor:"pointer" }}>🗑</button>
                </div>
              );
            })}
            <div style={{ display:"flex", gap:6, marginTop:8 }}>
              <input type="number" min="1" placeholder="Qté" value={newLotForm[r.key]?.qty||""} onChange={e=>setNewLotForm(p=>({...p,[r.key]:{...p[r.key],qty:e.target.value}}))} style={{ width:55, background:CK_C.bg, border:`1px solid ${CK_C.border}`, borderRadius:6, padding:"6px 8px", color:CK_C.text, fontSize:12 }}/>
              <div style={{ flex:1 }}><MonthYearPicker value={newLotForm[r.key]?.date||""} onChange={v=>setNewLotForm(p=>({...p,[r.key]:{...p[r.key],date:v}}))}/></div>
              <button onClick={()=>addLot(r)} style={{ background:CK_C.red, border:"none", borderRadius:6, color:"white", padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ Lot</button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function ReapprovisionnementView({ onBack, themeMode, toggleTheme, emails, o2Emails, checklists }){
  const [entries,setEntries]=useState([]);
  const [selections,setSelections]=useState({}); // key -> qty sélectionnée (0/absent = pas sélectionné)
  const [respName,setRespName]=useState("");
  const [remarks,setRemarks]=useState("");
  const [sending,setSending]=useState(false);
  const [sentMsg,setSentMsg]=useState(null);
  const [showRemarkModal,setShowRemarkModal]=useState(false);
  const [remarkText,setRemarkText]=useState("");
  const [remarkAuthor,setRemarkAuthor]=useState("");
  const [remarkSending,setRemarkSending]=useState(false);
  const [remarkSent,setRemarkSent]=useState(false);
  const [screen,setScreen]=useState("home"); // "home" | "o2"

  useEffect(()=>{
    const unsub=onSnapshot(collection(dbChecklists,"dispatchai_historique"), snap=>{
      setEntries(snap.docs.map(d=>d.data()));
    });
    return ()=>unsub();
  },[]);

  const allManques=[];
  entries.forEach(entry=>{
    (entry.issues||[]).forEach((iss,idx)=>{
      if(iss.remaining>0) allManques.push({ entryId:entry.id, issueIdx:idx, vehicle:entry.vehicle, ...iss });
    });
  });
  const byVehicle=allManques.reduce((acc,item)=>{ (acc[item.vehicle]=acc[item.vehicle]||[]).push(item); return acc; },{});
  const labelFor=(iss)=>iss.type==="missing"?`Manque : ${iss.remaining}`:iss.type==="nok_test"?"Test NOK":iss.type==="nok_seal"?"Scellé NOK":"Bouteille vide (0 bar)";

  const key=(item)=>`${item.entryId}_${item.issueIdx}`;
  const [peremptionDates,setPeremptionDates]=useState({}); // key -> date saisie pour un article périssable réapprovisionné
  const isPerishable=(vehicle,itemName)=>{
    const data=checklists&&checklists[vehicle];
    if(!data) return false;
    for(const sec of data.sections) for(const sh of sec.shelves) for(const it of sh.items){ if(it.n===itemName && it.p) return true; }
    return false;
  };
  const selectedCount=Object.values(selections).filter(v=>v>0).length;
  const selectedPerishableMissingDate=allManques.some(it=>(selections[key(it)]||0)>0 && isPerishable(it.vehicle,it.name) && !peremptionDates[key(it)]);
  const canSend=respName.trim().length>0 && selectedCount>0 && !sending && !selectedPerishableMissingDate;

  const toggleBoolItem=(item)=>setSelections(p=>({...p,[key(item)]:p[key(item)]?0:1}));

  const canSendRemark=remarkAuthor.trim().length>0 && remarkText.trim().length>0 && !remarkSending;
  const handleSendRemark=async()=>{
    if(!canSendRemark) return;
    setRemarkSending(true);
    try{
      if(emails&&emails.length>0){
        for(const to of emails){
          await emailjs.send("service_mrs8v2l","template_2sxsq4j",{
            to_email: to,
            title: "Checklist Remarque",
            content: `${remarkText.trim()}\n\n${remarkAuthor.trim()}`,
          }, "Fhdx1kTE7vFmh4z07");
        }
      }
    }catch(e){ console.error("Erreur envoi email remarque:", e); }
    setRemarkSending(false);
    setRemarkSent(true);
    setTimeout(()=>{ setShowRemarkModal(false); setRemarkSent(false); setRemarkText(""); setRemarkAuthor(""); }, 1800);
  };
  const setQtyItem=(item,qty)=>setSelections(p=>({...p,[key(item)]:Math.max(0,Math.min(item.remaining,qty))}));

  const handleSend=async()=>{
    if(!canSend) return;
    setSending(true);
    const toResolve=allManques.filter(it=>(selections[key(it)]||0)>0);
    for(const item of toResolve){
      await resolveHistoriqueIssue(item.entryId,item.issueIdx,selections[key(item)]);
      if(isPerishable(item.vehicle,item.name) && peremptionDates[key(item)]){
        const qty=item.type==="missing"?selections[key(item)]:1;
        await addPeremptionLot(item.vehicle,item.name,qty,peremptionDates[key(item)]);
      }
    }
    const vehicleEntries=Object.entries(byVehicle).map(([vehicle,items])=>{
      const resolvedItems=items.filter(it=>(selections[key(it)]||0)>0);
      if(resolvedItems.length===0) return null;
      const itemLines=resolvedItems.map(it=>{
        const qty=selections[key(it)];
        return it.type==="missing"?`- ${it.name} : +${qty} réapprovisionné`:`- ${it.name} : résolu`;
      });
      const stillMissing=items.filter(it=>(it.remaining-(selections[key(it)]||0))>0);
      const statusLine=stillMissing.length===0?"✅ Véhicule totalement réapprovisionné":`⚠ Encore en attente : ${stillMissing.map(i=>i.name).join(", ")}`;
      return { vehicle, block:`${itemLines.join("\n")}\n${statusLine}` };
    }).filter(Boolean);
    if(vehicleEntries.length===0){ setSending(false); return; }
    const firstVehicle=vehicleEntries[0].vehicle;
    let content=`Véhicule : ${firstVehicle}\n\nMatériel manquant : \n${vehicleEntries[0].block}`;
    vehicleEntries.slice(1).forEach(v=>{
      content += `\n\nVéhicule : ${v.vehicle}\n\nMatériel manquant : \n${v.block}`;
    });
    if(remarks.trim()) content += `\n\nRemarques : ${remarks.trim()}`;
    content += `\n\nRéapprovisionné par : ${respName.trim()}`;
    try{
      if(emails&&emails.length>0){
        for(const to of emails){
          await emailjs.send("service_mrs8v2l","template_2sxsq4j",{
            to_email: to,
            title: "Checklist Réapprovisionnement — Matériel manquant",
            content: content,
          }, "Fhdx1kTE7vFmh4z07");
        }
      }
    }catch(e){ console.error("Erreur envoi email réappro:", e); }
    setSending(false);
    setSelections({});
    setRemarks("");
    setSentMsg("✅ Réapprovisionnement enregistré et envoyé !");
    setTimeout(()=>setSentMsg(null),4000);
  };

  if(screen==="o2") return <O2ReserveView onBack={()=>setScreen("home")} themeMode={themeMode} toggleTheme={toggleTheme} emails={o2Emails}/>;

  return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
          <div>
            <div style={{ fontWeight:800, fontSize:16 }}>📦 Réapprovisionnement</div>
            <div style={{ fontSize:10, color:CK_C.muted }}>Accès libre — mode armoire</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ background:allManques.length===0?CK_C.successSoft:CK_C.dangerSoft, border:`1px solid ${allManques.length===0?CK_C.success:CK_C.danger}`, borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700, color:allManques.length===0?CK_C.success:CK_C.danger }}>{allManques.length===0?"✅ Tout OK":`${allManques.length} manque(s)`}</div>
          <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, padding:"16px 18px 0" }}>
        <button onClick={()=>setScreen("o2")} style={{flex:1,background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:10,color:CK_C.text,padding:"13px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><span style={{color:"#3b82f6",fontWeight:900}}>O₂</span> Réserve</button>
        <button onClick={()=>setShowRemarkModal(true)} style={{flex:1,background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:10,color:CK_C.text,padding:"13px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>📝 Remarque</button>
      </div>

      {allManques.length>0&&(
        <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"12px 18px", display:"flex", gap:8 }}>
          <input value={respName} onChange={e=>setRespName(e.target.value)} placeholder="Ton nom (obligatoire)*" style={{ flex:1, background:CK_C.bg, border:`1px solid ${respName.trim()?CK_C.border:CK_C.danger}`, borderRadius:8, padding:"8px 12px", color:CK_C.text, fontSize:13 }}/>
        </div>
      )}

      <div style={{ flex:1, padding:"14px", overflowY:"auto", paddingBottom:allManques.length>0?140:14 }}>
        {allManques.length===0&&(
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:50, marginBottom:14 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:800, color:CK_C.success }}>Tout est réapprovisionné !</div>
          </div>
        )}
        {Object.entries(byVehicle).map(([vehicle,items])=>(
          <div key={vehicle} style={{ marginBottom:16 }}>
            <div style={{ fontWeight:800, fontSize:14, marginBottom:8, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ background:CK_C.red, color:"white", borderRadius:8, padding:"4px 10px", fontSize:13 }}>🚑 {vehicle}</span>
              <span style={{ background:CK_C.dangerSoft, border:`1px solid ${CK_C.danger}`, borderRadius:20, padding:"2px 8px", fontSize:11, color:CK_C.danger, fontWeight:700 }}>{items.length} manque(s)</span>
            </div>
            {items.map(item=>{
              const k=key(item);
              const isQty=item.type==="missing";
              const selQty=selections[k]||0;
              const isSel=selQty>0;
              const perishable=isPerishable(item.vehicle,item.name);
              const dateMissing=isSel&&perishable&&!peremptionDates[k];
              return(
                <div key={k} style={{ background:isSel?CK_C.successSoft:CK_C.panel, border:`1px solid ${dateMissing?CK_C.danger:isSel?CK_C.success:CK_C.border}`, borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700 }}>{item.name}</div>
                      <div style={{ fontSize:11, color:CK_C.danger, marginTop:2 }}>{labelFor(item)}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {isQty?(
                        <div style={{ display:"flex", alignItems:"center", background:CK_C.bg, border:`1px solid ${CK_C.border}`, borderRadius:10, overflow:"hidden" }}>
                          <button onClick={()=>setQtyItem(item,selQty-1)} style={{ width:30, height:34, background:"transparent", border:"none", color:CK_C.muted, fontSize:16 }}>−</button>
                          <div style={{ minWidth:28, textAlign:"center", fontSize:13, fontWeight:800, color:isSel?CK_C.success:CK_C.text, borderLeft:`1px solid ${CK_C.border}`, borderRight:`1px solid ${CK_C.border}`, height:34, display:"flex", alignItems:"center", justifyContent:"center" }}>{selQty}</div>
                          <button onClick={()=>setQtyItem(item,selQty+1)} style={{ width:30, height:34, background:"transparent", border:"none", color:CK_C.muted, fontSize:16 }}>+</button>
                        </div>
                      ):(
                        <button onClick={()=>toggleBoolItem(item)} style={{ background:isSel?CK_C.success:"transparent", border:`1.5px solid ${isSel?CK_C.success:CK_C.border}`, borderRadius:10, color:isSel?"white":CK_C.muted, padding:"8px 16px", fontWeight:800, fontSize:13, cursor:"pointer" }}>{isSel?"✓ Sélectionné":"Réapprovisionner"}</button>
                      )}
                    </div>
                  </div>
                  {isSel&&perishable&&(
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginTop:10, paddingTop:10, borderTop:`1px dashed ${CK_C.border}` }}>
                      <div style={{ fontSize:11, color:dateMissing?CK_C.danger:"#fbbf24", fontWeight:dateMissing?700:400 }}>Nouvelle date de péremption{dateMissing?" (obligatoire)":""}</div>
                      <MonthYearPicker value={peremptionDates[k]||""} onChange={v=>setPeremptionDates(p=>({...p,[k]:v}))} danger={dateMissing}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {allManques.length>0&&(
          <div style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:"14px", marginTop:6 }}>
            <div style={{ fontSize:11, fontWeight:700, color:CK_C.muted, textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 }}>📝 Remarques</div>
            <textarea value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Observations sur ce réapprovisionnement..." rows={3} style={{ width:"100%", background:CK_C.bg, border:`1px solid ${CK_C.border}`, borderRadius:8, padding:"10px 12px", color:CK_C.text, fontSize:13, resize:"none" }}/>
          </div>
        )}
      </div>

      {allManques.length>0&&(
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:CK_C.panel, borderTop:`1px solid ${CK_C.border}`, padding:"13px 16px" }}>
          {sentMsg&&<div style={{ background:CK_C.successSoft, border:`1px solid ${CK_C.success}`, borderRadius:8, padding:"8px 12px", marginBottom:8, fontSize:12, color:CK_C.success, fontWeight:700, textAlign:"center" }}>{sentMsg}</div>}
          {!canSend&&!sentMsg&&(
            <div style={{ background:CK_C.dangerSoft, border:`1px solid ${CK_C.danger}`, borderRadius:8, padding:"8px 12px", marginBottom:8, fontSize:11, color:CK_C.danger, fontWeight:600, textAlign:"center" }}>
              {!respName.trim()?"⚠ Indique ton nom":"⚠ Sélectionne au moins un article réapprovisionné"}
            </div>
          )}
          <button disabled={!canSend} onClick={handleSend} style={{ width:"100%", background:canSend?CK_C.success:CK_C.border, border:"none", borderRadius:10, color:"white", padding:"14px", fontWeight:800, fontSize:15, cursor:canSend?"pointer":"not-allowed", opacity:canSend?1:0.6 }}>
            {sending?"Envoi…":`✅ Envoyer${selectedCount>0?` (${selectedCount})`:""}`}
          </button>
        </div>
      )}

      {showRemarkModal&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:400 }}>
          <div style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:16, padding:"24px", width:400, maxWidth:"92vw" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:16 }}>📝 Remarque</div>
              <button onClick={()=>{setShowRemarkModal(false);setRemarkText("");setRemarkAuthor("");setRemarkSent(false);}} style={{ background:"transparent", border:"none", color:CK_C.muted, fontSize:22, cursor:"pointer" }}>×</button>
            </div>
            {remarkSent?(
              <div style={{ background:CK_C.successSoft, border:`1px solid ${CK_C.success}`, borderRadius:10, padding:"14px", textAlign:"center", fontWeight:700, color:CK_C.success }}>✅ Remarque envoyée !</div>
            ):(
              <>
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:10, color:CK_C.muted, marginBottom:5, textTransform:"uppercase" }}>Ton nom*</div>
                  <input value={remarkAuthor} onChange={e=>setRemarkAuthor(e.target.value)} placeholder="Nom (obligatoire)" style={{ width:"100%", background:CK_C.bg, border:`1px solid ${remarkAuthor.trim()?CK_C.border:CK_C.danger}`, borderRadius:8, padding:"9px 12px", color:CK_C.text, fontSize:13 }}/>
                </div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, color:CK_C.muted, marginBottom:5, textTransform:"uppercase" }}>Remarque*</div>
                  <textarea value={remarkText} onChange={e=>setRemarkText(e.target.value)} placeholder="Une remarque sur le matériel, une checklist..." rows={4} style={{ width:"100%", background:CK_C.bg, border:`1px solid ${remarkText.trim()?CK_C.border:CK_C.danger}`, borderRadius:8, padding:"9px 12px", color:CK_C.text, fontSize:13, resize:"none" }}/>
                </div>
                <button disabled={!canSendRemark} onClick={handleSendRemark} style={{ width:"100%", background:canSendRemark?CK_C.success:CK_C.border, border:"none", borderRadius:10, color:"white", padding:"12px", fontWeight:800, fontSize:14, cursor:canSendRemark?"pointer":"not-allowed", opacity:canSendRemark?1:0.6 }}>
                  {remarkSending?"Envoi…":"✅ Envoyer"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


const O2_VEHICLES=["ALPHA 1","ALPHA 2","ALPHA 3","ALPHA 4","ALPHA 5","ALPHA 6","ALPHA 7","Préventif"];

function BottleStepper({label,value,onChange,max=2}){
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0"}}>
      <div style={{fontSize:13,fontWeight:700}}>{label}</div>
      <div style={{display:"flex",alignItems:"center",background:CK_C.bg,border:`1px solid ${CK_C.border}`,borderRadius:10,overflow:"hidden"}}>
        <button onClick={()=>onChange(Math.max(0,value-1))} style={{width:34,height:36,background:"transparent",border:"none",color:CK_C.muted,fontSize:18}}>−</button>
        <div style={{minWidth:32,textAlign:"center",fontWeight:800,fontSize:15,color:value>0?"#3b82f6":CK_C.text}}>{value}</div>
        <button onClick={()=>onChange(Math.min(max,value+1))} style={{width:34,height:36,background:"transparent",border:"none",color:CK_C.muted,fontSize:18}}>+</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// RÉSERVE OXYGÈNE — compteurs, échanges véhicules, livraison fournisseur
// ═══════════════════════════════════════
function O2ReserveView({ onBack, themeMode, toggleTheme, emails }){
  const [reserve,setReserve]=useState(O2_EMPTY_RESERVE);
  const [screen,setScreen]=useState("home"); // home | vehicle | fournisseur | historique
  const [selectedVehicle,setSelectedVehicle]=useState(null);
  const [sortie,setSortie]=useState({B2:0,B5:0,B10:0});
  const [entree,setEntree]=useState({B2:0,B5:0,B10:0});
  const [vName,setVName]=useState("");
  const [saving,setSaving]=useState(false);
  const [savedMsg,setSavedMsg]=useState(null);
  const [fSortie,setFSortie]=useState({B2:0,B5:0,B10:0});
  const [fEntree,setFEntree]=useState({B2:0,B5:0,B10:0});
  const [fSaving,setFSaving]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(doc(dbChecklists,"dispatchai_o2","reserve"), snap=>{
      const d=snap.exists()?snap.data():O2_EMPTY_RESERVE;
      setReserve({ pleines:{...O2_EMPTY_RESERVE.pleines,...d.pleines}, vides:{...O2_EMPTY_RESERVE.vides,...d.vides} });
    });
    return ()=>unsub();
  },[]);

  const resetVehicleForm=()=>{ setSortie({B2:0,B5:0,B10:0}); setEntree({B2:0,B5:0,B10:0}); setVName(""); };
  const canSendVehicle = vName.trim().length>0 && (Object.values(sortie).some(v=>v>0)||Object.values(entree).some(v=>v>0)) && !saving;

  const handleSendVehicle=async()=>{
    if(!canSendVehicle) return;
    setSaving(true);
    const {current,next}=await applyO2Movement("vehicule", sortie, entree, { vehicle:selectedVehicle, name:vName.trim() });
    await checkAndSendO2LowStock(current,next,emails);
    setSaving(false);
    setSavedMsg("✅ Mouvement enregistré");
    resetVehicleForm();
    setTimeout(()=>{ setSavedMsg(null); setScreen("home"); setSelectedVehicle(null); }, 1200);
  };

  const canSendFournisseur = (Object.values(fSortie).some(v=>v>0)||Object.values(fEntree).some(v=>v>0)) && !fSaving;
  const handleSendFournisseur=async()=>{
    if(!canSendFournisseur) return;
    setFSaving(true);
    const {current,next}=await applyO2Movement("fournisseur", fSortie, fEntree, {});
    await checkAndSendO2LowStock(current,next,emails);
    setFSaving(false);
    setFSortie({B2:0,B5:0,B10:0});
    setFEntree({B2:0,B5:0,B10:0});
    setScreen("home");
  };

  const headerBar = (title) => (
    <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={()=>{ if(screen==="home"){onBack();}else{setScreen("home");setSelectedVehicle(null);resetVehicleForm();} }} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
        <div style={{ fontWeight:800, fontSize:16 }}>{title}</div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        {screen==="home"&&<button onClick={()=>setScreen("historique")} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>📅 Historique</button>}
        {screen==="home"&&<button onClick={()=>setScreen("fournisseur")} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>🚚 Livraison fournisseur</button>}
        <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
    </div>
  );

  if(screen==="historique"){
    return <O2HistoriqueSubView onBack={()=>setScreen("home")} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  }

  if(screen==="fournisseur"){
    return(
      <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
        <style>{CK_GS}</style>
        {headerBar("🚚 Livraison fournisseur")}
        <div style={{ flex:1, padding:"18px", maxWidth:420, margin:"0 auto", width:"100%" }}>
          <div style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:"16px", marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:CK_C.danger, textTransform:"uppercase", marginBottom:4 }}>Sortie</div>
            <div style={{ fontSize:10, color:CK_C.muted, marginBottom:6 }}>Vides reprises par le fournisseur</div>
            {O2_SIZES.map(s=>(<BottleStepper key={s} label={s} value={fSortie[s]} onChange={v=>setFSortie(p=>({...p,[s]:v}))} max={99}/>))}
          </div>
          <div style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:"16px", marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:CK_C.success, textTransform:"uppercase", marginBottom:4 }}>Entrée</div>
            <div style={{ fontSize:10, color:CK_C.muted, marginBottom:6 }}>Pleines livrées par le fournisseur</div>
            {O2_SIZES.map(s=>(<BottleStepper key={s} label={s} value={fEntree[s]} onChange={v=>setFEntree(p=>({...p,[s]:v}))} max={99}/>))}
          </div>
          <button disabled={!canSendFournisseur} onClick={handleSendFournisseur} style={{ width:"100%", background:canSendFournisseur?CK_C.success:CK_C.border, border:"none", borderRadius:10, color:"white", padding:"14px", fontWeight:800, fontSize:15, cursor:canSendFournisseur?"pointer":"not-allowed", opacity:canSendFournisseur?1:0.6 }}>
            {fSaving?"Envoi…":"✅ Enregistrer"}
          </button>
        </div>
      </div>
    );
  }

  if(screen==="vehicle"&&selectedVehicle){
    return(
      <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
        <style>{CK_GS}</style>
        {headerBar(selectedVehicle==="Préventif"?"🧰 Préventif":`🚑 ${selectedVehicle}`)}
        <div style={{ flex:1, padding:"18px", maxWidth:420, margin:"0 auto", width:"100%" }}>
          {savedMsg?(
            <div style={{ background:CK_C.successSoft, border:`1px solid ${CK_C.success}`, borderRadius:10, padding:"16px", textAlign:"center", fontWeight:700, color:CK_C.success }}>{savedMsg}</div>
          ):(
            <>
              <div style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:"16px", marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:CK_C.danger, textTransform:"uppercase", marginBottom:4 }}>Sortie</div>
                <div style={{ fontSize:10, color:CK_C.muted, marginBottom:6 }}>Bouteille(s) retirée(s) du véhicule</div>
                {O2_SIZES.map(s=>(<BottleStepper key={s} label={s} value={sortie[s]} onChange={v=>setSortie(p=>({...p,[s]:v}))}/>))}
              </div>
              <div style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:"16px", marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:CK_C.success, textTransform:"uppercase", marginBottom:4 }}>Entrée</div>
                <div style={{ fontSize:10, color:CK_C.muted, marginBottom:6 }}>Bouteille(s) installée(s) dans le véhicule</div>
                {O2_SIZES.map(s=>(<BottleStepper key={s} label={s} value={entree[s]} onChange={v=>setEntree(p=>({...p,[s]:v}))}/>))}
              </div>
              <input value={vName} onChange={e=>setVName(e.target.value)} placeholder="Ton nom (obligatoire)*" style={{ width:"100%", background:CK_C.bg, border:`1px solid ${vName.trim()?CK_C.border:CK_C.danger}`, borderRadius:8, padding:"10px 12px", color:CK_C.text, fontSize:13, marginBottom:14, boxSizing:"border-box" }}/>
              <button disabled={!canSendVehicle} onClick={handleSendVehicle} style={{ width:"100%", background:canSendVehicle?CK_C.success:CK_C.border, border:"none", borderRadius:10, color:"white", padding:"14px", fontWeight:800, fontSize:15, cursor:canSendVehicle?"pointer":"not-allowed", opacity:canSendVehicle?1:0.6 }}>
                {saving?"Envoi…":"✅ Enregistrer"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      {headerBar("O₂ Réserve")}
      <div style={{ display:"flex", gap:8, padding:"16px 18px 0" }}>
        {O2_SIZES.map(s=>{
          const low=(reserve.pleines[s]||0)<=2;
          return(
            <div key={s} style={{ flex:1, background:low?CK_C.dangerSoft:CK_C.panel, border:`1px solid ${low?CK_C.danger:CK_C.border}`, borderRadius:12, padding:"12px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:900, color:low?CK_C.danger:"#3b82f6" }}>{reserve.pleines[s]||0}</div>
              <div style={{ fontSize:10, color:low?CK_C.danger:CK_C.muted, fontWeight:700, marginTop:2 }}>{s} pleines</div>
            </div>
          );
        })}
      </div>
      <div style={{ flex:1, padding:"18px", maxWidth:480, margin:"0 auto", width:"100%" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {O2_VEHICLES.map(v=>(
            <button key={v} onClick={()=>{setSelectedVehicle(v);setScreen("vehicle");}} style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:"18px 10px", color:CK_C.text, fontWeight:700, fontSize:14, cursor:"pointer" }}>
              {v==="Préventif"?"🧰 Préventif":`🚑 ${v}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChecklistsHome({ onBack, checklists, emails, o2Emails, peremptionEmails, vehicles, carnetBordTypes, themeMode, toggleTheme }) {
  const [selected, setSelected] = useState(null);
  const [screen, setScreen] = useState("home"); // "home" | "historique" | "reappro" | "peremption" | "tpmrvsl_list"
  const [selectedTpmrVsl, setSelectedTpmrVsl] = useState(null);
  const statuses = useChecklistsWeekStatus(checklists);
  const [tpmrVslTemplate] = useFirestoreState("tpmrVslChecklistTemplate", { sections: [] });
  const monthKey = getChecklistMonthKey();
  const tpmrVslStatuses = useTpmrVslMonthStatus(tpmrVslTemplate);

  if (selected) return <ChecklistView vehicleName={selected} onBack={() => setSelected(null)} checklists={checklists} emails={emails} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if (selectedTpmrVsl) return <TpmrVslChecklistView vehicleName={selectedTpmrVsl} template={tpmrVslTemplate} onBack={()=>setSelectedTpmrVsl(null)} emails={emails} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if (screen==="historique") return <HistoriqueView onBack={()=>setScreen("home")} vehicles={vehicles} carnetBordTypes={carnetBordTypes} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if (screen==="reappro") return <ReapprovisionnementView onBack={()=>setScreen("home")} themeMode={themeMode} toggleTheme={toggleTheme} emails={emails} o2Emails={o2Emails} checklists={checklists}/>;
  if (screen==="peremption") return <PeremptionView onBack={()=>setScreen("home")} checklists={checklists} tpmrVslTemplate={tpmrVslTemplate} peremptionEmails={peremptionEmails} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if (screen==="tpmrvsl_list") return(
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={()=>setScreen("home")} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"6px 12px", fontSize:14, cursor:"pointer" }}>←</button>
          <div style={{ fontWeight:800, fontSize:16 }}>♿ Sac TPMR/VSL</div>
        </div>
        <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{ flex:1, padding:"20px", maxWidth:480, margin:"0 auto", width:"100%" }}>
        <div style={{ fontSize:12, color:CK_C.muted, marginBottom:14, textTransform:"capitalize" }}>{monthYearLabel(monthKey)} — modèle unique partagé pour tous</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {TPMR_VSL_VEHICLES.map(v=>{
            const st=tpmrVslStatuses[v];
            const dotColor=st?.complete?CK_C.success:st?.started?"#f59e0b":CK_C.muted;
            const dotLabel=st?.complete?"✅ Complète":st?.started?"🟠 En cours":"Non commencée";
            return(
              <button key={v} onClick={()=>setSelectedTpmrVsl(v)} style={{ background:CK_C.panel, border:`1px solid ${st?.complete?CK_C.success:st?.started?"#f59e0b":CK_C.border}`, borderRadius:13, padding:"14px 18px", color:CK_C.text, textAlign:"left", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:36, height:36, background:CK_C.red, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>♿</div>
                  <div><div style={{ fontWeight:700, fontSize:14 }}>{v}</div><div style={{ fontSize:11, fontWeight:700, color:dotColor }}>{dotLabel}</div></div>
                </div>
                <span style={{ color:CK_C.muted, fontSize:18 }}>→</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:CK_C.bg, fontFamily:"'DM Sans',sans-serif", color:CK_C.text, display:"flex", flexDirection:"column" }}>
      <style>{CK_GS}</style>
      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"18px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${CK_C.border}`, borderRadius:8, color:CK_C.muted, padding:"7px 13px", fontSize:13, cursor:"pointer" }}>← Menu</button>
          <div style={{ width:40, height:40, background:CK_C.red, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🚑</div>
          <div>
            <div style={{ fontWeight:800, fontSize:18 }}>A.P.S. — Checklists</div>
            <div style={{ fontSize:10, color:CK_C.muted, textTransform:"uppercase", letterSpacing:"1.2px" }}>Sélectionnez votre véhicule</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={()=>setScreen("peremption")} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>🗓️ Péremption</button>
          <button onClick={()=>setScreen("historique")} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>📅 Historique</button>
          <button onClick={toggleTheme} style={{background:CK_C.panel2,border:`1px solid ${CK_C.border}`,borderRadius:8,color:CK_C.muted,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙 Sombre":"☀️ Clair"}</button>
        </div>
      </div>
      <div style={{ textAlign:"center", padding:"10px 20px 0", fontSize:12, color:CK_C.muted, fontWeight:600 }}>Semaine {getChecklistWeekNumber()}</div>
      {isFirstWeekOfMonth()&&(
        <div style={{ background:"#f59e0b20", borderBottom:`1px solid #f59e0b`, padding:"9px 20px", fontSize:12, fontWeight:700, color:"#fbbf24", textAlign:"center" }}>
          📅 1ère semaine du mois — les dates de scellé sont à renseigner
        </div>
      )}
      <div style={{ flex:1, padding:"24px 20px", maxWidth:480, margin:"0 auto", width:"100%" }}>
        <button onClick={()=>setScreen("reappro")} style={{ width:"100%", marginBottom:16, background:CK_C.panel, border:`2px dashed ${CK_C.border}`, borderRadius:13, padding:"14px 20px", color:CK_C.muted, display:"flex", alignItems:"center", justifyContent:"center", gap:10, fontWeight:700, fontSize:14, cursor:"pointer" }}>
          <span>📦</span> Accès Réapprovisionnement
        </button>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {Object.keys(checklists).sort((a,b)=>{
            const aDone=statuses[a]?.complete?1:0;
            const bDone=statuses[b]?.complete?1:0;
            if(aDone!==bDone) return aDone-bDone;
            return a.localeCompare(b);
          }).map(name => {
            const st = statuses[name];
            const dotColor = st?.complete ? CK_C.success : st?.started ? "#f59e0b" : CK_C.muted;
            const dotLabel = st?.complete ? "✅ Complète" : st?.started ? `🟠 En cours (${st.progress}%)` : "Non commencée";
            return(
            <button key={name} onClick={() => setSelected(name)}
              style={{ background:CK_C.panel, border:`1px solid ${st?.complete?CK_C.success:st?.started?"#f59e0b":CK_C.border}`, borderRadius:13, padding:"16px 20px", color:CK_C.text, textAlign:"left", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:42, height:42, background:CK_C.red, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, position:"relative" }}>
                  🚑
                  <div style={{ position:"absolute", bottom:-2, right:-2, width:14, height:14, borderRadius:"50%", background:dotColor, border:`2px solid ${CK_C.panel}` }}/>
                </div>
                <div>
                  <div style={{ fontWeight:800, fontSize:16 }}>{name}</div>
                  <div style={{ fontSize:11, color:CK_C.muted }}>Norme {checklists[name].norme}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:dotColor, marginTop:2 }}>{dotLabel}</div>
                </div>
              </div>
              <span style={{ color:CK_C.muted, fontSize:20 }}>→</span>
            </button>
            );
          })}
        </div>
        <button onClick={()=>setScreen("tpmrvsl_list")} style={{ width:"100%", marginTop:14, background:CK_C.panel, border:`1.5px solid ${CK_C.border}`, borderRadius:13, padding:"16px 20px", color:CK_C.text, textAlign:"left", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:42, height:42, background:CK_C.panel2, border:`1px solid ${CK_C.border}`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>♿</div>
            <div>
              <div style={{ fontWeight:800, fontSize:16 }}>TPMR / VSL</div>
              <div style={{ fontSize:11, color:CK_C.muted }}>Sac — check mensuelle, modèle unique</div>
            </div>
          </div>
          <span style={{ color:CK_C.muted, fontSize:20 }}>→</span>
        </button>
      </div>
    </div>
  );
}


function todayFR(){
  const d=new Date();
  return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();
}
function frToISO(fr){
  if(!fr) return "";
  const parts=fr.split("/");
  if(parts.length!==3) return "";
  const [dd,mm,yyyy]=parts;
  if(!dd||!mm||!yyyy||yyyy.length!==4) return "";
  return `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
}
function isoToFR(iso){
  if(!iso) return "";
  const [yyyy,mm,dd]=iso.split("-");
  if(!yyyy||!mm||!dd) return "";
  return `${dd}/${mm}/${yyyy}`;
}
function todayISO(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getChecklistWeekKey(){
  const d=new Date();
  const day=d.getDay();
  const diffToMonday=day===0?-6:1-day;
  const monday=new Date(d);
  monday.setDate(d.getDate()+diffToMonday);
  monday.setHours(0,0,0,0);
  return monday.toISOString().slice(0,10);
}
// Clé mensuelle pour la checklist "Sac TPMR/VSL" (reset automatique chaque mois).
function getChecklistMonthKey(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
const TPMR_VSL_VEHICLES=["TPMR 1","TPMR 2","TPMR 3","TPMR 4","TPMR 5","TPMR 6","TPMR 7","TPMR 8","VSL 1","VSL 2"];
// Numéro de semaine ISO (ex: "32" pour la semaine du 3 août 2026), calculé
// à partir du lundi de la semaine en cours.
function getChecklistWeekNumber(){
  const monday=new Date(getChecklistWeekKey()+"T00:00:00");
  const jan4=new Date(monday.getFullYear(),0,4);
  const startOfWeek1=new Date(jan4);
  startOfWeek1.setDate(jan4.getDate()-((jan4.getDay()||7)-1));
  const weekNum=Math.round((monday-startOfWeek1)/(7*86400000))+1;
  return weekNum;
}
// Enregistre une checklist envoyée dans l'historique (collection Firestore
// dédiée). Chaque manque garde un "remaining" indépendant pour permettre un
// réapprovisionnement partiel/progressif après coup.
async function saveChecklistHistorique(entry){
  try{
    await setDoc(doc(dbChecklists,"dispatchai_historique",entry.id), entry);
  }catch(e){ console.error("Erreur sauvegarde historique:", e); }
}
// Purge les entrées de plus de 24 mois (écart de mois calendaires, pas de
// jours — ex: en janvier 2028, tout ce qui date de janvier 2026 ou avant
// est supprimé).
async function cleanOldHistorique(){
  try{
    const snap=await getDocs(collection(dbChecklists,"dispatchai_historique"));
    const now=new Date();
    const toDelete=[];
    snap.forEach(d=>{
      const data=d.data();
      const entryDate=new Date(data.dateISO||data.timestamp);
      const monthsDiff=(now.getFullYear()-entryDate.getFullYear())*12+(now.getMonth()-entryDate.getMonth());
      if(monthsDiff>=24) toDelete.push(deleteDoc(doc(dbChecklists,"dispatchai_historique",d.id)));
    });
    if(toDelete.length>0) await Promise.all(toDelete);
  }catch(e){ console.error("Erreur nettoyage historique:", e); }
}
// Marque un manque précis (par index dans l'entrée) comme réapprovisionné
// d'une quantité donnée : diminue le restant et cumule le total réapprovisionné.
async function resolveHistoriqueIssue(entryId, issueIdx, qtyResupplied){
  try{
    const ref=doc(dbChecklists,"dispatchai_historique",entryId);
    const snap=await getDoc(ref);
    if(!snap.exists()) return;
    const data=snap.data();
    const issues=(data.issues||[]).map((iss,i)=>{
      if(i!==issueIdx) return iss;
      const newRemaining=Math.max(0,(iss.remaining||0)-qtyResupplied);
      const newResupplied=(iss.resupplied||0)+qtyResupplied;
      return {...iss, remaining:newRemaining, resupplied:newResupplied};
    });
    await setDoc(ref, {...data, issues}, {merge:true});
  }catch(e){ console.error("Erreur réappro:", e); }
}

// ═══════════════════════════════════════
// RÉSERVE OXYGÈNE — compteurs Pleines/Vides par taille + journal des mouvements
// ═══════════════════════════════════════
const O2_SIZES=["B2","B5","B10"];
const O2_EMPTY_RESERVE={ pleines:{B2:0,B5:0,B10:0}, vides:{B2:0,B5:0,B10:0} };

// ═══════════════════════════════════════
// CHECKLIST JOURNALIÈRE (portée depuis APS Daily) — modèles par flotte
// ═══════════════════════════════════════
const DAILY_CHECKLIST_ALPHA = [
  { section: '🚗 Véhicule', items: [
    { id:'fuel', label:'Carburant', type:'fuel', required:true },
    { id:'phares', label:'Phares', type:'ok_nok', required:true },
    { id:'clignotants', label:'Clignotants', type:'ok_nok', required:true },
    { id:'feux_bleus', label:'Feux bleus', type:'ok_nok', required:true },
    { id:'feux_travail', label:'Feux de travail', type:'ok_nok', required:true },
    { id:'eclairage_cab', label:'Éclairage cabine sanitaire', type:'ok_nok', required:true },
    { id:'huile', label:"Niveau d'huile moteur", type:'ok_insuf', required:true },
    { id:'refroid', label:'Niveau liquide de refroidissement', type:'ok_insuf', required:true },
    { id:'freins', label:'Niveau liquide de freins', type:'ok_insuf', required:true },
    { id:'lave_glace', label:'Niveau lave-glace', type:'ok_insuf', required:true },
    { id:'pneus_av', label:'État des pneus avant', type:'pneus', required:true },
    { id:'pneus_ar', label:'État des pneus arrière', type:'pneus', required:true },
  ]},
  { section: '🧹 Propreté', items: [
    { id:'carrosserie', label:'Carrosserie', type:'propre_sale', required:true },
    { id:'cab_chauffeur', label:'Cabine chauffeur', type:'propre_sale', required:true },
    { id:'cab_sanitaire', label:'Cabine sanitaire', type:'propre_sale', required:true },
    { id:'poubelle', label:'Poubelle', type:'vide_pleine', required:true },
  ]},
  { section: '🧰 Équipement', items: [
    { id:'extincteur', label:'Extincteur', type:'ok_nok', required:true },
    { id:'boite_secours', label:'Boîte de secours', type:'ok_nok', required:true },
    { id:'triangle', label:'Triangle', type:'ok_nok', required:true },
    { id:'marteau', label:'Marteau brise-vitre', type:'ok_nok', required:true },
    { id:'radio_fixe', label:'Radio fixe', type:'ok_nok_np', required:true },
    { id:'radio_port', label:'Radio portative', type:'ok_nok_np', required:true },
    { id:'marchepied', label:'Marchepied', type:'ok_nok_np', required:true },
    { id:'draps', label:'Sets de draps x3', type:'ok_nok', required:true },
    { id:'toile_glisse', label:'Toile de glisse', type:'ok_nok', required:true },
  ]},
  { section: '📄 Documents', items: [
    { id:'cert_conf', label:'Certificat de conformité', type:'ok_nok', required:true },
    { id:'immat', label:"Certificat d'immatriculation", type:'ok_nok', required:true },
    { id:'assurance', label:'Assurance', type:'ok_nok', required:true },
    { id:'ct', label:'Contrôle technique', type:'date', required:true },
    { id:'constat', label:"Constat d'accident", type:'ok_nok', required:true },
    { id:'carnet_bord', label:'Carnet de bord', type:'ok_nok', required:true },
    { id:'bon_transport', label:'Bon de transport', type:'ok_nok', required:true },
    { id:'carte_carb', label:'Carte carburant', type:'ok_nok', required:false },
    { id:'suivi_hygiene', label:"Suivi d'hygiène", type:'ok_nok', required:false },
    { id:'farde_listing', label:'Farde listing hôpitaux', type:'ok_nok', required:false },
    { id:'farde_sceller', label:'Farde scellée', type:'ok_nok', required:false },
  ]},
  { section: "🏥 Cartes d'accès hôpitaux", items: [
    { id:'h_epicura', label:'Epicura', type:'ok_nok', required:false },
    { id:'h_chwapi', label:'Chwapi', type:'ok_nok', required:false },
    { id:'h_chm', label:'CHM', type:'ok_nok', required:false },
    { id:'h_glorieux', label:'AZ Glorieux', type:'ok_nok', required:false },
  ]},
  { section: '🔬 Paramètres médicaux', items: [
    { id:'pulsox', label:'Pulsoxymètre', type:'ok_nok_np', required:false },
    { id:'tensio', label:'Tensiomètre', type:'ok_nok_np', required:false },
    { id:'gluco', label:'Glucomètre', type:'ok_nok_np', required:false },
    { id:'thermo_auri', label:'Thermomètre auriculaire', type:'ok_nok_np', required:false },
    { id:'thermo_digit', label:'Thermomètre digital', type:'ok_nok_np', required:true },
  ]},
  { section: '🫁 Oxygènes', items: [
    { id:'o2_b2_1', label:'B2 (1)', type:'o2', required:true },
    { id:'o2_b2_2', label:'B2 (2)', type:'o2', required:true },
    { id:'o2_b10_1', label:'B10 (1)', type:'o2', required:true },
    { id:'o2_b10_2', label:'B10 (2)', type:'o2', required:true },
  ]},
  { section: '📝 Fin de checklist', items: [
    { id:'km', label:'Kilométrage', type:'number', required:true },
    { id:'remarques', label:'Remarques / Problèmes', type:'textarea', required:false },
    { id:'nom1', label:'Ambulancier 1', type:'text', required:true },
    { id:'nom2', label:'Ambulancier 2', type:'text', required:false },
  ]},
];

const DAILY_CHECKLIST_TPMR = [
  { section: '🚗 Véhicule', items: [
    { id:'fuel', label:'Carburant', type:'fuel', required:true },
    { id:'phares', label:'Phares', type:'ok_nok', required:true },
    { id:'clignotants', label:'Clignotants', type:'ok_nok', required:true },
    { id:'huile', label:"Niveau d'huile moteur", type:'ok_insuf', required:true },
    { id:'refroid', label:'Niveau liquide de refroidissement', type:'ok_insuf', required:true },
    { id:'freins', label:'Niveau liquide de freins', type:'ok_insuf', required:true },
    { id:'lave_glace', label:'Niveau lave-glace', type:'ok_insuf', required:true },
    { id:'pneus_av', label:'État des pneus avant', type:'pneus', required:true },
    { id:'pneus_ar', label:'État des pneus arrière', type:'pneus', required:true },
  ]},
  { section: '🧹 Propreté', items: [
    { id:'carrosserie', label:'Carrosserie', type:'propre_sale', required:true },
    { id:'interieur', label:'Intérieur', type:'propre_sale', required:true },
  ]},
  { section: '🧰 Équipement', items: [
    { id:'fauteuil', label:'Fauteuil roulant', type:'ok_nok_np', required:true },
    { id:'sangle', label:'Sangle fauteuil', type:'ok_nok', required:true },
    { id:'extincteur', label:'Extincteur', type:'ok_nok', required:true },
    { id:'triangle', label:'Triangle', type:'ok_nok', required:true },
    { id:'boite_secours', label:'Boîte de secours', type:'ok_nok', required:true },
    { id:'sac_secours', label:'Sac de secours', type:'ok_nok', required:true },
    { id:'radio_port', label:'Radio portative', type:'ok_nok_np', required:true },
  ]},
  { section: '📄 Documents', items: [
    { id:'cert_conf', label:'Certificat de conformité', type:'ok_nok', required:true },
    { id:'immat', label:"Certificat d'immatriculation", type:'ok_nok', required:true },
    { id:'assurance', label:'Assurance', type:'ok_nok', required:true },
    { id:'ct', label:'Contrôle technique', type:'date', required:true },
    { id:'constat', label:"Constat d'accident", type:'ok_nok', required:true },
    { id:'carnet_bord', label:'Carnet de bord', type:'ok_nok', required:true },
    { id:'bon_transport', label:'Bon de transport', type:'ok_nok', required:true },
    { id:'carte_carb', label:'Carte carburant', type:'ok_nok', required:false },
    { id:'farde_listing', label:'Farde listing hôpitaux', type:'ok_nok', required:true },
    { id:'farde_sceller', label:'Farde scellée', type:'ok_nok', required:true },
  ]},
  { section: "🏥 Cartes d'accès hôpitaux", items: [
    { id:'h_epicura', label:'Epicura', type:'ok_nok', required:true },
    { id:'h_chm', label:'CHM', type:'ok_nok', required:true },
  ]},
  { section: '📝 Fin de checklist', items: [
    { id:'km', label:'Kilométrage', type:'number', required:true },
    { id:'remarques', label:'Remarques / Problèmes', type:'textarea', required:false },
    { id:'nom1', label:'Nom du chauffeur', type:'text', required:true },
  ]},
];

const DAILY_CHECKLIST_VSL = [
  { section: '🚗 Véhicule', items: [
    { id:'fuel', label:'Carburant', type:'fuel', required:true },
    { id:'phares', label:'Phares', type:'ok_nok', required:true },
    { id:'clignotants', label:'Clignotants', type:'ok_nok', required:true },
    { id:'huile', label:"Niveau d'huile moteur", type:'ok_insuf', required:true },
    { id:'refroid', label:'Niveau liquide de refroidissement', type:'ok_insuf', required:true },
    { id:'freins', label:'Niveau liquide de freins', type:'ok_insuf', required:true },
    { id:'lave_glace', label:'Niveau lave-glace', type:'ok_insuf', required:true },
    { id:'pneus_av', label:'État des pneus avant', type:'pneus', required:true },
    { id:'pneus_ar', label:'État des pneus arrière', type:'pneus', required:true },
  ]},
  { section: '🧹 Propreté', items: [
    { id:'carrosserie', label:'Carrosserie', type:'propre_sale', required:true },
    { id:'interieur', label:'Intérieur', type:'propre_sale', required:true },
  ]},
  { section: '🧰 Équipement', items: [
    { id:'fauteuil', label:'Fauteuil roulant', type:'ok_nok_np', required:true },
    { id:'sangle', label:'Sangle fauteuil', type:'ok_nok', required:true },
    { id:'extincteur', label:'Extincteur', type:'ok_nok', required:true },
    { id:'triangle', label:'Triangle', type:'ok_nok', required:true },
    { id:'boite_secours', label:'Boîte de secours', type:'ok_nok', required:true },
    { id:'radio_port', label:'Radio portative', type:'ok_nok_np', required:true },
  ]},
  { section: '📄 Documents', items: [
    { id:'cert_conf', label:'Certificat de conformité', type:'ok_nok', required:true },
    { id:'immat', label:"Certificat d'immatriculation", type:'ok_nok', required:true },
    { id:'assurance', label:'Assurance', type:'ok_nok', required:true },
    { id:'ct', label:'Contrôle technique', type:'date', required:true },
    { id:'constat', label:"Constat d'accident", type:'ok_nok', required:true },
    { id:'carnet_bord', label:'Carnet de bord', type:'ok_nok', required:true },
    { id:'bon_transport', label:'Bon de transport', type:'ok_nok', required:true },
    { id:'carte_carb', label:'Carte carburant', type:'ok_nok', required:false },
    { id:'farde_listing', label:'Farde listing hôpitaux', type:'ok_nok', required:true },
    { id:'farde_sceller', label:'Farde scellée', type:'ok_nok', required:true },
  ]},
  { section: "🏥 Cartes d'accès hôpitaux", items: [
    { id:'h_epicura', label:'Epicura', type:'ok_nok', required:true },
  ]},
  { section: '📝 Fin de checklist', items: [
    { id:'km', label:'Kilométrage', type:'number', required:true },
    { id:'remarques', label:'Remarques / Problèmes', type:'textarea', required:false },
    { id:'nom1', label:'Nom du chauffeur', type:'text', required:true },
  ]},
];

const DAILY_TEMPLATES_BASE = { AMB: DAILY_CHECKLIST_ALPHA, TPMR: DAILY_CHECKLIST_TPMR, VSL: DAILY_CHECKLIST_VSL };

// Applique un mouvement de bouteilles à la réserve et journalise l'action.
// type "vehicule" : sortie (bouteille retirée du véhicule) → +1 vide ; entrée (bouteille installée) → -1 pleine.
// type "fournisseur" : sortie (vide reprise par le fournisseur) → -1 vide ; entrée (pleine livrée) → +1 pleine.
async function applyO2Movement(type, sortie, entree, extra){
  try{
    const ref=doc(dbChecklists,"dispatchai_o2","reserve");
    const snap=await getDoc(ref);
    const current=snap.exists()?snap.data():O2_EMPTY_RESERVE;
    const currentPleines={...O2_EMPTY_RESERVE.pleines,...current.pleines};
    const next={ pleines:{...currentPleines}, vides:{...O2_EMPTY_RESERVE.vides,...current.vides} };
    O2_SIZES.forEach(s=>{
      if(type==="vehicule"){
        next.vides[s]=(next.vides[s]||0)+(sortie[s]||0);
        next.pleines[s]=Math.max(0,(next.pleines[s]||0)-(entree[s]||0));
      }else{
        next.vides[s]=Math.max(0,(next.vides[s]||0)-(sortie[s]||0));
        next.pleines[s]=(next.pleines[s]||0)+(entree[s]||0);
      }
    });
    await setDoc(ref,next);
    const logId=`${type}_${Date.now()}`;
    await setDoc(doc(dbChecklists,"dispatchai_o2_historique",logId),{
      id:logId, type, sortie, entree,
      date:new Date().toLocaleDateString("fr-FR"), dateISO:new Date().toISOString(), timestamp:Date.now(),
      ...extra,
    });
    return { current:currentPleines, next:next.pleines };
  }catch(e){ console.error("Erreur mouvement O2:", e); return { current:{}, next:{} }; }
}
// Supprime une entrée de l'historique O2 et annule son effet sur les
// compteurs de réserve (pour pouvoir nettoyer des tests sans fausser le stock).
async function deleteO2HistoriqueEntry(entry){
  try{
    const ref=doc(dbChecklists,"dispatchai_o2","reserve");
    const snap=await getDoc(ref);
    const current=snap.exists()?snap.data():O2_EMPTY_RESERVE;
    const next={ pleines:{...O2_EMPTY_RESERVE.pleines,...current.pleines}, vides:{...O2_EMPTY_RESERVE.vides,...current.vides} };
    const sortie=entry.sortie||{}, entree=entry.entree||{};
    O2_SIZES.forEach(s=>{
      if(entry.type==="vehicule"){
        next.vides[s]=Math.max(0,(next.vides[s]||0)-(sortie[s]||0));
        next.pleines[s]=(next.pleines[s]||0)+(entree[s]||0);
      }else{
        next.vides[s]=(next.vides[s]||0)+(sortie[s]||0);
        next.pleines[s]=Math.max(0,(next.pleines[s]||0)-(entree[s]||0));
      }
    });
    await setDoc(ref,next);
    await deleteDoc(doc(dbChecklists,"dispatchai_o2_historique",entry.id));
  }catch(e){ console.error("Erreur suppression historique O2:", e); }
}

// ═══════════════════════════════════════
// CHECKLIST JOURNALIÈRE — Firestore (checklists soumises + défauts Garage)
// ═══════════════════════════════════════
function yesterdayISO(){
  const d=new Date(); d.setDate(d.getDate()-1);
  return d.toISOString().split("T")[0];
}
// Cherche si une checklist a déjà été soumise aujourd'hui pour ce véhicule.
// Cherche la dernière checklist soumise pour ce véhicule, tous jours confondus
// (sert à décider si on doit en redemander une : même chauffeur + moins de 24h = non).
async function findLatestDailyChecklist(vehicleName){
  try{
    const q=query(collection(dbChecklists,"dispatchai_daily_checklists"), where("vehicle","==",vehicleName));
    const snap=await getDocs(q);
    if(snap.empty) return null;
    const docs=snap.docs.map(d=>({id:d.id,...d.data()}));
    docs.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    return docs[0];
  }catch(e){ console.error("Erreur lecture dernière checklist:", e); return null; }
}
// Cherche la checklist de la veille pour ce véhicule (pour "Chauffeur identique").
async function findYesterdayDailyChecklist(vehicleName){
  try{
    const q=query(collection(dbChecklists,"dispatchai_daily_checklists"), where("vehicle","==",vehicleName), where("date","==",yesterdayISO()));
    const snap=await getDocs(q);
    if(snap.empty) return null;
    return { id:snap.docs[0].id, ...snap.docs[0].data() };
  }catch(e){ console.error("Erreur lecture checklist veille:", e); return null; }
}
// Soumet une checklist journalière : détecte les valeurs problématiques,
// crée automatiquement les défauts correspondants au Garage (sans doublon
// via defectKey), et enregistre la checklist dans l'historique.
async function submitDailyChecklist({ vehicle, vType, values, template, skipped }){
  const BAD_VALUES = ['nok','remplacer','insuf','usure','sale','pleine'];
  const defautsAuto = [];
  if(!skipped){
    template.forEach(section=>{
      section.items.forEach(item=>{
        const val = values[item.id];
        if(item.id==="ct" && val){
          const dateCT=new Date(val); const today=new Date(); today.setHours(0,0,0,0);
          if(dateCT<today){
            defautsAuto.push({ vehicle, type:vType, description:"Contrôle technique dépassé : "+new Date(val).toLocaleDateString("fr-FR"), reportedBy:values.nom1||"Inconnu", source:"checklist", defectKey:vehicle+"_ct_depasse" });
          }
        }
        if(val && BAD_VALUES.includes(String(val).toLowerCase())){
          defautsAuto.push({ vehicle, type:vType, description:item.label+" : "+String(val).toUpperCase(), reportedBy:values.nom1||"Inconnu", source:"checklist", defectKey:vehicle+"_"+item.id });
        }
      });
    });
    if(values.remarques && values.remarques.trim().length>0){
      defautsAuto.push({ vehicle, type:vType, description:"Remarque : "+values.remarques.trim(), reportedBy:values.nom1||"Inconnu", source:"checklist", defectKey:vehicle+"_remarque_"+Date.now() });
    }
  }
  let nbNouveaux=0;
  for(const defaut of defautsAuto){
    if(defaut.defectKey.includes("_remarque_")){
      await addDoc(collection(dbChecklists,"dispatchai_daily_defects"), {...defaut, createdAt:Date.now()});
      nbNouveaux++; continue;
    }
    const existing=await getDocs(query(collection(dbChecklists,"dispatchai_daily_defects"), where("defectKey","==",defaut.defectKey)));
    if(existing.empty){ await addDoc(collection(dbChecklists,"dispatchai_daily_defects"), {...defaut, createdAt:Date.now()}); nbNouveaux++; }
  }
  await addDoc(collection(dbChecklists,"dispatchai_daily_checklists"), {
    vehicle, type:vType, date:todayISO(),
    time:new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}),
    submittedBy: values.nom1||"Inconnu",
    hasDefects: defautsAuto.length>0,
    values, skipped: !!skipped,
    createdAt: Date.now(),
  });
  return nbNouveaux;
}
async function resolveDailyDefect(id){
  try{ await deleteDoc(doc(dbChecklists,"dispatchai_daily_defects",id)); }catch(e){ console.error("Erreur résolution défaut:", e); }
}
// Nombre de véhicules distincts ayant eu une checklist journalière envoyée
// aujourd'hui (complétée normalement ou passée en urgence) — sert au
// compteur "Véhicules actifs" du menu principal.
function useDailyActiveVehiclesCount(){
  const [count,setCount]=useState(0);
  useEffect(()=>{
    const unsub=onSnapshot(collection(dbChecklists,"dispatchai_daily_checklists"), snap=>{
      const today=todayISO();
      const set=new Set();
      snap.forEach(d=>{ const data=d.data(); if(data.date===today) set.add(data.vehicle); });
      setCount(set.size);
    });
    return ()=>unsub();
  },[]);
  return count;
}
// Comme ci-dessus mais renvoie l'ensemble des noms (pour trier/marquer
// individuellement les véhicules "en service" dans les listes).
function useDailyActiveVehicleNames(){
  const [names,setNames]=useState(new Set());
  useEffect(()=>{
    const unsub=onSnapshot(collection(dbChecklists,"dispatchai_daily_checklists"), snap=>{
      const today=todayISO();
      const set=new Set();
      snap.forEach(d=>{ const data=d.data(); if(data.date===today) set.add(data.vehicle); });
      setNames(set);
    });
    return ()=>unsub();
  },[]);
  return names;
}

// ═══════════════════════════════════════
// CARNET DE BORD — historique légal des trajets (rétention 36 mois, obligation 3 ans)
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// RÉCEPTION DES BONS — archive permanente (indépendante de la session chauffeur)
// ═══════════════════════════════════════
async function saveBonArchive(bon){
  try{
    await setDoc(doc(dbChecklists,"dispatchai_bons_archive",String(bon.id)), sanitizeUndefined({...bon}));
  }catch(e){ console.error("Erreur archivage bon:", e); }
}

// ═══════════════════════════════════════
// PÉREMPTION — base centrale par LOTS (quantité + date), gérée par le bureau
// ═══════════════════════════════════════
function peremptionKey(vehicle,itemName){ return (vehicle+"__"+itemName).replace(/[^a-zA-Z0-9_]/g,"_"); }
function sortLots(lots){ return [...(lots||[])].sort((a,b)=>(a.date||"9999-99").localeCompare(b.date||"9999-99")); }
function getSoonestDate(lots){ const s=sortLots(lots); return s.length?s[0].date:""; }

async function getPeremptionDoc(vehicle,itemName){
  try{
    const snap=await getDoc(doc(dbChecklists,"dispatchai_peremption_dates",peremptionKey(vehicle,itemName)));
    return snap.exists()?snap.data():null;
  }catch(e){ console.error("Erreur lecture péremption:", e); return null; }
}
// Sauvegarde directe de la liste des lots (ajout/suppression/édition manuelle, bureau).
async function savePeremptionLots(vehicle,itemName,lots){
  try{
    const existing=await getPeremptionDoc(vehicle,itemName);
    await setDoc(doc(dbChecklists,"dispatchai_peremption_dates",peremptionKey(vehicle,itemName)), sanitizeUndefined({ vehicle, itemName, lots, alertSentForDate:existing?.alertSentForDate||null }));
  }catch(e){ console.error("Erreur sauvegarde péremption:", e); }
}
// Réappro : ajoute un nouveau lot (quantité + date) et retire automatiquement la
// même quantité en partant du/des lot(s) le(s) plus ancien(s) (celui consommé en premier).
async function addPeremptionLot(vehicle,itemName,qty,date){
  const existing=await getPeremptionDoc(vehicle,itemName);
  const lots=sortLots(existing?.lots||[]);
  let remaining=qty;
  const newLots=[];
  for(const lot of lots){
    if(remaining<=0){ newLots.push(lot); continue; }
    if(lot.quantite<=remaining){ remaining-=lot.quantite; }
    else{ newLots.push({...lot, quantite:lot.quantite-remaining}); remaining=0; }
  }
  newLots.push({ id:"lot"+Date.now(), quantite:qty, date });
  await setDoc(doc(dbChecklists,"dispatchai_peremption_dates",peremptionKey(vehicle,itemName)), sanitizeUndefined({ vehicle, itemName, lots:newLots, alertSentForDate:existing?.alertSentForDate||null }));
}
function usePeremptionMap(){
  const [map,setMap]=useState({});
  useEffect(()=>{
    const unsub=onSnapshot(collection(dbChecklists,"dispatchai_peremption_dates"), snap=>{
      const next={};
      snap.forEach(d=>{ const data=d.data(); next[peremptionKey(data.vehicle,data.itemName)]=data; });
      setMap(next);
    });
    return ()=>unsub();
  },[]);
  return map;
}

async function saveCarnetBordEntry(entry){
  const id=entry.id||("cb"+Date.now());
  try{
    await setDoc(doc(dbChecklists,"dispatchai_carnet_bord",id), sanitizeUndefined({...entry, id, createdAt:entry.createdAt||Date.now()}));
  }catch(e){ console.error("Erreur sauvegarde carnet de bord:", e); }
  return id;
}
// Purge les lignes de plus de 36 mois (obligation légale de conservation 3
// ans) — au 37ème mois, la plus ancienne disparaît.
async function cleanOldCarnetBord(){
  try{
    const snap=await getDocs(collection(dbChecklists,"dispatchai_carnet_bord"));
    const now=new Date();
    const toDelete=[];
    snap.forEach(d=>{
      const data=d.data();
      const entryDate=new Date(data.dateISO||data.createdAt);
      const monthsDiff=(now.getFullYear()-entryDate.getFullYear())*12+(now.getMonth()-entryDate.getMonth());
      if(monthsDiff>=37) toDelete.push(deleteDoc(doc(dbChecklists,"dispatchai_carnet_bord",d.id)));
    });
    if(toDelete.length>0) await Promise.all(toDelete);
  }catch(e){ console.error("Erreur nettoyage carnet de bord:", e); }
}

async function checkAndSendO2LowStock(currentPleines, nextPleines, emails){
  const justDropped = O2_SIZES.some(s => (nextPleines[s]||0) < (currentPleines[s]||0) && (nextPleines[s]||0)<=2);
  if(!justDropped) return;
  if(!emails || emails.length===0) return;
  const lowSizes = O2_SIZES.filter(s => (nextPleines[s]||0)<=2);
  if(lowSizes.length===0) return;
  const stockText = lowSizes.map(s=>`${s} : ${nextPleines[s]} restante(s)`).join("\n");
  try{
    for(const to of emails){
      await emailjs.send("service_mrs8v2l","template_2sxsq4j",{
        to_email: to,
        title: "Alerte Stock O²",
        content: `⚠ Stock bas\n\n${stockText}`,
      }, "Fhdx1kTE7vFmh4z07");
    }
  }catch(e){ console.error("Erreur alerte stock O2:", e); }
}
// Purge les entrées O2 de plus de 24 mois (même règle que l'historique checklists).
async function cleanOldO2Historique(){
  try{
    const snap=await getDocs(collection(dbChecklists,"dispatchai_o2_historique"));
    const now=new Date();
    const toDelete=[];
    snap.forEach(d=>{
      const data=d.data();
      const entryDate=new Date(data.dateISO||data.timestamp);
      const monthsDiff=(now.getFullYear()-entryDate.getFullYear())*12+(now.getMonth()-entryDate.getMonth());
      if(monthsDiff>=24) toDelete.push(deleteDoc(doc(dbChecklists,"dispatchai_o2_historique",d.id)));
    });
    if(toDelete.length>0) await Promise.all(toDelete);
  }catch(e){ console.error("Erreur nettoyage historique O2:", e); }
}

// Vrai si le lundi de la semaine en cours tombe dans les 7 premiers jours
// du mois (= c'est la 1ère semaine du mois, où les péremptions deviennent
// obligatoires).
function isFirstWeekOfMonth(){
  const monday=new Date(getChecklistWeekKey()+"T00:00:00");
  return monday.getDate()<=7;
}
function checklistTotalItems(checklistsData, vehicleName){
  const data=checklistsData[vehicleName];
  if(!data) return 0;
  return data.sections.flatMap(s=>s.shelves.flatMap(sh=>sh.items)).length;
}
// Calcule l'état d'une checklist (progression, complète ou non) à partir
// des coches actuelles. "Complète" exige aussi, la 1ère semaine du mois,
// que toutes les dates de péremption soient renseignées.
function checklistStatus(checklistsData, vehicleName, checks){
  const data=checklistsData[vehicleName];
  const total=checklistTotalItems(checklistsData, vehicleName);
  const checkedCount=Object.values(checks||{}).filter(c=>c.found!=null).length;
  const progress=total>0?Math.round((checkedCount/total)*100):0;
  let allValidated=!!data;
  if(data){
    outer:
    for(const sec of data.sections){
      for(const sh of sec.shelves){
        for(const item of sh.items){
          if(item.okOnly) continue;
          const key=`${sec.id}__${sh.id}__${item.n}`;
          const state=(checks||{})[key];
          if(!state||state.found==null){ allValidated=false; break outer; }
          if(item.t&&state.testOk==null){ allValidated=false; break outer; }
          if(item.s&&state.sealOk==null){ allValidated=false; break outer; }
        }
      }
    }
  }
  const complete=progress===100&&allValidated;
  const started=checkedCount>0;
  return { progress, checkedCount, total, complete, started };
}
// Abonnement temps réel au statut de la checklist de chaque véhicule pour
// la semaine en cours (partagé entre toutes les tablettes via Firestore).
function useChecklistsWeekStatus(checklistsData){
  const weekKey=getChecklistWeekKey();
  const vehicleNames=Object.keys(checklistsData);
  const [statuses,setStatuses]=useState({});
  useEffect(()=>{
    const unsubs=vehicleNames.map(name=>{
      const ref=doc(dbChecklists,"dispatchai_checklists",`${name}_${weekKey}`);
      return onSnapshot(ref, snap=>{
        const checks=snap.exists()?(snap.data().checks||{}):{};
        setStatuses(prev=>({...prev, [name]: checklistStatus(checklistsData, name, checks)}));
      }, ()=>{});
    });
    return ()=>unsubs.forEach(u=>u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, JSON.stringify(vehicleNames)]);
  return statuses;
}

// Statut mensuel (fait/en cours/pas commencé) de chaque véhicule TPMR/VSL,
// tous basés sur le même modèle partagé unique.
function useTpmrVslMonthStatus(template){
  const monthKey=getChecklistMonthKey();
  const [statuses,setStatuses]=useState({});
  useEffect(()=>{
    let total=0;
    (template.sections||[]).forEach(sec=>sec.shelves.forEach(sh=>sh.items.forEach(item=>{ if(!item.okOnly) total++; })));
    const unsubs=TPMR_VSL_VEHICLES.map(name=>{
      const ref=doc(dbChecklists,"dispatchai_checklists",`TPMRVSL_${name}_${monthKey}`);
      return onSnapshot(ref, snap=>{
        const checks=snap.exists()?(snap.data().checks||{}):{};
        const checkedCount=Object.values(checks).filter(s=>s&&s.found!=null).length;
        const started=checkedCount>0;
        const complete=total>0&&checkedCount>=total;
        setStatuses(prev=>({...prev, [name]:{ started, complete, progress: total>0?Math.round((checkedCount/total)*100):0 }}));
      }, ()=>{});
    });
    return ()=>unsubs.forEach(u=>u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, JSON.stringify(template)]);
  return statuses;
}


function PatientsHabituelsBody({patients,setPatients,categories,setCategories,conventions,transportTypes,equipements,onSchedule}){
  const [activeCat,setActiveCat]=useState(categories[0]||"");
  const [newCatName,setNewCatName]=useState("");
  const [showAddCat,setShowAddCat]=useState(false);
  const [editing,setEditing]=useState(null); // patient object being created/edited
  const [scheduling,setScheduling]=useState(null); // patient object being scheduled
  const [schedDate,setSchedDate]=useState(todayFR());
  const [schedHeure,setSchedHeure]=useState("");
  const [scheduledMsg,setScheduledMsg]=useState(null);

  const emptyPatient=(cat)=>({
    id:`ph_${Date.now()}`,categorie:cat,nom:"",prenom:"",telephone:"",
    adresseDepart:"",adresseArrivee:"",convention:"",typeTransport:"",
    mobilite:"assis",equipSelected:[],litrageO2:2,notes:"",heureHabituelle:"",statut:"actif",
  });

  const savePatient=()=>{
    if(!editing||!editing.nom.trim()) return;
    setPatients(p=>{
      const exists=p.find(x=>x.id===editing.id);
      if(exists) return p.map(x=>x.id===editing.id?editing:x);
      return [...p,editing];
    });
    setEditing(null);
  };
  const [confirmDelete,setConfirmDelete]=useState(null); // patient pending delete confirmation
  const deletePatient=(id)=>{setPatients(p=>p.filter(x=>x.id!==id));setConfirmDelete(null);};
  const addCategory=()=>{
    if(newCatName.trim()&&!categories.includes(newCatName.trim())){
      setCategories(c=>[...c,newCatName.trim()]);
      setActiveCat(newCatName.trim());
      setNewCatName("");
      setShowAddCat(false);
    }
  };
  const toggleEquip=(id)=>{
    if(!editing) return;
    const sel=editing.equipSelected||[];
    setEditing({...editing,equipSelected:sel.includes(id)?sel.filter(x=>x!==id):[...sel,id]});
  };

  const patientsInCat=patients.filter(p=>p.categorie===activeCat);

  return(
    <>
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        <div style={{width:190,background:C.panel,borderRight:`1px solid ${C.border}`,padding:"12px 8px",display:"flex",flexDirection:"column",gap:4,flexShrink:0,overflowY:"auto"}}>
          {categories.map(cat=>(
            <button key={cat} onClick={()=>setActiveCat(cat)} style={{padding:"11px 14px",borderRadius:9,border:"none",background:activeCat===cat?C.purpleSoft:"transparent",color:activeCat===cat?C.purple:C.muted,fontWeight:activeCat===cat?700:500,fontSize:13,cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>{cat}</span>
              <span style={{fontSize:10,opacity:0.7}}>{patients.filter(p=>p.categorie===cat).length}</span>
            </button>
          ))}
          {showAddCat?(
            <div style={{padding:"8px",display:"flex",flexDirection:"column",gap:6}}>
              <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Nom catégorie…" style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 9px",color:C.text,fontSize:12}}/>
              <div style={{display:"flex",gap:5}}>
                <button onClick={addCategory} style={{flex:1,background:C.success,border:"none",borderRadius:6,color:"white",padding:"6px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✅</button>
                <button onClick={()=>{setShowAddCat(false);setNewCatName("");}} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,padding:"6px",fontSize:11,cursor:"pointer"}}>✕</button>
              </div>
            </div>
          ):(
            <button onClick={()=>setShowAddCat(true)} style={{padding:"9px 14px",borderRadius:9,border:`1px dashed ${C.border}`,background:"transparent",color:C.muted,fontWeight:600,fontSize:12,cursor:"pointer",textAlign:"left",marginTop:6}}>+ Catégorie</button>
          )}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <SectionTitle icon="🗂️" title={activeCat||"Aucune catégorie"}/>
            {activeCat&&<button onClick={()=>setEditing(emptyPatient(activeCat))} style={{background:C.purpleSoft,border:`1px solid ${C.purple}`,borderRadius:8,color:C.purple,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",marginLeft:12}}>+ Nouvelle fiche</button>}
          </div>

          {patientsInCat.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.muted,fontSize:13}}>Aucun patient dans cette catégorie</div>}

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
            {patientsInCat.map(p=>{
              const isUnavailable=p.statut==="hospitalise"||p.statut==="vacances";
              const needsA=needsAmb(p.mobilite,p.equipSelected);
              return(
              <div key={p.id} style={{background:C.panel,border:`1px solid ${isUnavailable?C.danger:C.border}`,borderRadius:13,padding:"16px",opacity:isUnavailable?0.75:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{fontWeight:800,fontSize:15}}>{p.prenom} {p.nom}</div>
                  <div style={{display:"flex",gap:5}}>
                    <button onClick={()=>setEditing(p)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>✏️</button>
                    <button onClick={()=>setConfirmDelete(p)} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>🗑</button>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,background:needsA?C.dangerSoft:C.blueSoft,color:needsA?C.danger:C.blue,border:`1px solid ${needsA?C.danger:C.blue}`}}>{needsA?"🚑 Ambulance":"♿ TPMR"}</span>
                  {isUnavailable&&<span style={{fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:5,background:C.dangerSoft,color:C.danger,border:`1px solid ${C.danger}`}}>{p.statut==="hospitalise"?"🔴 HOSPITALISÉ":"🔴 EN VACANCES"}</span>}
                </div>
                {p.convention&&<div style={{fontSize:11,color:C.accent,fontWeight:600,marginBottom:6}}>🤝 {CONV_MAP[p.convention]||p.convention}</div>}
                <div style={{fontSize:11,color:C.muted,marginBottom:3}}>📍 {p.adresseDepart||"—"}</div>
                <div style={{fontSize:11,color:C.muted,marginBottom:6}}>🏁 {p.adresseArrivee||"—"}</div>
                {p.heureHabituelle&&<div style={{fontSize:11,color:C.muted,marginBottom:10}}>🕐 Habituellement à {p.heureHabituelle}</div>}
                <button disabled={isUnavailable} onClick={()=>{setScheduling(p);setSchedDate(todayFR());setSchedHeure(p.heureHabituelle||"");}} style={{width:"100%",background:isUnavailable?C.panel2:C.accentSoft,border:`1px solid ${isUnavailable?C.border:C.accent}`,borderRadius:8,color:isUnavailable?C.muted:C.accent,padding:"9px",fontWeight:700,fontSize:12,cursor:isUnavailable?"not-allowed":"pointer"}}>📅 Programmer une course</button>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal édition fiche */}
      {editing&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px",width:520,maxWidth:"92vw",maxHeight:"88vh",overflowY:"auto",animation:"pop 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:16}}>{patients.find(x=>x.id===editing.id)?"✏️ Modifier la fiche":"+ Nouvelle fiche"}</div>
              <button onClick={()=>setEditing(null)} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <TextInput value={editing.nom} onChange={e=>setEditing({...editing,nom:e.target.value})} placeholder="Nom"/>
              <TextInput value={editing.prenom} onChange={e=>setEditing({...editing,prenom:e.target.value})} placeholder="Prénom"/>
            </div>
            <div style={{marginBottom:10}}><TextInput value={editing.telephone} onChange={e=>setEditing({...editing,telephone:e.target.value})} placeholder="Téléphone"/></div>
            <div style={{marginBottom:10}}><TextInput value={editing.adresseDepart} onChange={e=>setEditing({...editing,adresseDepart:e.target.value})} placeholder="Adresse de départ"/></div>
            <div style={{marginBottom:10}}><TextInput value={editing.adresseArrivee} onChange={e=>setEditing({...editing,adresseArrivee:e.target.value})} placeholder="Destination"/></div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",marginBottom:6}}>Convention</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {conventions.map(c=>{const active=editing.convention===c.id;return(
                  <button key={c.id} onClick={()=>setEditing({...editing,convention:c.id})} style={{padding:"6px 12px",borderRadius:7,border:`1.5px solid ${active?C.accent:C.border}`,background:active?C.accentSoft:"transparent",color:active?C.accent:C.muted,fontSize:11,fontWeight:active?700:500,cursor:"pointer"}}>{c.icon} {c.label}</button>
                );})}
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",marginBottom:6}}>Type de transport</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {transportTypes.map(t=>{const active=editing.typeTransport===t.id;return(
                  <button key={t.id} onClick={()=>setEditing({...editing,typeTransport:t.id})} style={{padding:"6px 12px",borderRadius:7,border:`1.5px solid ${active?C.accent:C.border}`,background:active?C.accentSoft:"transparent",color:active?C.accent:C.muted,fontSize:11,fontWeight:active?700:500,cursor:"pointer"}}>{t.icon} {t.label}</button>
                );})}
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",marginBottom:6}}>Mobilité</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[{id:"assis",l:"🧍 Assis"},{id:"chaise_perso",l:"♿ Chaise perso"},{id:"chaise_aps",l:"♿ Chaise APS"},{id:"brancard",l:"🛏 Brancard"}].map(m=>{const active=editing.mobilite===m.id;return(
                  <button key={m.id} onClick={()=>setEditing({...editing,mobilite:m.id})} style={{padding:"6px 12px",borderRadius:7,border:`1.5px solid ${active?C.accent:C.border}`,background:active?C.accentSoft:"transparent",color:active?C.accent:C.muted,fontSize:11,fontWeight:active?700:500,cursor:"pointer"}}>{m.l}</button>
                );})}
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",marginBottom:6}}>Équipement</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {equipements.map(eq=>{const active=(editing.equipSelected||[]).includes(eq.id);return(
                  <button key={eq.id} onClick={()=>toggleEquip(eq.id)} style={{padding:"6px 12px",borderRadius:7,border:`1.5px solid ${active?C.danger:C.border}`,background:active?C.dangerSoft:"transparent",color:active?C.danger:C.muted,fontSize:11,fontWeight:active?700:500,cursor:"pointer"}}>{eq.icon} {eq.label}</button>
                );})}
              </div>
            </div>
            <div style={{marginBottom:10,background:needsAmb(editing.mobilite,editing.equipSelected)?C.dangerSoft:C.blueSoft,border:`1px solid ${needsAmb(editing.mobilite,editing.equipSelected)?C.danger:C.blue}`,borderRadius:9,padding:"9px 12px",fontSize:12,fontWeight:700,color:needsAmb(editing.mobilite,editing.equipSelected)?C.danger:C.blue}}>
              {needsAmb(editing.mobilite,editing.equipSelected)?"🚑 Véhicule requis : Ambulance":"♿ Véhicule requis : TPMR"}
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",marginBottom:6}}>Heure habituelle</div>
              <HeureInput value={editing.heureHabituelle||""} onChange={v=>setEditing({...editing,heureHabituelle:v})}/>
            </div>
            {editing.categorie==="Dialyse"&&(
              <div style={{marginBottom:10,background:C.purpleSoft,border:`1px solid ${C.purple}`,borderRadius:9,padding:"12px"}}>
                <div style={{fontSize:10,fontWeight:700,color:C.purple,textTransform:"uppercase",marginBottom:8}}>🔁 Récurrence automatique (dialyse)</div>
                <div style={{fontSize:11,color:C.muted,marginBottom:10}}>Un ou plusieurs horaires possibles (ex: Lun/Mer/Ven → Dialyse Enghien, Sam → Dialyse Ath). Chaque jour coché crée la course automatiquement (en attente, à assigner).</div>
                {(editing.recurringSlots||[]).map((slot,idx)=>(
                  <div key={slot.id} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px",marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase"}}>Horaire {idx+1}</span>
                      <button onClick={()=>setEditing({...editing,recurringSlots:editing.recurringSlots.filter(s=>s.id!==slot.id)})} style={{background:"transparent",border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"3px 8px",fontSize:10,cursor:"pointer"}}>🗑</button>
                    </div>
                    <div style={{display:"flex",gap:5,marginBottom:8}}>
                      {[["lun","L"],["mar","M"],["mer","M"],["jeu","J"],["ven","V"],["sam","S"],["dim","D"]].map(([id,l])=>{
                        const active=(slot.days||[]).includes(id);
                        return(
                          <button key={id} onClick={()=>{
                            const days=slot.days||[];
                            const newDays=active?days.filter(d=>d!==id):[...days,id];
                            setEditing({...editing,recurringSlots:editing.recurringSlots.map(s=>s.id===slot.id?{...s,days:newDays}:s)});
                          }} style={{flex:1,padding:"8px 0",borderRadius:6,border:`1.5px solid ${active?C.purple:C.border}`,background:active?C.purple:"transparent",color:active?"white":C.muted,fontSize:11,fontWeight:700,cursor:"pointer"}}>{l}</button>
                        );
                      })}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      <HeureInput value={slot.heure||""} onChange={v=>setEditing({...editing,recurringSlots:editing.recurringSlots.map(s=>s.id===slot.id?{...s,heure:v}:s)})} placeholder="Heure"/>
                      <input value={slot.destination||""} onChange={e=>setEditing({...editing,recurringSlots:editing.recurringSlots.map(s=>s.id===slot.id?{...s,destination:capitalizeWords(e.target.value)}:s)})} placeholder="Destination (ex: Dialyse Enghien)" style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 9px",color:C.text,fontSize:12}}/>
                    </div>
                  </div>
                ))}
                <button onClick={()=>setEditing({...editing,recurringSlots:[...(editing.recurringSlots||[]),{id:"slot"+Date.now(),days:[],heure:"",destination:""}]})} style={{width:"100%",background:"transparent",border:`1.5px dashed ${C.purple}`,borderRadius:8,color:C.purple,padding:"9px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Ajouter un horaire</button>
              </div>
            )}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",marginBottom:6}}>Statut</div>
              <div style={{display:"flex",gap:6}}>
                {[{id:"actif",l:"✅ Actif"},{id:"hospitalise",l:"🔴 Hospitalisé"},{id:"vacances",l:"🔴 En vacances"}].map(s=>{const active=(editing.statut||"actif")===s.id;return(
                  <button key={s.id} onClick={()=>setEditing({...editing,statut:s.id})} style={{flex:1,padding:"8px",borderRadius:7,border:`1.5px solid ${active?(s.id==="actif"?C.success:C.danger):C.border}`,background:active?(s.id==="actif"?C.successSoft:C.dangerSoft):"transparent",color:active?(s.id==="actif"?C.success:C.danger):C.muted,fontSize:11,fontWeight:active?700:500,cursor:"pointer"}}>{s.l}</button>
                );})}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <textarea value={editing.notes} onChange={e=>setEditing({...editing,notes:e.target.value})} placeholder="Notes…" rows={2} style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:12,resize:"none"}}/>
            </div>
            <button onClick={savePatient} disabled={!editing.nom.trim()} style={{width:"100%",background:editing.nom.trim()?C.success:C.panel2,border:"none",borderRadius:10,color:editing.nom.trim()?"white":C.muted,padding:"12px",fontWeight:800,fontSize:14,cursor:editing.nom.trim()?"pointer":"not-allowed"}}>✅ Enregistrer la fiche</button>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {confirmDelete&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:350}}>
          <div style={{background:C.panel,border:`1px solid ${C.danger}`,borderRadius:16,padding:"24px",width:360,maxWidth:"92vw",animation:"pop 0.2s ease"}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:10}}>🗑 Supprimer la fiche ?</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Es-tu sûr de vouloir supprimer définitivement la fiche de <strong style={{color:C.text}}>{confirmDelete.prenom} {confirmDelete.nom}</strong> ? Cette action est irréversible.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConfirmDelete(null)} style={{flex:1,background:C.panel2,border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Annuler</button>
              <button onClick={()=>deletePatient(confirmDelete.id)} style={{flex:1,background:C.danger,border:"none",borderRadius:9,color:"white",padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer"}}>🗑 Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal programmation rapide */}
      {scheduling&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px",width:380,maxWidth:"92vw",animation:"pop 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontWeight:800,fontSize:16}}>📅 Programmer</div>
              <button onClick={()=>setScheduling(null)} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>{scheduling.prenom} {scheduling.nom}</div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",marginBottom:6}}>Date</div>
              <DateInput value={schedDate} onChange={setSchedDate}/>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",marginBottom:6}}>Heure</div>
              <HeureInput value={schedHeure} onChange={setSchedHeure}/>
            </div>
            <button onClick={()=>{onSchedule(scheduling,schedDate,schedHeure);setScheduledMsg(`${scheduling.prenom} ${scheduling.nom} — ${schedDate}`);setScheduling(null);setTimeout(()=>setScheduledMsg(null),3000);}} style={{width:"100%",background:C.success,border:"none",borderRadius:10,color:"white",padding:"12px",fontWeight:800,fontSize:14,cursor:"pointer"}}>✅ Envoyer au dispatcher</button>
          </div>
        </div>
      )}

      {scheduledMsg&&(
        <div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:C.success,borderRadius:12,padding:"12px 24px",fontSize:13,fontWeight:700,color:"white",zIndex:400,animation:"pop 0.2s ease"}}>
          ✅ Course programmée pour {scheduledMsg}
        </div>
      )}
    </>
  );
}

function PlanningView({courses,setCourses,vehicles,patients,setPatients,categories,setCategories,conventions,transportTypes,equipements,pending,onAssignPending,onGoFormulaire,onBack,onSchedule,themeMode,toggleTheme}){
  const [tab,setTab]=useState("calendrier");
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:13,cursor:"pointer"}}>← Menu</button>
          <div style={{width:34,height:34,background:C.purple,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🗓️</div>
          <div><div style={{fontWeight:700,fontSize:14}}>Planning</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"1px"}}>Calendrier & patients habituels</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",gap:4,background:C.panel2,borderRadius:8,padding:3}}>
            {[["calendrier","🗓 Calendrier"],["patients","🗂️ Patients habituels"]].map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)} style={{padding:"6px 13px",background:tab===t?C.purple:"transparent",border:"none",borderRadius:6,color:tab===t?"white":C.muted,fontWeight:700,fontSize:11,cursor:"pointer"}}>{l}</button>
            ))}
          </div>
          <Clock/>
          <button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙 Sombre":"☀️ Clair"}</button>
        </div>
      </div>
      {tab==="calendrier"?(
        <CalendarView courses={courses} setCourses={setCourses} vehicles={vehicles} pending={pending} onAssignPending={onAssignPending} patients={patients} onGoFormulaire={onGoFormulaire} onScheduleFromPatient={onSchedule}/>
      ):(
        <PatientsHabituelsBody patients={patients} setPatients={setPatients} categories={categories} setCategories={setCategories} conventions={conventions} transportTypes={transportTypes} equipements={equipements} onSchedule={onSchedule}/>
      )}
    </div>
  );
}

export default function App(){
  const [vehicles,    setVehicles]    = useFirestoreState("vehicles", INIT_VEHICLES);
  const [courses,     setCourses]     = useFirestoreState("courses", INIT_COURSES);
  const [pending,     setPending]     = useFirestoreState("pending", []);
  const pendingTodayCount = pending.filter(p=>(p.dateISO||todayISO())===todayISO()).length;
  const [driversAmb,  setDriversAmb]  = useFirestoreState("driversAmb", INIT_DRIVERS_AMB);
  const [driversTpmr, setDriversTpmr] = useFirestoreState("driversTpmr", INIT_DRIVERS_TPMR);
  const [stagiairesAmb,setStagiairesAmb] = useFirestoreState("stagiairesAmb", INIT_STAGIAIRES_AMB);
  const [formationTpmr,setFormationTpmr] = useFirestoreState("formationTpmr", INIT_FORMATION_TPMR);
  const [conventions, setConventions] = useFirestoreState("conventions", INIT_CONVENTIONS);
  const [equipements, setEquipements] = useFirestoreState("equipements", INIT_EQUIPEMENTS);
  const [transportTypes,setTransportTypes] = useFirestoreState("transportTypes", INIT_TRANSPORT_TYPES);
  const [bases,       setBases]       = useFirestoreState("bases", INIT_BASES);
  const [contacts,    setContacts]    = useFirestoreState("contacts", INIT_CONTACTS);
  const [listeRouge,  setListeRouge]  = useFirestoreState("listeRouge", []);
  const [carnetBordTypes, setCarnetBordTypes] = useFirestoreState("carnetBordTypes", INIT_CARNET_TYPES);
  const [patientsHabituels, setPatientsHabituels] = useFirestoreState("patientsHabituels", [
    {id:"ph_test1",categorie:"Dialyse",nom:"Moreau",prenom:"Alice",telephone:"065 12 34 56",adresseDepart:"15 rue de la Paix, Mons",adresseArrivee:"CHU Mons — Dialyse",convention:"epicura",typeTransport:"dialyse",mobilite:"chaise_perso",equipSelected:[],litrageO2:2,notes:"Dialyse 3x/semaine — Lun/Mer/Ven",heureHabituelle:"08h00",statut:"actif"},
    {id:"ph_test2",categorie:"Radiothérapie",nom:"Petit",prenom:"Bernard",telephone:"065 98 76 54",adresseDepart:"42 chaussée de Bruxelles, Mons",adresseArrivee:"CHU Mons — Radiothérapie",convention:"partenamut",typeTransport:"radiotherapie",mobilite:"brancard",equipSelected:["oxygene"],litrageO2:4,notes:"Test — sous oxygène",heureHabituelle:"10h30",statut:"actif"},
    {id:"ph_test3",categorie:"Oncologie",nom:"Lambert",prenom:"Chantal",telephone:"065 45 67 89",adresseDepart:"8 rue du Parc, Frameries",adresseArrivee:"CHU Mons — Oncologie",convention:"home",typeTransport:"oncologie",mobilite:"assis",equipSelected:[],litrageO2:2,notes:"Test — patient hospitalisé actuellement",heureHabituelle:"13h00",statut:"hospitalise"},
  ]);
  const [patientCategories, setPatientCategories] = useFirestoreState("patientCategories", ["Dialyse","Radiothérapie","Oncologie"]);
  const [tarifs, setTarifs] = useFirestoreState("tarifs", {
    tpmr:{priseEnCharge:"0", kmAudela10:"0"},
    ambulance:{priseEnCharge:"0", km11_20:"0", km21plus:"0", oxygeneDemiH:"0"},
  });
  const [plans,       setPlans]       = useFirestoreState("plans", INIT_PLANS);
  const [nextId,      setNextId]      = useFirestoreState("nextId", 100);
  const [checklistsData, setChecklistsData] = useFirestoreState("checklistsData", INIT_CHECKLISTS);
  const [checklistEmails, setChecklistEmails] = useFirestoreState("checklistEmails", []);
  const [o2Emails, setO2Emails] = useFirestoreState("o2Emails", []);
  const [peremptionEmails, setPeremptionEmails] = useFirestoreState("peremptionEmails", []);
  const [appView,     setAppView]     = useState(()=>lsGet("aps_appView","menu"));
  const [showPin,     setShowPin]     = useState(false);
  const [showDispMenu,setShowDispMenu] = useState(false);
  const checklistStatuses = useChecklistsWeekStatus(checklistsData);
  const dailyActiveCount = useDailyActiveVehiclesCount();
  const [themeMode, setThemeMode] = useState(()=>getStoredThemeMode());
  // Le fond de page (body) était figé au premier chargement dans le CSS
  // global (GS) et ne suivait plus les changements de thème ensuite — on le
  // met à jour ici à chaque bascule pour que tout reste bien synchronisé.
  useEffect(()=>{
    document.body.style.background = C.bg;
    document.documentElement.style.background = C.bg;
  },[themeMode]);
  const toggleTheme = () => { const next=themeMode==="light"?"dark":"light"; applyThemeMode(next); applyCkThemeMode(next); setThemeMode(next); };

  const [cDriver,   setCDriver]   = useState(()=>lsGet("aps_cDriver",null));
  const [cVehicle,  setCVehicle]  = useState(()=>lsGet("aps_cVehicle",null));
  const [cScreen,   setCScreen]   = useState(()=>lsGet("aps_cScreen","choix_nom"));
  const [cCourse,   setCCourse]   = useState(()=>lsGet("aps_cCourse",null));
  const [cStatuts,  setCStatuts]  = useState(()=>lsGet("aps_cStatuts",{}));
  const [cBons,     setCBons]     = useState(()=>lsGet("aps_cBons",[]));

  useEffect(()=>{ lsSet("aps_appView",appView); },[appView]);
  useEffect(()=>{ lsSet("aps_cDriver",cDriver); },[cDriver]);
  useEffect(()=>{ lsSet("aps_cVehicle",cVehicle); },[cVehicle]);
  useEffect(()=>{ lsSet("aps_cScreen",cScreen); },[cScreen]);
  useEffect(()=>{ lsSet("aps_cCourse",cCourse); },[cCourse]);
  useEffect(()=>{ lsSet("aps_cStatuts",cStatuts); },[cStatuts]);
  useEffect(()=>{ lsSet("aps_cBons",cBons); },[cBons]);

  const getStatut = id => cStatuts[id]||"planifie";
  const setStatut = (id,s) => {
    setCStatuts(p=>({...p,[id]:s}));
    const course=courses.find(c=>c.id===id);
    if(course) setVehicles(p=>p.map(v=>v.id===course.vehicleId?{...v,status:s==="en_cours"?"en_course":"disponible"}:v));
  };

  const myCourses  = cVehicle ? courses.filter(c=>c.vehicleId===cVehicle.id) : [];
  const myActives  = myCourses.filter(c=>getStatut(c.id)!=="termine");
  const myTermines = myCourses.filter(c=>getStatut(c.id)==="termine");

  const validateCourse = (pc, vehicleId) => {
    const newC={...pc,id:nextId,vehicleId,statut:"planifie"};
    setCourses(p=>[...p,newC]);
    setPending(p=>p.filter(x=>x.id!==pc.id));
    setNextId(n=>n+1);
  };
  const refuseCourse = pc => setPending(p=>p.filter(x=>x.id!==pc.id));
  const backToSubMenu = () => { setAppView("menu"); setShowDispMenu(true); };

  const submitCourse = (form) => {
    const newP={
      id:nextId+1,
      patient:`${form.prenom} ${form.nom}`,
      depart:form.adresseDepart,arrivee:form.adresseArrivee,
      heure:form.heurePC||(form.heures&&form.heures[0]?form.heures[0].heure:"")||"—",
      type:form.typeTransport,sousType:form.sousType,
      convention:form.convention,mobilite:form.mobilite,
      equipSelected:form.equipSelected||[],
      oxygene:(form.equipSelected||[]).includes("oxygene"),
      litrageO2:form.litrageO2,
      accompagnant:form.accompagnant,
      telephone:form.telephone,
      notes:form.notes,
      date:form.date||todayFR(),
      dateISO:frToISO(form.date)||todayISO(),
      statut:"en_attente",heures:form.heures,
    };
    setPending(p=>[...p,newP]);
    setNextId(n=>n+2);
  };

  const submitFromPatientHabituel = (patient, dateFR, heure) => {
    const newP={
      id:nextId+1,
      patient:`${patient.prenom} ${patient.nom}`,
      depart:patient.adresseDepart,arrivee:patient.adresseArrivee,
      heure:heure||"—",
      type:patient.typeTransport,
      convention:patient.convention,mobilite:patient.mobilite,
      equipSelected:patient.equipSelected||[],
      oxygene:(patient.equipSelected||[]).includes("oxygene"),
      litrageO2:patient.litrageO2,
      telephone:patient.telephone,
      notes:patient.notes,
      date:dateFR||todayFR(),
      dateISO:frToISO(dateFR)||todayISO(),
      statut:"en_attente",heures:[],
    };
    setPending(p=>[...p,newP]);
    setNextId(n=>n+2);
  };

  // Génération automatique des courses de dialyse récurrentes : dès que le
  // jour courant correspond à un jour coché sur un des horaires du patient,
  // une course "en attente" est créée automatiquement (une seule fois par jour et par destination).
  useEffect(()=>{
    const WEEKDAY_CODES=["dim","lun","mar","mer","jeu","ven","sam"];
    const todayCode=WEEKDAY_CODES[new Date().getDay()];
    const todayF=todayFR();
    patientsHabituels.forEach(p=>{
      if(p.categorie!=="Dialyse") return;
      if(p.statut!=="actif") return;
      (p.recurringSlots||[]).forEach(slot=>{
        if(!(slot.days||[]).includes(todayCode)) return;
        const fullName=`${p.prenom} ${p.nom}`;
        const destination=slot.destination||p.adresseArrivee;
        const alreadyPending=pending.some(x=>x.patient===fullName && x.date===todayF && x.arrivee===destination);
        const alreadyCourse=courses.some(x=>x.patient===fullName && x.date===todayF && x.arrivee===destination);
        if(!alreadyPending && !alreadyCourse){
          const newP={
            id:nextId+1,
            patient:fullName,
            depart:p.adresseDepart, arrivee:destination,
            heure:slot.heure||p.heureHabituelle||"—",
            type:p.typeTransport,
            convention:p.convention, mobilite:p.mobilite,
            equipSelected:p.equipSelected||[],
            oxygene:(p.equipSelected||[]).includes("oxygene"),
            litrageO2:p.litrageO2,
            telephone:p.telephone,
            notes:p.notes,
            date:todayF, dateISO:todayISO(),
            statut:"en_attente", heures:[],
          };
          setPending(pr=>[...pr,newP]);
          setNextId(n=>n+2);
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[patientsHabituels]);

  const saveBon = (bon) => {
    setCBons(p=>{
      const exists=p.find(b=>b.id===bon.id);
      if(exists) return p.map(b=>b.id===bon.id?bon:b);
      return [...p,bon];
    });
    if(bon.valide) saveBonArchive({...bon, traite: bon.traite||false});
  };

  if(showPin) return <PinModal onSuccess={()=>{setShowPin(false);setAppView("parametres");}} onCancel={()=>setShowPin(false)}/>;
  if(appView==="formulaire") return <FormulaireView onBack={backToSubMenu} onSubmit={submitCourse} conventions={conventions} equipements={equipements} transportTypes={transportTypes} contacts={contacts} listeRouge={listeRouge} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(appView==="dispatcher") return <DispatcherView vehicles={vehicles} setVehicles={setVehicles} courses={courses} setCourses={setCourses} pending={pending} onValidate={validateCourse} onRefuse={refuseCourse} onBack={backToSubMenu} contacts={contacts} tarifs={tarifs} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(appView==="planning") return <PlanningView courses={courses} setCourses={setCourses} vehicles={vehicles} patients={patientsHabituels} setPatients={setPatientsHabituels} categories={patientCategories} setCategories={setPatientCategories} conventions={conventions} transportTypes={transportTypes} equipements={equipements} pending={pending} onAssignPending={validateCourse} onGoFormulaire={()=>setAppView("formulaire")} onBack={backToSubMenu} onSchedule={submitFromPatientHabituel} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(appView==="chauffeur")  return <ChauffeurView driversAmb={driversAmb} driversTpmr={driversTpmr} stagiairesAmb={stagiairesAmb} formationTpmr={formationTpmr} vehicles={vehicles} setVehicles={setVehicles} contacts={contacts} plans={plans} driver={cDriver} setDriver={setCDriver} vehicle={cVehicle} setVehicle={setCVehicle} screen={cScreen} setScreen={setCScreen} course={cCourse} setCourse={setCCourse} statuts={cStatuts} setStatut={setStatut} myCourses={myCourses} myActives={myActives} myTermines={myTermines} bons={cBons} saveBon={saveBon} bases={bases} carnetBordTypes={carnetBordTypes} onBack={()=>setAppView("menu")} onEndService={()=>{setCDriver(null);setCVehicle(null);setCScreen("choix_nom");setCStatuts({});setCCourse(null);setCBons([]);setAppView("menu");}} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(appView==="checklists") return <ChecklistsHome onBack={()=>setAppView("menu")} checklists={checklistsData} emails={checklistEmails} o2Emails={o2Emails} peremptionEmails={peremptionEmails} vehicles={vehicles} carnetBordTypes={carnetBordTypes} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(appView==="garage") return <GarageView onBack={()=>setAppView("menu")} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(appView==="bons") return <BonsMenuView bases={bases} onBack={backToSubMenu} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(appView==="preventif") return <PreventifView onBack={()=>setAppView("menu")} vehicles={vehicles} driversAmb={driversAmb} driversTpmr={driversTpmr} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(appView==="signaler") return <SignalerCompletView onBack={()=>setAppView("menu")} vehicles={vehicles} themeMode={themeMode} toggleTheme={toggleTheme}/>;
  if(appView==="parametres") return <ParametresView driversAmb={driversAmb} setDriversAmb={setDriversAmb} driversTpmr={driversTpmr} setDriversTpmr={setDriversTpmr} stagiairesAmb={stagiairesAmb} setStagiairesAmb={setStagiairesAmb} formationTpmr={formationTpmr} setFormationTpmr={setFormationTpmr} vehicles={vehicles} setVehicles={setVehicles} conventions={conventions} setConventions={setConventions} equipements={equipements} setEquipements={setEquipements} transportTypes={transportTypes} setTransportTypes={setTransportTypes} bases={bases} setBases={setBases} contacts={contacts} setContacts={setContacts} plans={plans} setPlans={setPlans} tarifs={tarifs} setTarifs={setTarifs} checklistsData={checklistsData} setChecklistsData={setChecklistsData} checklistEmails={checklistEmails} setChecklistEmails={setChecklistEmails} o2Emails={o2Emails} setO2Emails={setO2Emails} peremptionEmails={peremptionEmails} setPeremptionEmails={setPeremptionEmails} listeRouge={listeRouge} setListeRouge={setListeRouge} carnetBordTypes={carnetBordTypes} setCarnetBordTypes={setCarnetBordTypes} onBack={()=>setAppView("menu")} themeMode={themeMode} toggleTheme={toggleTheme}/>;

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:38,height:38,background:C.accent,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🚑</div>
          <div><div style={{fontWeight:700,fontSize:16}}>DispatchAI</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"1.2px"}}>A.P.S. · Système de dispatch</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Badge color={C.success} soft={C.successSoft} pulse>En ligne</Badge>
          <Clock/>
          <button onClick={()=>{const next=themeMode==="light"?"dark":"light";applyThemeMode(next);applyCkThemeMode(next);setThemeMode(next);}} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙 Sombre":"☀️ Clair"}</button>
          <button onClick={()=>setShowPin(true)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>⚙️ Paramètres</button>
        </div>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 20px"}}>
        <div style={{width:"100%",maxWidth:700,animation:"fadeUp 0.4s ease"}}>
          <div style={{textAlign:"center",marginBottom:44}}>
            <div style={{fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:"2px",marginBottom:10}}>Choisissez votre interface</div>
            <div style={{fontSize:30,fontWeight:700,letterSpacing:"-0.5px"}}>Où souhaitez-vous aller ?</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:36}}>
            {[{val:dailyActiveCount,label:"Véhicules actifs",color:C.accent},{val:vehicles.filter(v=>v.active&&v.status==="disponible"&&!v.horsBase).length,label:"Véhicules disponibles",color:C.success},{val:courses.length,label:"Courses du jour",color:C.blue},{val:Object.keys(checklistsData).filter(n=>!checklistStatuses[n]?.complete).length,label:"Checklists restantes",color:Object.keys(checklistsData).filter(n=>!checklistStatuses[n]?.complete).length===0?C.success:"#dc2626"}].map(s=>(
              <div key={s.label} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",textAlign:"center"}}>
                <div style={{fontSize:24,fontWeight:800,color:s.color,fontFamily:"'IBM Plex Mono',monospace"}}>{s.val}</div>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.5px",marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>
          {!showDispMenu?(
            <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
              <button onClick={()=>setShowDispMenu(true)}
                style={{background:C.panel,border:`1.5px solid ${C.border}`,borderRadius:16,padding:"24px 20px",textAlign:"left",cursor:"pointer",display:"flex",flexDirection:"column",gap:10,position:"relative",overflow:"hidden"}}>
                {pendingTodayCount>0&&<div style={{position:"absolute",top:12,right:12,background:C.warningSoft,border:`1px solid ${C.warning}`,borderRadius:20,padding:"3px 9px",fontSize:10,color:C.warning,fontWeight:700,display:"flex",alignItems:"center",gap:4}}><div style={{width:5,height:5,borderRadius:"50%",background:C.warning,animation:"blink 1.2s infinite"}}/>{pendingTodayCount} en attente</div>}
                <div style={{width:48,height:48,background:C.accentSoft,border:`1.5px solid ${C.accent}`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>🖥️</div>
                <div>
                  <div style={{fontWeight:800,fontSize:17,color:C.text,marginBottom:2}}>Dispatch</div>
                  <div style={{fontSize:11,color:C.accent,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>Centre de contrôle</div>
                  <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Gérer la flotte, valider les courses, formulaire de saisie.</div>
                </div>
                <div style={{fontSize:12,color:C.accent,fontWeight:700,marginTop:"auto"}}>Ouvrir →</div>
              </button>
              <button onClick={()=>setAppView("chauffeur")}
                style={{background:C.panel,border:`1.5px solid ${C.border}`,borderRadius:16,padding:"24px 20px",textAlign:"left",cursor:"pointer",display:"flex",flexDirection:"column",gap:10}}>
                <div style={{width:48,height:48,background:C.successSoft,border:`1.5px solid ${C.success}`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>🚑</div>
                <div>
                  <div style={{fontWeight:800,fontSize:17,color:C.text,marginBottom:2}}>Chauffeur</div>
                  <div style={{fontSize:11,color:C.success,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>Tablette de bord</div>
                  <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Voir le planning, démarrer les courses, gérer les bons de transport.</div>
                </div>
                <div style={{fontSize:12,color:C.success,fontWeight:700,marginTop:"auto"}}>Ouvrir →</div>
              </button>
              <button onClick={()=>setAppView("checklists")}
                style={{background:C.panel,border:`1.5px solid ${C.border}`,borderRadius:16,padding:"24px 20px",textAlign:"left",cursor:"pointer",display:"flex",flexDirection:"column",gap:10}}>
                <div style={{width:48,height:48,background:"rgba(220,38,38,0.12)",border:"1.5px solid #dc2626",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>📋</div>
                <div>
                  <div style={{fontWeight:800,fontSize:17,color:C.text,marginBottom:2}}>Checklists</div>
                  <div style={{fontSize:11,color:"#dc2626",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>Contrôle véhicules</div>
                  <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Vérifier le matériel embarqué par véhicule (Alpha 1 à 7).</div>
                </div>
                <div style={{fontSize:12,color:"#dc2626",fontWeight:700,marginTop:"auto"}}>Ouvrir →</div>
              </button>
            </div>
            <button onClick={()=>setAppView("preventif")}
              style={{width:"100%",marginTop:14,background:C.panel,border:`1.5px solid ${C.purple}`,borderRadius:16,padding:"22px 20px",display:"flex",alignItems:"center",gap:16,cursor:"pointer",textAlign:"left"}}>
              <div style={{width:52,height:52,background:C.purpleSoft,border:`1.5px solid ${C.purple}`,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>🚑</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:17,color:C.text,marginBottom:2}}>Préventif</div>
                <div style={{fontSize:11,color:C.purple,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:6}}>Postes de secours événementiels</div>
                <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Fiches événements, matériel, personnel et véhicule assigné.</div>
              </div>
              <div style={{fontSize:13,color:C.purple,fontWeight:700}}>Ouvrir →</div>
            </button>
            <div style={{display:"flex",gap:10,marginTop:14}}>
              <button onClick={()=>setAppView("garage")}
                style={{flex:1,background:C.panel,border:`1.5px solid ${C.danger}55`,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",textAlign:"left"}}>
                <div style={{width:38,height:38,background:C.dangerSoft,border:`1.5px solid ${C.danger}`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>🔧</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:14,color:C.text}}>Garage</div>
                  <div style={{fontSize:10,color:C.muted}}>Défauts + Mode TV</div>
                </div>
              </button>
              <button onClick={()=>setAppView("signaler")}
                style={{flex:1,background:C.panel,border:`1.5px solid ${C.danger}55`,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",textAlign:"left"}}>
                <div style={{width:38,height:38,background:C.dangerSoft,border:`1.5px solid ${C.danger}`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>🚨</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:14,color:C.text}}>Signaler</div>
                  <div style={{fontSize:10,color:C.muted}}>Tout véhicule</div>
                </div>
              </button>
            </div>
            </>
          ):(
            <div>
              <button onClick={()=>setShowDispMenu(false)} style={{background:"transparent",border:"none",color:C.muted,fontSize:13,cursor:"pointer",marginBottom:16,display:"flex",alignItems:"center",gap:6}}>← Retour</button>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14}}>
                <button onClick={()=>{setShowDispMenu(false);setAppView("formulaire");}}
                  style={{background:C.panel,border:`1.5px solid ${C.border}`,borderRadius:16,padding:"24px 20px",textAlign:"left",cursor:"pointer",display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{width:48,height:48,background:C.blueSoft,border:`1.5px solid ${C.blue}`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>📋</div>
                  <div>
                    <div style={{fontWeight:800,fontSize:17,color:C.text,marginBottom:2}}>Formulaire</div>
                    <div style={{fontSize:11,color:C.blue,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>Saisie de course</div>
                    <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Encoder une nouvelle course.</div>
                  </div>
                  <div style={{fontSize:12,color:C.blue,fontWeight:700,marginTop:"auto"}}>Ouvrir →</div>
                </button>
                <button onClick={()=>{setShowDispMenu(false);setAppView("dispatcher");}}
                  style={{background:C.panel,border:`1.5px solid ${C.border}`,borderRadius:16,padding:"24px 20px",textAlign:"left",cursor:"pointer",display:"flex",flexDirection:"column",gap:10,position:"relative",overflow:"hidden"}}>
                  {pendingTodayCount>0&&<div style={{position:"absolute",top:12,right:12,background:C.warningSoft,border:`1px solid ${C.warning}`,borderRadius:20,padding:"3px 9px",fontSize:10,color:C.warning,fontWeight:700,display:"flex",alignItems:"center",gap:4}}><div style={{width:5,height:5,borderRadius:"50%",background:C.warning,animation:"blink 1.2s infinite"}}/>{pendingTodayCount} en attente</div>}
                  <div style={{width:48,height:48,background:C.accentSoft,border:`1.5px solid ${C.accent}`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>🖥️</div>
                  <div>
                    <div style={{fontWeight:800,fontSize:17,color:C.text,marginBottom:2}}>Dispatch</div>
                    <div style={{fontSize:11,color:C.accent,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>Centre de contrôle</div>
                    <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Gérer la flotte, valider les courses.</div>
                  </div>
                  <div style={{fontSize:12,color:C.accent,fontWeight:700,marginTop:"auto"}}>Ouvrir →</div>
                </button>
                <button onClick={()=>{setShowDispMenu(false);setAppView("planning");}}
                  style={{background:C.panel,border:`1.5px solid ${C.border}`,borderRadius:16,padding:"24px 20px",textAlign:"left",cursor:"pointer",display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{width:48,height:48,background:C.purpleSoft,border:`1.5px solid ${C.purple}`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>🗓️</div>
                  <div>
                    <div style={{fontWeight:800,fontSize:17,color:C.text,marginBottom:2}}>Planning</div>
                    <div style={{fontSize:11,color:C.purple,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>Calendrier & patients habituels</div>
                    <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Programmer à l'avance, dialyse, radiothérapie…</div>
                  </div>
                  <div style={{fontSize:12,color:C.purple,fontWeight:700,marginTop:"auto"}}>Ouvrir →</div>
                </button>
                <button onClick={()=>{setShowDispMenu(false);setAppView("bons");}}
                  style={{background:C.panel,border:`1.5px solid ${C.border}`,borderRadius:16,padding:"24px 20px",textAlign:"left",cursor:"pointer",display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{width:48,height:48,background:C.successSoft,border:`1.5px solid ${C.success}`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>🧾</div>
                  <div>
                    <div style={{fontWeight:800,fontSize:17,color:C.text,marginBottom:2}}>Bons</div>
                    <div style={{fontSize:11,color:C.success,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>Bons de transport</div>
                    <div style={{fontSize:12,color:C.muted,lineHeight:1.5}}>Réception et traitement des bons envoyés.</div>
                  </div>
                  <div style={{fontSize:12,color:C.success,fontWeight:700,marginTop:"auto"}}>Ouvrir →</div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STEPS_F=[{id:1,icon:"📞",label:"Appelant"},{id:2,icon:"👤",label:"Patient"},{id:3,icon:"🗺",label:"Trajet"},{id:4,icon:"🔖",label:"Transport"},{id:5,icon:"🏥",label:"Médical"}];
const EMPTY_F={convention:"",autreConvention:"",epicuraType:"",nom:"",prenom:"",dateNaissance:"",telephone:"",adresseDepart:"",adresseArrivee:"",typeTransport:"",sousType:"",date:"",heures:[{heure:"",description:""}],heurePC:"",mobilite:"assis",equipSelected:[],litrageO2:2,accompagnant:false,notes:""};

function validateF(form,step){
  const e={};
  if(step>=1){if(!form.convention)e.convention="Convention requise";}
  if(step>=2){if(!form.nom.trim())e.nom="Requis";if(!form.prenom.trim())e.prenom="Requis";}
  if(step>=3){if(!form.adresseDepart.trim())e.adresseDepart="Requis";if(!form.adresseArrivee.trim())e.adresseArrivee="Requis";}
  if(step>=4){if(!form.typeTransport)e.typeTransport="Requis";if(!form.date||!form.date.trim())e.date="Date requise";}
  return e;
}

function FormulaireView({onBack,onSubmit,conventions,equipements,transportTypes,contacts,listeRouge,themeMode,toggleTheme}){
  const [step,setStep]=useState(1);
  const [form,setForm]=useState(()=>({...EMPTY_F,date:todayFR()}));
  const [touched,setTouched]=useState({});
  const [done,setDone]=useState(false);
  const [showContactsPicker,setShowContactsPicker]=useState(false);
  const [showEmailPaste,setShowEmailPaste]=useState(false);
  const [emailPasteText,setEmailPasteText]=useState("");
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const touch=(...ks)=>setTouched(t=>{const n={...t};ks.forEach(k=>n[k]=true);return n;});
  const errors=validateF(form,step);
  const canNext=Object.keys(errors).length===0;
  const TOUCH_MAP={1:["convention"],2:["nom","prenom"],3:["adresseDepart","adresseArrivee"],4:["typeTransport"],5:[]};
  const goNext=()=>{touch(...(TOUCH_MAP[step]||[]));if(canNext)setStep(s=>Math.min(s+1,5));};
  const toggleEquip=(id)=>{const sel=form.equipSelected||[];if(sel.includes(id))set("equipSelected",sel.filter(x=>x!==id));else set("equipSelected",[...sel,id]);};
  const isAmb=needsAmb(form.mobilite,form.equipSelected);
  const vehicle=isAmb?{label:"AMBULANCE",icon:"🚑",color:C.danger}:form.mobilite==="assis"?{label:"VSL / TPMR",icon:"🚗",color:C.blue}:{label:"TPMR",icon:"♿",color:C.blue};
  const normalizedFull=`${(form.nom||"").trim()} ${(form.prenom||"").trim()}`.toLowerCase();
  const redEntry=(listeRouge||[]).find(p=>{
    if(!p.name||!p.name.trim()) return false;
    if(!normalizedFull.includes(p.name.trim().toLowerCase())) return false;
    if(p.birthdate) return (form.dateNaissance||"")===p.birthdate;
    return true;
  });
  const handleSubmit=()=>{if(redEntry) return; if(Object.keys(validateF(form,5)).length===0){onSubmit(form);setDone(true);}};
  const addHeure=()=>set("heures",[...form.heures,{heure:"",description:""}]);
  const removeHeure=(i)=>set("heures",form.heures.filter((_,j)=>j!==i));
  const updateHeure=(i,k,v)=>set("heures",form.heures.map((h,j)=>j===i?{...h,[k]:v}:h));

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:13,cursor:"pointer"}}>← Menu</button>
          <div style={{width:34,height:34,background:C.accent,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📋</div>
          <div><div style={{fontWeight:700,fontSize:14}}>Nouvelle course</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"1px"}}>Formulaire de saisie</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}><Badge color={C.success} soft={C.successSoft} pulse>En ligne</Badge><Clock/><button onClick={toggleTheme} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙 Sombre":"☀️ Clair"}</button></div>
      </div>
      <div style={{flex:1,padding:"24px 20px 100px",maxWidth:620,margin:"0 auto",width:"100%"}}>
        {done?(
          <div style={{textAlign:"center",padding:"60px 20px",animation:"fadeUp 0.4s ease"}}>
            <div style={{fontSize:64,marginBottom:14}}>✅</div>
            <div style={{fontSize:22,fontWeight:800,color:C.success,marginBottom:8}}>Course envoyée au dispatcher !</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:28}}>En attente de validation</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setForm({...EMPTY_F,date:todayFR()});setTouched({});setStep(1);setDone(false);}} style={{flex:1,padding:"13px",background:C.accent,border:"none",borderRadius:12,color:"white",fontSize:14,fontWeight:800,cursor:"pointer"}}>+ Nouvelle course</button>
              <button onClick={onBack} style={{flex:1,padding:"13px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:12,color:C.muted,fontSize:14,cursor:"pointer"}}>← Menu</button>
            </div>
          </div>
        ):(
          <>
            <div style={{marginBottom:18}}><div style={{fontSize:22,fontWeight:700,marginBottom:3}}>{STEPS_F[step-1].icon} {STEPS_F[step-1].label}</div><div style={{fontSize:12,color:C.muted}}>Étape {step} sur 5</div></div>
            <div style={{display:"flex",gap:5,marginBottom:20}}>{STEPS_F.map((_,i)=><div key={i} style={{flex:1,height:3,borderRadius:99,background:i<step?C.accent:C.border,transition:"background 0.3s"}}/>)}</div>
            <div style={{display:"flex",marginBottom:26}}>
              {STEPS_F.map(s=>{const isDone=step>s.id,isActive=step===s.id;return(
                <div key={s.id} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:isDone?C.success:isActive?C.accent:C.panel2,border:`2px solid ${isDone?C.success:isActive?C.accent:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:isDone?11:14,boxShadow:isActive?`0 0 12px ${C.accentGlow}`:"none",transition:"all 0.3s"}}>{isDone?"✓":s.icon}</div>
                  <span style={{fontSize:9,fontWeight:isActive?700:400,color:isDone?C.success:isActive?C.accent:C.muted,textTransform:"uppercase"}}>{s.label}</span>
                </div>
              );})}
            </div>
            <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"22px 24px",animation:"fadeUp 0.3s ease"}}>
              {step===1&&(
                <>
                  <button onClick={()=>setShowEmailPaste(true)} style={{width:"100%",marginBottom:16,background:C.blueSoft,border:`1.5px dashed ${C.blue}`,borderRadius:11,padding:"13px",color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>📋 Coller un email</button>
                  <SectionTitle icon="📞" title="Appelant"/>
                  <FieldWrap label="Appelant" error={errors.convention} touched={touched.convention} required>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginTop:2}}>
                      {[...conventions].sort((a,b)=>a.label.localeCompare(b.label,"fr")).map(c=>{const active=form.convention===c.id;return(
                        <button key={c.id} onClick={()=>{set("convention",c.id);touch("convention");}}
                          style={{padding:"11px 7px",borderRadius:9,cursor:"pointer",border:`1.5px solid ${active?C.accent:C.border}`,background:active?C.accentSoft:C.panel2,color:active?C.accent:C.muted,display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontSize:12,fontWeight:active?700:500,transition:"all 0.15s"}}>
                          <span>{c.icon}</span>{c.label}
                        </button>
                      );})}
                    </div>
                  </FieldWrap>
                  {form.convention==="autre"&&<div style={{marginTop:14}}><FieldWrap label="Précisez"><TextInput value={form.autreConvention||""} onChange={e=>set("autreConvention",e.target.value)} onBlur={()=>{}} placeholder="Nom de la convention…"/></FieldWrap></div>}
                  {form.convention==="epicura"&&(
                    <div style={{marginTop:14}}>
                      <FieldWrap label="Facturation">
                        <div style={{display:"flex",gap:8}}>
                          {[["conventionne","Conventionné (facturé à l'hôpital)"],["non_conventionne","Non conventionné (facturé au patient)"]].map(([v,l])=>(
                            <button key={v} onClick={()=>set("epicuraType",v)} style={{flex:1,padding:"11px 8px",borderRadius:9,cursor:"pointer",border:`1.5px solid ${form.epicuraType===v?C.accent:C.border}`,background:form.epicuraType===v?C.accentSoft:C.panel2,color:form.epicuraType===v?C.accent:C.muted,fontSize:12,fontWeight:form.epicuraType===v?700:500}}>{l}</button>
                          ))}
                        </div>
                      </FieldWrap>
                    </div>
                  )}
                </>
              )}
              {step===2&&(
                <>
                  <SectionTitle icon="👤" title="Patient"/>
                  {redEntry&&(
                    <div style={{background:C.dangerSoft,border:`1.5px solid ${C.danger}`,borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:22}}>🚫</span>
                      <div><div style={{fontWeight:800,fontSize:13,color:C.danger}}>Patient sur liste rouge — course bloquée</div><div style={{fontSize:12,color:C.text,marginTop:2}}>Raison : {redEntry.reason}</div></div>
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                    <FieldWrap label="Nom" error={errors.nom} touched={touched.nom} required><TextInput value={form.nom} onChange={e=>set("nom",e.target.value)} onBlur={()=>touch("nom")} placeholder="Dupont" error={errors.nom} touched={touched.nom}/></FieldWrap>
                    <FieldWrap label="Prénom" error={errors.prenom} touched={touched.prenom} required><TextInput value={form.prenom} onChange={e=>set("prenom",e.target.value)} onBlur={()=>touch("prenom")} placeholder="Jean" error={errors.prenom} touched={touched.prenom}/></FieldWrap>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <FieldWrap label="Date de naissance"><DateInput value={form.dateNaissance} onChange={v=>set("dateNaissance",v)}/></FieldWrap>
                    <FieldWrap label="Téléphone">
                      <div style={{display:"flex",gap:6}}>
                        <div style={{flex:1}}><TextInput value={form.telephone} onChange={e=>set("telephone",e.target.value)} onBlur={()=>{}} placeholder="06 00 00 00 00"/></div>
                        <button type="button" onClick={()=>setShowContactsPicker(true)} title="Carnet de contacts"
                          style={{flexShrink:0,width:40,background:C.blueSoft,border:`1.5px solid ${C.blue}`,borderRadius:9,color:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,cursor:"pointer"}}>📒</button>
                        {form.telephone&&form.telephone.trim()&&(
                          <a href={`tel:${form.telephone.replace(/\s/g,"")}`} title="Appeler le patient"
                            style={{flexShrink:0,width:40,background:C.successSoft,border:`1.5px solid ${C.success}`,borderRadius:9,color:C.success,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,textDecoration:"none"}}>📞</a>
                        )}
                      </div>
                    </FieldWrap>
                  </div>
                </>
              )}
              {step===3&&(
                <>
                  <SectionTitle icon="🗺" title="Trajet"/>
                  <div style={{marginBottom:8}}>
                    <FieldWrap label="Adresse de départ" error={errors.adresseDepart} touched={touched.adresseDepart} required>
                      <div style={{position:"relative"}}><TextInput value={form.adresseDepart} onChange={e=>set("adresseDepart",e.target.value)} onBlur={()=>touch("adresseDepart")} placeholder="12 rue des Lilas, Mons" error={errors.adresseDepart} touched={touched.adresseDepart}/><span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:14,pointerEvents:"none"}}>📍</span></div>
                    </FieldWrap>
                  </div>
                  <div style={{textAlign:"center",padding:"8px 0",color:C.muted,fontSize:20}}>↓</div>
                  <FieldWrap label="Destination" error={errors.adresseArrivee} touched={touched.adresseArrivee} required>
                    <div style={{position:"relative"}}><TextInput value={form.adresseArrivee} onChange={e=>set("adresseArrivee",e.target.value)} onBlur={()=>touch("adresseArrivee")} placeholder="CHU Mons — Service…" error={errors.adresseArrivee} touched={touched.adresseArrivee}/><span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:14,pointerEvents:"none"}}>🏁</span></div>
                  </FieldWrap>
                </>
              )}
              {step===4&&(
                <>
                  <SectionTitle icon="🔖" title="Type de transport"/>
                  {touched.typeTransport&&errors.typeTransport&&<div style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:8,padding:"8px 13px",fontSize:11,color:C.danger,fontWeight:700,marginBottom:12}}>⚠ {errors.typeTransport}</div>}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                    {transportTypes.map(t=>{const active=form.typeTransport===t.id;return(
                      <button key={t.id} onClick={()=>{set("typeTransport",t.id);touch("typeTransport");set("sousType","");}}
                        style={{padding:"12px 13px",borderRadius:10,cursor:"pointer",textAlign:"left",border:`1.5px solid ${active?C.accent:C.border}`,background:active?C.accentSoft:C.panel2,display:"flex",alignItems:"center",gap:9,transition:"all 0.15s"}}>
                        <span style={{fontSize:18}}>{t.icon}</span>
                        <span style={{fontSize:12,fontWeight:active?700:500,color:active?C.accent:C.mutedLight}}>{t.label}</span>
                      </button>
                    );})}
                  </div>
                  {form.typeTransport==="consultation"&&(
                    <div style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px",marginBottom:16,animation:"pop 0.2s ease"}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:10}}>Type de consultation</div>
                      <div style={{display:"flex",gap:8}}>
                        {[{id:"deposer",icon:"🚗",label:"Déposer"},{id:"attente",icon:"⏳",label:"Avec attente"}].map(s=>{const active=form.sousType===s.id;return(
                          <button key={s.id} onClick={()=>set("sousType",s.id)}
                            style={{flex:1,padding:"12px",borderRadius:9,border:`1.5px solid ${active?C.accent:C.border}`,background:active?C.accentSoft:C.bg,color:active?C.accent:C.muted,fontWeight:active?700:500,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
                            <span>{s.icon}</span>{s.label}
                          </button>
                        );})}
                      </div>
                    </div>
                  )}
                  <div style={{marginBottom:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <FieldWrap label="Date de la course" required>
                      <DateInput value={form.date} onChange={v=>set("date",v)}/>
                    </FieldWrap>
                    <FieldWrap label="Heure de prise en charge">
                      <HeureInput value={form.heurePC} onChange={v=>set("heurePC",v)}/>
                    </FieldWrap>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span>Heure(s) de rendez-vous</span>
                      <button onClick={addHeure} style={{background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:6,color:C.accent,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Ajouter</button>
                    </div>
                    {form.heures.map((h,i)=>(
                      <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
                        <div style={{width:110,flexShrink:0}}><HeureInput value={h.heure} onChange={v=>updateHeure(i,"heure",v)}/></div>
                        <input value={h.description} onChange={e=>updateHeure(i,"description",e.target.value)} placeholder="ex: Cardio, Ophtalmo…" style={{background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:13,flex:1,fontFamily:"inherit"}}/>
                        {form.heures.length>1&&<button onClick={()=>removeHeure(i)} style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:6,color:C.danger,padding:"6px 10px",fontSize:14,cursor:"pointer",flexShrink:0}}>✕</button>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {step===5&&(
                <>
                  <SectionTitle icon="🏥" title="Médical"/>
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:10}}>Mobilité</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      {[{id:"assis",icon:"🧍",label:"Assis valide",desc:"Marche seul"},{id:"chaise_perso",icon:"♿",label:"Chaise personnelle",desc:"A sa propre chaise"},{id:"chaise_aps",icon:"♿",label:"Chaise APS",desc:"Chauffeur apporte la chaise"},{id:"brancard",icon:"🛏",label:"Brancard",desc:"Allongé — Ambulance"}].map(m=>{const active=form.mobilite===m.id;return(
                        <button key={m.id} onClick={()=>set("mobilite",m.id)} style={{padding:"12px 13px",borderRadius:10,cursor:"pointer",textAlign:"left",border:`1.5px solid ${active?C.accent:C.border}`,background:active?C.accentSoft:C.panel2,transition:"all 0.15s"}}>
                          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}><span style={{fontSize:16}}>{m.icon}</span><span style={{fontSize:12,fontWeight:active?700:600,color:active?C.accent:C.text}}>{m.label}</span></div>
                          <div style={{fontSize:10,color:C.muted,paddingLeft:23}}>{m.desc}</div>
                        </button>
                      );})}
                    </div>
                  </div>
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:10}}>Équipement</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                      {equipements.map(eq=>{const active=(form.equipSelected||[]).includes(eq.id);return(
                        <button key={eq.id} onClick={()=>toggleEquip(eq.id)} style={{padding:"8px 15px",borderRadius:8,cursor:"pointer",border:`1.5px solid ${active?C.danger:C.border}`,background:active?C.dangerSoft:"transparent",color:active?C.danger:C.muted,fontSize:12,fontWeight:active?700:500,display:"flex",alignItems:"center",gap:6,transition:"all 0.15s"}}>
                          <span>{eq.icon}</span>{eq.label}
                        </button>
                      );})}
                    </div>
                    {(form.equipSelected||[]).includes("oxygene")&&(
                      <div style={{background:C.dangerSoft,border:`1px solid ${C.danger}`,borderRadius:11,padding:"14px 16px",animation:"pop 0.2s ease"}}>
                        <div style={{fontSize:11,fontWeight:700,color:C.danger,marginBottom:12}}>💨 Débit d'oxygène</div>
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          <button onClick={()=>set("litrageO2",Math.max(1,form.litrageO2-1))} style={{width:32,height:32,borderRadius:7,border:`1px solid ${C.danger}`,background:"transparent",color:C.danger,fontSize:20,cursor:"pointer",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                          <div style={{textAlign:"center",minWidth:60}}><div style={{fontSize:28,fontWeight:800,color:C.danger,lineHeight:1}}>{form.litrageO2}</div><div style={{fontSize:10,color:C.muted,marginTop:3}}>L/min</div></div>
                          <button onClick={()=>set("litrageO2",Math.min(15,form.litrageO2+1))} style={{width:32,height:32,borderRadius:7,border:`1px solid ${C.danger}`,background:"transparent",color:C.danger,fontSize:20,cursor:"pointer",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                          <div style={{flex:1}}><input type="range" min={1} max={15} value={form.litrageO2} onChange={e=>set("litrageO2",Number(e.target.value))} style={{width:"100%",accentColor:C.danger}}/><div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.muted}}><span>1L</span><span>15L max</span></div></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{marginBottom:16}}>
                    <button onClick={()=>set("accompagnant",!form.accompagnant)} style={{width:"100%",padding:"12px 15px",borderRadius:10,cursor:"pointer",border:`1.5px solid ${form.accompagnant?C.success:C.border}`,background:form.accompagnant?C.successSoft:C.panel2,display:"flex",alignItems:"center",gap:10,transition:"all 0.15s"}}>
                      <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${form.accompagnant?C.success:C.muted}`,background:form.accompagnant?C.success:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>{form.accompagnant&&<span style={{color:"white",fontSize:11,fontWeight:800}}>✓</span>}</div>
                      <div style={{textAlign:"left"}}><div style={{fontSize:13,fontWeight:form.accompagnant?700:500,color:form.accompagnant?C.success:C.text}}>👥 1 accompagnant</div><div style={{fontSize:10,color:C.muted}}>Un accompagnant sera présent dans le véhicule</div></div>
                    </button>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:C.mutedLight,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:7}}>Notes</div>
                    <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Accès difficile, patient anxieux…" rows={2} style={{width:"100%",background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:9,padding:"10px 13px",color:C.text,fontSize:12,resize:"none",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <div style={{marginTop:14,background:`${vehicle.color}10`,border:`1.5px solid ${vehicle.color}`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:28}}>{vehicle.icon}</span>
                    <div><div style={{fontSize:13,fontWeight:800,color:vehicle.color}}>Véhicule requis : {vehicle.label}</div><div style={{fontSize:11,color:C.muted}}>{isAmb?"Ambulance obligatoire":"Transport standard"}{form.accompagnant?" · +1 accompagnant":""}</div></div>
                  </div>
                </>
              )}
            </div>
            <div style={{display:"flex",gap:10,marginTop:18}}>
              {step>1&&<button onClick={()=>setStep(s=>s-1)} style={{flex:1,padding:"12px",background:"transparent",border:`1.5px solid ${C.border}`,borderRadius:11,color:C.mutedLight,fontSize:13,fontWeight:700,cursor:"pointer"}}>← Précédent</button>}
              {step<5?<button onClick={goNext} style={{flex:2,padding:"12px",background:canNext?C.accent:C.panel2,border:"none",borderRadius:11,color:canNext?"white":C.muted,fontSize:13,fontWeight:800,cursor:canNext?"pointer":"not-allowed",opacity:canNext?1:0.6}}>Suivant →</button>
              :<button onClick={handleSubmit} disabled={!!redEntry} style={{flex:2,padding:"12px",background:redEntry?C.panel2:C.success,border:"none",borderRadius:11,color:redEntry?C.danger:"white",fontSize:13,fontWeight:800,cursor:redEntry?"not-allowed":"pointer"}}>{redEntry?"🚫 Bloqué — liste rouge":"📤 Envoyer au dispatcher"}</button>}
            </div>
          </>
        )}
      </div>
      {showEmailPaste&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:250}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:480,maxWidth:"92vw",maxHeight:"90vh",overflowY:"auto",animation:"pop 0.2s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontWeight:800,fontSize:16,color:C.blue}}>📋 Coller un email</div>
              <button onClick={()=>{setShowEmailPaste(false);setEmailPasteText("");}} style={{background:"transparent",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button>
            </div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Colle le texte de l'email de l'hôpital ci-dessous, l'IA remplira automatiquement le formulaire.</div>
            <textarea value={emailPasteText} onChange={e=>setEmailPasteText(e.target.value)} placeholder="Colle ici le texte complet de l'email…" style={{width:"100%",minHeight:180,background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"12px 14px",color:C.text,fontSize:13,resize:"vertical",boxSizing:"border-box",fontFamily:"inherit",marginBottom:16}}/>
            <div style={{background:C.warningSoft,border:`1px solid ${C.warning}`,borderRadius:9,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.text}}>🚧 Analyse IA pas encore branchée — arrive bientôt.</div>
            <button disabled style={{width:"100%",background:C.panel2,border:"none",borderRadius:10,color:C.muted,padding:14,fontWeight:800,fontSize:14,cursor:"not-allowed"}}>🔍 Analyser (bientôt disponible)</button>
          </div>
        </div>
      )}
      {showContactsPicker&&<ContactsPickerModal contacts={contacts} pickMode onSelect={(tel)=>set("telephone",tel)} onClose={()=>setShowContactsPicker(false)}/>}
    </div>
  );
}
