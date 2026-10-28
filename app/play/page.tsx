"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bean } from "../../components/Bean";
import { RaceGame } from "../../components/RaceGame";
import { WobbleLogo } from "../../components/WobbleLogo";
import { getMapMode } from "../../lib/game";
import { getRoomState, roomAction, type RoomState } from "../../lib/types";

type PlayerSession={playerId:string;playerToken:string;roomCode:string};
export default function PlayPage(){
  const router=useRouter();const [code,setCode]=useState("");const [session,setSession]=useState<PlayerSession|null>(null);const [state,setState]=useState<RoomState|null>(null);const [error,setError]=useState("");const [finish,setFinish]=useState<{position:number;points:number}|null>(null);
  useEffect(()=>{const c=new URLSearchParams(location.search).get("room")?.toUpperCase()||"";setCode(c);const raw=localStorage.getItem(`wobble_player_${c}`);if(!raw){router.replace(`/join?room=${c}`);return}try{setSession(JSON.parse(raw))}catch{router.replace(`/join?room=${c}`)}},[router]);
  const refresh=useCallback(async()=>{if(!code)return;try{setState(await getRoomState(code));setError("")}catch(e){setError(e instanceof Error?e.message:"Mất kết nối")}},[code]);
  useEffect(()=>{refresh();const id=setInterval(refresh,650);return()=>clearInterval(id)},[refresh]);
  const me=useMemo(()=>state?.players.find(p=>p.id===session?.playerId),[state,session]);
  const sendProgress=useCallback((progress:number,positionX:number)=>{if(!session)return;roomAction(code,{action:"progress",playerId:session.playerId,playerToken:session.playerToken,progress,positionX}).catch(()=>{})},[code,session]);
  const sendFinish=useCallback(async(timeMs:number)=>{if(!session)return;try{const result=await roomAction<{position:number;points:number}>(code,{action:"finish",playerId:session.playerId,playerToken:session.playerToken,timeMs});setFinish(result);await refresh()}catch(e){setError(e instanceof Error?e.message:"Không ghi được kết quả")}},[code,session,refresh]);
  const sendEliminate=useCallback(async(timeMs:number)=>{if(!session)return;try{const result=await roomAction<{position:number;points:number}>(code,{action:"eliminate",playerId:session.playerId,playerToken:session.playerToken,timeMs});setFinish(result);await refresh()}catch(e){setError(e instanceof Error?e.message:"Không ghi được thứ hạng sinh tồn")}},[code,session,refresh]);
  useEffect(()=>{setFinish(null)},[state?.room.currentRound]);
  if(!state||!me)return <main className="loading-shell"><div className="loader-bean"/><p>{error||"ĐANG KẾT NỐI VÀO PHÒNG..."}</p></main>;
  if(state.room.status==="waiting")return <main className="player-wait"><header className="app-nav"><WobbleLogo compact/><span className="room-mini">ROOM <b>{code}</b></span></header><section><span className="eyebrow">BẠN ĐÃ VÀO PHÒNG!</span><h1>CHỜ HOST<br/><em>BẮT ĐẦU...</em></h1><Bean color={me.color} name={me.name} size="lg"/><button className={me.isReady?"ready-btn active":"ready-btn"} onClick={async()=>{if(!session)return;await roomAction(code,{action:"ready",ready:!me.isReady,playerId:session.playerId,playerToken:session.playerToken});refresh()}}>{me.isReady?"✓ ĐÃ SẴN SÀNG":"TÔI SẴN SÀNG!"}</button><p>{state.players.length}/{state.room.maxPlayers} tay đua đã tham gia</p></section></main>;
  const mode=getMapMode(state.room.currentMap);
  if(state.room.status==="racing"&&!finish&&!me.finishPosition)return <main className="play-shell"><RaceGame key={`${state.room.currentRound}-${state.room.currentMap}`} me={me} players={state.players} mapId={state.room.currentMap} round={state.room.currentRound} startedAt={state.room.updatedAt} onProgress={sendProgress} onFinish={sendFinish} onEliminate={sendEliminate}/></main>;
  const ranked=[...state.players].sort((a,b)=>b.score-a.score);const myRank=ranked.findIndex(p=>p.id===me.id)+1;
  const roundResult=state.results.find(result=>result.roundNumber===state.room.currentRound&&result.playerId===me.id);
  const roundPosition=finish?.position??roundResult?.position??me.finishPosition;
  const roundPoints=finish?.points??roundResult?.points??0;
  return <main className="player-result"><div className="result-rays"/><header className="app-nav"><WobbleLogo compact/><span className="room-mini">ROUND {state.room.currentRound}/{state.room.totalRounds}</span></header><section>{state.room.status==="finished"?<><span className="eyebrow">FINAL LEADERBOARD</span><h1>GIẢI ĐẤU<br/><em>KẾT THÚC!</em></h1><div className="final-rank">#{myRank}</div><h2>{me.name}</h2><p>Tổng điểm: <b>{me.score} PTS</b></p></>:<><span className="eyebrow">{mode==="survival"?(roundPosition===1?"SỐNG SÓT CUỐI CÙNG!":"ĐÃ BỊ LOẠI"):"ĐÃ VỀ ĐÍCH!"}</span><h1>HẠNG <em>#{roundPosition}</em></h1><Bean color={me.color} name={me.name} size="lg" crown={roundPosition===1}/><div className="points-earned">+{roundPoints} PTS</div><p>Chờ host chốt kết quả hoặc bắt đầu round tiếp theo...</p></>}</section></main>;
}
