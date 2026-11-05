"use client";
import { useCallback, useEffect, useState } from "react";
import { WobbleLogo } from "../../components/WobbleLogo";
import { Bean } from "../../components/Bean";
import { RoomTrack } from "../../components/RoomTrack";
import { getMapMode, MAPS } from "../../lib/game";
import { getCharacter } from "../../lib/characters";
import { getRoomState, roomAction, type RoomState } from "../../lib/types";

type HostSession = { code: string; hostToken: string };
const ROUND_OPTIONS = Array.from({ length: MAPS.length }, (_, index) => index + 1);
const DEFAULT_ROUNDS = Math.min(3, MAPS.length);

export default function HostPage() {
  const [session, setSession] = useState<HostSession | null>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("PSI Rush Cup"); const [maxPlayers, setMaxPlayers] = useState(50);
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS); const [maps, setMaps] = useState<string[]>(MAPS.map(m=>m.id));

  useEffect(()=>{
    const params=new URLSearchParams(location.search);
    if(params.get("new")==="1"){
      localStorage.removeItem("wobble_host");setSession(null);setState(null);
      history.replaceState(null,"","/host");return;
    }
    const raw=localStorage.getItem("wobble_host");if(raw)try{setSession(JSON.parse(raw))}catch{localStorage.removeItem("wobble_host")}
  },[]);
  const refresh = useCallback(async()=>{
    if(!session)return; try{setState(await getRoomState(session.code,session.hostToken));setError("")}catch(e){setError(e instanceof Error?e.message:"Mất kết nối")}
  },[session]);
  useEffect(()=>{refresh();const id=setInterval(refresh,450);return()=>clearInterval(id)},[refresh]);

  async function createRoom(){
    setBusy(true);setError("");try{
      const res=await fetch("/api/rooms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title,maxPlayers,totalRounds:rounds,mapPool:maps})});
      const data=await res.json() as {code:string;hostToken:string;error?:string};if(!res.ok)throw new Error(data.error);
      const next={code:data.code,hostToken:data.hostToken};localStorage.setItem("wobble_host",JSON.stringify(next));setSession(next);
    }catch(e){setError(e instanceof Error?e.message:"Không tạo được phòng")}finally{setBusy(false)}
  }
  async function act(action:string){if(!session)return;setBusy(true);try{await roomAction(session.code,{action,hostToken:session.hostToken});await refresh()}catch(e){setError(e instanceof Error?e.message:"Lỗi")}finally{setBusy(false)}}
  function leave(){localStorage.removeItem("wobble_host");setSession(null);setState(null)}
  function createFreshRoom(){localStorage.removeItem("wobble_host");setSession(null);setState(null);setError("");history.replaceState(null,"","/host")}

  if(!session) return <main className="setup-shell">
    <header className="app-nav"><WobbleLogo compact/><span className="view-tag admin">ADMIN SETUP</span></header>
    <section className="setup-card">
      <div className="setup-intro"><span className="eyebrow">TẠO GIẢI ĐẤU MỚI</span><h1>CHỌN LUẬT<br/><em>CHO CUỘC CHƠI</em></h1><p>Host điều khiển toàn bộ trận đấu, chọn số round và theo dõi mọi người theo thời gian thực.</p></div>
      <div className="setup-form">
        <label>TÊN GIẢI ĐẤU<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={40}/></label>
        <div className="form-pair"><label>SỐ ROUND<select value={rounds} onChange={e=>setRounds(+e.target.value)}>{ROUND_OPTIONS.map(n=><option key={n} value={n}>{n} round</option>)}</select></label><label>TỐI ĐA<select value={maxPlayers} onChange={e=>setMaxPlayers(+e.target.value)}>{[20,50,100,150,200].map(n=><option key={n} value={n}>{n} người</option>)}</select></label></div>
        <label className="maps-label">MAP POOL <small>Chọn ít nhất 1 map</small></label>
        <div className="map-picker">{MAPS.map((m,i)=><button key={m.id} className={maps.includes(m.id)?"selected":""} style={{"--map":m.floor,"--accent":m.accent} as React.CSSProperties} onClick={()=>setMaps(v=>v.includes(m.id)?(v.length>1?v.filter(x=>x!==m.id):v):[...v,m.id])}><i>{maps.includes(m.id)?"✓":""}</i><b>{m.name}</b><small>{m.subtitle}</small><span>0{i+1}</span></button>)}</div>
        {error&&<p className="form-error">{error}</p>}<button className="primary-action" disabled={busy||!maps.length} onClick={createRoom}>{busy?"ĐANG TẠO...":"TẠO PHÒNG →"}</button>
      </div>
    </section>
  </main>;

  if(!state) return <main className="loading-shell"><div className="loader-bean"/><p>ĐANG MỞ PHÒNG {session.code}...</p>{error&&<button onClick={leave}>Tạo phòng khác</button>}</main>;
  const {room,players,results}=state;
  const currentResults=results.filter(r=>r.roundNumber===room.currentRound);
  const mode=getMapMode(room.currentMap);
  const ranked=[...players].sort((a,b)=>mode==="survival"&&room.status==="racing"?((a.finishPosition?1:0)-(b.finishPosition?1:0)||(a.finishPosition??0)-(b.finishPosition??0)):b.score-a.score||b.progress-a.progress);
  const joinUrl=typeof location!=="undefined"?`${location.origin}/join?room=${room.code}`:"";
  return <main className="admin-shell">
    <header className="admin-topbar"><WobbleLogo compact/><div className="admin-room"><small>ROOM CODE</small><b>{room.code}</b><button onClick={()=>navigator.clipboard.writeText(joinUrl)}>COPY LINK</button></div><div className="admin-status"><i className={room.status}/><span>ROUND {room.currentRound || 0}/{room.totalRounds}</span><b>{players.length}/{room.maxPlayers}</b><button className="icon-btn" onClick={leave}>×</button></div></header>
    {room.status==="waiting"&&<section className="admin-lobby">
      <div className="join-stage"><div className="join-copy"><span className="eyebrow">PHÒNG ĐANG MỞ</span><h2>QUÉT ĐỂ<br/><em>THAM GIA</em></h2><p>Hoặc truy cập đường link và nhập mã phòng</p><div className="giant-code">{room.code}</div></div><div className="qr-frame"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(joinUrl)}`} alt={`QR tham gia phòng ${room.code}`}/><span>SCAN ME</span></div></div>
      <aside className="lobby-roster"><div className="section-head"><div><small>PLAYERS</small><h3>ĐÃ THAM GIA</h3></div><b>{players.length}<i>/{room.maxPlayers}</i></b></div><div className="roster-grid">{players.map((p,i)=><div className="roster-player" key={p.id}><Bean characterId={p.characterId} size="sm"/><span><b>{p.name}</b><small>{p.isReady?"SẴN SÀNG":"ĐANG CHỜ"}</small></span><i>{String(i+1).padStart(2,"0")}</i></div>)}{!players.length&&<div className="empty-roster">Chưa có ai trong phòng.<br/>Hãy chiếu mã QR lên màn hình lớn!</div>}</div><button className="start-btn" disabled={!players.length||busy} onClick={()=>act("start")}>BẮT ĐẦU ROUND 1 <span>▶</span></button></aside>
    </section>}
    {room.status==="racing"&&<section className="race-admin-grid">
      <div className="spectator-panel"><div className="panel-title"><div><small>{mode==="survival"?"LIVE SPECTATOR":"LIVE RACE ORDER"}</small><h2>{mode==="survival"?"TOÀN CẢNH SINH TỒN":"TIẾN ĐỘ ĐƯỜNG ĐUA"}</h2></div><span className="live-badge"><i/> LIVE</span></div><RoomTrack players={players} mapId={room.currentMap} round={room.currentRound} startedAt={room.updatedAt}/><div className="race-actions"><button className="danger-action" disabled={busy} onClick={()=>act("endRound")}>CHỐT KẾT QUẢ ROUND</button></div></div>
      <Leaderboard players={ranked} currentResults={currentResults} title="XẾP HẠNG TRỰC TIẾP" mode={mode}/>
    </section>}
    {(room.status==="results"||room.status==="finished")&&<section className="results-admin">
      <div className="results-hero"><span className="eyebrow">{room.status==="finished"?`KẾT QUẢ SAU ${room.totalRounds} ROUND`:`KẾT QUẢ ROUND ${room.currentRound}/${room.totalRounds}`}</span><h2>{room.status==="finished"?"NHÀ VÔ ĐỊCH":"ROUND COMPLETE!"}</h2><Podium players={ranked}/><div className="result-actions">{room.status!=="finished"&&room.currentRound<room.totalRounds&&<button className="primary-action" onClick={()=>act("next")}>BẮT ĐẦU ROUND {room.currentRound+1} →</button>}{room.status==="finished"&&<><button className="secondary-action" onClick={()=>act("reset")}>CHƠI LẠI CÙNG NHÓM ↻</button><button className="primary-action" onClick={createFreshRoom}>TẠO PHÒNG MỚI ＋</button></>}</div></div>
      <Leaderboard players={ranked} currentResults={currentResults} title={room.status==="finished"?"BẢNG XẾP HẠNG CHUNG CUỘC":`TỔNG ĐIỂM SAU ROUND ${room.currentRound}`} mode={mode}/>
    </section>}
    {error&&<div className="error-toast">{error}</div>}
  </main>;
}

function Leaderboard({players,currentResults,title,mode}:{players:RoomState["players"];currentResults:RoomState["results"];title:string;mode:"race"|"survival"}){
  const points=new Map(currentResults.map(r=>[r.playerId,r.points]));
  return <aside className="leaderboard"><div className="section-head"><div><small>LEADERBOARD</small><h3>{title}</h3></div><span>PTS</span></div><div className="leader-list">{players.map((p,i)=><div className={`leader-row ${i<3?`top top-${i+1}`:""}`} key={p.id}><b className="rank-no">{i+1}</b><span className="character-dot" style={{backgroundImage:`url(${getCharacter(p.characterId).image})`}}/><div><b>{p.name}</b><small>{mode==="survival"?(p.finishPosition?`Hạng sinh tồn #${p.finishPosition}`:"● CÒN TRỤ"):p.finishPosition?`Về đích #${p.finishPosition}`:`${Math.round(p.progress)}% đường đua`}</small></div>{points.has(p.id)&&<em>+{points.get(p.id)}</em>}<strong>{p.score}</strong></div>)}</div></aside>
}
function Podium({players}:{players:RoomState["players"]}){
  const order=[players[1],players[0],players[2]];return <div className="podium">{order.map((p,i)=>p?<div className={`podium-slot place-${[2,1,3][i]}`} key={p.id}><Bean characterId={p.characterId} size={i===1?"lg":"md"} name={p.name} crown={i===1}/><div><b>#{[2,1,3][i]}</b><span>{p.score} PTS</span></div></div>:<div key={i}/>)}</div>
}
