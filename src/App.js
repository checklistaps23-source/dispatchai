import { useState, useEffect, useRef } from "react";
import React from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

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
      setDoc(doc(db, "dispatchai", key), { data: next }).catch((err)=>console.error("Firestore write error ("+key+"):", err));
      return next;
    });
  };

  return [value, update];
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
              style={{padding:"14px",borderRadius:10,border:`1px solid ${C.border}`,background:k?"":C.bg,color:k==="del"?C.danger:C.text,fontSize:k==="del"?18:20,fontWeight:700,cursor:k?"pointer":"default"}}>
              {k==="del"?"⌫":k}
            </button>
          ))}
        </div>
        <button onClick={onCancel} style={{width:"100%",background:"transparent",border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,padding:"10px",fontSize:13,cursor:"pointer"}}>Annuler</button>
      </div>
    </div>
  );
}

function ParametresView({driversAmb,setDriversAmb,driversTpmr,setDriversTpmr,stagiairesAmb,setStagiairesAmb,formationTpmr,setFormationTpmr,vehicles,setVehicles,conventions,setConventions,equipements,setEquipements,transportTypes,setTransportTypes,bases,setBases,contacts,setContacts,plans,setPlans,tarifs,setTarifs,onBack}){
  const [tab,setTab]=useState("chauffeurs");
  const [newVal,setNewVal]=useState("");
  const [newVehName,setNewVehName]=useState("");
  const [newVehType,setNewVehType]=useState("TPMR");
  const [newConvLabel,setNewConvLabel]=useState("");
  const [newEquipLabel,setNewEquipLabel]=useState("");
  const [newEquipForceAmb,setNewEquipForceAmb]=useState(false);
  const [newTypeLabel,setNewTypeLabel]=useState("");
  const [newTypeIcon,setNewTypeIcon]=useState("🚑");
  const [subTab,setSubTab]=useState("amb");
  const TABS=[{id:"chauffeurs",icon:"👤",label:"Chauffeurs"},{id:"stagiaires",icon:"🎓",label:"Stag/Form."},{id:"vehicules",icon:"🚐",label:"Véhicules"},{id:"conventions",icon:"📞",label:"Conventions"},{id:"equipements",icon:"🏥",label:"Équipements"},{id:"transports",icon:"🔖",label:"Transports"},{id:"bases",icon:"🏠",label:"Bases"},{id:"contacts",icon:"📒",label:"Contacts"},{id:"plans",icon:"🗺️",label:"Plans"},{id:"tarifs",icon:"💶",label:"Tarifs"}];
  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'IBM Plex Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column"}}>
      <style>{GS}</style>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"6px 12px",fontSize:13,cursor:"pointer"}}>← Menu</button>
          <div style={{width:34,height:34,background:C.accent,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⚙️</div>
          <div><div style={{fontWeight:700,fontSize:14}}>Paramètres</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"1px"}}>Configuration</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}><Badge color={C.success} soft={C.successSoft} pulse>En ligne</Badge><Clock/></div>
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
                    <div><div style={{fontSize:13,fontWeight:600}}>🗺️ {p.nom}</div><div style={{fontSize:10,color:C.success}}>PDF chargé ✓</div></div>
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

