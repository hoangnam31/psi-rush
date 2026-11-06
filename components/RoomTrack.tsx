"use client";

import { useEffect, useRef, useState } from "react";
import { blockStormWaveAt } from "../lib/block-storm";
import { getCharacter } from "../lib/characters";
import { courseWidthForPlayers, MAPS, survivalSizeForPlayers } from "../lib/game";
import { laserSweepFramesAt } from "../lib/laser-arena";
import { ROUND_START_DELAY_MS, serverEpoch } from "../lib/round-timing";
import { TILE_COUNT, tileCollapseState } from "../lib/tile-collapse";
import type { Player } from "../lib/types";

const COURSE = 10_000;
const SURVIVAL_Y = 3_900;

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function stableHash(value: string) {
  return [...value].reduce((result, char) => ((result * 31 + char.charCodeAt(0)) >>> 0), 7);
}

function fallbackSurvivalPosition(mapId: string, playerId: string, index: number, playerCount: number, arenaWidth: number, arenaHeight: number) {
  if (mapId === "jungle") {
    const tileIndex = stableHash(playerId) % TILE_COUNT;
    const column = tileIndex % 10, row = Math.floor(tileIndex / 10);
    const gap = 14, padX = 28, padY = 28;
    const tileWidth = (arenaWidth - padX * 2 - gap * 9) / 10;
    const tileHeight = (arenaHeight - padY * 2 - gap * 7) / 8;
    return {
      x: (padX + column * (tileWidth + gap) + tileWidth / 2) / arenaWidth,
      y: (padY + row * (tileHeight + gap) + tileHeight / 2) / arenaHeight,
    };
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
  if (map.mode === "survival") return <SurvivalOverview players={players} map={map} round={round} startedAt={startedAt}/>;

  const ordered = [...players].sort((a, b) => {
    if (a.finishPosition && b.finishPosition) return a.finishPosition - b.finishPosition;
    if (a.finishPosition) return -1;
    if (b.finishPosition) return 1;
    return b.progress - a.progress || a.name.localeCompare(b.name, "vi");
  });
  const rankById = new Map(ordered.map((player, index) => [player.id, index]));
  const leader = ordered[0];
  const rowHeight = players.length > 100 ? 46 : players.length > 50 ? 50 : 56;

  return <div className="spectator-track race-progress-track" style={{ "--sky": map.sky, "--floor": map.floor, "--accent": map.accent, "--race-row-height": `${rowHeight}px` } as React.CSSProperties}>
    <div className="race-progress-glow"/>
    <div className="race-progress-summary">
      <div><small>ROUND MAP · LIVE PROGRESS</small><b>{map.name}</b><span>{map.subtitle}</span></div>
      <div className="race-leader-chip"><small>ĐANG DẪN ĐẦU</small><b><i style={{ backgroundImage: leader ? `url(${getCharacter(leader.characterId).image})` : undefined }}/>{leader?.name ?? "—"}</b><span>{leader ? `${Math.round(leader.progress)}%` : "0%"}</span></div>
    </div>
    <div className="race-progress-scroll">
      <div className="race-progress-list" style={{ height: `${Math.max(players.length, 1) * rowHeight}px` }}>
        {players.map((player) => {
          const rank = rankById.get(player.id) ?? players.length;
          const progress = player.finishPosition ? 100 : clamp(player.progress / 100) * 100;
          const label = player.finishPosition ? `VỀ ĐÍCH #${player.finishPosition}` : rank === 0 ? "ĐANG DẪN ĐẦU" : `CÁCH ĐÍCH ${Math.max(0, Math.round(100 - progress))}%`;
          return <div className={`race-progress-row ${player.finishPosition ? "finished" : ""} ${rank < 3 ? `top-${rank + 1}` : ""}`} key={player.id} style={{ transform: `translateY(${rank * rowHeight}px)` }}>
            <b className="race-live-rank">#{rank + 1}</b>
            <div className="race-player-label"><i style={{ backgroundImage: `url(${getCharacter(player.characterId).image})` }}/><span><strong>{player.name}</strong><small>{label}</small></span></div>
            <div className="race-progress-rail"><i className="race-progress-fill" style={{ width: `${progress}%`, background: player.color }}/><span className="race-progress-marker" style={{ left: `${progress}%` }}><i style={{ backgroundImage: `url(${getCharacter(player.characterId).image})` }}/></span></div>
            <strong className="race-progress-value">{player.finishPosition ? "✓" : `${Math.round(progress)}%`}</strong>
          </div>;
        })}
        {!players.length && <div className="race-progress-empty">Đang chờ dữ liệu tay đua…</div>}
      </div>
    </div>
    <div className="realtime-chip"><i/> LIVE · THỨ HẠNG TỰ ĐỘNG</div>
  </div>;
}

type MapDefinition = (typeof MAPS)[number];
type OverviewPosition = { x: number; y: number };

function SurvivalOverview({ players, map, round, startedAt }: { players: Player[]; map: MapDefinition; round: number; startedAt: string }) {
  const courseWidth = courseWidthForPlayers(players.length);
  const arenaWidth = survivalSizeForPlayers(players.length);
  const arenaHeight = map.id === "jungle" ? Math.round(arenaWidth * .82) : arenaWidth;
  const arenaX = (courseWidth - arenaWidth) / 2;
  const [roundSeconds, setRoundSeconds] = useState(0);
  const targets = useRef(new Map<string, OverviewPosition>());
  const displayed = useRef(new Map<string, OverviewPosition>());
  const nodes = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    targets.current.clear();
    displayed.current.clear();
  }, [map.id, round]);

  useEffect(() => {
    const active = new Set<string>();
    players.forEach((player, index) => {
      active.add(player.id);
      const fallback = fallbackSurvivalPosition(map.id, player.id, index, players.length, arenaWidth, arenaHeight);
      const hasLivePosition = player.progress >= 1;
      const worldY = player.progress / 100 * COURSE;
      const target = {
        x: hasLivePosition && Number.isFinite(player.positionX) ? clamp((player.positionX - arenaX) / arenaWidth) : fallback.x,
        y: hasLivePosition ? clamp((worldY - SURVIVAL_Y) / arenaHeight) : fallback.y,
      };
      targets.current.set(player.id, target);
      if (!displayed.current.has(player.id)) displayed.current.set(player.id, target);
    });
    for (const id of targets.current.keys()) if (!active.has(id)) {
      targets.current.delete(id); displayed.current.delete(id); nodes.current.delete(id);
    }
  }, [players, map.id, arenaHeight, arenaWidth, arenaX]);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      const dt = Math.min(.05, (now - previous) / 1000); previous = now;
      const easing = 1 - Math.exp(-dt * 9);
      for (const [id, target] of targets.current) {
        const current = displayed.current.get(id) ?? target;
        const next = { x: current.x + (target.x - current.x) * easing, y: current.y + (target.y - current.y) * easing };
        displayed.current.set(id, next);
        const node = nodes.current.get(id);
        if (node) { node.style.left = `${next.x * 100}%`; node.style.bottom = `${next.y * 100}%`; }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const goAt = serverEpoch(startedAt) + ROUND_START_DELAY_MS;
    const update = () => setRoundSeconds(Math.max(0, (Date.now() - goAt) / 1000));
    update(); const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [startedAt, round]);

  return <div className={`spectator-track survival-overview admin-map-${map.id}`} style={{ "--sky": map.sky, "--floor": map.floor, "--accent": map.accent } as React.CSSProperties}>
    <div className="survival-overview-heading"><small>ROUND MAP · LIVE OVERVIEW</small><b>{map.name}</b><span>{map.subtitle}</span></div>
    <div className="track-lane survival-layout" style={{ aspectRatio: `${arenaWidth}/${arenaHeight}` }}>
      <SurvivalFeatures mapId={map.id} round={round} roundSeconds={roundSeconds} arenaWidth={arenaWidth}/>
      {players.map((player, index) => {
        const fallback = fallbackSurvivalPosition(map.id, player.id, index, players.length, arenaWidth, arenaHeight);
        const position = displayed.current.get(player.id) ?? targets.current.get(player.id) ?? fallback;
        return <div className={`track-runner ${player.finishPosition ? "eliminated" : ""}`} key={player.id} ref={(node) => { if (node) nodes.current.set(player.id, node); else nodes.current.delete(player.id); }} style={{ left: `${position.x * 100}%`, bottom: `${position.y * 100}%`, "--bean": player.color } as React.CSSProperties}>
          <span>{player.name}</span><i className="track-mascot" style={{ backgroundImage: `url(${getCharacter(player.characterId).image})` }}/>
        </div>;
      })}
      <div className="survival-counter">CÒN TRỤ {players.filter((player) => !player.finishPosition).length}/{players.length}</div>
    </div>
    <div className="realtime-chip"><i/> LIVE · TỌA ĐỘ THẾ GIỚI</div>
  </div>;
}

