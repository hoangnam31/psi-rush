"use client";
import { useEffect, useRef, useState } from "react";
import { MAPS } from "../lib/game";
import type { Player } from "../lib/types";

type Props = { me: Player; players: Player[]; mapId: string | null; round: number; onProgress: (value:number)=>void; onFinish:(timeMs:number)=>void };
type Obstacle = { x:number;y:number;w:number;h:number;kind:"block"|"pad";color:string };
type Spinner = { x:number;y:number;len:number;speed:number;phase:number;color:string };

const COURSE=10000, CW=1100;
function mapSeed(id:string){return [...id].reduce((a,c)=>a+c.charCodeAt(0),0)}
function buildCourse(id:string){
  const seed=mapSeed(id), colors=["#ff3d9a","#ffe14a","#35dcff","#b6f43b"];
  const blocks:Obstacle[]=[],spinners:Spinner[]=[];
  for(let zone=1;zone<=11;zone++){
    const y=zone*790+(seed*zone)%170, type=(zone+seed)%3;
    if(type===0){const gap=170+(seed*zone*13)%600;blocks.push({x:0,y,w:gap,h:105,kind:"block",color:colors[zone%4]},{x:gap+200,y,w:CW-gap-200,h:105,kind:"block",color:colors[zone%4]});}
    else if(type===1){spinners.push({x:260+(zone%2)*570,y,len:260+(seed+zone)%110,speed:(zone%2?1:-1)*(1.5+(zone%4)*.35),phase:zone,color:colors[zone%4]});}
    else {blocks.push({x:80+(zone*137)%530,y,w:300,h:92,kind:"block",color:colors[zone%4]},{x:430+(zone*91)%350,y:y+220,w:250,h:92,kind:"block",color:colors[(zone+1)%4]});}
    if(zone%3===0)blocks.push({x:430,y:y+360,w:180,h:100,kind:"pad",color:"#b6f43b"});
  }
  return {blocks,spinners};
}