function DispatcherView({vehicles,setVehicles,courses,setCourses,pending,onValidate,onRefuse,onBack,contacts,tarifs}){
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
  const filteredV=activeVehicles.filter(v=>filterType==="tous"?true:v.type===filterType);
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
            {filteredV.map(v=>{
              const sc={en_course:{label:"En course",color:C.success},disponible:{label:"Disponible",color:C.blue},attente:{label:"En attente",color:C.warning}}[v.status]||{label:"—",color:C.muted};
              const isSelected=selectedV?.id===v.id;
              const cnt=vCourses(v.id).length;
              return(
                <div key={v.id} onClick={()=>setSelectedV(isSelected?null:v)}
                  style={{background:isSelected?C.accentSoft:C.panel2,border:`1px solid ${isSelected?C.accent:C.border}`,borderRadius:8,padding:"9px 10px",marginBottom:5,cursor:"pointer",transition:"all 0.14s"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:13,color:vColor(v.type)}}>{vIcon(v.type)}</span><span style={{fontWeight:700,fontSize:12}}>{v.name}</span></div>
                    <div style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:5,height:5,borderRadius:"50%",background:sc.color,animation:v.status==="en_course"?"pulse 2s infinite":"none"}}/><span style={{fontSize:9,color:sc.color,fontWeight:700}}>{sc.label}</span></div>
                  </div>
                  <div style={{fontSize:10,color:C.muted}}>{v.driver}</div>
                  <div style={{fontSize:10,color:C.accent,fontWeight:600,marginTop:2}}>{cnt} course{cnt>1?"s":""}</div>
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

function ChauffeurView({driversAmb,driversTpmr,stagiairesAmb,formationTpmr,vehicles,contacts,plans,driver,setDriver,vehicle,setVehicle,screen,setScreen,course,setCourse,statuts,setStatut,myCourses,myActives,myTermines,bons,saveBon,bases,onBack,onEndService}){
  const [showBons,setShowBons]=useState(false);
  const [showContacts,setShowContacts]=useState(false);
  const [showPlans,setShowPlans]=useState(false);
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
        {showEnd&&<button onClick={onEndService} style={{background:C.danger,border:"none",borderRadius:7,color:"white",padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🔴 Fin de service</button>}
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
          const group=vehicles.filter(v=>v.type===type&&v.active);
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
                  <button key={v.id} onClick={()=>{setVehicle(v);setScreen("choix_vehicule");}}
                    style={{background:C.panel,border:`1.5px solid ${C.border}`,borderRadius:13,padding:"18px 10px",color:C.text,textAlign:"center",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:7}}>
                    <span style={{fontSize:28,color:vColor(type)}}>{vIcon(type)}</span>
                    <span style={{fontWeight:700,fontSize:13}}>{v.name}</span>
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
          <button onClick={()=>{if(canContinue)setScreen("planning");}} disabled={!canContinue}
            style={{width:"100%",background:canContinue?C.success:C.panel2,border:"none",borderRadius:11,color:canContinue?"white":C.muted,padding:"13px",fontWeight:800,fontSize:15,cursor:canContinue?"pointer":"not-allowed",opacity:canContinue?1:0.6}}>
            ✅ Commencer le service
          </button>
        </div>
      </div>
    );
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
                <button onClick={()=>setRoleSwapped(r=>!r)}
                  style={{background:roleSwapped?C.successSoft:C.accentSoft,border:`1px solid ${roleSwapped?C.success:C.accent}`,borderRadius:8,color:roleSwapped?C.success:C.accent,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                  🔄 Switch
                </button>
              ):null}
            </div>
          </div>
        ):null}
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

      {showPlans&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px",width:520,maxWidth:"92vw",maxHeight:"90vh",display:"flex",flexDirection:"column",animation:"pop 0.2s ease"}}>
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
                  <div key={i} style={{marginBottom:16}}>
                    <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>🗺️ {p.nom}</div>
                    <iframe src={p.data} style={{width:"100%",height:400,border:`1px solid ${C.border}`,borderRadius:9}} title={p.nom}/>
                  </div>
                ))
              }
            </div>
          </div>
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
            {vehicles.filter(v=>v.active&&v.id!==vehicle?.id).map(v=>(
              <button key={v.id} onClick={()=>setConfirmTransfer({course:showTransfer,vehicle:v})}
                style={{width:"100%",background:C.panel2,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:7,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:16,color:vColor(v.type)}}>{vIcon(v.type)}</span>
                <div><div style={{fontWeight:700,fontSize:13}}>{v.name}</div><div style={{fontSize:10,color:C.muted}}>{v.driver}</div></div>
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


const CK_C = {
  bg:"#0b1120",panel:"#111827",panel2:"#1a2540",border:"#1f2f4a",
  accent:"#f97316",accentSoft:"rgba(249,115,22,0.1)",
  text:"#f0f4ff",muted:"#4d6a8a",
  success:"#22c55e",successSoft:"rgba(34,197,94,0.12)",
  danger:"#ef4444",dangerSoft:"rgba(239,68,68,0.1)",
  warning:"#f59e0b",blue:"#38bdf8",
  red:"#dc2626",darkBlue:"#1d4ed8",
};

const CK_GS=`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap'); *{box-sizing:border-box;} button{cursor:pointer;font-family:inherit;} input,textarea{font-family:inherit;} input::placeholder{color:#4d6a8a;}`;

// ═══════════════════════════════════════════════
// DONNÉES DES 7 CHECKLISTS
// ═══════════════════════════════════════════════

const CHECKLISTS = {

  // ── ALPHA 1 ──────────────────────────────────
  "ALPHA 1": {
    edition: "12/2025", norme: "ATNUP",
    sections: [
      { id:1, label:"Soins et oxygénothérapie", color:CK_C.red, shelves:[
        { id:"A", label:"Étagère A", items:[
          {n:"Set de pansement",q:1},{n:"Rouleau de sparadrap",q:2},{n:"Couverture Isotherme",q:5},
          {n:"Bandage triangulaire + épingle",q:4},{n:"Esculape",q:1},
        ]},
        { id:"B", label:"Étagère B", items:[
          {n:"Compresse 5x5cm",q:10},{n:"Compresse 7,5x7,5cm",q:10},{n:"Compresse 10x10cm",q:10},
          {n:"Compresse absorbante 20x10cm",q:5},{n:"Solution désinfectante Hibidil®",q:10},
          {n:"Sérum physiologique unidose",q:10},{n:"Iso-Bétadine® dermique 10%",q:5,p:true},
          {n:"Champ stérile 90x70",q:4},{n:"Kit pansement autocollant",q:1},
        ]},
        { id:"CK_C", label:"Étagère CK_C", items:[
          {n:"Bandage élastique 5 ou 7cm",q:5},{n:"Bandage élastique 10cm",q:5},
          {n:"Bandage élastique 15cm",q:4},{n:"Cool Pack",q:5},
        ]},
        { id:"D", label:"Oxygénothérapie Adulte", items:[
          {n:"Masque O² 100% Adulte",q:1},{n:"Lunette O² Adulte",q:2},
          {n:"Masque aérosol Adulte",q:1},{n:"Tubulure + Raccord Biconique",q:1},
        ]},
        { id:"E", label:"Oxygénothérapie Enfant", items:[
          {n:"Masque O² 100% Enfant",q:1},{n:"Lunette O² Enfant",q:2},{n:"Masque aérosol Enfant",q:1},
        ]},
        { id:"F", label:"Aspiration", items:[
          {n:"Sac récupérateur de mucosité",q:1},{n:"Tubulure aspirateur de mucosité",q:1},
          {n:"Bassin réniforme UU",q:10},{n:"Sac vomitoire",q:5},
        ]},
      ]},
      { id:2, label:"Paramétrage suite", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Glucomètre",q:1,t:true},{n:"Lancettes",q:10},{n:"Tigettes",q:10},
          {n:"Compresse 5x5cm",q:7},{n:"Pille AA 4",q:4},{n:"Pille AAA",q:4},
          {n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1},
        ]},
      ]},
      { id:3, label:"Divers", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[{n:"Couverture anti feu",q:1}] },
      ]},
      { id:4, label:"Eau potable", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[{n:"Bouteille d'eau potable 50cl",q:6}] },
      ]},
      { id:5, label:"Hygiène — Spray", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[{n:"Spray désinfectant surface",q:2}] },
      ]},
      { id:7, label:"Hygiène", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Spray désodorisant citron",q:1},{n:"Rouleau sac poubelle ambulance",q:1},
          {n:"Sac à linge jaune",q:2},{n:"Sac à linge blanc",q:2},{n:"Alèze UU",q:2},
          {n:"Lange adulte",q:3},{n:"Paquet de lingette désinfectante",q:1},{n:"Microfibres",q:4},
        ]},
      ]},
      { id:8, label:"Ballon REA et canules", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Ballon REA adulte complet UU",q:1},{n:"Masque pour ballon N°4",q:1},
          {n:"Masque pour ballon N°5",q:1},{n:"Filtre antibactérien ballon REA",q:1},
          {n:"Set de 9 canules de T000 à T5",q:1},
        ]},
      ]},
      { id:9, label:"RDOH", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[{n:"Pane",q:1},{n:"Urinal",q:1}] },
      ]},
      { id:10, label:"Kits Burning", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[{n:"Kit Burning",q:1,s:true}] },
      ]},
      { id:"P", label:"Paramétrage", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},
          {n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},
          {n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},
        ]},
      ]},
    ]
  },

  // ── ALPHA 2 ──────────────────────────────────
  "ALPHA 2": {
    edition: "12/2024", norme: "112/ATNUP",
    sections: [
      { id:1, label:"Soin et Oxygénothérapie", color:CK_C.red, shelves:[
        { id:"A", label:"Étagère A", items:[
          {n:"Compresse 5x5cm",q:10},{n:"Compresse 7,5x7,5cm",q:10},{n:"Compresse 10x10cm",q:10},
          {n:"Compresse absorbante 20x10cm",q:5},{n:"Bandage élastique 15cm",q:2},
          {n:"Bandage élastique 20cm",q:2},{n:"Rouleau de sparadrap 2cm",q:1},
        ]},
        { id:"B", label:"Étagère B", items:[
          {n:"Bandage triangulaire + épingle",q:4},{n:"Couverture Isotherme",q:5},{n:"Esculape",q:1},
          {n:"Kit pansement autocollant",q:1},{n:"Bandage élastique 5 ou 7cm",q:5},
          {n:"Bandage élastique 10cm",q:5},{n:"Champ stérile 90x71",q:4},{n:"Bande pansement autocollant",q:1},
        ]},
        { id:"CK_C", label:"Étagère CK_C", items:[
          {n:"Set de pansement",q:1},{n:"Rouleau Urgoderme",q:1},{n:"Bouchon fermeture robinet 3 voies",q:1},
          {n:"Solution désinfectante Hibidil®",q:10},{n:"Sérum physiologique unidose",q:10},
          {n:"Bétadine® dermique 10%",q:5,p:true},{n:"Cold Pack",q:5},
        ]},
        { id:"D", label:"Oxygénothérapie Adulte", items:[
          {n:"Masque O² 100% Adulte",q:1},{n:"Lunette O² Adulte",q:2},
          {n:"Masque aérosol Adulte",q:1},{n:"Tubulure + Raccord Biconique",q:1},
        ]},
        { id:"E", label:"Oxygénothérapie Enfant", items:[
          {n:"Masque O² 100% Enfant",q:1},{n:"Lunette O² Enfant",q:2},{n:"Masque aérosol Enfant",q:1},
        ]},
        { id:"F", label:"Divers", items:[
          {n:"Bassin réniforme UU",q:10},{n:"Sac vomitoire",q:5},
          {n:"Sac récupérateur de mucosité",q:1},{n:"Tubulure aspirateur de mucosité",q:1},
          {n:"Bouteille d'eau potable 50cl",q:6},
        ]},
      ]},
      { id:2, label:"Oxygénothérapie — Ballons", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Ballon REA adulte complet UU",q:1},{n:"Ballon REA Junior complet UU",q:1},
          {n:"Ballon REA baby complet UU",q:1},{n:"Filtre antibactérien ballon REA",q:1},
          {n:"Set de 9 canules de T000 à T6",q:1},
        ]},
      ]},
      { id:3, label:"Electrode DEA + Divers", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[{n:"Electrode DEA réserve",q:1}] },
      ]},
      { id:4, label:"Kits: Linge brancard / Padding", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Kit de linge brancard",q:3},{n:"Kit Padding",q:1},{n:"Oreiller de réserve (lavable)",q:1},
        ]},
      ]},
      { id:5, label:"Pochette paramétrage", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},
          {n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},
          {n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},
          {n:"Glucomètre",q:1,t:true},{n:"Lancette",q:10},{n:"Tigette",q:10},
          {n:"Compresse 5x5cm",q:10},{n:"Pille AA4 / Pille AAA4",q:1},
          {n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1},{n:"Détecteur CO",q:1},
        ]},
      ]},
      { id:9, label:"Kits: Burning", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[{n:"Kit Burning",q:1,s:true}] },
      ]},
      { id:10, label:"Set de perfusions", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Poche Sérum Physiologique 500ml",q:4,p:true},{n:"Trousse à perfusion",q:2,p:true},
          {n:"Cathéter 16G",q:2,p:true},{n:"Cathéter 18G",q:2,p:true},
          {n:"Cathéter 20G",q:2,p:true},{n:"Cathéter 22G",q:2,p:true},
          {n:"Tégaderme",q:2},{n:"Garrot",q:1},
          {n:"Gants stériles 6,5",q:2},{n:"Gants stériles 7,5",q:2},{n:"Gants stériles 8,5",q:2},
        ]},
      ]},
      { id:13, label:"Hygiène", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Spray désinfectant surface",q:2},{n:"Spray désodorisant citron",q:1},
          {n:"Rouleau sac poubelle ambulance",q:1},{n:"Sac à linge blanc",q:2},{n:"Sac à linge jaune",q:2},
          {n:"Alèze UU",q:3},{n:"Lange adulte",q:3},{n:"Paquet de lingette désinfectante",q:1},
          {n:"Microfibres",q:4},{n:"Mouchoir UU (boite)",q:1},{n:"Blouse d'opéré",q:1},
        ]},
      ]},
      { id:15, label:"Aspirateur de mucosité", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[{n:"Aspirateur de mucosité",q:1,t:true}] },
      ]},
      { id:16, label:"Sac: KATA et Pédiatrique", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Sac KATA (Rouge)",q:1,s:true},{n:"Sac Pédia./Accou.(bleu)",q:1,s:true},
        ]},
      ]},
      { id:17, label:"Matelas à dépression", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Matelas à dépression",q:1,t:true},{n:"Pompe pour matelas",q:1},
        ]},
      ]},
      { id:18, label:"RDOH / Kit protection / Speed Block", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"RDOH", items:[{n:"Pane",q:1},{n:"Urinal",q:1}] },
        { id:"B", label:"Kit de protection individuelle", items:[
          {n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},
          {n:"Charlotte",q:2},{n:"Masque chirurgical",q:5},{n:"Masque KN95 / FFP3",q:5},
        ]},
        { id:"CK_C", label:"Kit Speed Block", items:[{n:"Kit Speed Block",q:1}] },
      ]},
      { id:19, label:"Oxygène", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Bouteille O² 10L",q:1},{n:"Bouteille O² 10L (2)",q:1},{n:"Bouteille O² 2L",q:1},
        ]},
      ]},
      { id:20, label:"Cabine sanitaire", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},
          {n:"Gel hydroalcoolique",q:1},{n:"Sonde d'aspiration CH 6 ou 8",q:3},
          {n:"Sonde d'aspiration CH 10 ou 12",q:2},{n:"Sonde d'aspiration CH 14 ou 16",q:2},
          {n:"Appareil multi paramétrage",q:1,t:true},{n:"Tarif ATNUP",q:1},
          {n:"Couverture anti feu",q:1},{n:"Planche d'Olivier + base Speed Block",q:1},
          {n:"Collier cervical adulte",q:1},{n:"Collier cervical pédiatrique",q:1},
          {n:"Gant nitrile taille S (boite)",q:1},{n:"Gant nitrile taille M (boite)",q:1},
          {n:"Gant nitrile taille L (boite)",q:1},{n:"Gant nitrile taille XL (boite)",q:1},
          {n:"Container à aiguille",q:1},{n:"Tensiomètre mural",q:1},
          {n:"Ciseau multifonctions d'urgence",q:1},{n:"Sac Intervention + DEA",q:1,t:true},
        ]},
      ]},
      { id:21, label:"Porte Ext. Arrière — Traumatologie", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Scoop",q:1,t:true},{n:"Chaise d'évacuation",q:1,t:true},{n:"Sac d'atèle",q:1},
          {n:"Atèle grande",q:1,t:true},{n:"Atèle moyenne",q:1,t:true},{n:"Atèle petite",q:1,t:true},
          {n:"Pompe (pour atèle)",q:1,t:true},{n:"Bouteille O² 2L",q:1},{n:"Sangle araignée",q:1},
          {n:"KED",q:1,t:true},{n:"Marche pieds",q:1,t:true},{n:"Extincteur 6Kg",q:1},
          {n:"Corde semi statique",q:1},{n:"Pelle pliable (US)",q:1},
          {n:"Gant de sécurité",q:1},{n:"Pied de biche",q:1},
        ]},
      ]},
      { id:22, label:"Cabine chauffeur", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Casque",q:2},{n:"Lampe pour casque",q:2,t:true},
          {n:"Coupe ceinture",q:1},{n:"Brise vitre",q:1},
          {n:"Carte routière Hainaut",q:1},{n:"Carte ADR",q:1},
        ]},
      ]},
    ]
  },

  // ── ALPHA 3 ──────────────────────────────────
  "ALPHA 3": {
    edition: "07/2025", norme: "112/ATNUP",
    sections: [
      { id:1, label:"Soin et Oxygénothérapie", color:CK_C.red, shelves:[
        { id:"A", label:"Étagère A", items:[
          {n:"Set de pansement",q:1},{n:"Rouleau de sparadrap",q:2},{n:"Couverture Isotherme",q:5},
          {n:"Bandage triangulaire + épingle",q:4},{n:"Compresse 5x5cm",q:10},
          {n:"Compresse 7,5x7,5cm",q:10},{n:"Compresse 10x10cm",q:10},
          {n:"Compresse absorbante 20x10cm",q:5},{n:"Bandage élastique 5 ou 7cm",q:5},
          {n:"Tubulure aspirateur de mucosité",q:1},{n:"Cool Pack",q:5},
        ]},
        { id:"B", label:"Étagère B", items:[
          {n:"Bandage élastique 10cm",q:5},{n:"Bandage élastique 15cm ou 20cm",q:8},
          {n:"Rouleau Urgoderme",q:1},{n:"Solution désinfectante Hibidil®",q:10},
          {n:"Sérum physiologique unidose",q:10},{n:"Iso-Bétadine® dermique 10%",q:5,p:true},
          {n:"Champ stérile 90x69",q:4},{n:"Kit pansement autocollant",q:1},
          {n:"Bande pansement autocollant",q:1},{n:"Container à aiguille",q:1},
        ]},
        { id:"CK_C", label:"Oxygénothérapie Adulte", items:[
          {n:"Masque O² 100% Adulte",q:1},{n:"Lunette O² Adulte",q:2},
          {n:"Masque aérosol Adulte",q:1},{n:"Tubulure + Raccord Biconique",q:1},
        ]},
        { id:"D", label:"Oxygénothérapie Enfant", items:[
          {n:"Masque O² 100% Enfant",q:1},{n:"Lunette O129 Enfant",q:2},{n:"Masque aérosol Enfant",q:1},
        ]},
        { id:"E", label:"Divers", items:[
          {n:"Bassin réniforme UU",q:10},{n:"Bouchon fermeture robinet 3 voies",q:3},
          {n:"Sac vomitoire",q:5},
        ]},
        { id:"F", label:"Ballons REA", items:[
          {n:"Ballon REA adulte complet UU",q:1},{n:"Masque pour ballon N°4",q:1},
          {n:"Masque pour ballon N°5",q:1},{n:"Filtre antibactérien ballon REA",q:1},
          {n:"Set de 9 canules de T000 à T5",q:1},{n:"Sac récupérateur de mucosité",q:1},
        ]},
      ]},
      { id:2, label:"Divers", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Manchette à pression",q:1},{n:"Bouteille d'eau potable 50cl",q:6},
        ]},
      ]},
      { id:3, label:"Pochette paramétrage", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},
          {n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},
          {n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},
          {n:"Glucomètre",q:1,t:true},{n:"Lancette",q:10},{n:"Tigettes",q:10},
          {n:"Compresse 5x5cm",q:7},{n:"Pille AA4 / Pille AAA4",q:8},
          {n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1},{n:"Détecteur CO",q:1},
        ]},
      ]},
      { id:4, label:"Set de perfusions", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Poche Sérum Physiologique 500ml",q:4,p:true},{n:"Trousse à perfusion",q:2,p:true},
          {n:"Cathéter 16G",q:2,p:true},{n:"Cathéter 18G",q:2,p:true},
          {n:"Cathéter 20G",q:2,p:true},{n:"Cathéter 22G",q:2,p:true},
          {n:"Tégaderme",q:2},{n:"Garrot",q:1},
          {n:"Gants stériles 6,5",q:2},{n:"Gants stériles 7,5",q:2},{n:"Gants stériles 8,5",q:2},
        ]},
      ]},
      { id:5, label:"Kit de protection individuelle", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},
          {n:"Charlotte",q:2},{n:"Masque chirurgical",q:5},{n:"Masque KN95 / FFP2",q:5},
        ]},
      ]},
      { id:6, label:"Kits Burning / Electrode DEA", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[{n:"Kit Burning",q:1,s:true}] },
      ]},
      { id:"7-8", label:"Kits: Linge brancard / Padding", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Kit de linge brancard",q:3},{n:"Kit Padding",q:1},
        ]},
      ]},
      { id:9, label:"Poubelle / Frigo", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[] },
      ]},
      { id:11, label:"Support monitoring / Sac KATA / Oreiller", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Support monitoring 'Pack-Rac'",q:1},{n:"Oreiller lavable",q:1},{n:"Sac KATA",q:1,s:true},
        ]},
      ]},
      { id:12, label:"Gant nitrile / Mouchoir UU", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Gant nitrile taille S (boite)",q:1},{n:"Gant nitrile taille M (boite)",q:1},
          {n:"Gant nitrile taille L (boite)",q:1},{n:"Gant nitrile taille XL (boite)",q:1},
          {n:"Mouchoir UU (boite)",q:1},
        ]},
      ]},
      { id:13, label:"Kit COVID Colliers cervicaux", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Kit COVID",q:1},{n:"Collier cervical adulte",q:1},{n:"Collier cervical pédiatrique",q:1},
        ]},
      ]},
      { id:14, label:"Sac d'Intervention + DEA / sac Pédiatrique", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Sac d'Intervention",q:1,s:true},{n:"DEA + Electrode",q:1,t:true},
          {n:"Electrode de réserve",q:1},{n:"Sac Pédiatrique",q:2,s:true},
        ]},
      ]},
      { id:15, label:"Hygiène", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Spray désinfectant surface",q:2},{n:"Spray désodorisant citron",q:2},
          {n:"Rouleau sac poubelle ambulance",q:1},{n:"Sac à linge blanc",q:2},
          {n:"Sac à linge jaune",q:2},{n:"Alèze UU",q:3},{n:"Lange adulte",q:3},
          {n:"Paquet de lingette désinfectante",q:1},{n:"Microfibres",q:4},
        ]},
      ]},
      { id:16, label:"RDOH", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[{n:"Pane",q:1},{n:"Urinal",q:1}] },
      ]},
      { id:17, label:"Oxygène", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Bouteille O² 10L",q:1},{n:"Bouteille O² 10L (2)",q:1},{n:"Bouteille O² 2L",q:1},
        ]},
      ]},
      { id:18, label:"Cabine sanitaire", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},
          {n:"Gel hydroalcoolique",q:1},{n:"Sonde d'aspiration CH 8",q:3},
          {n:"Sonde d'aspiration CH 12",q:3},{n:"Sonde d'aspiration CH 14",q:3},
          {n:"Aspirateur de mucosité",q:1,t:true},{n:"Appareil multi paramétrage",q:1,t:true},
          {n:"Tarif TMS",q:1},{n:"Couverture anti feu",q:1},
        ]},
      ]},
      { id:19, label:"Porte Ext. Arrière — Traumatologie", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Matelas à dépression",q:1,t:true},{n:"Pompe pour matelas",q:1},
          {n:"Scoop",q:1,t:true},{n:"Planche d'Olivier",q:1},{n:"Chaise d'évacuation",q:1,t:true},
          {n:"KED",q:1},{n:"Speed block complet",q:1},{n:"Sac d'atèle",q:1},
          {n:"Atèle grande",q:1,t:true},{n:"Atèle moyenne",q:1,t:true},{n:"Atèle petite",q:1,t:true},
          {n:"Pompe (pour atèle)",q:1,t:true},{n:"Sangle araignée",q:1},{n:"Marche pieds",q:1,t:true},
        ]},
      ]},
      { id:20, label:"Porte Ext. Avant — Matériels divers", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"Planche A (petit matériel)", items:[
          {n:"Corde semi statique",q:1},{n:"Pelle pliable (US)",q:1},{n:"Casque",q:2},
          {n:"Lampe pour casque",q:2,t:true},{n:"Gant de sécurité",q:1},{n:"Pied de biche",q:1},
        ]},
        { id:"CK_C", label:"Planche CK_C + Extincteur", items:[
          {n:"Extincteur 6Kg",q:1},{n:"Bouteille O² 2L",q:1},
        ]},
      ]},
      { id:"CC", label:"Cabine chauffeur", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Lampe de présignalisation",q:2,t:true},{n:"Coupe ceinture / Brise glace",q:1},
        ]},
      ]},
    ]
  },

  // ── ALPHA 4 ──────────────────────────────────
  "ALPHA 4": {
    edition: "09/2025", norme: "112/ATNUP",
    sections: [
      { id:1, label:"Soin", color:CK_C.red, shelves:[
        { id:"A", label:"Étagère A", items:[
          {n:"Bandage triangulaire + épingle",q:4},{n:"Couverture Isotherme",q:5},{n:"Esculape",q:1},
          {n:"Rouleau Urgoderme",q:1},{n:"Rouleau de sparadrap 2cm",q:2},
          {n:"Solution désinfectante Hibidil®",q:10},{n:"Sérum physiologique unidose",q:10},
          {n:"Iso-Bétadine® dermique 10%",q:5,p:true},{n:"Cold Pack",q:5},{n:"Kit pansement autocollant",q:1},
        ]},
        { id:"B", label:"Étagère B", items:[
          {n:"Compresse 10x10cm",q:10},{n:"Compresse absorbante 20x10cm",q:5},
          {n:"Compresse 5x5cm",q:10},{n:"Compresse 7,5x7,5cm",q:10},
          {n:"Bandage élastique 5 ou 7cm",q:5},{n:"Bandage élastique 10cm",q:5},
        ]},
        { id:"CK_C", label:"Étagère CK_C", items:[
          {n:"Bandage élastique 15cm",q:2},{n:"Bandage élastique 20cm",q:2},{n:"Champ stérile 75x90cm",q:4},
        ]},
      ]},
      { id:2, label:"Oxygénothérapie", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"Adulte", items:[
          {n:"Masque O² 100% Adulte",q:1},{n:"Lunette O² Adulte",q:2},
          {n:"Masque aérosol Adulte",q:1},{n:"Tubulure + Raccord Biconique",q:1},
        ]},
        { id:"B", label:"Enfant", items:[
          {n:"Masque O² 100% Enfant",q:1},{n:"Lunette O² Enfant",q:2},{n:"Masque aérosol Enfant",q:1},
        ]},
      ]},
      { id:3, label:"BR, Sac vomitoir, Bt. Mouchoir UU", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Bassin réniforme UU",q:10},{n:"Sac vomitoire",q:5},{n:"Mouchoir UU (boite)",q:1},
        ]},
      ]},
      { id:4, label:"Bouteille eau", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[{n:"Bouteille d'eau potable 50cl",q:6}] },
      ]},
      { id:5, label:"Kit paramétrage / Kit Burning", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},
          {n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},
          {n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},
          {n:"Glucomètre",q:1,t:true},{n:"Lancette",q:10},{n:"Tigette",q:2},
          {n:"Compresse 5x5cm",q:8},{n:"Pille AA4 / Pille AAA4",q:1},
          {n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1},{n:"Kit Burning",q:1,s:true},
        ]},
      ]},
      { id:7, label:"Kits Padding / Divers", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Kit Padding",q:1},{n:"Spray désinfectant surface",q:2},
          {n:"Oreiller de réserve (lavable)",q:1},{n:"Blouse d'opéré",q:1},
        ]},
      ]},
      { id:8, label:"Set de perfusions", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Poche Sérum Physiologique 500ml",q:4,p:true},{n:"Trousse à perfusion",q:2,p:true},
          {n:"Cathéter 16G",q:2,p:true},{n:"Cathéter 18G",q:2,p:true},
          {n:"Cathéter 20G",q:2,p:true},{n:"Cathéter 22G",q:2,p:true},
          {n:"Tégaderme",q:2},{n:"Garrot",q:1},
          {n:"Gants stériles 6,5",q:2},{n:"Gants stériles 7,5",q:2},{n:"Gants stériles 8,5",q:2},
          {n:"Bouchon robinet 3 voies",q:3},
        ]},
      ]},
      { id:9, label:"Kits: Linge brancard / Jeu d'Atèle", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Kit de linge brancard",q:3},{n:"Sac d'atèle",q:1},
          {n:"Atèle grande",q:1,t:true},{n:"Atèle moyenne",q:1,t:true},
          {n:"Atèle petite",q:1,t:true},{n:"Pompe (pour atèle)",q:1,t:true},
        ]},
      ]},
      { id:10, label:"Hygiène", color:CK_C.red, shelves:[
        { id:"A", label:"Étagère A", items:[
          {n:"Spray désodorisant citron",q:1},{n:"Rouleau sac poubelle ambulance",q:1},
          {n:"Sac à linge blanc",q:2},{n:"Sac à linge jaune",q:2},{n:"Alèze UU",q:3},
          {n:"Lange adulte",q:3},{n:"Paquet de lingette désinfectante",q:1},{n:"Microfibres",q:4},
        ]},
        { id:"B", label:"Étagère B", items:[
          {n:"Ballon REA adulte complet UU",q:1},{n:"Masque ballon N°4",q:1},
          {n:"Masque ballon N°5",q:1},{n:"Filtre antibactérien ballon REA",q:1},
          {n:"Set de 8 canules de T000 à T5",q:1},{n:"Sac récupérateur de mucosité",q:1},
          {n:"Tubulure aspirateur de mucosité",q:1},
        ]},
      ]},
      { id:11, label:"Kit de protection individuel", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"Étagère A", items:[
          {n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},
          {n:"Charlotte",q:5},{n:"Masque chirurgical",q:5},{n:"Masque KN95 / FFP3",q:5},
        ]},
      ]},
      { id:12, label:"Matelas à dépression", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Matelas à dépression",q:1,t:true},{n:"Pompe pour matelas",q:1},
        ]},
      ]},
      { id:13, label:"RDOH", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[{n:"Pane",q:1},{n:"Urinal",q:1}] },
      ]},
      { id:14, label:"Sac Intervention", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Sac Intervention",q:1},{n:"DEA + Electrodes",q:1,t:true},
          {n:"Electrodes de réserve",q:1},{n:"Détecteur CO",q:1},
          {n:"Ciseau multifonction d'URGENCE",q:1},
        ]},
      ]},
      { id:15, label:"Sac: KATA et Pédiatrique", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Sac KATA (rouge)",q:1,s:true},{n:"Sac Pédia./Accou.(bleu)",q:1,s:true},
        ]},
      ]},
      { id:16, label:"Scoop", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[{n:"Scoop + 3 sangles velcro",q:1,t:true}] },
      ]},
      { id:17, label:"Porte Ext. Traumatologie / O²", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"Étagère A", items:[
          {n:"Planche d'Olivier",q:1},{n:"Chaise d'évacuation",q:1},{n:"Extincteur 6kg",q:1,t:true},
          {n:"Sangle araignée",q:1},{n:"KED",q:1,t:true},
        ]},
        { id:"B", label:"Étagère B", items:[
          {n:"Corde semi statique",q:1},{n:"Pelle pliable (US)",q:1},{n:"Pied de sécurité",q:1},
          {n:"Casque",q:1},{n:"Lampe pour casque",q:2,t:true},{n:"Kit Speed Block",q:1,t:true},
          {n:"Bouteille O² 10L",q:1},{n:"Bouteille O² 10L (2)",q:1},{n:"Bouteille O² 2L",q:1},
          {n:"Marche pieds",q:1,t:true},
        ]},
      ]},
      { id:18, label:"Cabine sanitaire", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},
          {n:"Gel hydroalcoolique",q:1},{n:"Sonde d'aspiration CH 8",q:3},
          {n:"Sonde d'aspiration CH 12",q:3},{n:"Sonde d'aspiration CH 14",q:3},
          {n:"Appareil multi paramétrage",q:1,t:true},{n:"Aspirateur de mucosité",q:1,t:true},
          {n:"Gant nitrile taille S (boite)",q:1},{n:"Gant nitrile taille M (boite)",q:1},
          {n:"Gant nitrile taille L (boite)",q:1},{n:"Gant nitrile taille XL (boite)",q:1},
          {n:"Container à aiguille",q:1},{n:"Poubelle",q:1},{n:"Tarif ATNUP",q:1},
          {n:"Couverture anti feu",q:1},{n:"Bouteille O² 2L",q:1},
        ]},
      ]},
      { id:19, label:"Cabine chauffeur", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Lampe de présignalisation",q:2,t:true},{n:"Coupe ceinture",q:1},
          {n:"Brise vitre",q:1},{n:"Carte routière Hainaut",q:1},{n:"Carte ADR",q:1},
        ]},
      ]},
    ]
  },

  // ── ALPHA 5 ──────────────────────────────────
  "ALPHA 5": {
    edition: "09/2025", norme: "112/ATNUP",
    sections: [
      { id:1, label:"Container à aiguille", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[{n:"Container à aiguille",q:1}] },
      ]},
      { id:2, label:"Bouteilles d'eau potable", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[{n:"Bouteille d'eau potable 50cl",q:6}] },
      ]},
      { id:3, label:"Frigo", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[] },
      ]},
      { id:4, label:"Kits de linge brancard", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[{n:"Kit de linge brancard",q:3}] },
      ]},
      { id:6, label:"Appareil multi paramétrage", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[{n:"Appareil multi paramétrage",q:1,t:true}] },
      ]},
      { id:9, label:"Soin", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"Étagère A", items:[
          {n:"Solution désinfectante Hibidil®",q:10},{n:"Sérum physiologique unidose",q:10},
          {n:"Iso-Bétadine® dermique 10%",q:5,p:true},{n:"Compresse 5x5cm",q:10},
          {n:"Compresse 7,5x7,5cm",q:10},{n:"Compresse 10x10cm",q:10},{n:"Esculape",q:1},
          {n:"Rouleau Urgoderme",q:1},{n:"Rouleau de sparadrap 2cm",q:2},
          {n:"Bandage élastique 5cm",q:5},{n:"Bandage élastique 7cm",q:5},
          {n:"Bandage élastique 10cm",q:5},{n:"Bandage élastique 15cm",q:4},
          {n:"Bandage triangulaire + épingle",q:4},{n:"Couverture Isotherme",q:5},
          {n:"Sac vomitoir",q:5},{n:"Cold Pack",q:5},{n:"Kit pansement autocollant",q:1},
          {n:"Compresse absorbante 20x10cm",q:5},{n:"Champ stérile 40x45cm",q:4},
        ]},
        { id:"B", label:"Étagère B", items:[
          {n:"Rouleau Urgoderme",q:1},{n:"Rouleau de sparadrap 2cm",q:2},
        ]},
      ]},
      { id:10, label:"Oxygénothérapie / Balons", color:CK_C.red, shelves:[
        { id:"A", label:"Adulte", items:[
          {n:"Masque O² 100% Adulte",q:1},{n:"Lunette O² Adulte",q:2},
          {n:"Masque aérosol Adulte",q:1},{n:"Tubulure + Raccord Biconique",q:1},
        ]},
        { id:"B", label:"Enfant", items:[
          {n:"Masque O² 100% Enfant",q:1},{n:"Lunette O² Enfant",q:2},{n:"Masque aérosol Enfant",q:1},
        ]},
        { id:"CK_C", label:"Ballons REA", items:[
          {n:"Ballon REA adulte complet UU",q:1},{n:"Masque REA N°4 Rouge",q:1},
          {n:"Masque REA N°5 Bleu",q:1},{n:"Filtre antibactérien ballon REA",q:1},
          {n:"Set de 8 canules de T000 à T5",q:1},
        ]},
      ]},
      { id:11, label:"Set de perfusions", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Poche Sérum Physiologique 500ml",q:4,p:true},{n:"Trousse à perfusion",q:2,p:true},
          {n:"Cathéter 16G",q:2,p:true},{n:"Cathéter 18G",q:2,p:true},
          {n:"Cathéter 20G",q:2,p:true},{n:"Cathéter 22G",q:2,p:true},
          {n:"Tégaderme",q:2},{n:"Garrot",q:1},
          {n:"Gants stériles 6,5",q:2},{n:"Gants stériles 7,5",q:2},{n:"Gants stériles 8,5",q:2},
          {n:"Bouchon robinet 3 voies",q:4},
        ]},
      ]},
      { id:12, label:"Kit padding", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[{n:"Kit Padding 3 pièces",q:1}] },
      ]},
      { id:13, label:"Divers", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Bassin réniforme UU",q:10},{n:"Sac récupérateur de mucosité",q:1},
          {n:"Tubulure aspirateur de mucosité",q:1},
        ]},
      ]},
      { id:14, label:"Kit d'atèles / Pochette paramétrage", color:CK_C.red, shelves:[
        { id:"A", label:"Atèles", items:[
          {n:"Sac d'attelle + pompe",q:1},{n:"Attelle grande",q:1,t:true},
          {n:"Attelle moyenne",q:1,t:true},{n:"Attelle petite",q:1,t:true},
        ]},
        { id:"B", label:"Paramétrage", items:[
          {n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},
          {n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},
          {n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},
          {n:"Glucomètre",q:1,t:true},{n:"Lancette",q:5},{n:"Tigette minimum",q:10},
          {n:"Compresse 5x5cm",q:2},{n:"Sérum physiologique unidose",q:1},
          {n:"Pille AA4 / Pille AAA4",q:8},{n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1},
        ]},
      ]},
      { id:16, label:"Hygiène", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Spray désinfectant surface",q:2},{n:"Paquet de lingette désinfectante",q:1},
          {n:"Spray désodorisant citron",q:1},{n:"Rouleau sac poubelle ambulance",q:2},
          {n:"Sac à linge blanc",q:2},{n:"Sac à linge jaune",q:2},{n:"Alèze UU",q:4},
          {n:"Lange adulte",q:4},{n:"Microfibres",q:1},{n:"Mouchoir UU (boite)",q:1},
          {n:"Blouse d'opéré",q:1},
        ]},
      ]},
      { id:17, label:"Kit de protection individuel", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},
          {n:"Charlotte",q:5},{n:"Masque chirurgical",q:5},{n:"Masque KN95 / FFP3",q:5},
        ]},
      ]},
      { id:18, label:"RDOH", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Pane + 2 sacs récupérateurs UU",q:1},{n:"Urinal + 2 sacs récupérateurs UU",q:1},
          {n:"Oreiller de réserve (lavable)",q:1},
        ]},
      ]},
      { id:19, label:"Cabine sanitaire", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},
          {n:"Gel hydroalcoolique",q:2},{n:"Sonde d'aspiration CH 8",q:3},
          {n:"Sonde d'aspiration CH 12",q:3},{n:"Sonde d'aspiration CH 14",q:3},
          {n:"Aspirateur de mucosité",q:1,t:true},{n:"Gant nitrile taille S (boite)",q:1},
          {n:"Gant nitrile taille M (boite)",q:1},{n:"Gant nitrile taille L (boite)",q:1},
          {n:"Gant nitrile taille XL (boite)",q:1},{n:"Tarif ATNUP",q:1},{n:"Couverture anti feu",q:1},
          {n:"DEA",q:1,t:true},{n:"Brise vitre et coupe ceinture",q:1},
          {n:"Ciseau multifonction d'URGENCE",q:1},{n:"Sac Intervention",q:1,s:true},
          {n:"DEA + Electrodes",q:1,t:true},{n:"Electrodes de réserve",q:1},{n:"Détecteur CO",q:1},
        ]},
      ]},
      { id:20, label:"Face arrière portes ouvertes", color:CK_C.darkBlue, shelves:[
        { id:"B", label:"", items:[{n:"Chaise d'évacuation",q:1}] },
        { id:"CK_C", label:"", items:[{n:"Sac Pédia. / Accou. (bleu)",q:1,s:true}] },
        { id:"E", label:"", items:[{n:"Sac KATA (rouge)",q:1,s:true}] },
        { id:"F", label:"", items:[{n:"Bouteille O² 2L",q:1},{n:"Bouteille O² 2L (2)",q:1}] },
      ]},
      { id:21, label:"Porte Ext. Traumatologie / O²", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Scoop + 3 sangles velcro",q:1},{n:"Planche d'Olivier",q:1},
          {n:"KED",q:1,t:true},{n:"Matelas à dépression",q:1,t:true},
          {n:"Pompe pour matelas",q:1,t:true},{n:"Sangle araignée",q:1},
          {n:"Corde semi statique",q:1},{n:"Pelle pliable (US)",q:1},{n:"Gant de sécurité",q:1},
          {n:"Pied de biche",q:1},{n:"Kit HEAD Block",q:1},
          {n:"Bouteille O² 5L",q:1},{n:"Bouteille O² 5L (2)",q:1},{n:"Extincteur 6Kg",q:1},
          {n:"Marche pieds",q:1,t:true},{n:"Planche de transfert Rollbord®",q:1},
        ]},
      ]},
      { id:22, label:"Cabine chauffeur", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Casque",q:2},{n:"Lampe pour casque",q:2,t:true},
          {n:"Lampe de présignalisation",q:2,t:true},{n:"Brise vitre / Coupe ceinture",q:1},
          {n:"Carte routière Hainaut",q:1},{n:"Carte ADR",q:1},
        ]},
      ]},
    ]
  },

  // ── ALPHA 6 ──────────────────────────────────
  "ALPHA 6": {
    edition: "09/2025", norme: "112/ATNUP",
    sections: [
      { id:1, label:"Divers", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Sac récupérateur de mucosité",q:1},{n:"Tubulure aspirateur de mucosité",q:1},
        ]},
      ]},
      { id:2, label:"Soins et Oxygénothérapie", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"Étagère A", items:[
          {n:"Bandage élastique 5cm",q:5},{n:"Bandage élastique 7cm",q:5},
          {n:"Bandage élastique 10cm",q:5},{n:"Bandage élastique 15cm",q:5},
          {n:"Bandage élastique 20cm",q:2},{n:"Cold Pack",q:2},{n:"Pansement autocollant",q:1},
        ]},
        { id:"B", label:"Étagère B", items:[
          {n:"Solution désinfectante Hibidil®",q:10},{n:"Sérum physiologique unidose",q:10},
          {n:"Iso-Bétadine® dermique 10%",q:5,p:true},{n:"Compresse 5x5cm",q:10},
          {n:"Compresse 7,5x7,5cm",q:10},{n:"Compresse 10x10cm",q:10},
          {n:"Esculape",q:1},{n:"Compresse absorbante 20x10cm",q:5},{n:"Rouleau Urgoderme",q:1},
          {n:"Rouleau de sparadrap 2cm",q:2},{n:"Bandage triangulaire + épingle",q:4},
          {n:"Couverture Isotherme",q:5},
        ]},
        { id:"CK_C", label:"Bassin / Vomitoire", items:[
          {n:"Bassin réniforme UU",q:10},{n:"Sac vomitoire",q:5},{n:"Champ stérile 75x90cm",q:4},
        ]},
        { id:"D", label:"Oxygénothérapie Adulte", items:[
          {n:"Masque O² 100% Adulte",q:1},{n:"Lunette O² Adulte",q:2},
          {n:"Masque aérosol Adulte",q:1},{n:"Tubulure + Raccord Biconique",q:1},
        ]},
        { id:"E", label:"Oxygénothérapie Enfant + Ballons REA", items:[
          {n:"Masque O² 100% Enfant",q:1},{n:"Lunette O² Enfant",q:2},{n:"Masque aérosol Enfant",q:1},
          {n:"Ballon REA adulte complet UU",q:1},{n:"Masque REA N°4 rouge",q:1},
          {n:"Masque REA N°5 bleu",q:1},{n:"Filtre antibactérien ballon REA",q:1},
          {n:"Set de 8 canules de T000 à T5",q:1},
        ]},
        { id:"F", label:"Eau potable", items:[
          {n:"Bouteille d'eau potable 50cl",q:6},
        ]},
      ]},
      { id:3, label:"Kits de linge brancard / Padding", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Kit de linge brancard",q:3},{n:"Kit Padding 3 pièces",q:1},
          {n:"Oreiller de réserve (lavable)",q:1},
        ]},
      ]},
      { id:4, label:"Kit paramétrage", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},
          {n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},
          {n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},
          {n:"Glucomètre",q:1,t:true},{n:"Lancette",q:10},{n:"Tigette",q:10},
          {n:"Compresse 5x5cm",q:2},{n:"Sérum physiologique unidose",q:1},
          {n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1},{n:"Pille AA4 / Pille AAA2",q:6},
        ]},
      ]},
      { id:5, label:"Set de perfusions", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Poche Sérum Physiologique 500ml",q:4,p:true},{n:"Trousse à perfusion",q:2,p:true},
          {n:"Cathéter 16G",q:2,p:true},{n:"Cathéter 18G",q:2,p:true},
          {n:"Cathéter 20G",q:2,p:true},{n:"Cathéter 22G",q:2,p:true},
          {n:"Tégaderme",q:2},{n:"Garrot",q:1},
          {n:"Gants stériles 6,5 ou S",q:2},{n:"Gants stériles 7,5 ou M",q:2},
          {n:"Gants stériles 8,5 ou L",q:2},{n:"Bouchon robinet 3 voies",q:3},
        ]},
      ]},
      { id:6, label:"Kit de protection individuelle", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},
          {n:"Charlotte",q:2},{n:"Masque chirurgical",q:5},{n:"Masque KN95 / FFP3",q:5},
        ]},
      ]},
      { id:7, label:"Kit Burning Electrode DEA réserve", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[{n:"Kit Burning",q:1,s:true}] },
      ]},
      { id:8, label:"RDOH / Kit Burning", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[{n:"Pane + 2 sacs UU",q:1},{n:"Urinal + 2 sacs UU",q:1}] },
      ]},
      { id:9, label:"Hygiène", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Spray désodorisant citron",q:1},{n:"Rouleau sac poubelle ambulance",q:1},
          {n:"Sac à linge blanc",q:2},{n:"Sac à linge jaune",q:2},{n:"Alèze UU",q:3},
          {n:"Lange adulte",q:3},{n:"Paquet de lingette désinfectante",q:1},
          {n:"Microfibres",q:4},{n:"Spray désinfectant surface",q:2},{n:"Blouse d'opéré",q:1},
        ]},
      ]},
      { id:13, label:"Gant nitrile / Mouchoir UU", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Gant nitrile taille S (boite)",q:1},{n:"Gant nitrile taille M (boite)",q:1},
          {n:"Gant nitrile taille L (boite)",q:1},{n:"Gant nitrile taille XL (boite)",q:1},
          {n:"Mouchoir UU (boite)",q:1},
        ]},
      ]},
      { id:15, label:"Sac Pédia. / Accou.", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[{n:"Sac Pédia./Accou.(bleu)",q:1,s:true}] },
      ]},
      { id:16, label:"Sac Intervention + DEA / Sac KATA", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Sac Intervention",q:1,s:true},{n:"Détecteur CO",q:1},
          {n:"DEA + Electrodes",q:1,t:true},{n:"Electrodes de réserve",q:1},
          {n:"Ciseau multifonction d'URGENCE",q:1},{n:"Sac KATA (rouge)",q:1,s:true},
          {n:"Bouteille O² 2L",q:1},
        ]},
      ]},
      { id:17, label:"Cabine sanitaire", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},
          {n:"Gel hydroalcoolique",q:1},{n:"Sonde d'aspiration CH 8",q:3},
          {n:"Sonde d'aspiration CH 12",q:3},{n:"Sonde d'aspiration CH 14",q:3},
          {n:"Container à aiguille",q:1},{n:"Poubelle",q:1},{n:"Tarif ATNUP",q:1},
          {n:"Couverture anti feu",q:1},{n:"Ciseau multifonction d'URGENCE",q:1},
          {n:"Appareil multi paramétrage",q:1,t:true},{n:"Aspirateur de mucosité",q:1,t:true},
        ]},
      ]},
      { id:18, label:"HEAD B-LOCK", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"Boite", items:[
          {n:"HEAD B-LOCK",q:1},{n:"Corde semi statique",q:1},{n:"Pelle pliable (US)",q:1},
          {n:"Gant de sécurité",q:1},{n:"Sangle araignée",q:1},
        ]},
      ]},
      { id:19, label:"O² / Extincteur 6Kg", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Bouteille O² 10L",q:1},{n:"Bouteille O² 10L (2)",q:1},
          {n:"Bouteille O² 2L",q:1},{n:"Extincteur 6Kg",q:1},
        ]},
      ]},
      { id:20, label:"Porte Ext. Traumatologie", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Chaise d'évacuation",q:1,t:true},{n:"Matelas à dépression",q:1,t:true},
          {n:"Pompe pour matelas",q:1},{n:"KED",q:1},{n:"Sac d'atèle",q:1},
          {n:"Atèle grande",q:1,t:true},{n:"Atèle moyenne",q:1,t:true},{n:"Atèle petite",q:1,t:true},
          {n:"Pompe (pour atèle)",q:1,t:true},{n:"Scoop + 3 sangles velcro",q:1,t:true},
          {n:"Pied de biche",q:1},
        ]},
      ]},
      { id:21, label:"Porte arrière", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[{n:"Planche d'Olivier",q:1}] },
      ]},
      { id:22, label:"Cabine chauffeur", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Lampe de présignalisation",q:2,t:true},{n:"Brise vitre / Coupe ceinture",q:1},
          {n:"Carte routière Hainaut",q:1},{n:"Carte ADR",q:1},{n:"Casque",q:2},
          {n:"Lampe pour casque F2",q:2,t:true},
        ]},
      ]},
    ]
  },

  // ── ALPHA 7 ──────────────────────────────────
  "ALPHA 7": {
    edition: "Nov/2025", norme: "112/ATNUP",
    sections: [
      { id:1, label:"Oxygénothérapie / Divers", color:CK_C.red, shelves:[
        { id:"A", label:"Étagère A — Ballons REA", items:[
          {n:"Ballon REA adulte complet UU4",q:1},{n:"Masque REA N°5",q:1},
          {n:"Filtre antibactérien ballon REA",q:1},{n:"Set de 8 canules de T000 à T5",q:1},
        ]},
        { id:"B", label:"Étagère B — Oxygénothérapie Adulte", items:[
          {n:"Masque O² 100% Adulte",q:1},{n:"Lunette O² Adulte",q:2},
          {n:"Masque aérosol Adulte",q:1},{n:"Tubulure + Raccord Biconique",q:1},
        ]},
        { id:"CK_C", label:"Étagère CK_C — Oxygénothérapie Enfant + Eau", items:[
          {n:"Bouteille d'eau potable 50cl",q:6},
          {n:"Sac récupérateur de mucosité",q:1},{n:"Tubulure aspirateur de mucosité",q:1},
        ]},
        { id:"D", label:"Étagère D — Oxygénothérapie Enfant", items:[
          {n:"Masque O² 100% Enfant",q:1},{n:"Lunette O² Enfant",q:2},{n:"Masque aérosol Enfant",q:1},
        ]},
        { id:"E", label:"Divers", items:[
          {n:"Bassin réniforme UU",q:10},{n:"Sac vomitoire",q:5},
        ]},
      ]},
      { id:2, label:"Soins", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"Étagère A", items:[
          {n:"Solution désinfectante Hibidil®",q:10},{n:"Sérum physiologique unidose",q:10},
          {n:"Iso-Bétadine® dermique 10%",q:5,p:true},{n:"Compresse 5x5cm",q:10},
          {n:"Compresse 7,5x7,5cm",q:10},{n:"Compresse 10x10cm",q:10},
          {n:"Compresse absorbante 20x10cm",q:5},
        ]},
        { id:"B", label:"Étagère B", items:[
          {n:"Rouleau Urgoderme",q:1},{n:"Rouleau de sparadrap 2cm",q:2},
          {n:"Kit pansement autocollant",q:1},{n:"Bandage élastique 5cm",q:5},
          {n:"Esculape",q:1},{n:"Bandage élastique 7cm",q:5},{n:"Bandage élastique 10cm",q:5},
        ]},
        { id:"CK_C", label:"Étagère CK_C", items:[
          {n:"Bandage élastique 15cm",q:2},{n:"Bandage élastique 20cm",q:2},{n:"Champ stérile 75x90cm",q:4},
        ]},
        { id:"D", label:"Étagère D", items:[
          {n:"Bandage triangulaire + épingle",q:4},{n:"Couverture Isotherme",q:5},{n:"Cold Pack",q:5},
        ]},
      ]},
      { id:3, label:"Kits de linge brancard / Padding", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Kit de linge brancard",q:3},{n:"Kit Padding 3 pièces",q:1},
          {n:"Oreiller de réserve (lavable)",q:1},
        ]},
      ]},
      { id:4, label:"Kit paramétrage", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Tensiomètre manuel",q:1,t:true},{n:"Stéthoscope",q:1,t:true},
          {n:"Pulsoxymètre filaire",q:1,t:true},{n:"Thermomètre auriculaire",q:1,t:true},
          {n:"Recharge d'embouts jetable",q:1},{n:"Thermomètre digitale",q:1,t:true},
          {n:"Glucomètre",q:1,t:true},{n:"Lancette",q:10},{n:"Tigette",q:10},
          {n:"Compresse 5x5cm",q:2},{n:"Sérum physiologique unidose",q:1},
          {n:"Lampe diagnostique",q:1},{n:"Marqueur indélébile",q:1},{n:"Pille AA4 / Pille AAA2",q:6},
        ]},
      ]},
      { id:5, label:"Set de perfusions", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Poche Sérum Physiologique 500ml",q:4,p:true},{n:"Trousse à perfusion",q:2,p:true},
          {n:"Cathéter 16G",q:2,p:true},{n:"Cathéter 18G",q:2,p:true},
          {n:"Cathéter 20G",q:2,p:true},{n:"Cathéter 22G",q:2,p:true},
          {n:"Tégaderme",q:2},{n:"Garrot",q:1},
          {n:"Gants stériles 6,5 ou S",q:2},{n:"Gants stériles 7,5 ou M",q:2},
          {n:"Gants stériles 8,5 ou L",q:2},{n:"Bouchon robinet 3 voies",q:3},
        ]},
      ]},
      { id:8, label:"Sac d'atèles", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Atèle grande",q:1,t:true},{n:"Atèle moyenne",q:1,t:true},
          {n:"Atèle petite",q:1,t:true},{n:"Pompe (pour atèle)",q:1,t:true},
        ]},
      ]},
      { id:9, label:"Hygiène", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Spray désodorisant citron",q:1},{n:"Rouleau sac poubelle ambulance",q:1},
          {n:"Sac à linge blanc",q:2},{n:"Sac à linge jaune",q:2},{n:"Alèze UU",q:3},
          {n:"Lange adulte",q:3},{n:"Paquet de lingette désinfectante",q:1},
          {n:"Microfibres",q:1},{n:"Mouchoir UU (boite)",q:1},{n:"Blouse d'opéré",q:1},
          {n:"Spray désinfectant surface",q:2},
        ]},
      ]},
      { id:10, label:"Sacs Pédia. / Accou. / KATA / Inter.", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Sac KATA (rouge)",q:1,s:true},{n:"Sac Pédia./Accou.(bleu)",q:1,s:true},
        ]},
        { id:"B", label:"Boite", items:[
          {n:"Corde semi statique",q:1},{n:"Pelle pliable (US)",q:1},
          {n:"Gant de sécurité",q:1},{n:"Sangle araignée",q:1},
        ]},
      ]},
      { id:11, label:"Sac Intervention / O² / Inter.", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Sac Intervention avec DEA",q:1},{n:"DEA",q:1,t:true},
          {n:"Electrode DEA réserve",q:1},{n:"Détecteur CO",q:1},
          {n:"Ciseau multifonction d'URGENCE",q:1},{n:"Bouteille O² 2L",q:1},{n:"Pied de biche",q:1},
        ]},
      ]},
      { id:12, label:"Cabine sanitaire", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Brancard avec sangles",q:1},{n:"Toile de glisse",q:1},{n:"Distributeur de papier UU",q:1},
          {n:"Gel hydroalcoolique",q:1},{n:"Sonde d'aspiration CH 8",q:3},
          {n:"Sonde d'aspiration CH 12",q:3},{n:"Sonde d'aspiration CH 14",q:3},
          {n:"Appareil multi paramétrage",q:1,t:true},{n:"Aspirateur de mucosité",q:1,t:true},
          {n:"Gant nitrile taille S (boite)",q:1},{n:"Gant nitrile taille M (boite)",q:1},
          {n:"Gant nitrile taille L (boite)",q:1},{n:"Gant nitrile taille XL (boite)",q:1},
          {n:"Container à aiguille",q:1},{n:"Poubelle",q:1},{n:"Tarif ATNUP",q:1},
          {n:"Couverture anti feu",q:1},{n:"Ciseau multifonction d'URGENCE",q:1},
        ]},
      ]},
      { id:13, label:"Kit protec. Indiv. / HEAD B-LOCK", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Salopette UU",q:2},{n:"Blouse UU",q:2},{n:"Lunette de protection",q:2},
          {n:"Charlotte",q:2},{n:"Masque chirurgical",q:5},{n:"Masque KN95 / FFP3",q:5},
          {n:"HEAD B-LOCK",q:1},
        ]},
      ]},
      { id:14, label:"RDOH / Kit Burning", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Pane + 2 sacs UU",q:1},{n:"Urinal + 2 sacs UU",q:1},{n:"Kit Burning",q:1,s:true},
        ]},
      ]},
      { id:15, label:"O²", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Bouteille O² 2L",q:1},{n:"Pompe à matelas à dépression",q:1},
        ]},
      ]},
      { id:16, label:"Divers", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[{n:"Matelas à dépression",q:1}] },
      ]},
      { id:17, label:"Porte Ext. Traumatologie", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Planche d'Olivier",q:1},{n:"Chaise d'évacuation",q:1,t:true},
          {n:"KED",q:1},{n:"Bouteille O² 5L",q:1},{n:"Bouteille O² 5L (2)",q:1},
          {n:"Extincteur 6Kg",q:1},{n:"Scoop + 3 sangles velcro",q:1,t:true},{n:"Pied de biche",q:1},
        ]},
      ]},
      { id:18, label:"Cabine chauffeur", color:CK_C.darkBlue, shelves:[
        { id:"A", label:"", items:[
          {n:"Lampe de présignalisation",q:2,t:true},{n:"Brise vitre / Coupe ceinture",q:1},
          {n:"Carte routière Hainaut",q:1},{n:"Carte ADR",q:1},
          {n:"Casque F2",q:2},{n:"Lampe pour casque F2",q:2,t:true},
        ]},
      ]},
      { id:20, label:"Couverture", color:CK_C.red, shelves:[
        { id:"A", label:"", items:[
          {n:"Couverture",q:0,okOnly:true},
        ]},
      ]},
    ]
  },
};