function SurvivalFeatures({ mapId, round, roundSeconds, arenaWidth }: { mapId: string; round: number; roundSeconds: number; arenaWidth: number }) {
  if (mapId === "jungle") return <div className="admin-tile-course" aria-hidden="true"><div className="admin-survival-frame" style={{ padding: `${28 / arenaWidth * 100}%`, gap: `${14 / arenaWidth * 100}%` }}>{Array.from({ length: TILE_COUNT }, (_, visualIndex) => {
    const column = visualIndex % 10, visualRow = Math.floor(visualIndex / 10);
    const index = (7 - visualRow) * 10 + column;
    const state = tileCollapseState(index, roundSeconds, round);
    return <i className={state.collapsed ? "collapsed" : state.warning ? "warning" : ""} key={index}/>;
  })}</div></div>;

  if (mapId === "sweep") {
    const wave = blockStormWaveAt(roundSeconds, round);
    const horizontalTravel = wave ? wave.direction === 0 || wave.direction === 2 : true;
    const reverse = wave ? wave.direction === 2 || wave.direction === 3 : false;
    const thickness = 104 / arenaWidth * 100;
    const travel = wave ? (reverse ? 100 + thickness - wave.progress * (100 + thickness * 2) : -thickness + wave.progress * (100 + thickness * 2)) : -thickness;
    const gapStart = wave ? (wave.gapCenterRatio - wave.gapSizeRatio / 2) * 100 : 36.5;
    const gapEnd = wave ? (wave.gapCenterRatio + wave.gapSizeRatio / 2) * 100 : 63.5;
    const barrierStyle = horizontalTravel ? { animation: "none", left: `${travel}%`, top: 0, width: `${thickness}%` } : { animation: "none", top: `${100 - travel - thickness}%`, left: 0, height: `${thickness}%` };
    const firstSegment = horizontalTravel ? { bottom: 0, left: 0, width: "100%", height: `${gapStart}%` } : { top: 0, left: 0, width: `${gapStart}%`, height: "100%" };
    const secondSegment = horizontalTravel ? { top: 0, left: 0, width: "100%", height: `${100 - gapEnd}%` } : { top: 0, right: 0, width: `${100 - gapEnd}%`, height: "100%" };
    return <div className="admin-sweep-course" aria-hidden="true"><i className="admin-sweep-platform">{wave && <b className={`${horizontalTravel ? "vertical" : "horizontal"} ${wave.low ? "low" : "high"}`} style={barrierStyle}><i style={wave.low ? undefined : firstSegment}/><i style={wave.low ? undefined : secondSegment}/></b>}</i></div>;
  }

  return <div className="admin-arena-course admin-laser-course" aria-hidden="true"><i className="admin-laser-platform"/>{laserSweepFramesAt(roundSeconds).map((beam, index) => {
    const center = 50 + beam.offset * 43;
    const start = 50 - beam.extent * 43, length = beam.extent * 86;
    return <b className={`admin-laser-beam ${beam.vertical ? "vertical" : "horizontal"}`} key={`${index}-${beam.vertical}`} style={beam.vertical
      ? { animation: "none", left: `${center}%`, top: `${start}%`, width: "7px", height: `${length}%`, background: beam.color }
      : { animation: "none", left: `${start}%`, top: `${100 - center}%`, width: `${length}%`, height: "7px", background: beam.color }}/>;
  })}</div>;
}
