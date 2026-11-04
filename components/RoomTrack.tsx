"use client";

import { useEffect, useRef, useState } from "react";
import { courseWidthForPlayers, MAPS } from "../lib/game";
import { TILE_COUNT, tileCollapseState } from "../lib/tile-collapse";
import type { Player } from "../lib/types";

function stableLane(id: string) {
  const hash = [...id].reduce((value, char) => ((value * 31 + char.charCodeAt(0)) >>> 0), 7);
  return 10 + hash % 76;
}

export function RoomTrack({ players, mapId, round, startedAt }: { players: Player[]; mapId: string | null; round: number; startedAt: string }) {
  const map = MAPS.find((item) => item.id === mapId) ?? MAPS[0];
  const courseWidth = courseWidthForPlayers(players.length);
  const [roundSeconds, setRoundSeconds] = useState(0);
  const targets = useRef(new Map<string, { progress: number; lane: number }>());
  const displayed = useRef(new Map<string, { progress: number; lane: number }>());
  const nodes = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const active = new Set<string>();
    for (const player of players) {
      active.add(player.id);
      const lane = Number.isFinite(player.positionX) ? 8 + Math.max(0, Math.min(courseWidth, player.positionX)) / courseWidth * 84 : stableLane(player.id);
      const fallbackSurvivalProgress = 32 + stableLane(`${player.id}:y`) * .42;
      const target = { progress: Math.min(100, Math.max(0, map.mode === "survival" && player.progress < 1 ? fallbackSurvivalProgress : player.progress)), lane };
      targets.current.set(player.id, target);
      if (!displayed.current.has(player.id)) displayed.current.set(player.id, target);
    }
    for (const id of targets.current.keys()) {
      if (!active.has(id)) { targets.current.delete(id); displayed.current.delete(id); nodes.current.delete(id); }
    }
  }, [players, map.mode, courseWidth]);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      const dt = Math.min(.05, (now - previous) / 1000);
      previous = now;
      const easing = 1 - Math.exp(-dt * 7.5);
      for (const [id, target] of targets.current) {
        const current = displayed.current.get(id) ?? target;
        const next = {
          progress: Math.abs(target.progress - current.progress) < .015 ? target.progress : current.progress + (target.progress - current.progress) * easing,
          lane: Math.abs(target.lane - current.lane) < .015 ? target.lane : current.lane + (target.lane - current.lane) * easing,
        };
        displayed.current.set(id, next);
        const node = nodes.current.get(id);
        if (node) { node.style.bottom = `calc(${Math.min(97, next.progress)}% - 12px)`; node.style.left = `${next.lane}%`; }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const normalized = startedAt.includes("T") ? startedAt : `${startedAt.replace(" ", "T")}Z`;
    const parsed = Date.parse(normalized);
    const goAt = (Number.isFinite(parsed) ? parsed : Date.now()) + 3000;
    const update = () => setRoundSeconds(Math.max(0, (Date.now() - goAt) / 1000));
    update();
    const timer = window.setInterval(update, 120);
    return () => window.clearInterval(timer);
  }, [startedAt, round]);

  return <div className={`spectator-track admin-map-${map.id}`} style={{ "--sky": map.sky, "--floor": map.floor, "--accent": map.accent } as React.CSSProperties}>
    <div className="track-cloud c1"/><div className="track-cloud c2"/>
    <div className="track-lane">
      {map.mode === "race"&&<div className="finish-line"><b>FINISH</b></div>}
      <MapFeatures mapId={map.id} round={round} roundSeconds={roundSeconds} playerCount={players.length}/>
      {players.map((player) => <div
        className={`track-runner ${player.finishPosition?"eliminated":""}`}
        key={player.id}
        ref={(node) => { if (node) nodes.current.set(player.id, node); else nodes.current.delete(player.id); }}
        style={{ bottom: `calc(${Math.min(97, displayed.current.get(player.id)?.progress ?? player.progress)}% - 12px)`, left: `${displayed.current.get(player.id)?.lane ?? stableLane(player.id)}%`, "--bean": player.color } as React.CSSProperties}
      >
        <span>{player.name}</span><i><b/><b/></i>
      </div>)}
      {map.mode === "race"?<div className="start-line">START</div>:<div className="survival-counter">CÒN TRỤ {players.filter(player=>!player.finishPosition).length}/{players.length}</div>}
    </div>
    <div className="realtime-chip"><i/> LIVE · 60 FPS VIEW</div>
    <div className="map-plaque"><small>ROUND MAP</small><b>{map.name}</b><span>{map.subtitle}</span></div>
  </div>;
}

function MapFeatures({ mapId, round, roundSeconds, playerCount }: { mapId: string; round: number; roundSeconds: number; playerCount: number }) {
  if (mapId === "sky") return <div className="admin-ring-course" aria-hidden="true">
    {[14, 38, 62, 86].map((bottom, index) => <i key={bottom} style={{ bottom: `${bottom}%`, left: `${index % 2 ? 48 : 8}%`, animationDuration: `${2.4 + index * .55}s` }}/>) }
    {[27, 51, 75].map((bottom, index) => <span className={`track-obstacle o${index % 2}`} style={{ bottom: `${bottom}%` }} key={bottom}><b/><b/><b/></span>)}
  </div>;
  if (mapId === "jungle") return <div className="admin-tile-course" aria-hidden="true">
    <div className="admin-survival-frame">{Array.from({ length: TILE_COUNT }, (_, index) => {
      const state = tileCollapseState(index, roundSeconds, round);
      return <i className={state.collapsed ? "collapsed" : state.warning ? "warning" : ""} key={index}/>;
    })}</div>
  </div>;
  if (mapId === "sweep") {
    const count = 1 + Math.min(2, Math.floor(roundSeconds / 22));
    return <div className="admin-sweep-course" aria-hidden="true"><i className="admin-sweep-platform" style={{ transform: `scale(${Math.min(1, .72 + playerCount / 500)})` }}>
      {Array.from({length: count}, (_, index) => <b className={index % 2 ? "vertical" : "horizontal"} style={{ animationDuration: `${Math.max(1.8, 4.8 - roundSeconds * .025 + index * .35)}s` }} key={index}/>) }
    </i></div>;
  }
  if (mapId === "lava") return <div className="admin-arena-course" aria-hidden="true">
    <i className="admin-arena survival laser" style={{ bottom: "25%", transform: `scale(${Math.min(1, .72 + playerCount / 500)})` }}>
      {Array.from({length: 1 + Math.min(2, Math.floor(roundSeconds / 22))}, (_, index) => <b className={roundSeconds > 24 && index % 2 ? "vertical" : "horizontal"} style={{ animationDuration: `${Math.max(1.9, 4.8 - roundSeconds * .03 + index * .4)}s` }} key={index}/>) }
    </i>
  </div>;
  if (mapId === "ice") return <div className="admin-ice-course" aria-hidden="true">
    {[20, 36, 53, 70, 86].map((bottom, index) => <i className={index % 2 ? "right" : "left"} style={{ bottom: `${bottom}%` }} key={bottom}><b/></i>)}
    {[30, 67].map((bottom) => <span className="admin-ice-pit" style={{bottom:`${bottom}%`}} key={bottom}>{[0,1,2].map(index=><b style={{animationDelay:`${index * -.7}s`}} key={index}/>)}</span>)}
  </div>;
  return <>{[18, 34, 51, 68, 84].map((position, index) => <div className={`track-obstacle o${index % 3}`} style={{ bottom: `${position}%` }} key={position}><i/><i/><i/></div>)}</>;
}
