"use client";

import { MAPS } from "../lib/game";
import { getCharacter } from "../lib/characters";
import type { Player } from "../lib/types";

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function RoomTrack({ players, mapId }: { players: Player[]; mapId: string | null; round: number; startedAt: string }) {
  const map = MAPS.find((item) => item.id === mapId) ?? MAPS[0];
  const survival = map.mode === "survival";
  const ordered = [...players].sort((a, b) => {
    if (survival) {
      if (!a.finishPosition && b.finishPosition) return -1;
      if (a.finishPosition && !b.finishPosition) return 1;
      if (a.finishPosition && b.finishPosition) return a.finishPosition - b.finishPosition;
      return a.name.localeCompare(b.name, "vi");
    }
    if (a.finishPosition && b.finishPosition) return a.finishPosition - b.finishPosition;
    if (a.finishPosition) return -1;
    if (b.finishPosition) return 1;
    return b.progress - a.progress || a.name.localeCompare(b.name, "vi");
  });
  const rankById = new Map(ordered.map((player, index) => [player.id, index]));
  const leader = ordered[0];
  const alive = players.filter((player) => !player.finishPosition).length;
  const rowHeight = players.length > 100 ? 46 : players.length > 50 ? 50 : 56;

  return <div className={`spectator-track race-progress-track${survival ? " survival-progress" : ""}`} style={{ "--sky": map.sky, "--floor": map.floor, "--accent": map.accent, "--race-row-height": `${rowHeight}px` } as React.CSSProperties}>
    <div className="race-progress-glow"/>
    <div className="race-progress-summary">
      <div><small>ROUND MAP · {survival ? "SURVIVAL STATUS" : "LIVE PROGRESS"}</small><b>{map.name}</b><span>{map.subtitle}</span></div>
      <div className="race-leader-chip"><small>{survival ? "CÒN TRỤ" : "ĐANG DẪN ĐẦU"}</small><b><i style={{ backgroundImage: leader ? `url(${getCharacter(leader.characterId).image})` : undefined }}/>{leader?.name ?? "—"}</b><span>{survival ? `${alive}/${players.length}` : leader ? `${Math.round(leader.progress)}%` : "0%"}</span></div>
    </div>
    <div className="race-progress-scroll">
      <div className="race-progress-scale"><span>{survival ? "OUT" : "START"}</span><i/><span>25%</span><i/><span>50%</span><i/><span>75%</span><i/><strong>{survival ? "ALIVE" : "FINISH"}</strong></div>
      <div className="race-progress-list" style={{ height: `${Math.max(players.length, 1) * rowHeight}px` }}>
        {players.map((player) => {
          const rank = rankById.get(player.id) ?? players.length;
          const progress = survival ? (player.finishPosition ? 3 : 100) : player.finishPosition ? 100 : clamp(player.progress / 100) * 100;
          const label = survival
            ? player.finishPosition ? `ĐÃ LOẠI · HẠNG #${player.finishPosition}` : "● CÒN TRỤ"
            : player.finishPosition ? `VỀ ĐÍCH #${player.finishPosition}` : rank === 0 ? "ĐANG DẪN ĐẦU" : `CÁCH ĐÍCH ${Math.max(0, Math.round(100 - progress))}%`;
          return <div className={`race-progress-row ${player.finishPosition ? "finished" : ""} ${rank < 3 ? `top-${rank + 1}` : ""}`} key={player.id} style={{ transform: `translateY(${rank * rowHeight}px)` }}>
            <b className="race-live-rank">#{rank + 1}</b>
            <div className="race-player-label"><i style={{ backgroundImage: `url(${getCharacter(player.characterId).image})` }}/><span><strong>{player.name}</strong><small>{label}</small></span></div>
            <div className="race-progress-rail"><i className="race-progress-fill" style={{ width: `${progress}%`, background: player.color }}/><span className="race-progress-marker" style={{ left: `${progress}%` }}><i style={{ backgroundImage: `url(${getCharacter(player.characterId).image})` }}/></span></div>
            <strong className="race-progress-value">{survival ? player.finishPosition ? "OUT" : "✓" : player.finishPosition ? "✓" : `${Math.round(progress)}%`}</strong>
          </div>;
        })}
        {!players.length && <div className="race-progress-empty">Đang chờ dữ liệu tay đua…</div>}
      </div>
    </div>
    <div className="realtime-chip"><i/> LIVE · {survival ? "TRẠNG THÁI SINH TỒN" : "THỨ HẠNG TỰ ĐỘNG"}</div>
  </div>;
}
