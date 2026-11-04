"use client";

import { useEffect, useRef, useState } from "react";
import { courseWidthForPlayers, MAPS, survivalSizeForPlayers } from "../lib/game";
import { TILE_COUNT, tileCollapseState } from "../lib/tile-collapse";
import type { Player } from "../lib/types";

const COURSE = 10000;
const SURVIVAL_Y = 3900;

function stableHash(value: string) {
  return [...value].reduce((result, char) => ((result * 31 + char.charCodeAt(0)) >>> 0), 7);
}

function stableLane(id: string) {
  return 10 + stableHash(id) % 76;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function mapSeed(id: string) {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function raceBottom(worldY: number) {
  return clamp(worldY / COURSE, .01, .99) * 100;
}

function fallbackSurvivalPosition(mapId: string, playerId: string, index: number, playerCount: number) {
  if (mapId === "jungle") {
    const tile = stableHash(playerId) % TILE_COUNT;
    return { x: (tile % 10 + .5) / 10, y: (Math.floor(tile / 10) + .5) / 8 };
  }
  if (mapId === "lava") {
    const angle = stableHash(playerId) / 0xffffffff * Math.PI * 2;
    return { x: .5 + Math.cos(angle) * .25, y: .5 + Math.sin(angle) * .25 };
  }
  const columns = Math.max(5, Math.ceil(Math.sqrt(Math.max(1, playerCount))));
  const rows = Math.ceil(Math.max(1, playerCount) / columns);
  return {
    x: .18 + .64 * (index % columns + .5) / columns,
    y: .18 + .64 * (Math.floor(index / columns) + .5) / rows,
  };
}

export function RoomTrack({ players, mapId, round, startedAt }: { players: Player[]; mapId: string | null; round: number; startedAt: string }) {
  const map = MAPS.find((item) => item.id === mapId) ?? MAPS[0];
  const courseWidth = courseWidthForPlayers(players.length);
  const survivalSize = survivalSizeForPlayers(players.length);
  const survivalHeight = map.id === "jungle" ? Math.round(survivalSize * .82) : survivalSize;
  const survivalX = (courseWidth - survivalSize) / 2;
  const [roundSeconds, setRoundSeconds] = useState(0);
  const targets = useRef(new Map<string, { progress: number; lane: number }>());
  const displayed = useRef(new Map<string, { progress: number; lane: number }>());
  const nodes = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    targets.current.clear();
    displayed.current.clear();
  }, [map.id, round]);

  useEffect(() => {
    const active = new Set<string>();
    players.forEach((player, index) => {
      active.add(player.id);
      let target: { progress: number; lane: number };
      if (map.mode === "survival") {
        const fallback = fallbackSurvivalPosition(map.id, player.id, index, players.length);
        const hasLivePosition = player.progress >= 1;
        const xRatio = hasLivePosition && Number.isFinite(player.positionX)
          ? clamp((player.positionX - survivalX) / survivalSize)
          : fallback.x;
        const worldY = player.progress / 100 * COURSE;
        const yRatio = hasLivePosition ? clamp((worldY - SURVIVAL_Y) / survivalHeight) : fallback.y;
        target = { lane: 5 + xRatio * 90, progress: 5 + yRatio * 90 };
      } else {
        const lane = Number.isFinite(player.positionX)
          ? 3 + clamp(player.positionX / courseWidth) * 94
          : stableLane(player.id);
        target = { progress: 2 + clamp(player.progress / 100) * 96, lane };
      }
      targets.current.set(player.id, target);
      if (!displayed.current.has(player.id)) displayed.current.set(player.id, target);
    });
    for (const id of targets.current.keys()) {
      if (!active.has(id)) { targets.current.delete(id); displayed.current.delete(id); nodes.current.delete(id); }
    }
  }, [players, map.id, map.mode, courseWidth, survivalHeight, survivalSize, survivalX]);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      const dt = Math.min(.05, (now - previous) / 1000);
      previous = now;
      const easing = 1 - Math.exp(-dt * 8.5);
      for (const [id, target] of targets.current) {
        const current = displayed.current.get(id) ?? target;
        const next = {
          progress: Math.abs(target.progress - current.progress) < .01 ? target.progress : current.progress + (target.progress - current.progress) * easing,
          lane: Math.abs(target.lane - current.lane) < .01 ? target.lane : current.lane + (target.lane - current.lane) * easing,
        };
        displayed.current.set(id, next);
        const node = nodes.current.get(id);
        if (node) { node.style.bottom = `${next.progress}%`; node.style.left = `${next.lane}%`; }
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
    <div className={`track-lane ${map.mode === "survival" ? "survival-layout" : "race-layout"}`}>
      {map.mode === "race" && <div className="finish-line"><b>FINISH</b></div>}
      <MapFeatures mapId={map.id} round={round} roundSeconds={roundSeconds} playerCount={players.length} courseWidth={courseWidth}/>
      {players.map((player) => {
        const position = displayed.current.get(player.id) ?? targets.current.get(player.id) ?? { progress: 2, lane: stableLane(player.id) };
        return <div
          className={`track-runner ${player.finishPosition ? "eliminated" : ""}`}
          key={player.id}
          ref={(node) => { if (node) nodes.current.set(player.id, node); else nodes.current.delete(player.id); }}
          style={{ bottom: `${position.progress}%`, left: `${position.lane}%`, "--bean": player.color } as React.CSSProperties}
        >
          <span>{player.name}</span><i><b/><b/></i>
        </div>;
      })}
      {map.mode === "race"
        ? <div className="start-line">START</div>
        : <div className="survival-counter">CÒN TRỤ {players.filter((player) => !player.finishPosition).length}/{players.length}</div>}
    </div>
    <div className="realtime-chip"><i/> LIVE · TỌA ĐỘ THỰC</div>
    <div className="map-plaque"><small>ROUND MAP</small><b>{map.name}</b><span>{map.subtitle}</span></div>
  </div>;
}

function MapFeatures({ mapId, round, roundSeconds, courseWidth }: { mapId: string; round: number; roundSeconds: number; playerCount: number; courseWidth: number }) {
  if (mapId === "sky") {
    const zoneStarts = [720, 2860, 5000, 7140];
    const ringRows = [
      { dx: -1, y: 150, speed: .52, phase: 0, amp: 190 },
      { dx: 1, y: 455, speed: .68, phase: 1.2, amp: 220 },
      { dx: -1, y: 765, speed: .84, phase: 2.4, amp: 190 },
      { dx: 1, y: 1060, speed: 1.02, phase: 3.6, amp: 220 },
    ];
    const scale = Math.min(1.42, courseWidth / 1600);
    const gates = [2250, 4390, 6530, 8670];
    const seed = mapSeed("sky");
    return <div className="admin-sky-course" aria-hidden="true">
      {zoneStarts.flatMap((zoneY, zoneIndex) => ringRows.map((row, rowIndex) => {
        const baseX = courseWidth / 2 + row.dx * 290 * scale;
        const moveAmp = Math.min(row.amp, courseWidth * .07);
        const x = baseX + Math.sin(roundSeconds * row.speed + row.phase + zoneIndex * .7) * moveAmp;
        return <i className="admin-ring-platform" key={`${zoneY}-${rowIndex}`} style={{ bottom: `${raceBottom(zoneY + row.y)}%`, left: `${x / courseWidth * 100}%` }}/>;
      }))}
      {zoneStarts.map((zoneY, index) => <i className="admin-course-spinner" key={`spin-${zoneY}`} style={{ bottom: `${raceBottom(zoneY + 610)}%`, left: "50%", transform: `translate(-50%,50%) rotate(${roundSeconds * (index % 2 ? -1 : 1) * (1.6 + index * .22) + index}rad)` }}/>) }
      {gates.map((y, index) => {
        const gate = courseWidth * (.2 + ((seed + index * 17) % 32) / 100);
        const gap = Math.max(360, courseWidth * .22);
        return <span className="admin-course-gate" key={y} style={{ bottom: `${raceBottom(y)}%` }}>
          <b style={{ left: 0, width: `${gate / courseWidth * 100}%` }}/>
          <b style={{ left: `${(gate + gap) / courseWidth * 100}%`, right: 0 }}/>
        </span>;
      })}
      {gates.map((y, index) => {
        const amp = Math.min(650, courseWidth * .34);
        const x = courseWidth / 2 - 120 + Math.sin(roundSeconds * (1.35 + index * .17) + index) * amp;
        return <b className="admin-moving-block" key={`move-${y}`} style={{ bottom: `${raceBottom(y + 270)}%`, left: `${x / courseWidth * 100}%`, width: `${240 / courseWidth * 100}%` }}/>;
      })}
    </div>;
  }

  if (mapId === "jungle") return <div className="admin-tile-course" aria-hidden="true">
    <div className="admin-survival-frame">{Array.from({ length: TILE_COUNT }, (_, index) => {
      const state = tileCollapseState(index, roundSeconds, round);
      return <i className={state.collapsed ? "collapsed" : state.warning ? "warning" : ""} key={index}/>;
    })}</div>
  </div>;

  if (mapId === "sweep") {
    const count = 1 + Math.min(2, Math.floor(roundSeconds / 22));
    const wave = Math.max(0, Math.floor((roundSeconds - 2) / 3.3));
    return <div className="admin-sweep-course" aria-hidden="true"><i className="admin-sweep-platform">
      {Array.from({ length: count }, (_, index) => {
        const low = (wave + index * 2) % 3 === 0;
        return <b className={`${index % 2 ? "vertical" : "horizontal"} ${low ? "low" : "high"}`} style={{ animationDuration: `${Math.max(1.8, 4.8 - roundSeconds * .025 + index * .35)}s` }} key={index}><i/><i/></b>;
      })}
    </i></div>;
  }

  if (mapId === "lava") return <div className="admin-arena-course" aria-hidden="true">
    <i className="admin-arena survival laser">
      {Array.from({ length: 1 + Math.min(2, Math.floor(roundSeconds / 22)) }, (_, index) => <b className={roundSeconds > 24 && index % 2 ? "vertical" : "horizontal"} style={{ animationDuration: `${Math.max(1.9, 4.8 - roundSeconds * .03 + index * .4)}s` }} key={index}/>) }
    </i>
  </div>;

  if (mapId === "ice") {
    const seed = mapSeed("ice");
    const zones = Array.from({ length: 12 }, (_, index) => {
      const zone = index + 1;
      return { zone, y: 650 + zone * 720 + seed * zone % 145 };
    });
    return <div className="admin-ice-course accurate" aria-hidden="true">
      <span className="admin-course-gate intro" style={{ bottom: `${raceBottom(540)}%` }}><b style={{ left: 0, width: "24%" }}/><b style={{ left: "72%", right: 0 }}/></span>
      <b className="admin-moving-block ice" style={{ bottom: `${raceBottom(870)}%`, left: `${(courseWidth / 2 - 145 + Math.sin(roundSeconds * .42 + .4) * Math.min(310, courseWidth * .2)) / courseWidth * 100}%`, width: `${290 / courseWidth * 100}%` }}/>
      {zones.map(({ zone, y }) => {
        if ([3000, 6200].some((pitY) => y > pitY && y < pitY + 1080)) return null;
        const type = zone % 4;
        if (type === 0) {
          const gapWidth = 390;
          const gap = 160 + seed * zone * 13 % (courseWidth - gapWidth - 320);
          return <span className="admin-course-gate ice" key={zone} style={{ bottom: `${raceBottom(y)}%` }}><b style={{ left: 0, width: `${gap / courseWidth * 100}%` }}/><b style={{ left: `${(gap + gapWidth) / courseWidth * 100}%`, right: 0 }}/></span>;
        }
        if (type === 1) return <i className="admin-course-spinner ice" key={zone} style={{ bottom: `${raceBottom(y)}%`, left: `${zone % 2 ? 30 : 70}%`, transform: `translate(-50%,50%) rotate(${roundSeconds * (zone % 2 ? 1 : -1) * (.72 + zone / 12 * 1.7) + zone}rad)` }}/>;
        if (type === 2) {
          const x = courseWidth / 2 - 125 + Math.sin(roundSeconds * (.55 + zone / 12 * 1.35) + zone) * Math.min(650, courseWidth * .34);
          return <b className="admin-moving-block ice" key={zone} style={{ bottom: `${raceBottom(y)}%`, left: `${x / courseWidth * 100}%`, width: `${250 / courseWidth * 100}%` }}/>;
        }
        return <span className="admin-ice-double" key={zone} style={{ bottom: `${raceBottom(y)}%` }}><b/><b/></span>;
      })}
      {[3000, 6200].map((pitY, pitIndex) => <span className="admin-ice-abyss" key={pitY} style={{ bottom: `${raceBottom(pitY)}%`, height: `${1080 / COURSE * 100}%` }}>
        {Array.from({ length: 4 }, (_, row) => {
          const amp = Math.min(pitIndex ? 420 : 300, courseWidth / 2 - 330);
          const speed = pitIndex ? .68 : .38;
          const x = courseWidth / 2 - 250 + Math.sin(roundSeconds * speed + pitIndex * .55 + row * .2) * amp;
          return <b key={row} style={{ bottom: `${(25 + row * 270) / 1080 * 100}%`, left: `${x / courseWidth * 100}%`, width: `${500 / courseWidth * 100}%`, height: `${185 / 1080 * 100}%` }}/>;
        })}
      </span>)}
    </div>;
  }

  return null;
}
