"use client";

import { useEffect, useRef } from "react";
import { MAPS } from "../lib/game";
import type { Player } from "../lib/types";

function stableLane(id: string) {
  const hash = [...id].reduce((value, char) => ((value * 31 + char.charCodeAt(0)) >>> 0), 7);
  return 10 + hash % 76;
}

export function RoomTrack({ players, mapId }: { players: Player[]; mapId: string | null }) {
  const map = MAPS.find((item) => item.id === mapId) ?? MAPS[0];
  const obstacles = [18, 34, 51, 68, 84];
  const targets = useRef(new Map<string, { progress: number; lane: number }>());
  const displayed = useRef(new Map<string, { progress: number; lane: number }>());
  const nodes = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const active = new Set<string>();
    for (const player of players) {
      active.add(player.id);
      const lane = Number.isFinite(player.positionX) ? 8 + Math.max(0, Math.min(1600, player.positionX)) / 1600 * 84 : stableLane(player.id);
      const target = { progress: Math.min(100, Math.max(0, player.progress)), lane };
      targets.current.set(player.id, target);
      if (!displayed.current.has(player.id)) displayed.current.set(player.id, target);
    }
    for (const id of targets.current.keys()) {
      if (!active.has(id)) { targets.current.delete(id); displayed.current.delete(id); nodes.current.delete(id); }
    }
  }, [players]);

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

  return <div className="spectator-track" style={{ "--sky": map.sky, "--floor": map.floor, "--accent": map.accent } as React.CSSProperties}>
    <div className="track-cloud c1"/><div className="track-cloud c2"/>
    <div className="track-lane">
      <div className="finish-line"><b>FINISH</b></div>
      {obstacles.map((position, index) => <div className={`track-obstacle o${index % 3}`} style={{ bottom: `${position}%` }} key={position}><i/><i/><i/></div>)}
      {players.map((player) => <div
        className="track-runner"
        key={player.id}
        ref={(node) => { if (node) nodes.current.set(player.id, node); else nodes.current.delete(player.id); }}
        style={{ bottom: `calc(${Math.min(97, displayed.current.get(player.id)?.progress ?? player.progress)}% - 12px)`, left: `${displayed.current.get(player.id)?.lane ?? stableLane(player.id)}%`, "--bean": player.color } as React.CSSProperties}
      >
        <span>{player.name}</span><i><b/><b/></i>
      </div>)}
      <div className="start-line">START</div>
    </div>
    <div className="realtime-chip"><i/> LIVE · 60 FPS VIEW</div>
    <div className="map-plaque"><small>ROUND MAP</small><b>{map.name}</b><span>{map.subtitle}</span></div>
  </div>;
}
