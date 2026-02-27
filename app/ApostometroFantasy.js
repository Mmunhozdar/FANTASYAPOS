'use client';

import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// MITOU FC — Gerador de Escalação Inteligente · Cartola FC 2026
// https://mitoufc.com.br
// ═══════════════════════════════════════════════════════════════════════════

const MERCADO_ABERTO = 1;

// ─── API (via proxy local — sem CORS) ───────────────────────────────────────
async function apiFetch(path, timeout = 10000) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeout);
    const r = await fetch(`/api/cartola${path}`, { signal: c.signal, headers: { Accept: "application/json" } });
    clearTimeout(t);
    if (r.ok) { console.log(`[API] OK /api/cartola${path}`); return await r.json(); }
    console.warn(`[API] ${r.status} /api/cartola${path}`);
  } catch (e) { console.warn(`[API] fail /api/cartola${path}:`, e.message); }
  return null;
}

// ─── NORMALIZE ──────────────────────────────────────────────────────────────
const CC = { FLA:"#E10600",BOT:"#1a1a1a",COR:"#1a1a1a",BAH:"#024A9B",SAO:"#E10600",VAS:"#1a1a1a",PAL:"#006437",SAN:"#1a1a1a",GRE:"#004B8D",CAM:"#1a1a1a",CRU:"#004B8D",INT:"#E10600",JUV:"#006837",VIT:"#E10600",CAP:"#E10600",GOI:"#006437",SPT:"#E10600",MIR:"#F9A825",CEA:"#1a1a1a",FOR:"#E10600",FLU:"#7B1FA2",BRA:"#006437",CFC:"#006437",RBB:"#E10600",CHA:"#006437",REM:"#004B8D",CTB:"#006437",COX:"#006437" };
const MPOS = { 1:{id:1,nome:"Goleiro",abreviacao:"GOL"},2:{id:2,nome:"Lateral",abreviacao:"LAT"},3:{id:3,nome:"Zagueiro",abreviacao:"ZAG"},4:{id:4,nome:"Meia",abreviacao:"MEI"},5:{id:5,nome:"Atacante",abreviacao:"ATA"},6:{id:6,nome:"Técnico",abreviacao:"TEC"} };

function normPlayer(a) {
  const m = a.media_num ?? a.media ?? 0;
  return { id: a.atleta_id, apelido: a.apelido||a.nome||"?", posicao_id: a.posicao_id, clube_id: a.clube_id, preco: a.preco_num??a.preco??0, media: m, jogos: a.jogos_num??a.jogos??0, status_id: a.status_id??7, variacao: a.variacao_num??a.variacao??0, pontos_ultimas_3: [+(m*1.1).toFixed(1),+(m*0.9).toFixed(1),+(m*1.05).toFixed(1)] };
}
function normClub(c) { const a=c.abreviacao||"???"; return { id:c.id, nome:c.nome||"?", abreviacao:a, cor:CC[a]||"#555" }; }

// ─── FORMATIONS ─────────────────────────────────────────────────────────────
const FORMS = { "3-4-3":{z:3,l:0,m:4,a:3},"3-5-2":{z:3,l:0,m:5,a:2},"4-3-3":{z:2,l:2,m:3,a:3},"4-4-2":{z:2,l:2,m:4,a:2},"4-5-1":{z:2,l:2,m:5,a:1},"5-3-2":{z:3,l:2,m:3,a:2},"5-4-1":{z:3,l:2,m:4,a:1} };

// ─── OPTIMIZER (always 11 + 1 TEC = 12) ────────────────────────────────────
function optimize(players, clubs, formation, budget, strategy) {
  const f=FORMS[formation]; if(!f) return null;
  const needs={1:1,2:f.l,3:f.z,4:f.m,5:f.a,6:1};
  const REQUIRED_TOTAL=12;
  const avail=players.filter(p=>p.status_id===7&&p.jogos>0);
  const score=(p)=>{const r=p.pontos_ultimas_3.reduce((a,b)=>a+b,0)/3;switch(strategy){case"aggressive":return r*1.3+p.variacao*2+p.media*.5;case"conservative":return p.media*1.5+(p.jogos/8)*2-Math.abs(p.variacao)*.5;case"value":return(p.media/Math.max(p.preco,1))*10+r*.3;default:return r*.8+p.media*.8+p.variacao+p.jogos/8*1.5;}};
  let rem=budget; const sel=[];
  for(const pid of [5,4,1,3,2,6]){
    const cnt=needs[pid]||0;if(!cnt)continue;
    const cands=avail.filter(p=>p.posicao_id===pid&&!sel.find(s=>s.id===p.id)).map(p=>({...p,sc:score(p)})).sort((a,b)=>b.sc-a.sc);
    let pk=0;
    for(const c of cands){if(pk>=cnt)break;const sl=REQUIRED_TOTAL-sel.length-1;const minRest=sl*3.0;if(c.preco<=rem-minRest||sl<=0){sel.push(c);rem-=c.preco;pk++;}}
    if(pk<cnt){const cheap=cands.filter(c=>!sel.find(s=>s.id===c.id)).sort((a,b)=>a.preco-b.preco);for(const c of cheap){if(pk>=cnt)break;sel.push(c);rem-=c.preco;pk++;}}
  }
  if(sel.length!==REQUIRED_TOTAL){return{players:[],formation,strategy,totalCost:0,remaining:budget,totalMedia:0,expectedPoints:0,overBudget:false,error:`Erro: ${sel.length}/12 escalados. Aumente o orçamento.`};}
  for(const[pid,cnt]of Object.entries(needs)){if(sel.filter(p=>p.posicao_id===+pid).length!==cnt){return{players:[],formation,strategy,totalCost:0,remaining:budget,totalMedia:0,expectedPoints:0,overBudget:false,error:`Erro de posição.`};}}
  const tc=sel.reduce((a,p)=>a+p.preco,0);const ep=sel.reduce((a,p)=>a+p.pontos_ultimas_3.reduce((x,y)=>x+y,0)/3,0);
  return{players:sel,formation,strategy,totalCost:+tc.toFixed(2),remaining:+(budget-tc).toFixed(2),totalMedia:+sel.reduce((a,p)=>a+p.media,0).toFixed(2),expectedPoints:+ep.toFixed(2),overBudget:tc>budget};
}

