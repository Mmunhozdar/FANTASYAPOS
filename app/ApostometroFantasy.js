'use client';

import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// APOSTÔMETRO FANTASY — Cartola FC 2026 Lineup Generator with LIVE API
// ═══════════════════════════════════════════════════════════════════════════

const MERCADO_ABERTO = 1;
const API_URLS = ["https://api.cartola.globo.com", "https://api.cartolafc.globo.com"];

// ─── API ────────────────────────────────────────────────────────────────────
async function apiFetch(path, timeout = 8000) {
  for (const base of API_URLS) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), timeout);
      const r = await fetch(`${base}${path}`, { signal: c.signal, headers: { Accept: "application/json" } });
      clearTimeout(t);
      if (r.ok) return await r.json();
    } catch (_) {}
  }
  return null;
}

// ─── NORMALIZE ──────────────────────────────────────────────────────────────
const CC = { FLA:"#B71C1C",BOT:"#1a1a1a",COR:"#1a1a1a",BAH:"#1565C0",SAO:"#B71C1C",VAS:"#1a1a1a",PAL:"#1B5E20",SAN:"#1a1a1a",GRE:"#0D47A1",CAM:"#1a1a1a",CRU:"#0D47A1",INT:"#B71C1C",JUV:"#2E7D32",VIT:"#B71C1C",CAP:"#B71C1C",GOI:"#1B5E20",SPT:"#B71C1C",MIR:"#F9A825",CEA:"#1a1a1a",FOR:"#B71C1C",FLU:"#7B1FA2",BRA:"#1B5E20",CFC:"#1B5E20",RBB:"#B71C1C",CHA:"#1B5E20",REM:"#0D47A1",CTB:"#1B5E20",COX:"#1B5E20" };
const MPOS = { 1:{id:1,nome:"Goleiro",abreviacao:"GOL"},2:{id:2,nome:"Lateral",abreviacao:"LAT"},3:{id:3,nome:"Zagueiro",abreviacao:"ZAG"},4:{id:4,nome:"Meia",abreviacao:"MEI"},5:{id:5,nome:"Atacante",abreviacao:"ATA"},6:{id:6,nome:"Técnico",abreviacao:"TEC"} };

function normPlayer(a) {
  const m = a.media_num ?? a.media ?? 0;
  return { id: a.atleta_id, apelido: a.apelido||a.nome||"?", posicao_id: a.posicao_id, clube_id: a.clube_id, preco: a.preco_num??a.preco??0, media: m, jogos: a.jogos_num??a.jogos??0, status_id: a.status_id??7, variacao: a.variacao_num??a.variacao??0, pontos_ultimas_3: [+(m*1.1).toFixed(1),+(m*0.9).toFixed(1),+(m*1.05).toFixed(1)] };
}
function normClub(c) { const a=c.abreviacao||"???"; return { id:c.id, nome:c.nome||"?", abreviacao:a, cor:CC[a]||"#555" }; }

// ─── FORMATIONS ─────────────────────────────────────────────────────────────
const FORMS = { "3-4-3":{z:3,l:0,m:4,a:3},"3-5-2":{z:3,l:0,m:5,a:2},"4-3-3":{z:2,l:2,m:3,a:3},"4-4-2":{z:2,l:2,m:4,a:2},"4-5-1":{z:2,l:2,m:5,a:1},"5-3-2":{z:3,l:2,m:3,a:2},"5-4-1":{z:3,l:2,m:4,a:1} };