// ═══════════════════════════════════════════════
// COMPOSANT CHECKLIST GÉNÉRIQUE
// ═══════════════════════════════════════════════
function ChecklistView({ vehicleName, onBack }) {
  const data = CHECKLISTS[vehicleName];
  const [checks, setChecks] = useState({});
  const [expanded, setExpanded] = useState({ [data.sections[0]?.id]: true });
  const [amb1, setAmb1] = useState("");
  const [amb2, setAmb2] = useState("");
  const [semaine, setSemaine] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const gk = (sId, shId, name) => `${sId}__${shId}__${name}`;
  const setCF = (key, found, required) => setChecks(p => ({ ...p, [key]: { ...p[key], found, required } }));
  const setC = (key, field, value) => setChecks(p => ({ ...p, [key]: { ...p[key], [field]: value } }));
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const allItems = data.sections.flatMap(s => s.shelves.flatMap(sh => sh.items));
  const totalItems = allItems.length;
  const checkedItems = Object.values(checks).filter(c => c.found !== undefined).length;
  const nokItems = Object.entries(checks).filter(([, v]) => v.found !== undefined && v.found < v.required);
  const progress = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

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
        {nokItems.length>0&&(
          <div style={{ background:CK_C.dangerSoft, border:`1px solid ${CK_C.danger}`, borderRadius:12, padding:"16px", marginBottom:14 }}>
            <div style={{ fontWeight:800, color:CK_C.danger, marginBottom:12, fontSize:14 }}>⚠ Matériel manquant ({nokItems.length})</div>
            {nokItems.map(([key,val])=>{
              const parts=key.split("__");
              const sId=parts[0];
              const section=data.sections.find(s=>String(s.id)===sId);
              const itemName=parts.slice(2).join("__");
              return(<div key={key} style={{ borderLeft:`2px solid ${CK_C.danger}`, paddingLeft:10, marginBottom:8 }}>
                <div style={{ fontSize:11, color:CK_C.muted }}>{section?.label}</div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{itemName}</span>
                  <span style={{ color:CK_C.danger, fontWeight:700, fontSize:12 }}>Manque {val.required-val.found}/{val.required}</span>
                </div>
              </div>);
            })}
          </div>
        )}
        {remarks&&<div style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:12, padding:"16px", marginBottom:14 }}><div style={{ fontSize:11, fontWeight:700, color:CK_C.muted, textTransform:"uppercase", marginBottom:8 }}>Remarques</div><div style={{ fontSize:13 }}>{remarks}</div></div>}
        <div style={{ background:CK_C.successSoft, border:`1px solid ${CK_C.success}`, borderRadius:10, padding:"14px", textAlign:"center", fontWeight:700, color:CK_C.success }}>✅ Rapport envoyé au responsable</div>
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
              <div style={{ fontSize:10, color:CK_C.muted, textTransform:"uppercase", letterSpacing:"0.8px" }}>Norme {data.norme} · Éd. {data.edition}</div>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:20, fontWeight:800, color:progress===100?CK_C.success:CK_C.accent }}>{progress}%</div>
            <div style={{ fontSize:10, color:CK_C.muted }}>{checkedItems}/{totalItems}</div>
          </div>
        </div>
        <div style={{ height:4, background:CK_C.border, borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progress}%`, background:progress===100?CK_C.success:CK_C.accent, borderRadius:4, transition:"width 0.3s" }}/>
        </div>
      </div>

      <div style={{ background:CK_C.panel, borderBottom:`1px solid ${CK_C.border}`, padding:"12px 16px", display:"flex", gap:8 }}>
        <input value={amb1} onChange={e=>setAmb1(e.target.value)} placeholder="Ambulancier 1" style={{ flex:1, background:CK_C.bg, border:`1px solid ${CK_C.border}`, borderRadius:8, padding:"8px 12px", color:CK_C.text, fontSize:13 }}/>
        <input value={amb2} onChange={e=>setAmb2(e.target.value)} placeholder="Ambulancier 2" style={{ flex:1, background:CK_C.bg, border:`1px solid ${CK_C.border}`, borderRadius:8, padding:"8px 12px", color:CK_C.text, fontSize:13 }}/>
        <input value={semaine} onChange={e=>setSemaine(e.target.value)} placeholder="Sem.N°" style={{ width:75, background:CK_C.bg, border:`1px solid ${CK_C.border}`, borderRadius:8, padding:"8px 10px", color:CK_C.text, fontSize:13 }}/>
      </div>

      <div style={{ flex:1, padding:"12px 12px 100px" }}>
        {data.sections.filter(s=>s.shelves.some(sh=>sh.items.length>0)).map(section=>{
          const allKeys=section.shelves.flatMap(sh=>sh.items.map(item=>gk(section.id,sh.id,item.n)));
          const sChecked=allKeys.filter(k=>checks[k]?.found!==undefined).length;
          const sNOK=allKeys.filter(k=>checks[k]?.found!==undefined&&checks[k]?.found<checks[k]?.required).length;
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
                  <span style={{ fontSize:11, opacity:0.8 }}>{sChecked}/{allKeys.length}</span>
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
                    const isChecked=found!==undefined;
                    const isMissing=isChecked&&found<item.q;
                    const isOk=isChecked&&found>=item.q;
                    const isBinary=item.t||item.s||item.okOnly;
                    return(
                      <div key={idx} style={{ background:isMissing?"rgba(239,68,68,0.06)":isOk?"rgba(34,197,94,0.04)":CK_C.panel, borderTop:`1px solid ${CK_C.border}`, padding:"11px 14px" }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:CK_C.text, display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                              {item.n}
                              {item.t&&<span style={{ background:"#1d4ed820", border:"1px solid #1d4ed8", color:"#60a5fa", borderRadius:4, padding:"1px 5px", fontSize:9, fontWeight:700 }}>TEST</span>}
                              {item.s&&<span style={{ background:"#7c3aed20", border:"1px solid #7c3aed", color:"#a78bfa", borderRadius:4, padding:"1px 5px", fontSize:9, fontWeight:700 }}>SCELLÉ</span>}
                              {item.p&&<span style={{ background:"#f59e0b20", border:"1px solid #f59e0b", color:"#fbbf24", borderRadius:4, padding:"1px 5px", fontSize:9, fontWeight:700 }}>PÉREMPTION</span>}
                            </div>
                            {!item.okOnly&&<div style={{ fontSize:11, color:CK_C.muted, marginTop:2, display:"flex", gap:8 }}>
                              <span>Requis : <strong style={{ color:CK_C.text }}>{item.q}</strong></span>
                              {isChecked&&!isBinary&&<span style={{ color:isOk?CK_C.success:CK_C.danger, fontWeight:700 }}>{isOk?"✓ Complet":`⚠ Manque ${item.q-found}`}</span>}
                            </div>}
                            {item.p&&<input type="date" value={state.date||""} onChange={e=>setC(key,"date",e.target.value)} style={{ marginTop:5, background:CK_C.bg, border:`1px solid ${CK_C.border}`, borderRadius:6, padding:"4px 8px", color:CK_C.text, fontSize:11, width:150 }}/>}
                          </div>
                          <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                            <button onClick={()=>setCF(key,state.found===item.q?undefined:item.q,item.q)} style={{ padding:"7px 12px", borderRadius:8, border:isOk?`2px solid ${CK_C.success}`:`1px solid ${CK_C.border}`, background:isOk?CK_C.successSoft:"transparent", color:isOk?CK_C.success:CK_C.muted, fontWeight:700, fontSize:12 }}>OK</button>
                            {!item.okOnly&&<button onClick={()=>setCF(key,state.found===0?undefined:0,item.q)} style={{ padding:"7px 10px", borderRadius:8, border:(isChecked&&!isOk)?`2px solid ${CK_C.danger}`:`1px solid ${CK_C.border}`, background:(isChecked&&!isOk)?CK_C.dangerSoft:"transparent", color:(isChecked&&!isOk)?CK_C.danger:CK_C.muted, fontWeight:700, fontSize:12 }}>NOK</button>}
                            {!isBinary&&<div style={{ display:"flex", alignItems:"center", background:CK_C.bg, border:`1px solid ${isMissing?CK_C.danger:isOk?CK_C.success:CK_C.border}`, borderRadius:10, overflow:"hidden" }}>
                              <button onClick={()=>setCF(key,Math.max(0,(found!==undefined?found:item.q)-1),item.q)} style={{ width:32, height:34, background:"transparent", border:"none", color:CK_C.muted, fontSize:17, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                              <div style={{ minWidth:32, textAlign:"center", fontSize:14, fontWeight:800, color:isMissing?CK_C.danger:isOk?CK_C.success:CK_C.text, borderLeft:`1px solid ${CK_C.border}`, borderRight:`1px solid ${CK_C.border}`, height:34, display:"flex", alignItems:"center", justifyContent:"center" }}>{found!==undefined?found:"?"}</div>
                              <button onClick={()=>setCF(key,(found!==undefined?found:0)+1,item.q)} style={{ width:32, height:34, background:"transparent", border:"none", color:CK_C.muted, fontSize:17, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                            </div>}
                          </div>
                        </div>
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
          <textarea value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="Matériel manquant, observations..." rows={3} style={{ width:"100%", background:CK_C.bg, border:`1px solid ${CK_C.border}`, borderRadius:8, padding:"10px 12px", color:CK_C.text, fontSize:13, resize:"none" }}/>
        </div>
      </div>
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:CK_C.panel, borderTop:`1px solid ${CK_C.border}`, padding:"13px 16px" }}>
        <button onClick={()=>{if(checkedItems>0){markChecklistDone(vehicleName);setSubmitted(true);}}} style={{ width:"100%", background:progress===100?CK_C.success:CK_C.accent, border:"none", borderRadius:10, color:"white", padding:"14px", fontWeight:800, fontSize:15, opacity:checkedItems>0?1:0.5 }}>
          {progress===100?"✅ Envoyer au responsable":`📤 Envoyer (${progress}% complété)`}
        </button>
      </div>
    </div>
  );
}
function ChecklistsHome({ onBack }) {
  const [selected, setSelected] = useState(null);

  if (selected) return <ChecklistView vehicleName={selected} onBack={() => setSelected(null)} />;

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
      </div>
      <div style={{ flex:1, padding:"24px 20px", maxWidth:480, margin:"0 auto", width:"100%" }}>
        <div style={{ fontSize:13, color:CK_C.muted, marginBottom:20 }}>Scannez le QR code de votre véhicule ou sélectionnez-le manuellement :</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {Object.keys(CHECKLISTS).map(name => (
            <button key={name} onClick={() => setSelected(name)}
              style={{ background:CK_C.panel, border:`1px solid ${CK_C.border}`, borderRadius:13, padding:"16px 20px", color:CK_C.text, textAlign:"left", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:42, height:42, background:CK_C.red, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🚑</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:16 }}>{name}</div>
                  <div style={{ fontSize:11, color:CK_C.muted }}>Éd. {CHECKLISTS[name].edition} · Norme {CHECKLISTS[name].norme}</div>
                </div>
              </div>
              <span style={{ color:CK_C.muted, fontSize:20 }}>→</span>
            </button>
          ))}
        </div>
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
function getChecklistsDoneThisWeek(){
  try{
    const raw=localStorage.getItem(`aps_checklists_done_${getChecklistWeekKey()}`);
    return raw?JSON.parse(raw):[];
  }catch(e){return [];}
}
function markChecklistDone(vehicleName){
  try{
    const key=`aps_checklists_done_${getChecklistWeekKey()}`;
    const done=getChecklistsDoneThisWeek();
    if(!done.includes(vehicleName)){
      done.push(vehicleName);
      localStorage.setItem(key,JSON.stringify(done));
    }
  }catch(e){}
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

function PlanningView({courses,setCourses,vehicles,patients,setPatients,categories,setCategories,conventions,transportTypes,equipements,pending,onAssignPending,onGoFormulaire,onBack,onSchedule}){
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
  const [patientsHabituels, setPatientsHabituels] = useFirestoreState("patientsHabituels", [
    {id:"ph_test1",categorie:"Dialyse",nom:"Moreau",prenom:"Alice",telephone:"065 12 34 56",adresseDepart:"15 rue de la Paix, Mons",adresseArrivee:"CHU Mons — Dialyse",convention:"epicura",typeTransport:"dialyse",mobilite:"chaise_perso",equipSelected:[],litrageO2:2,notes:"Dialyse 3x/semaine — Lun/Mer/Ven",heureHabituelle:"08h00",statut:"actif"},
    {id:"ph_test2",categorie:"Radiothérapie",nom:"Petit",prenom:"Bernard",telephone:"065 98 76 54",adresseDepart:"42 chaussée de Bruxelles, Mons",adresseArrivee:"CHU Mons — Radiothérapie",convention:"partenamut",typeTransport:"radiotherapie",mobilite:"brancard",equipSelected:["oxygene"],litrageO2:4,notes:"Test — sous oxygène",heureHabituelle:"10h30",statut:"actif"},
    {id:"ph_test3",categorie:"Oncologie",nom:"Lambert",prenom:"Chantal",telephone:"065 45 67 89",adresseDepart:"8 rue du Parc, Frameries",adresseArrivee:"CHU Mons — Oncologie",convention:"home",typeTransport:"oncologie",mobilite:"assis",equipSelected:[],litrageO2:2,notes:"Test — patient hospitalisé actuellement",heureHabituelle:"13h00",statut:"hospitalise"},
  ]);
  const [patientCategories, setPatientCategories] = useFirestoreState("patientCategories", ["Dialyse","Radiothérapie","Oncologie"]);
  const [tarifs, setTarifs] = useFirestoreState("tarifs", {
    tpmr:{priseEnCharge:"0", kmAudela10:"0"},
    ambulance:{priseEnCharge:"0", km11_20:"0", km21plus:"0"},
  });
  const [plans,       setPlans]       = useFirestoreState("plans", INIT_PLANS);
  const [nextId,      setNextId]      = useFirestoreState("nextId", 100);
  const [appView,     setAppView]     = useState("menu");
  const [showPin,     setShowPin]     = useState(false);
  const [showDispMenu,setShowDispMenu] = useState(false);
  const [checklistsDoneWeek,setChecklistsDoneWeek] = useState(()=>getChecklistsDoneThisWeek());
  const [themeMode, setThemeMode] = useState(()=>getStoredThemeMode());

  useEffect(()=>{ if(appView==="menu") setChecklistsDoneWeek(getChecklistsDoneThisWeek()); },[appView]);

  const [cDriver,   setCDriver]   = useState(null);
  const [cVehicle,  setCVehicle]  = useState(null);
  const [cScreen,   setCScreen]   = useState("choix_nom");
  const [cCourse,   setCCourse]   = useState(null);
  const [cStatuts,  setCStatuts]  = useState({});
  const [cBons,     setCBons]     = useState([]);

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

  const saveBon = (bon) => {
    setCBons(p=>{
      const exists=p.find(b=>b.id===bon.id);
      if(exists) return p.map(b=>b.id===bon.id?bon:b);
      return [...p,bon];
    });
  };

  const activeVehicles=vehicles.filter(v=>v.active);

  if(showPin) return <PinModal onSuccess={()=>{setShowPin(false);setAppView("parametres");}} onCancel={()=>setShowPin(false)}/>;
  if(appView==="formulaire") return <FormulaireView onBack={backToSubMenu} onSubmit={submitCourse} conventions={conventions} equipements={equipements} transportTypes={transportTypes} contacts={contacts}/>;
  if(appView==="dispatcher") return <DispatcherView vehicles={vehicles} setVehicles={setVehicles} courses={courses} setCourses={setCourses} pending={pending} onValidate={validateCourse} onRefuse={refuseCourse} onBack={backToSubMenu} contacts={contacts} tarifs={tarifs}/>;
  if(appView==="planning") return <PlanningView courses={courses} setCourses={setCourses} vehicles={vehicles} patients={patientsHabituels} setPatients={setPatientsHabituels} categories={patientCategories} setCategories={setPatientCategories} conventions={conventions} transportTypes={transportTypes} equipements={equipements} pending={pending} onAssignPending={validateCourse} onGoFormulaire={()=>setAppView("formulaire")} onBack={backToSubMenu} onSchedule={submitFromPatientHabituel}/>;
  if(appView==="chauffeur")  return <ChauffeurView driversAmb={driversAmb} driversTpmr={driversTpmr} stagiairesAmb={stagiairesAmb} formationTpmr={formationTpmr} vehicles={vehicles} contacts={contacts} plans={plans} driver={cDriver} setDriver={setCDriver} vehicle={cVehicle} setVehicle={setCVehicle} screen={cScreen} setScreen={setCScreen} course={cCourse} setCourse={setCCourse} statuts={cStatuts} setStatut={setStatut} myCourses={myCourses} myActives={myActives} myTermines={myTermines} bons={cBons} saveBon={saveBon} bases={bases} onBack={()=>setAppView("menu")} onEndService={()=>{setCDriver(null);setCVehicle(null);setCScreen("choix_nom");setCStatuts({});setAppView("menu");}}/>;
  if(appView==="checklists") return <ChecklistsHome onBack={()=>setAppView("menu")}/>;
  if(appView==="parametres") return <ParametresView driversAmb={driversAmb} setDriversAmb={setDriversAmb} driversTpmr={driversTpmr} setDriversTpmr={setDriversTpmr} stagiairesAmb={stagiairesAmb} setStagiairesAmb={setStagiairesAmb} formationTpmr={formationTpmr} setFormationTpmr={setFormationTpmr} vehicles={vehicles} setVehicles={setVehicles} conventions={conventions} setConventions={setConventions} equipements={equipements} setEquipements={setEquipements} transportTypes={transportTypes} setTransportTypes={setTransportTypes} bases={bases} setBases={setBases} contacts={contacts} setContacts={setContacts} plans={plans} setPlans={setPlans} tarifs={tarifs} setTarifs={setTarifs} onBack={()=>setAppView("menu")}/>;

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
          <button onClick={()=>{const next=themeMode==="light"?"dark":"light";applyThemeMode(next);setThemeMode(next);}} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{themeMode==="light"?"🌙 Sombre":"☀️ Clair"}</button>
          <button onClick={()=>setShowPin(true)} style={{background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>⚙️ Paramètres</button>
        </div>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 20px"}}>
        <div style={{width:"100%",maxWidth:700,animation:"fadeUp 0.4s ease"}}>
          <div style={{textAlign:"center",marginBottom:44}}>
            <div style={{fontSize:13,color:C.muted,textTransform:"uppercase",letterSpacing:"2px",marginBottom:10}}>Choisissez votre interface</div>
            <div style={{fontSize:30,fontWeight:700,letterSpacing:"-0.5px"}}>Où souhaitez-vous aller ?</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:36}}>
            {[{val:activeVehicles.length,label:"Véhicules actifs",color:C.accent},{val:courses.length,label:"Courses du jour",color:C.blue},{val:Math.max(0,7-checklistsDoneWeek.length),label:"Checklists restantes",color:(7-checklistsDoneWeek.length)===0?C.success:"#dc2626"}].map(s=>(
              <div key={s.label} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",textAlign:"center"}}>
                <div style={{fontSize:24,fontWeight:800,color:s.color,fontFamily:"'IBM Plex Mono',monospace"}}>{s.val}</div>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.5px",marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>
          {!showDispMenu?(
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
          ):(
            <div>
              <button onClick={()=>setShowDispMenu(false)} style={{background:"transparent",border:"none",color:C.muted,fontSize:13,cursor:"pointer",marginBottom:16,display:"flex",alignItems:"center",gap:6}}>← Retour</button>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STEPS_F=[{id:1,icon:"📞",label:"Appelant"},{id:2,icon:"👤",label:"Patient"},{id:3,icon:"🗺",label:"Trajet"},{id:4,icon:"🔖",label:"Transport"},{id:5,icon:"🏥",label:"Médical"}];
const EMPTY_F={convention:"",autreConvention:"",nom:"",prenom:"",dateNaissance:"",telephone:"",adresseDepart:"",adresseArrivee:"",typeTransport:"",sousType:"",date:"",heures:[{heure:"",description:""}],heurePC:"",mobilite:"assis",equipSelected:[],litrageO2:2,accompagnant:false,notes:""};

function validateF(form,step){
  const e={};
  if(step>=1){if(!form.convention)e.convention="Convention requise";}
  if(step>=2){if(!form.nom.trim())e.nom="Requis";if(!form.prenom.trim())e.prenom="Requis";}
  if(step>=3){if(!form.adresseDepart.trim())e.adresseDepart="Requis";if(!form.adresseArrivee.trim())e.adresseArrivee="Requis";}
  if(step>=4){if(!form.typeTransport)e.typeTransport="Requis";if(!form.date||!form.date.trim())e.date="Date requise";}
  return e;
}

function FormulaireView({onBack,onSubmit,conventions,equipements,transportTypes,contacts}){
  const [step,setStep]=useState(1);
  const [form,setForm]=useState(()=>({...EMPTY_F,date:todayFR()}));
  const [touched,setTouched]=useState({});
  const [done,setDone]=useState(false);
  const [showContactsPicker,setShowContactsPicker]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const touch=(...ks)=>setTouched(t=>{const n={...t};ks.forEach(k=>n[k]=true);return n;});
  const errors=validateF(form,step);
  const canNext=Object.keys(errors).length===0;
  const TOUCH_MAP={1:["convention"],2:["nom","prenom"],3:["adresseDepart","adresseArrivee"],4:["typeTransport"],5:[]};
  const goNext=()=>{touch(...(TOUCH_MAP[step]||[]));if(canNext)setStep(s=>Math.min(s+1,5));};
  const toggleEquip=(id)=>{const sel=form.equipSelected||[];if(sel.includes(id))set("equipSelected",sel.filter(x=>x!==id));else set("equipSelected",[...sel,id]);};
  const isAmb=needsAmb(form.mobilite,form.equipSelected);
  const vehicle=isAmb?{label:"AMBULANCE",icon:"🚑",color:C.danger}:form.mobilite==="assis"?{label:"VSL / TPMR",icon:"🚗",color:C.blue}:{label:"TPMR",icon:"♿",color:C.blue};
  const handleSubmit=()=>{if(Object.keys(validateF(form,5)).length===0){onSubmit(form);setDone(true);}};
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
        <div style={{display:"flex",alignItems:"center",gap:10}}><Badge color={C.success} soft={C.successSoft} pulse>En ligne</Badge><Clock/></div>
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
                  <SectionTitle icon="📞" title="Appelant"/>
                  <FieldWrap label="Appelant" error={errors.convention} touched={touched.convention} required>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginTop:2}}>
                      {conventions.map(c=>{const active=form.convention===c.id;return(
                        <button key={c.id} onClick={()=>{set("convention",c.id);touch("convention");}}
                          style={{padding:"11px 7px",borderRadius:9,cursor:"pointer",border:`1.5px solid ${active?C.accent:C.border}`,background:active?C.accentSoft:C.panel2,color:active?C.accent:C.muted,display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontSize:12,fontWeight:active?700:500,transition:"all 0.15s"}}>
                          <span>{c.icon}</span>{c.label}
                        </button>
                      );})}
                    </div>
                  </FieldWrap>
                  {form.convention==="autre"&&<div style={{marginTop:14}}><FieldWrap label="Précisez"><TextInput value={form.autreConvention||""} onChange={e=>set("autreConvention",e.target.value)} onBlur={()=>{}} placeholder="Nom de la convention…"/></FieldWrap></div>}
                </>
              )}
              {step===2&&(
                <>
                  <SectionTitle icon="👤" title="Patient"/>
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
              :<button onClick={handleSubmit} style={{flex:2,padding:"12px",background:C.success,border:"none",borderRadius:11,color:"white",fontSize:13,fontWeight:800,cursor:"pointer"}}>📤 Envoyer au dispatcher</button>}
            </div>
          </>
        )}
      </div>
      {showContactsPicker&&<ContactsPickerModal contacts={contacts} pickMode onSelect={(tel)=>set("telephone",tel)} onClose={()=>setShowContactsPicker(false)}/>}
    </div>
  );
}