function analysis(L,clubs){
  if(!L||L.error) return L?.error||"Não foi possível gerar escalação.";
  if(!L.players?.length) return "Não foi possível gerar escalação. Tente outro orçamento.";
  const jog=L.players.filter(p=>p.posicao_id!==6).length;
  const tec=L.players.filter(p=>p.posicao_id===6).length;
  const top=[...L.players].sort((a,b)=>(b.pontos_ultimas_3.reduce((x,y)=>x+y,0)/3)-(a.pontos_ultimas_3.reduce((x,y)=>x+y,0)/3))[0];
  const ris=[...L.players].sort((a,b)=>b.variacao-a.variacao)[0];
  const ta=top.pontos_ultimas_3.reduce((a,b)=>a+b,0)/3;const g=id=>clubs[id]?.abreviacao||"???";
  const sl={aggressive:"Agressiva ⚡",conservative:"Conservadora 🛡️",value:"Custo-Benefício 💎",balanced:"Equilibrada ⚖️"};
  const tp={aggressive:"MITADA na certa! Risco alto, recompensa gigante.",conservative:"Sem negativar. Consistência é a chave.",value:"Máximo de pontos por Cartoleta investida.",balanced:"O caminho do meio: segurança com potencial."};
  let text=`⚡ MITOU! ESCALAÇÃO PRONTA!\n\n📊 ${L.formation} | ${sl[L.strategy]}\n👥 ${jog} jogadores + ${tec} técnico = ${jog+tec} escalados\n💰 C$ ${L.totalCost.toFixed(2)}`;
  if(L.overBudget){text+=` ⚠️ (C$ ${Math.abs(L.remaining).toFixed(2)} acima)`;}else{text+=` (Sobram C$ ${L.remaining.toFixed(2)})`;}
  text+=`\n📈 Esperado: ${L.expectedPoints.toFixed(1)} pts | Média: ${L.totalMedia.toFixed(1)} pts\n\n🔥 Craque: ${top.apelido} (${g(top.clube_id)}) — ${ta.toFixed(1)} pts/rod\n📈 Valorizando: ${ris.apelido} (${g(ris.clube_id)}) +C$ ${ris.variacao.toFixed(2)}\n\n💡 ${tp[L.strategy]}`;
  if(L.overBudget) text+=`\n\n⚠️ Orçamento apertado. Tente C$ ${(L.totalCost+5).toFixed(0)}+`;
  return text;
}

