export type Player = {
  id: string; name: string; color: string; score: number; progress: number; positionX: number;
  finishPosition: number | null; isReady: boolean;
};

export type RoundResult = {
  id: number; roomId: string; roundNumber: number; playerId: string;
  position: number; points: number; timeMs: number; createdAt: string;
};

export type Room = {
  id: string; code: string; title: string; status: "waiting" | "racing" | "results" | "finished";
  maxPlayers: number; totalRounds: number; currentRound: number; currentMap: string | null;
  mapPool: string[]; isHost: boolean; updatedAt: string;
};

export type RoomState = { room: Room; players: Player[]; results: RoundResult[] };

export async function roomAction<T = any>(code: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(data.error || "Thao tác thất bại");
  return data as T;
}

export async function getRoomState(code: string, hostToken?: string): Promise<RoomState> {
  const suffix = hostToken ? `?hostToken=${encodeURIComponent(hostToken)}` : "";
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}${suffix}`, { cache: "no-store" });
  const data = await response.json() as RoomState & { error?: string };
  if (!response.ok) throw new Error(data.error || "Không tải được phòng");
  return data;
}