export function RaceGame({me,players,mapId,round,onProgress,onFinish}:Props){
  const canvasRef=useRef<HTMLCanvasElement>(null), progressCb=useRef(onProgress), finishCb=useRef(onFinish);
  const playersRef=useRef(players);
  const input=useRef({x:0,y:0,jump:false,dash:false}); const [countdown,setCountdown]=useState("3"); const [dash,setDash]=useState(100); const [elapsed,setElapsed]=useState(0);
  const map=MAPS.find(m=>m.id===mapId)??MAPS[0];
  useEffect(()=>{progressCb.current=onProgress;finishCb.current=onFinish},[onProgress,onFinish]);
  useEffect(()=>{playersRef.current=players},[players]);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d")!;let raf=0,last=performance.now(),start=0,lastSync=0,readyAt=performance.now()+3000,finished=false;
    const p={x:CW/2,y:80,vx:0,vy:0,z:0,vz:0,stun:0,dashCd:0,dashTime:0};const {blocks,spinners}=buildCourse(map.id);
    const keys:Record<string,boolean>={};
    const down=(e:KeyboardEvent)=>{keys[e.key.toLowerCase()]=true;if(e.code==="Space")input.current.jump=true;if(e.key==="Shift")input.current.dash=true};
    const up=(e:KeyboardEvent)=>{keys[e.key.toLowerCase()]=false};addEventListener("keydown",down);addEventListener("keyup",up);
    function resize(){const d=Math.min(devicePixelRatio,2),r=canvas!.getBoundingClientRect();canvas!.width=r.width*d;canvas!.height=r.height*d;ctx.setTransform(d,0,0,d,0,0)}resize();addEventListener("resize",resize);
    function rectHit(o:Obstacle,ox:number,oy:number){if(o.kind==="pad")return false;const nx=Math.max(o.x,Math.min(p.x,o.x+o.w)),ny=Math.max(o.y,Math.min(p.y,o.y+o.h));if((p.x-nx)**2+(p.y-ny)**2<38**2&&p.z<52){p.x=ox;p.y=oy;p.vx*=-.2;p.vy=-120;p.stun=.18;return true}return false}
    function segDist(px:number,py:number,x1:number,y1:number,x2:number,y2:number){const dx=x2-x1,dy=y2-y1,l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l));return Math.hypot(px-(x1+t*dx),py-(y1+t*dy))}
    function update(dt:number,now:number){
      const remain=readyAt-now;if(remain>0){setCountdown(String(Math.ceil(remain/1000)));return}if(!start){start=now;setCountdown("GO!");setTimeout(()=>setCountdown(""),500)}
      const ox=p.x,oy=p.y;p.stun=Math.max(0,p.stun-dt);p.dashCd=Math.max(0,p.dashCd-dt);p.dashTime=Math.max(0,p.dashTime-dt);
      let ix=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+input.current.x;let iy=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0)+input.current.y;const len=Math.hypot(ix,iy);if(len>1){ix/=len;iy/=len}
      if(input.current.jump&&p.z<=1){p.vz=650}input.current.jump=false;if(input.current.dash&&p.dashCd<=0){p.dashTime=.35;p.dashCd=3}input.current.dash=false;
      const control=p.stun>0?.12:1,acc=1250*control,max=p.dashTime>0?850:(map.id==="ice"?410:355);p.vx+=ix*acc*dt;p.vy+=iy*acc*dt;const friction=Math.pow(map.id==="ice"?.34:.055,dt);p.vx*=friction;p.vy*=friction;const speed=Math.hypot(p.vx,p.vy);if(speed>max){p.vx=p.vx/speed*max;p.vy=p.vy/speed*max}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vz-=1450*dt;p.z+=p.vz*dt;if(p.z<0){p.z=0;p.vz=0}
      p.x=Math.max(35,Math.min(CW-35,p.x));p.y=Math.max(0,p.y);
      for(const o of blocks)if(Math.abs(p.y-o.y)<160){if(o.kind==="pad"&&p.x>o.x&&p.x<o.x+o.w&&p.y>o.y&&p.y<o.y+o.h)p.vy=Math.max(p.vy,720);else rectHit(o,ox,oy)}
      for(const s of spinners)if(Math.abs(p.y-s.y)<s.len+50&&p.stun<.3){const a=(now-start)/1000*s.speed+s.phase,dx=Math.cos(a)*s.len,dy=Math.sin(a)*s.len;if(p.z<55&&segDist(p.x,p.y,s.x-dx,s.y-dy,s.x+dx,s.y+dy)<52){p.vx+=Math.cos(a+Math.PI/2)*650;p.vy-=260;p.stun=.6}}
      const pct=Math.min(100,p.y/COURSE*100);if(now-lastSync>550){lastSync=now;progressCb.current(pct)}setDash(Math.max(0,(1-p.dashCd/3)*100));setElapsed(now-start);
      if(p.y>=COURSE&&!finished){finished=true;progressCb.current(100);finishCb.current(now-start)}
    }
    function draw(now:number){const r=canvas!.getBoundingClientRect(),w=r.width,h=r.height,sc=Math.max(.42,Math.min(.76,w/1450)),cam=p.y-1300;ctx.clearRect(0,0,w,h);const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,map.sky);sky.addColorStop(1,"#170a39");ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
      const sx=(x:number)=>w/2+(x-CW/2)*sc,sy=(y:number)=>h*.82-(y-cam)*sc,left=sx(0),right=sx(CW);ctx.fillStyle=map.floor;ctx.fillRect(left,0,right-left,h);ctx.globalAlpha=.14;for(let yy=((cam*sc)%160)-160;yy<h;yy+=160){ctx.fillStyle="#fff";ctx.fillRect(left,yy,right-left,3)}ctx.globalAlpha=1;ctx.fillStyle=map.accent;ctx.fillRect(left-15,0,15,h);ctx.fillRect(right,0,15,h);
      const fy=sy(COURSE);if(fy>-50&&fy<h+50){for(let x=left,n=0;x<right;x+=34,n++)for(let row=0;row<3;row++){ctx.fillStyle=(n+row)%2?"#fff":"#180936";ctx.fillRect(x,fy+row*34,34,34)}}
      for(const o of blocks){const y=sy(o.y+o.h),x=sx(o.x),ww=o.w*sc,hh=o.h*sc;if(y<-100||y>h+100)continue;ctx.fillStyle="rgba(12,4,35,.25)";ctx.beginPath();ctx.roundRect(x+7,y+10,ww,hh,13);ctx.fill();ctx.fillStyle=o.color;ctx.beginPath();ctx.roundRect(x,y,ww,hh,13);ctx.fill();ctx.fillStyle="rgba(255,255,255,.22)";ctx.fillRect(x+9,y+8,Math.max(0,ww-18),9)}
      for(const s of spinners){const x=sx(s.x),y=sy(s.y);if(y<-350||y>h+350)continue;const a=(now-start)/1000*s.speed+s.phase,dx=Math.cos(a)*s.len*sc,dy=-Math.sin(a)*s.len*sc;ctx.strokeStyle=s.color;ctx.lineWidth=22*sc;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(x-dx,y-dy);ctx.lineTo(x+dx,y+dy);ctx.stroke();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(x,y,24*sc,0,Math.PI*2);ctx.fill()}
      for(const other of playersRef.current){if(other.id===me.id)continue;const oy=other.progress/100*COURSE,y=sy(oy);if(y<-50||y>h+50)continue;drawBean(sx(130+(hash(other.id)%840)),y,18*sc,other.color,other.name,.55)}drawBean(sx(p.x),sy(p.y)-p.z*sc,30*sc,me.color,me.name,1);
      ctx.textAlign="center";ctx.font="900 11px system-ui";ctx.fillStyle="rgba(255,255,255,.7)";ctx.fillText(`${map.name.toUpperCase()} · ROUND ${round}`,w/2,34);
    }
    function hash(s:string){return [...s].reduce((a,c)=>((a*31+c.charCodeAt(0))>>>0),7)}
    function drawBean(x:number,y:number,r:number,color:string,name:string,alpha:number){ctx.globalAlpha=alpha;ctx.fillStyle="rgba(12,4,35,.3)";ctx.beginPath();ctx.ellipse(x,y+r*1.1,r*.9,r*.34,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x-r,y-r*1.35,r*2,r*2.5,r*.8);ctx.fill();ctx.stroke();ctx.fillStyle="#fff";ctx.beginPath();ctx.ellipse(x,y-r*.45,r*.62,r*.45,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#160832";ctx.beginPath();ctx.arc(x-r*.2,y-r*.45,r*.08,0,Math.PI*2);ctx.arc(x+r*.2,y-r*.45,r*.08,0,Math.PI*2);ctx.fill();ctx.font="800 10px system-ui";ctx.textAlign="center";ctx.fillStyle="#fff";ctx.strokeStyle="#180936";ctx.lineWidth=3;ctx.strokeText(name,x,y-r*1.65);ctx.fillText(name,x,y-r*1.65);ctx.globalAlpha=1}
    function loop(now:number){const dt=Math.min(.033,(now-last)/1000);last=now;if(!finished)update(dt,now);draw(now);raf=requestAnimationFrame(loop)}raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);removeEventListener("keydown",down);removeEventListener("keyup",up);removeEventListener("resize",resize)}
  },[map.id,me.color,me.id,me.name,round]);
  function pointerAxis(e:React.PointerEvent<HTMLDivElement>){const r=e.currentTarget.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),l=Math.hypot(dx,dy)||1;input.current.x=dx/l*Math.min(1,l/42);input.current.y=-dy/l*Math.min(1,l/42);const k=e.currentTarget.firstElementChild as HTMLElement;k.style.transform=`translate(${dx/l*Math.min(38,l)}px,${dy/l*Math.min(38,l)}px)`}
  function clearAxis(e:React.PointerEvent<HTMLDivElement>){input.current.x=input.current.y=0;(e.currentTarget.firstElementChild as HTMLElement).style.transform=""}
  return <div className="race-game"><canvas ref={canvasRef}/>{countdown&&<div className="race-countdown">{countdown}</div>}<div className="player-hud"><div><small>TIẾN ĐỘ</small><b>{Math.min(100,Math.round(me.progress))}%</b></div><div className="hud-map"><span>{map.name}</span><i><b style={{width:`${me.progress}%`}}/></i></div><div><small>THỜI GIAN</small><b>{(elapsed/1000).toFixed(1)}s</b></div></div><div className="boost-hud"><span>SHIFT</span><i><b style={{width:`${dash}%`}}/></i></div><div className="touch-controls"><div className="touch-stick" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointerAxis(e)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))pointerAxis(e)}} onPointerUp={clearAxis} onPointerCancel={clearAxis}><i/></div><div><button onPointerDown={()=>input.current.jump=true}>↑<small>NHẢY</small></button><button onPointerDown={()=>input.current.dash=true}>»<small>BOOST</small></button></div></div></div>;
}