// ─── OPTIMIZER ──────────────────────────────────────────────────────────────
// ALWAYS returns exactly 11 jogadores + 1 técnico = 12 players
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
    // Pass 1: best scored within budget
    for(const c of cands){if(pk>=cnt)break;const sl=REQUIRED_TOTAL-sel.length-1;const minRest=sl*3.0;if(c.preco<=rem-minRest||sl<=0){sel.push(c);rem-=c.preco;pk++;}}
    // Pass 2: force cheapest if slots still unfilled (mandatory - completing 12 is required)
    if(pk<cnt){const cheap=cands.filter(c=>!sel.find(s=>s.id===c.id)).sort((a,b)=>a.preco-b.preco);for(const c of cheap){if(pk>=cnt)break;sel.push(c);rem-=c.preco;pk++;}}
  }
  // Hard validation
  if(sel.length!==REQUIRED_TOTAL){return{players:[],formation,strategy,totalCost:0,remaining:budget,totalMedia:0,expectedPoints:0,overBudget:false,error:`Erro: ${sel.length}/12 escalados. Aumente o orçamento.`};}
  for(const[pid,cnt]of Object.entries(needs)){if(sel.filter(p=>p.posicao_id===+pid).length!==cnt){return{players:[],formation,strategy,totalCost:0,remaining:budget,totalMedia:0,expectedPoints:0,overBudget:false,error:`Erro de posição.`};}}
  const tc=sel.reduce((a,p)=>a+p.preco,0);const ep=sel.reduce((a,p)=>a+p.pontos_ultimas_3.reduce((x,y)=>x+y,0)/3,0);
  const overBudget=tc>budget;
  return{players:sel,formation,strategy,totalCost:+tc.toFixed(2),remaining:+(budget-tc).toFixed(2),totalMedia:+sel.reduce((a,p)=>a+p.media,0).toFixed(2),expectedPoints:+ep.toFixed(2),overBudget};
}

function analysis(L,clubs){
  if(!L||L.error) return L?.error||"Não foi possível gerar escalação.";
  if(!L.players?.length) return "Não foi possível gerar escalação. Tente outro orçamento.";
  const jogadores=L.players.filter(p=>p.posicao_id!==6).length;
  const tecnicos=L.players.filter(p=>p.posicao_id===6).length;
  const top=[...L.players].sort((a,b)=>(b.pontos_ultimas_3.reduce((x,y)=>x+y,0)/3)-(a.pontos_ultimas_3.reduce((x,y)=>x+y,0)/3))[0];
  const ris=[...L.players].sort((a,b)=>b.variacao-a.variacao)[0];
  const ta=top.pontos_ultimas_3.reduce((a,b)=>a+b,0)/3;const g=id=>clubs[id]?.abreviacao||"???";
  const sl={aggressive:"Agressiva 🔥",conservative:"Conservadora 🛡️",value:"Custo-Benefício 💎",balanced:"Equilibrada ⚖️"};
  const tp={aggressive:"Potencial de mitada! Risco maior.",conservative:"Consistência e segurança.",value:"Melhor custo/pontuação.",balanced:"Equilíbrio perfeito."};
  let text=`⚡ ESCALAÇÃO GERADA!\n\n📊 ${L.formation} | ${sl[L.strategy]}\n👥 ${jogadores} jogadores + ${tecnicos} técnico = ${jogadores+tecnicos} escalados\n💰 C$ ${L.totalCost.toFixed(2)}`;
  if(L.overBudget){text+=` ⚠️ (C$ ${Math.abs(L.remaining).toFixed(2)} acima do orçamento)`;}else{text+=` (Sobram C$ ${L.remaining.toFixed(2)})`;}
  text+=`\n📈 Esperado: ${L.expectedPoints.toFixed(1)} pts | Média: ${L.totalMedia.toFixed(1)} pts\n\n🔥 ${top.apelido} (${g(top.clube_id)}) — ${ta.toFixed(1)} pts/rod\n📈 ${ris.apelido} (${g(ris.clube_id)}) +C$ ${ris.variacao.toFixed(2)}\n\n💡 ${tp[L.strategy]}`;
  if(L.overBudget) text+=`\n\n⚠️ Orçamento apertado. Considere aumentar para C$ ${(L.totalCost+5).toFixed(0)}+`;
  return text;
}

