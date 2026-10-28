"use client";
import { MAPS } from "../lib/game";
import type { Player } from "../lib/types";

export function RoomTrack({ players, mapId }: { players: Player[]; mapId: string | null }) {
  const map = MAPS.find((m) => m.id === mapId) ?? MAPS[0];
  const obstacles = [18, 34, 51, 68, 84];
  return <div className="spectator-track" style={{ "--sky": map.sky, "--floor": map.floor, "--accent": map.accent } as React.CSSProperties}>
    <div className="track-cloud c1"/><div className="track-cloud c2"/>
    <div className="track-lane">
      <div className="finish-line"><b>FINISH</b></div>
      {obstacles.map((y, i) => <div className={`track-obstacle o${i%3}`} style={{ bottom: `${y}%` }} key={y}><i/><i/><i/></div>)}
      {players.map((p, i) => <div className="track-runner" key={p.id} style={{ bottom: `calc(${Math.min(97,p.progress)}% - 12px)`, left: `${16 + (i*23)%68}%`, "--bean": p.color } as React.CSSProperties}>
        <span>{p.name}</span><i><b/><b/></i>
      </div>)}
      <div className="start-line">START</div>
    </div>
    <div className="map-plaque"><small>ROUND MAP</small><b>{map.name}</b><span>{map.subtitle}</span></div>
  </div>;
}
