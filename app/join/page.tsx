"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bean } from "../../components/Bean";
import { WobbleLogo } from "../../components/WobbleLogo";
import { COLORS } from "../../lib/game";
import { roomAction } from "../../lib/types";

export default function JoinPage(){
  const router=useRouter();const [code,setCode]=useState("");const [name,setName]=useState("");const [color,setColor]=useState(COLORS[0]);const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{setCode(new URLSearchParams(location.search).get("room")?.toUpperCase()||"")},[]);
  async function join(){setBusy(true);setError("");try{const data=await roomAction(code,{action:"join",name,color});localStorage.setItem(`wobble_player_${code}`,JSON.stringify(data));router.push(`/play?room=${code}`)}catch(e){setError(e instanceof Error?e.message:"Không thể tham gia")}finally{setBusy(false)}}
  return <main className="join-shell"><header className="app-nav"><WobbleLogo compact/><span className="view-tag player">PLAYER JOIN</span></header><section className="join-card"><div className="join-character"><div className="spotlight"/><Bean color={color} size="lg" name={name||"Tay đua"}/><span>CHỌN MÀU NHÂN VẬT</span><div className="color-row">{COLORS.map(c=><button key={c} className={c===color?"selected":""} style={{background:c}} onClick={()=>setColor(c)}/>)}</div></div><div className="join-form"><span className="eyebrow">SẴN SÀNG CHƯA?</span><h1>VÀO<br/><em>ĐƯỜNG ĐUA!</em></h1><label>MÃ PHÒNG<input value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6))} placeholder="ABC123"/></label><label>TÊN HIỂN THỊ<input value={name} onChange={e=>setName(e.target.value.slice(0,16))} placeholder="Nhập tên của bạn"/></label>{error&&<p className="form-error">{error}</p>}<button className="primary-action" disabled={busy||code.length<6||!name.trim()} onClick={join}>{busy?"ĐANG VÀO PHÒNG...":"THAM GIA NGAY →"}</button><p className="join-note">Tên của bạn sẽ hiển thị phía trên nhân vật trong suốt cuộc đua.</p></div></section></main>
}