// ─── DATE ───────────────────────────────────────────────────────────────────
function fmtFechamento(f) {
  if(!f) return null;
  if(f.timestamp){const d=new Date(f.timestamp*1000);const ds=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];const ms=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];return `${ds[d.getDay()]}, ${d.getDate()} ${ms[d.getMonth()]} ${d.getFullYear()} às ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
  return null;
}

// ─── SPONSOR ────────────────────────────────────────────────────────────────
const AD_LINK = "https://go.aff.partnersapostou.com/1xwo5mwf";
const AD_BANNER_URL = "/banner-apostou.png";

const AdBanner = ({ style = {} }) => (
  <a href={AD_LINK} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", animation: "fadeInUp .5s ease-out", ...style }}>
    <img src={AD_BANNER_URL} alt="Apostou - Registre-se" style={{ width: "100%", maxWidth: 380, borderRadius: 12, border: "2px solid rgba(255,193,7,.25)", boxShadow: "0 4px 20px rgba(255,193,7,.15)", cursor: "pointer", transition: "transform .2s, box-shadow .2s" }}
      onMouseOver={e => { e.target.style.transform = "scale(1.02)"; e.target.style.boxShadow = "0 8px 30px rgba(255,193,7,.3)"; }}
      onMouseOut={e => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "0 4px 20px rgba(255,193,7,.15)"; }}
      onError={e => { e.target.style.display = "none"; }}
    />
  </a>
);

const AdPopup = ({ onClose, countdown }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.88)", backdropFilter: "blur(12px)", animation: "fadeInUp .3s ease-out" }}>
    <div style={{ maxWidth: 380, width: "90%", textAlign: "center", padding: 20 }}>
      <div style={{ fontSize: 12, color: "#FFC107", fontWeight: 800, marginBottom: 12, letterSpacing: 2, textTransform: "uppercase" }}>⚡ Parceiro Mitou FC</div>
      <a href={AD_LINK} target="_blank" rel="noopener noreferrer">
        <img src={AD_BANNER_URL} alt="Apostou" style={{ width: "100%", borderRadius: 14, border: "2px solid rgba(255,193,7,.3)", boxShadow: "0 8px 40px rgba(255,193,7,.2)", cursor: "pointer", transition: "transform .2s" }}
          onMouseOver={e => { e.target.style.transform = "scale(1.03)"; }}
          onMouseOut={e => { e.target.style.transform = "scale(1)"; }}
          onError={e => { e.target.onerror = null; e.target.style.display = "none"; }}
        />
      </a>
      <a href={AD_LINK} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 14, background: "linear-gradient(135deg,#FFC107,#FF8F00)", border: "none", borderRadius: 12, padding: "12px 32px", color: "#0a0a0a", fontSize: 15, fontWeight: 800, textDecoration: "none", boxShadow: "0 4px 20px rgba(255,193,7,.4)", letterSpacing: .5 }}>🎁 REGISTRE-SE E GANHE</a>
      <button onClick={onClose} disabled={countdown > 0} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: countdown > 0 ? "#444" : "#888", fontSize: 13, cursor: countdown > 0 ? "default" : "pointer", fontFamily: "inherit", fontWeight: 500, opacity: countdown > 0 ? .4 : .8, transition: "opacity .3s" }}>
        {countdown > 0 ? `Gerando escalação... ${countdown}s` : "✕ Ver minha escalação"}
      </button>
    </div>
  </div>
);

// ─── GLOBAL CSS ─────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');
@keyframes float{0%{transform:translate(0,0)scale(1)}100%{transform:translate(20px,-20px)scale(1.1)}}
@keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
@keyframes slideDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(255,193,7,.2)}50%{box-shadow:0 0 40px rgba(255,193,7,.4)}}
@keyframes lockFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,193,7,.3);border-radius:10px}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;background:linear-gradient(90deg,#FFC107,#FF8F00);outline:none}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:#FFC107;cursor:pointer;box-shadow:0 0 12px rgba(255,193,7,.5)}
`;

// ─── COMPONENTS ─────────────────────────────────────────────────────────────
const Orb=({x,y,sz,c,d})=><div style={{position:"absolute",left:`${x}%`,top:`${y}%`,width:sz,height:sz,background:`radial-gradient(circle,${c}35,transparent 70%)`,borderRadius:"50%",filter:"blur(50px)",animation:`float ${6+d}s ease-in-out infinite alternate`,animationDelay:`${d}s`,pointerEvents:"none"}}/>;

const PCard=({p,clubs,sm})=>{const cl=clubs[p.clube_id];const r=p.pontos_ultimas_3.reduce((a,b)=>a+b,0)/3;return(
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:sm?2:4,animation:"fadeInUp .5s ease-out forwards"}}>
    <div style={{width:sm?42:54,height:sm?42:54,borderRadius:"50%",background:`linear-gradient(145deg,${cl?.cor||"#333"},${cl?.cor||"#333"}99)`,border:"2px solid rgba(255,255,255,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:sm?9:11,fontWeight:800,color:"#fff",textShadow:"0 1px 3px rgba(0,0,0,.6)",boxShadow:`0 4px 15px ${cl?.cor||"#333"}50`,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(255,255,255,.2),transparent 50%)"}}/><span style={{position:"relative",zIndex:1,letterSpacing:1}}>{cl?.abreviacao||"?"}</span>
    </div>
    <div style={{background:"rgba(10,22,40,.85)",backdropFilter:"blur(10px)",borderRadius:8,padding:sm?"2px 6px":"3px 8px",border:"1px solid rgba(255,193,7,.15)",textAlign:"center",minWidth:sm?58:72}}>
      <div style={{fontSize:sm?9:10,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:sm?62:82}}>{p.apelido}</div>
      <div style={{fontSize:sm?7:8,color:"#FFC107",fontWeight:700,fontFamily:"'Space Mono',monospace"}}>C${p.preco.toFixed(1)} · {r.toFixed(1)}</div>
    </div>
  </div>
)};