// ─── DATE FORMAT ────────────────────────────────────────────────────────────
function fmtFechamento(f) {
  if(!f) return null;
  if(f.timestamp){const d=new Date(f.timestamp*1000);const ds=["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];const ms=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];return `${ds[d.getDay()]}, ${d.getDate()} de ${ms[d.getMonth()]} de ${d.getFullYear()} às ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
  if(f.dia){const ms=["","janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];return `${f.dia} de ${ms[f.mes]||f.mes} às ${String(f.hora||0).padStart(2,"0")}:${String(f.minuto||0).padStart(2,"0")}`;}
  return null;
}

// ─── GLOBAL CSS ─────────────────────────────────────────────────────────────
const CSS = `

@keyframes float{0%{transform:translate(0,0)scale(1)}100%{transform:translate(20px,-20px)scale(1.1)}}
@keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
@keyframes slideDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes p2{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes lockFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,230,118,.3);border-radius:10px}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;background:linear-gradient(90deg,#00e676,#00c853);outline:none}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:#00e676;cursor:pointer;box-shadow:0 0 10px rgba(0,230,118,.5)}
`;

// ─── COMPONENTS ─────────────────────────────────────────────────────────────
const Orb=({x,y,sz,c,d})=><div style={{position:"absolute",left:`${x}%`,top:`${y}%`,width:sz,height:sz,background:`radial-gradient(circle,${c}40,transparent 70%)`,borderRadius:"50%",filter:"blur(40px)",animation:`float ${6+d}s ease-in-out infinite alternate`,animationDelay:`${d}s`,pointerEvents:"none"}}/>;

const PCard=({p,clubs,sm})=>{const cl=clubs[p.clube_id];const r=p.pontos_ultimas_3.reduce((a,b)=>a+b,0)/3;return(
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:sm?2:4,animation:"fadeInUp .5s ease-out forwards"}}>
    <div style={{width:sm?44:56,height:sm?44:56,borderRadius:"50%",background:`linear-gradient(135deg,${cl?.cor||"#333"},${cl?.cor||"#333"}88)`,border:"2px solid rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:sm?10:12,fontWeight:800,color:"#fff",textShadow:"0 1px 3px rgba(0,0,0,.5)",boxShadow:`0 4px 15px ${cl?.cor||"#333"}60`,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(255,255,255,.15),transparent 60%)"}}/><span style={{position:"relative",zIndex:1}}>{cl?.abreviacao||"?"}</span>
    </div>
    <div style={{background:"rgba(0,0,0,.7)",backdropFilter:"blur(10px)",borderRadius:8,padding:sm?"2px 6px":"3px 8px",border:"1px solid rgba(255,255,255,.1)",textAlign:"center",minWidth:sm?60:75}}>
      <div style={{fontSize:sm?9:11,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:sm?65:85}}>{p.apelido}</div>
      <div style={{fontSize:sm?8:9,color:"#00e676",fontWeight:600}}>C$ {p.preco.toFixed(1)} · {r.toFixed(1)}pts</div>
    </div>
  </div>
)};

const Pitch=({L,clubs})=>{if(!L?.players?.length)return null;const g=L.players.filter(p=>p.posicao_id===1),l=L.players.filter(p=>p.posicao_id===2),z=L.players.filter(p=>p.posicao_id===3),m=L.players.filter(p=>p.posicao_id===4),a=L.players.filter(p=>p.posicao_id===5),t=L.players.filter(p=>p.posicao_id===6);const d=[];if(l[0])d.push(l[0]);d.push(...z);if(l[1])d.push(l[1]);const rows=[a,m,d,g],tops=["12%","36%","60%","82%"];return(
  <div style={{position:"relative",width:"100%",maxWidth:420,aspectRatio:"3/4",margin:"0 auto",background:"linear-gradient(180deg,#1a472a 0%,#1a5c30 25%,#1a472a 50%,#1a5c30 75%,#1a472a 100%)",borderRadius:16,overflow:"hidden",border:"2px solid rgba(255,255,255,.1)",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
    <svg viewBox="0 0 300 400" style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.15}}><rect x="10" y="10" width="280" height="380" rx="4" fill="none" stroke="white" strokeWidth="1.5"/><line x1="10" y1="200" x2="290" y2="200" stroke="white" strokeWidth="1.5"/><circle cx="150" cy="200" r="40" fill="none" stroke="white" strokeWidth="1.5"/><circle cx="150" cy="200" r="3" fill="white"/><rect x="80" y="10" width="140" height="60" fill="none" stroke="white" strokeWidth="1.5"/><rect x="80" y="330" width="140" height="60" fill="none" stroke="white" strokeWidth="1.5"/></svg>
    {rows.map((row,ri)=><div key={ri} style={{position:"absolute",left:0,right:0,top:tops[ri],display:"flex",justifyContent:"space-evenly",alignItems:"center",padding:"0 8px",transform:"translateY(-50%)"}}>{row.map(p=><PCard key={p.id} p={p} clubs={clubs} sm={row.length>3}/>)}</div>)}
    {t[0]&&<div style={{position:"absolute",bottom:6,right:10,display:"flex",alignItems:"center",gap:4,background:"rgba(0,0,0,.6)",borderRadius:8,padding:"3px 8px",border:"1px solid rgba(255,255,255,.1)"}}><span style={{fontSize:10}}>🎩</span><span style={{fontSize:10,color:"#fff",fontWeight:600}}>{t[0].apelido}</span></div>}
  </div>
)};

const Msg=({text,isUser})=><div style={{display:"flex",justifyContent:isUser?"flex-end":"flex-start",marginBottom:12,animation:"fadeInUp .3s ease-out"}}><div style={{maxWidth:"85%",background:isUser?"linear-gradient(135deg,#00e676,#00c853)":"rgba(255,255,255,.06)",color:isUser?"#0a0a0a":"#e0e0e0",borderRadius:isUser?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"12px 16px",fontSize:14,lineHeight:1.5,border:isUser?"none":"1px solid rgba(255,255,255,.08)",backdropFilter:isUser?"none":"blur(10px)",whiteSpace:"pre-wrap",fontWeight:isUser?500:400}}>{text}</div></div>;

// ═══════════════════════════════════════════════════════════════════════════
// MERCADO FECHADO SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function ClosedScreen({ status, onRetry }) {
  const [retrying, setRetrying] = useState(false);
  const rod = status?.rodada_atual || "?";
  const fech = fmtFechamento(status?.fechamento);
  const tesc = status?.times_escalados;

  const handleRetry = async () => {
    setRetrying(true);
    await onRetry();
    // If still on this screen after retry, stop spinner
    setTimeout(() => setRetrying(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050a0f", fontFamily: "'Outfit', sans-serif", color: "#e0e0e0", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <style>{CSS}</style>
      <Orb x={15} y={25} sz="350px" c="#ff5252" d={0} />
      <Orb x={65} y={55} sz="280px" c="#ff9800" d={2} />
      <Orb x={35} y={80} sz="220px" c="#B71C1C" d={4} />

      {/* Header */}
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,.06)", background: "rgba(5,10,15,.85)", backdropFilter: "blur(20px)", zIndex: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#ff5252,#B71C1C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 4px 15px rgba(255,82,82,.3)" }}>⚽</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, background: "linear-gradient(135deg,#ff5252,#ff8a80)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Apostômetro Fantasy</div>
          <div style={{ fontSize: 10, color: "#666", fontWeight: 500, letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}>
            CARTOLA FC 2026 <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff5252", display: "inline-block", animation: "p2 2s infinite" }} /> MERCADO FECHADO
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", textAlign: "center", position: "relative", zIndex: 1 }}>

        {/* Lock */}
        <div style={{ width: 96, height: 96, borderRadius: "50%", background: "rgba(255,82,82,.08)", border: "2px solid rgba(255,82,82,.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, animation: "lockFloat 3s ease-in-out infinite", boxShadow: "0 0 50px rgba(255,82,82,.1)" }}>
          <span style={{ fontSize: 42 }}>🔒</span>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Mercado Fechado</h1>
        <p style={{ fontSize: 14, color: "#888", marginBottom: 24, maxWidth: 320, lineHeight: 1.6 }}>
          Os jogos da <span style={{ color: "#ff8a80", fontWeight: 700 }}>Rodada {rod}</span> estão em andamento.
        </p>

        {/* Chat-style message */}
        <div style={{ maxWidth: 380, width: "100%", marginBottom: 24 }}>
          <div style={{ background: "rgba(255,255,255,.04)", borderRadius: "18px 18px 18px 4px", padding: "16px 20px", border: "1px solid rgba(255,255,255,.08)", textAlign: "left", lineHeight: 1.7, fontSize: 14, color: "#ccc" }}>
            <span style={{ color: "#ff8a80", fontWeight: 700 }}>⚽ Opa, Cartoleiro!</span>
            {"\n\n"}O mercado do Cartola FC está fechado no momento. Não é possível gerar escalações enquanto os jogos estão rolando.
            {fech && (
              <>
                {"\n\n"}🕐 <span style={{ color: "#fff", fontWeight: 600 }}>Fechou em:</span>{"\n"}
                <span style={{ color: "#ffd54f", fontWeight: 600 }}>{fech}</span>
              </>
            )}
            {"\n\n"}📅 <span style={{ color: "#fff", fontWeight: 600 }}>Reabertura:</span>{"\n"}
            <span style={{ color: "#00e676", fontWeight: 600 }}>
              Após o encerramento dos jogos da Rodada {rod}
            </span>
            {"\n"}
            <span style={{ fontSize: 12, color: "#666" }}>(geralmente 2-4h após o último jogo)</span>
            {"\n\n"}Volte quando o mercado reabrir para gerar escalações com dados atualizados! 🚀
          </div>
        </div>

        {/* Stats */}
        {tesc && (
          <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
            <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "12px 20px", border: "1px solid rgba(255,255,255,.06)", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#666", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>RODADA</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#ff8a80", fontFamily: "'Space Mono', monospace" }}>{rod}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "12px 20px", border: "1px solid rgba(255,255,255,.06)", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#666", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>ESCALADOS</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#00e676", fontFamily: "'Space Mono', monospace" }}>{tesc.toLocaleString("pt-BR")}</div>
            </div>
          </div>
        )}

        {/* Retry */}
        <button onClick={handleRetry} disabled={retrying} style={{ background: retrying ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "14px 28px", color: retrying ? "#666" : "#fff", fontSize: 14, fontWeight: 600, cursor: retrying ? "wait" : "pointer", transition: "all .2s", display: "flex", alignItems: "center", gap: 8 }}
          onMouseOver={(e) => { if(!retrying){ e.currentTarget.style.background="rgba(0,230,118,.12)"; e.currentTarget.style.borderColor="#00e676"; e.currentTarget.style.color="#00e676"; }}}
          onMouseOut={(e) => { if(!retrying){ e.currentTarget.style.background="rgba(255,255,255,.06)"; e.currentTarget.style.borderColor="rgba(255,255,255,.15)"; e.currentTarget.style.color="#fff"; }}}
        >
          {retrying ? (
            <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.2)", borderTopColor: "#00e676", borderRadius: "50%", animation: "spin .8s linear infinite" }} /> Verificando...</>
          ) : (
            <><span>🔄</span> Verificar se o mercado abriu</>
          )}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
export default function ApostometroFantasy() {
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
      if (st) { setMStatus(st); setRodada(st.rodada_atual); if (st.status_mercado !== MERCADO_ABERTO) { setAppState("closed"); return; } }
      const [mkt, par] = await Promise.all([apiFetch("/atletas/mercado"), apiFetch("/partidas")]);
      if (mkt?.atletas?.length) {
        const pl = mkt.atletas.map(normPlayer);
        const cl = {}; if (mkt.clubes) for (const [k, v] of Object.entries(mkt.clubes)) cl[+k] = normClub(v);
        const po = {}; if (mkt.posicoes) for (const [k, v] of Object.entries(mkt.posicoes)) po[+k] = { id: v.id, nome: v.nome, abreviacao: v.abreviacao };
        setPlayers(pl); setClubs(cl); setPositions(po);
        if (par?.partidas) setPartidas(par.partidas.map(p => ({ m: cl[p.clube_casa_id]?.abreviacao || "???", v: cl[p.clube_visitante_id]?.abreviacao || "???" })));
        setStep("welcome"); setAppState("open"); return;
      }
      if (st?.status_mercado !== MERCADO_ABERTO) { setAppState("closed"); return; }
    } catch (e) { console.warn(e); }
    setAppState("closed");
    if (!mStatus) setMStatus({ rodada_atual: "?", status_mercado: 2 });
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── WELCOME ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (appState === "open" && step === "welcome") {
      setTimeout(() => {
        botMsg("⚽ Fala, Cartoleiro! Eu sou o Apostômetro Fantasy — IA para escalação do Cartola FC 2026!", 300);
        setTimeout(() => { botMsg(`✅ Mercado aberto! Rodada ${rodada || "?"} | ${players.length} jogadores`, 400);
          setTimeout(() => { botMsg("Vou montar o time ideal no seu orçamento. 🧠💰", 500);
            setTimeout(() => { setStep("formation"); botMsg("Qual formação?", 400); }, 1000);
          }, 800);
        }, 600);
      }, 200);
    }
  }, [appState, step, rodada, players.length, botMsg]);

  const pickForm = (f) => { userMsg(`Formação: ${f}`); setFormation(f); setTimeout(() => { botMsg(`${f} ✅`); setTimeout(() => { setStep("budget"); botMsg("Orçamento (C$)?"); }, 600); }, 300); };
  const pickBudget = () => { const b = parseFloat(budgetInput) || 110; setBudget(b); userMsg(`C$ ${b.toFixed(2)}`); setTimeout(() => { botMsg(`C$ ${b.toFixed(2)} 💰`); setTimeout(() => { setStep("strategy"); botMsg("Estratégia?"); }, 600); }, 300); };
  const pickStrat = (s) => { const lb = { aggressive: "🔥 Agressiva", conservative: "🛡️ Conservadora", value: "💎 Custo-Benefício", balanced: "⚖️ Equilibrada" }; setStrategy(s); userMsg(lb[s]);
    setTimeout(() => { botMsg(`Analisando ${players.length} jogadores... 🔍`); setTimeout(() => { botMsg("Otimizando... 📊");
      setTimeout(() => { const r = optimize(players, clubs, formation, budget, s); setLineup(r); setStep("result"); botMsg(analysis(r, clubs)); setTimeout(() => { setShowPitch(true); botMsg("👆 Escalação acima!"); }, 600); }, 1200);
    }, 800); }, 300);
  };
  const reset = () => { setStep("formation"); setFormation(null); setBudget(110); setBudgetInput("110"); setStrategy(null); setLineup(null); setMessages([]); setShowPitch(false); setTimeout(() => botMsg("Nova escalação! Formação?", 300), 100); };

  if (appState === "loading") return (
    <div style={{ minHeight: "100vh", background: "#050a0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif" }}>
      <style>{CSS}</style>
      <div style={{ fontSize: 48, marginBottom: 20, animation: "p2 1.5s infinite" }}>⚽</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#00e676", marginBottom: 8 }}>Apostômetro Fantasy</div>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>Conectando à API do Cartola FC...</div>
      <div style={{ width: 32, height: 32, border: "3px solid rgba(0,230,118,.2)", borderTopColor: "#00e676", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
    </div>
  );

  if (appState === "closed") return <ClosedScreen status={mStatus} onRetry={load} />;

  // ─── OPEN ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#050a0f", fontFamily: "'Outfit','DM Sans',sans-serif", color: "#e0e0e0", position: "relative", overflow: "hidden" }}>
      <style>{CSS}</style>
      <Orb x={10} y={20} sz="300px" c="#00e676" d={0} /><Orb x={70} y={60} sz="250px" c="#2979ff" d={2} /><Orb x={40} y={80} sz="200px" c="#ffd54f" d={4} />

      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(5,10,15,.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,.06)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#00e676,#00c853)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 4px 15px rgba(0,230,118,.3)" }}>⚽</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, background: "linear-gradient(135deg,#00e676,#69f0ae)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Apostômetro Fantasy</div>
            <div style={{ fontSize: 10, color: "#666", fontWeight: 500, letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}>RODADA {rodada||"?"} <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e676", display: "inline-block" }} /> MERCADO ABERTO</div>
          </div>
        </div>
        {step === "result" && <button onClick={reset} style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: "8px 14px", color: "#00e676", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↻ Nova</button>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 65px)" }}>
        {showPitch && lineup && lineup.players?.length===12 && (
          <div style={{ padding: "16px 16px 0", animation: "slideDown .6s ease-out" }}>
            <Pitch L={lineup} clubs={clubs} />
            <div style={{ margin: "12px auto 0", maxWidth: 420, background: "rgba(255,255,255,.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,.06)", overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", background: "rgba(0,230,118,.08)", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: "#888", letterSpacing: 1, textTransform: "uppercase" }}>
                <span>Jogador</span><div style={{ display: "flex", gap: 16 }}><span style={{ width: 40, textAlign: "right" }}>Preço</span><span style={{ width: 35, textAlign: "right" }}>Média</span><span style={{ width: 40, textAlign: "right" }}>Expect.</span></div>
              </div>
              {lineup.players.sort((a, b) => a.posicao_id - b.posicao_id).map((p, i) => { const r = p.pontos_ultimas_3.reduce((a, b) => a + b, 0) / 3; const ps = positions[p.posicao_id] || MPOS[p.posicao_id]; return (
                <div key={p.id} style={{ padding: "7px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < lineup.players.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#888", background: "rgba(255,255,255,.06)", borderRadius: 4, padding: "2px 4px", minWidth: 26, textAlign: "center", flexShrink: 0 }}>{ps?.abreviacao || "?"}</span>
                    <span style={{ fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.apelido}</span>
                    <span style={{ fontSize: 10, color: "#555", flexShrink: 0 }}>{clubs[p.clube_id]?.abreviacao}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                    <span style={{ color: "#ffd54f", fontWeight: 600, fontFamily: "'Space Mono',monospace", fontSize: 11, width: 40, textAlign: "right" }}>{p.preco.toFixed(1)}</span>
                    <span style={{ color: "#aaa", fontFamily: "'Space Mono',monospace", fontSize: 11, width: 35, textAlign: "right" }}>{p.media.toFixed(1)}</span>
                    <span style={{ color: r >= 5 ? "#00e676" : r >= 3 ? "#ffd54f" : "#ff5252", fontWeight: 700, fontFamily: "'Space Mono',monospace", fontSize: 11, width: 40, textAlign: "right" }}>{r.toFixed(1)}</span>
                  </div>
                </div>
              ); })}
              <div style={{ padding: "8px 12px", background: "rgba(0,230,118,.06)", borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: "#00e676" }}>TOTAL</span>
                <div style={{ display: "flex", gap: 12, fontFamily: "'Space Mono',monospace" }}><span style={{ color: "#ffd54f" }}>C$ {lineup.totalCost.toFixed(1)}</span><span style={{ color: "#00e676" }}>{lineup.expectedPoints.toFixed(1)} pts</span></div>
              </div>
            </div>
          </div>
        )}

        <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px 8px" }}>
          {messages.map((m, i) => <Msg key={i} text={m.text} isUser={m.isUser} />)}
          {isTyping && <div style={{ display: "flex", gap: 5, padding: "8px 16px", background: "rgba(255,255,255,.06)", borderRadius: 18, width: "fit-content", border: "1px solid rgba(255,255,255,.08)" }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#00e676", animation: `pulse 1.2s ease-in-out ${i * .2}s infinite` }} />)}</div>}
        </div>

        <div style={{ padding: "10px 16px 16px", background: "rgba(5,10,15,.9)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,.06)" }}>
          {step === "formation" && <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, animation: "fadeInUp .4s ease-out" }}>
            {Object.keys(FORMS).map(f => <button key={f} onClick={() => pickForm(f)} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 4px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .2s", fontFamily: "'Space Mono',monospace" }} onMouseOver={e => { e.target.style.background = "rgba(0,230,118,.15)"; e.target.style.borderColor = "#00e676"; e.target.style.color = "#00e676"; }} onMouseOut={e => { e.target.style.background = "rgba(255,255,255,.06)"; e.target.style.borderColor = "rgba(255,255,255,.12)"; e.target.style.color = "#fff"; }}>{f}</button>)}
          </div>}
          {step === "budget" && <div style={{ animation: "fadeInUp .4s ease-out" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: "#ffd54f", fontFamily: "'Space Mono',monospace", minWidth: 85 }}>C$ {parseFloat(budgetInput || 0).toFixed(0)}</span>
              <input type="range" min="50" max="200" step="5" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} style={{ flex: 1 }} />
            </div>
            <button onClick={pickBudget} style={{ width: "100%", background: "linear-gradient(135deg,#00e676,#00c853)", border: "none", borderRadius: 12, padding: "14px", color: "#0a0a0a", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(0,230,118,.3)" }}>Confirmar Orçamento</button>
          </div>}
          {step === "strategy" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, animation: "fadeInUp .4s ease-out" }}>
            {[{ k: "aggressive", i: "🔥", l: "Agressiva", d: "Máx. pontuação" }, { k: "conservative", i: "🛡️", l: "Conservadora", d: "Mín. risco" }, { k: "value", i: "💎", l: "Custo-Benefício", d: "Melhor C$/pts" }, { k: "balanced", i: "⚖️", l: "Equilibrada", d: "Risco x Retorno" }].map(s => (
              <button key={s.k} onClick={() => pickStrat(s.k)} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "14px 10px", color: "#fff", textAlign: "center", cursor: "pointer", transition: "all .2s" }}
                onMouseOver={e => { e.currentTarget.style.background = "rgba(0,230,118,.12)"; e.currentTarget.style.borderColor = "#00e676"; }}
                onMouseOut={e => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.12)"; }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{s.i}</div><div style={{ fontSize: 13, fontWeight: 700 }}>{s.l}</div><div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{s.d}</div>
              </button>
            ))}
          </div>}
          {step === "result" && <button onClick={reset} style={{ width: "100%", background: "linear-gradient(135deg,#00e676,#00c853)", border: "none", borderRadius: 12, padding: "14px", color: "#0a0a0a", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(0,230,118,.3)" }}>⚽ Nova Escalação</button>}
          {partidas.length > 0 && <div style={{ marginTop: 10, display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {partidas.slice(0, 6).map((p, i) => <div key={i} style={{ flexShrink: 0, background: "rgba(255,255,255,.04)", borderRadius: 8, padding: "5px 10px", border: "1px solid rgba(255,255,255,.06)", fontSize: 10, color: "#888", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Space Mono',monospace" }}>{p.m} × {p.v}</div>)}
          </div>}
        </div>
      </div>
    </div>
  );
}