const Pitch=({L,clubs})=>{if(!L?.players?.length)return null;const g=L.players.filter(p=>p.posicao_id===1),l=L.players.filter(p=>p.posicao_id===2),z=L.players.filter(p=>p.posicao_id===3),m=L.players.filter(p=>p.posicao_id===4),a=L.players.filter(p=>p.posicao_id===5),t=L.players.filter(p=>p.posicao_id===6);const d=[];if(l[0])d.push(l[0]);d.push(...z);if(l[1])d.push(l[1]);const rows=[a,m,d,g],tops=["12%","36%","60%","82%"];return(
  <div style={{position:"relative",width:"100%",maxWidth:420,aspectRatio:"3/4",margin:"0 auto",background:"linear-gradient(180deg,#0d3320 0%,#145a2e 25%,#0d3320 50%,#145a2e 75%,#0d3320 100%)",borderRadius:16,overflow:"hidden",border:"2px solid rgba(255,193,7,.2)",boxShadow:"0 20px 60px rgba(0,0,0,.5),inset 0 0 80px rgba(0,0,0,.2)"}}>
    <svg viewBox="0 0 300 400" style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.12}}><rect x="10" y="10" width="280" height="380" rx="4" fill="none" stroke="white" strokeWidth="1.5"/><line x1="10" y1="200" x2="290" y2="200" stroke="white" strokeWidth="1.5"/><circle cx="150" cy="200" r="40" fill="none" stroke="white" strokeWidth="1.5"/><circle cx="150" cy="200" r="3" fill="white"/><rect x="80" y="10" width="140" height="60" fill="none" stroke="white" strokeWidth="1.5"/><rect x="80" y="330" width="140" height="60" fill="none" stroke="white" strokeWidth="1.5"/></svg>
    {rows.map((row,ri)=><div key={ri} style={{position:"absolute",left:0,right:0,top:tops[ri],display:"flex",justifyContent:"space-evenly",alignItems:"center",padding:"0 8px",transform:"translateY(-50%)"}}>{row.map(p=><PCard key={p.id} p={p} clubs={clubs} sm={row.length>3}/>)}</div>)}
    {t[0]&&<div style={{position:"absolute",bottom:6,right:10,display:"flex",alignItems:"center",gap:4,background:"rgba(10,22,40,.8)",borderRadius:8,padding:"3px 10px",border:"1px solid rgba(255,193,7,.2)"}}><span style={{fontSize:10}}>🎩</span><span style={{fontSize:10,color:"#FFC107",fontWeight:700}}>{t[0].apelido}</span></div>}
  </div>
)};

const Msg=({text,isUser})=><div style={{display:"flex",justifyContent:isUser?"flex-end":"flex-start",marginBottom:12,animation:"fadeInUp .3s ease-out"}}><div style={{maxWidth:"85%",background:isUser?"linear-gradient(135deg,#FFC107,#FFB300)":"rgba(255,255,255,.05)",color:isUser?"#0a0a0a":"#d0d0d0",borderRadius:isUser?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"12px 16px",fontSize:14,lineHeight:1.5,border:isUser?"none":"1px solid rgba(255,255,255,.07)",backdropFilter:isUser?"none":"blur(10px)",whiteSpace:"pre-wrap",fontWeight:isUser?600:400}}>{text}</div></div>;

// ═══════════════════════════════════════════════════════════════════════════
// MERCADO FECHADO
// ═══════════════════════════════════════════════════════════════════════════
function ClosedScreen({ status, onRetry }) {
  const [retrying, setRetrying] = useState(false);
  const rod = status?.rodada_atual || "?";
  const fech = fmtFechamento(status?.fechamento);
  const tesc = status?.times_escalados;
  const handleRetry = async () => { setRetrying(true); await onRetry(); setTimeout(() => setRetrying(false), 2000); };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f18", fontFamily: "'Outfit', sans-serif", color: "#e0e0e0", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <style>{CSS}</style>
      <Orb x={15} y={25} sz="350px" c="#ff5252" d={0} /><Orb x={65} y={55} sz="280px" c="#ff9800" d={2} /><Orb x={35} y={80} sz="220px" c="#B71C1C" d={4} />
      {/* Header */}
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,.06)", background: "rgba(10,15,24,.9)", backdropFilter: "blur(20px)", zIndex: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#ff5252,#B71C1C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2, color: "#ff8a80" }}>MITOU FC</div>
          <div style={{ fontSize: 9, color: "#555", fontWeight: 600, letterSpacing: 1.5, display: "flex", alignItems: "center", gap: 6 }}>
            CARTOLA FC 2026 <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff5252", display: "inline-block", animation: "pulse 2s infinite" }} /> MERCADO FECHADO
          </div>
        </div>
      </div>
      {/* Body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{ width: 90, height: 90, borderRadius: "50%", background: "rgba(255,82,82,.06)", border: "2px solid rgba(255,82,82,.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, animation: "lockFloat 3s ease-in-out infinite" }}>
          <span style={{ fontSize: 40 }}>🔒</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Bebas Neue',sans-serif", color: "#fff", letterSpacing: 3, marginBottom: 6 }}>MERCADO FECHADO</h1>
        <p style={{ fontSize: 14, color: "#777", marginBottom: 24, maxWidth: 320, lineHeight: 1.6 }}>
          Jogos da <span style={{ color: "#ff8a80", fontWeight: 700 }}>Rodada {rod}</span> em andamento.
        </p>
        <div style={{ maxWidth: 380, width: "100%", marginBottom: 24 }}>
          <div style={{ background: "rgba(255,255,255,.03)", borderRadius: "18px 18px 18px 4px", padding: "16px 20px", border: "1px solid rgba(255,255,255,.06)", textAlign: "left", lineHeight: 1.7, fontSize: 14, color: "#bbb" }}>
            <span style={{ color: "#FFC107", fontWeight: 700 }}>⚡ E aí, Cartoleiro!</span>
            {"\n\n"}O mercado está fechado. Não rola gerar escalação enquanto a bola tá rolando.
            {fech && (<>{"\n\n"}🕐 <span style={{ color: "#fff", fontWeight: 600 }}>Fechou em:</span>{"\n"}<span style={{ color: "#FFC107", fontWeight: 600 }}>{fech}</span></>)}
            {"\n\n"}📅 <span style={{ color: "#fff", fontWeight: 600 }}>Reabre:</span>{"\n"}
            <span style={{ color: "#4CAF50", fontWeight: 600 }}>Após os jogos da Rodada {rod}</span>
            {"\n"}<span style={{ fontSize: 12, color: "#555" }}>(~2-4h após o último jogo)</span>
            {"\n\n"}Cola aqui quando abrir pra mitar! 🚀
          </div>
        </div>
        {tesc && (
          <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
            <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "12px 20px", border: "1px solid rgba(255,255,255,.06)", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#555", fontWeight: 700, letterSpacing: 1.5, marginBottom: 4 }}>RODADA</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#ff8a80", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2 }}>{rod}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "12px 20px", border: "1px solid rgba(255,255,255,.06)", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#555", fontWeight: 700, letterSpacing: 1.5, marginBottom: 4 }}>ESCALADOS</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#4CAF50", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1 }}>{tesc.toLocaleString("pt-BR")}</div>
            </div>
          </div>
        )}
        <AdBanner style={{ marginBottom: 24, maxWidth: 380, width: "100%" }} />
        <button onClick={handleRetry} disabled={retrying} style={{ background: retrying ? "rgba(255,255,255,.02)" : "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "14px 28px", color: retrying ? "#555" : "#fff", fontSize: 14, fontWeight: 600, cursor: retrying ? "wait" : "pointer", transition: "all .2s", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}
          onMouseOver={e => { if(!retrying){ e.currentTarget.style.background="rgba(255,193,7,.1)"; e.currentTarget.style.borderColor="#FFC107"; e.currentTarget.style.color="#FFC107"; }}}
          onMouseOut={e => { if(!retrying){ e.currentTarget.style.background="rgba(255,255,255,.05)"; e.currentTarget.style.borderColor="rgba(255,255,255,.12)"; e.currentTarget.style.color="#fff"; }}}
        >
          {retrying ? (<><div style={{ width: 16, height: 16, border: "2px solid rgba(255,193,7,.2)", borderTopColor: "#FFC107", borderRadius: "50%", animation: "spin .8s linear infinite" }} /> Verificando...</>) : (<><span>🔄</span> Verificar se abriu</>)}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
export default function MitouFC() {
  const [appState, setAppState] = useState("loading");
  const [step, setStep] = useState("welcome");
  const [formation, setFormation] = useState(null);
  const [budget, setBudget] = useState(110);
  const [strategy, setStrategy] = useState(null);
  const [lineup, setLineup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showPitch, setShowPitch] = useState(false);
  const [budgetInput, setBudgetInput] = useState("110");
  const [showAdPopup, setShowAdPopup] = useState(false);
  const [adCountdown, setAdCountdown] = useState(0);
  const [pendingResult, setPendingResult] = useState(null);
  const [players, setPlayers] = useState([]);
  const [clubs, setClubs] = useState({});
  const [positions, setPositions] = useState({});
  const [mStatus, setMStatus] = useState(null);
  const [rodada, setRodada] = useState(null);
  const [partidas, setPartidas] = useState([]);
  const chatRef = useRef(null);

  const scroll = useCallback(() => { if (chatRef.current) setTimeout(() => { chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 50); }, []);
  const botMsg = useCallback((m, d = 600) => { setIsTyping(true); setTimeout(() => { setIsTyping(false); setMessages(p => [...p, { text: m, isUser: false }]); scroll(); }, d); }, [scroll]);
  const userMsg = useCallback((m) => { setMessages(p => [...p, { text: m, isUser: true }]); scroll(); }, [scroll]);

  // ─── LOAD ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setAppState("loading");
    try {
      const st = await apiFetch("/mercado/status");
      console.log("[MitouFC] status:", st?.status_mercado, "rodada:", st?.rodada_atual);
      if (st) {
        setMStatus(st);
        setRodada(st.rodada_atual);
        if (st.status_mercado !== MERCADO_ABERTO) { setAppState("closed"); return; }
      }
      // Market is open — fetch players
      const [mkt, par] = await Promise.all([apiFetch("/atletas/mercado"), apiFetch("/partidas")]);
      console.log("[MitouFC] atletas:", mkt?.atletas?.length || 0);
      if (mkt?.atletas?.length) {
        const pl = mkt.atletas.map(normPlayer);
        const cl = {}; if (mkt.clubes) for (const [k, v] of Object.entries(mkt.clubes)) cl[+k] = normClub(v);
        const po = {}; if (mkt.posicoes) for (const [k, v] of Object.entries(mkt.posicoes)) po[+k] = { id: v.id, nome: v.nome, abreviacao: v.abreviacao };
        setPlayers(pl); setClubs(cl); setPositions(po);
        if (par?.partidas) setPartidas(par.partidas.map(p => ({ m: cl[p.clube_casa_id]?.abreviacao || "???", v: cl[p.clube_visitante_id]?.abreviacao || "???" })));
        setStep("welcome"); setAppState("open"); return;
      }
      // Market open but couldn't load players — show error, not "closed"
      if (st && st.status_mercado === MERCADO_ABERTO) {
        console.warn("[MitouFC] Mercado aberto mas falha ao carregar jogadores");
        setAppState("error");
        return;
      }
    } catch (e) { console.warn("[MitouFC] load error:", e); }
    setAppState("closed");
    if (!mStatus) setMStatus({ rodada_atual: "?", status_mercado: 2 });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── WELCOME ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (appState === "open" && step === "welcome") {
      setTimeout(() => {
        botMsg("⚡ Fala, Cartoleiro! Bem-vindo ao Mitou FC — sua escalação inteligente pro Cartola 2026!", 300);
        setTimeout(() => { botMsg(`✅ Rodada ${rodada || "?"} · Mercado aberto · ${players.length} jogadores disponíveis`, 400);
          setTimeout(() => { botMsg("Bora montar o time dos sonhos? Escolha a formação pra começar! 🏟️", 500);
            setTimeout(() => { setStep("formation"); }, 800);
          }, 700);
        }, 500);
      }, 200);
    }
  }, [appState, step, rodada, players.length, botMsg]);

  const pickForm = (f) => { userMsg(`Formação: ${f}`); setFormation(f); setTimeout(() => { botMsg(`${f} — fechou! ✅`); setTimeout(() => { setStep("budget"); botMsg("Quanto de grana? Define o orçamento em Cartoletas:"); }, 600); }, 300); };
  const pickBudget = () => { const b = parseFloat(budgetInput) || 110; setBudget(b); userMsg(`C$ ${b.toFixed(2)}`); setTimeout(() => { botMsg(`C$ ${b.toFixed(2)} no caixa 💰`); setTimeout(() => { setStep("strategy"); botMsg("Última: qual estratégia você quer?"); }, 600); }, 300); };

  const pickStrat = (s) => { const lb = { aggressive: "⚡ Agressiva", conservative: "🛡️ Conservadora", value: "💎 Custo-Benefício", balanced: "⚖️ Equilibrada" }; setStrategy(s); userMsg(lb[s]);
    setTimeout(() => { botMsg(`Analisando ${players.length} jogadores... 🔍`); setTimeout(() => { botMsg("Otimizando escalação... 📊");
      setTimeout(() => {
        const r = optimize(players, clubs, formation, budget, s);
        setPendingResult(r);
        setAdCountdown(5);
        setShowAdPopup(true);
      }, 1200);
    }, 800); }, 300);
  };

  useEffect(() => {
    if (!showAdPopup || adCountdown <= 0) return;
    const t = setTimeout(() => setAdCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showAdPopup, adCountdown]);

  const closeAdPopup = () => {
    setShowAdPopup(false);
    if (pendingResult) {
      setLineup(pendingResult); setStep("result");
      botMsg(analysis(pendingResult, clubs));
      setTimeout(() => { setShowPitch(true); botMsg("👆 Tá aí tua escalação! Bora mitar! 🔥"); }, 600);
      setPendingResult(null);
    }
  };

  const reset = () => { setStep("formation"); setFormation(null); setBudget(110); setBudgetInput("110"); setStrategy(null); setLineup(null); setMessages([]); setShowPitch(false); setPendingResult(null); setShowAdPopup(false); setTimeout(() => botMsg("Bora de novo! Escolhe a formação:", 300), 100); };

  // ─── LOADING ───────────────────────────────────────────────────────────
  if (appState === "loading") return (
    <div style={{ minHeight: "100vh", background: "#0a0f18", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif" }}>
      <style>{CSS}</style>
      <div style={{ fontSize: 44, marginBottom: 16, animation: "glow 2s infinite" }}>⚡</div>
      <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Bebas Neue',sans-serif", color: "#FFC107", letterSpacing: 4, marginBottom: 6 }}>MITOU FC</div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 24, letterSpacing: 1 }}>Conectando ao Cartola FC...</div>
      <div style={{ width: 32, height: 32, border: "3px solid rgba(255,193,7,.15)", borderTopColor: "#FFC107", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
    </div>
  );

  if (appState === "closed") return <ClosedScreen status={mStatus} onRetry={load} />;

  if (appState === "error") return (
    <div style={{ minHeight: "100vh", background: "#0a0f18", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", padding: 24, textAlign: "center" }}>
      <style>{CSS}</style>
      <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>
      <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Bebas Neue',sans-serif", color: "#FFC107", letterSpacing: 4, marginBottom: 8 }}>MITOU FC</div>
      <div style={{ fontSize: 15, color: "#ccc", marginBottom: 8, fontWeight: 600 }}>Mercado está aberto! ✅</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 24, maxWidth: 340, lineHeight: 1.6 }}>
        Mas não conseguimos carregar os jogadores. A API do Cartola pode estar instável ou bloqueando a conexão.
      </div>
      <button onClick={load} style={{ background: "linear-gradient(135deg,#FFC107,#FFB300)", border: "none", borderRadius: 12, padding: "14px 32px", color: "#0a0a0a", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(255,193,7,.3)", fontFamily: "inherit", marginBottom: 16 }}>⚡ Tentar Novamente</button>
      <div style={{ fontSize: 11, color: "#555", maxWidth: 300, lineHeight: 1.5 }}>
        💡 Dica: a API do Cartola às vezes demora uns minutos pra estabilizar após abrir o mercado. Tente novamente em instantes.
      </div>
    </div>
  );

  // ─── OPEN ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0a0f18", fontFamily: "'Outfit',sans-serif", color: "#e0e0e0", position: "relative", overflow: "hidden" }}>
      <style>{CSS}</style>
      <Orb x={8} y={15} sz="320px" c="#FFC107" d={0} /><Orb x={72} y={55} sz="260px" c="#1565C0" d={2} /><Orb x={35} y={85} sz="200px" c="#E10600" d={4} />

      {showAdPopup && <AdPopup onClose={closeAdPopup} countdown={adCountdown} />}

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(10,15,24,.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,193,7,.08)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#FFC107,#FF8F00)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "0 4px 15px rgba(255,193,7,.25)", animation: "glow 3s infinite" }}>⚡</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 3, background: "linear-gradient(135deg,#FFC107,#FFE082)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>MITOU FC</div>
            <div style={{ fontSize: 9, color: "#555", fontWeight: 600, letterSpacing: 1.5, display: "flex", alignItems: "center", gap: 6, marginTop: -2 }}>
              ROD. {rodada||"?"} <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4CAF50", display: "inline-block" }} /> ABERTO
            </div>
          </div>
        </div>
        {step === "result" && <button onClick={reset} style={{ background: "rgba(255,193,7,.08)", border: "1px solid rgba(255,193,7,.2)", borderRadius: 10, padding: "7px 14px", color: "#FFC107", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: .5 }}>↻ Nova</button>}
      </div>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 58px)" }}>
        {showPitch && lineup && lineup.players?.length === 12 && (
          <div style={{ padding: "16px 16px 0", animation: "slideDown .6s ease-out" }}>
            <Pitch L={lineup} clubs={clubs} />
            <div style={{ margin: "12px auto 0", maxWidth: 420, background: "rgba(255,255,255,.02)", borderRadius: 12, border: "1px solid rgba(255,193,7,.1)", overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", background: "rgba(255,193,7,.05)", borderBottom: "1px solid rgba(255,193,7,.08)", display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: "#666", letterSpacing: 1, textTransform: "uppercase" }}>
                <span>Jogador</span><div style={{ display: "flex", gap: 16 }}><span style={{ width: 40, textAlign: "right" }}>Preço</span><span style={{ width: 35, textAlign: "right" }}>Média</span><span style={{ width: 40, textAlign: "right" }}>Expect.</span></div>
              </div>
              {lineup.players.sort((a, b) => a.posicao_id - b.posicao_id).map((p, i) => { const r = p.pontos_ultimas_3.reduce((a, b) => a + b, 0) / 3; const ps = positions[p.posicao_id] || MPOS[p.posicao_id]; return (
                <div key={p.id} style={{ padding: "7px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < lineup.players.length - 1 ? "1px solid rgba(255,255,255,.03)" : "none", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#777", background: "rgba(255,193,7,.08)", borderRadius: 4, padding: "2px 5px", minWidth: 26, textAlign: "center", flexShrink: 0 }}>{ps?.abreviacao || "?"}</span>
                    <span style={{ fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.apelido}</span>
                    <span style={{ fontSize: 10, color: "#444", flexShrink: 0 }}>{clubs[p.clube_id]?.abreviacao}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                    <span style={{ color: "#FFC107", fontWeight: 600, fontFamily: "'Space Mono',monospace", fontSize: 11, width: 40, textAlign: "right" }}>{p.preco.toFixed(1)}</span>
                    <span style={{ color: "#888", fontFamily: "'Space Mono',monospace", fontSize: 11, width: 35, textAlign: "right" }}>{p.media.toFixed(1)}</span>
                    <span style={{ color: r >= 5 ? "#4CAF50" : r >= 3 ? "#FFC107" : "#ff5252", fontWeight: 700, fontFamily: "'Space Mono',monospace", fontSize: 11, width: 40, textAlign: "right" }}>{r.toFixed(1)}</span>
                  </div>
                </div>
              ); })}
              <div style={{ padding: "8px 12px", background: "rgba(255,193,7,.05)", borderTop: "1px solid rgba(255,193,7,.08)", display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: "#FFC107", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 1.5, fontSize: 14 }}>TOTAL</span>
                <div style={{ display: "flex", gap: 12, fontFamily: "'Space Mono',monospace" }}><span style={{ color: "#FFC107" }}>C$ {lineup.totalCost.toFixed(1)}</span><span style={{ color: "#4CAF50" }}>{lineup.expectedPoints.toFixed(1)} pts</span></div>
              </div>
            </div>
            <AdBanner style={{ marginTop: 12, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }} />
          </div>
        )}

        {/* Chat */}
        <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px 8px" }}>
          {messages.map((m, i) => <Msg key={i} text={m.text} isUser={m.isUser} />)}
          {isTyping && <div style={{ display: "flex", gap: 5, padding: "8px 16px", background: "rgba(255,255,255,.04)", borderRadius: 18, width: "fit-content", border: "1px solid rgba(255,193,7,.1)" }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFC107", animation: `pulse 1.2s ease-in-out ${i * .2}s infinite` }} />)}</div>}
        </div>

        {/* Input */}
        <div style={{ padding: "10px 16px 16px", background: "rgba(10,15,24,.95)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,193,7,.06)" }}>
          {step === "formation" && <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, animation: "fadeInUp .4s ease-out" }}>
            {Object.keys(FORMS).map(f => <button key={f} onClick={() => pickForm(f)} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 4px", color: "#ccc", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .2s", fontFamily: "'Space Mono',monospace" }} onMouseOver={e => { e.target.style.background = "rgba(255,193,7,.1)"; e.target.style.borderColor = "#FFC107"; e.target.style.color = "#FFC107"; }} onMouseOut={e => { e.target.style.background = "rgba(255,255,255,.04)"; e.target.style.borderColor = "rgba(255,255,255,.1)"; e.target.style.color = "#ccc"; }}>{f}</button>)}
          </div>}
          {step === "budget" && <div style={{ animation: "fadeInUp .4s ease-out" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: "#FFC107", fontFamily: "'Space Mono',monospace", minWidth: 85 }}>C$ {parseFloat(budgetInput || 0).toFixed(0)}</span>
              <input type="range" min="50" max="200" step="5" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} style={{ flex: 1 }} />
            </div>
            <button onClick={pickBudget} style={{ width: "100%", background: "linear-gradient(135deg,#FFC107,#FFB300)", border: "none", borderRadius: 12, padding: "14px", color: "#0a0a0a", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(255,193,7,.3)", fontFamily: "inherit", letterSpacing: .5 }}>Confirmar Orçamento</button>
          </div>}
          {step === "strategy" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, animation: "fadeInUp .4s ease-out" }}>
            {[{ k: "aggressive", i: "⚡", l: "Agressiva", d: "Máx. mitada" }, { k: "conservative", i: "🛡️", l: "Conservadora", d: "Sem negativar" }, { k: "value", i: "💎", l: "Custo-Benefício", d: "Melhor C$/pts" }, { k: "balanced", i: "⚖️", l: "Equilibrada", d: "Risco x Retorno" }].map(s => (
              <button key={s.k} onClick={() => pickStrat(s.k)} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "14px 10px", color: "#ccc", textAlign: "center", cursor: "pointer", transition: "all .2s", fontFamily: "inherit" }}
                onMouseOver={e => { e.currentTarget.style.background = "rgba(255,193,7,.08)"; e.currentTarget.style.borderColor = "#FFC107"; }}
                onMouseOut={e => { e.currentTarget.style.background = "rgba(255,255,255,.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.1)"; }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{s.i}</div><div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{s.l}</div><div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.d}</div>
              </button>
            ))}
          </div>}
          {step === "result" && <button onClick={reset} style={{ width: "100%", background: "linear-gradient(135deg,#FFC107,#FFB300)", border: "none", borderRadius: 12, padding: "14px", color: "#0a0a0a", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(255,193,7,.3)", fontFamily: "inherit", letterSpacing: .5 }}>⚡ Nova Escalação</button>}
          {partidas.length > 0 && <div style={{ marginTop: 10, display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {partidas.slice(0, 6).map((p, i) => <div key={i} style={{ flexShrink: 0, background: "rgba(255,255,255,.03)", borderRadius: 8, padding: "5px 10px", border: "1px solid rgba(255,193,7,.06)", fontSize: 10, color: "#666", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Space Mono',monospace" }}>{p.m} × {p.v}</div>)}
          </div>}
        </div>
      </div>
    </div>
  );
}
