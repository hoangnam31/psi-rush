import { getDb } from "../../../db";
import { rooms } from "../../../db/schema";
import { MAPS } from "../../../lib/game";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function makeCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { title?: string; maxPlayers?: number; totalRounds?: number; mapPool?: string[] };
    const validMapIds = new Set(MAPS.map((m) => m.id));
    const mapPool = (body.mapPool ?? []).filter((id) => validMapIds.has(id as never));
    const room = {
      id: crypto.randomUUID(), code: makeCode(), hostToken: crypto.randomUUID(),
      title: (body.title || "Wobble Cup").trim().slice(0, 40),
      maxPlayers: Math.max(2, Math.min(200, Number(body.maxPlayers) || 50)),
      totalRounds: Math.max(1, Math.min(7, Number(body.totalRounds) || 3)),
      mapPool: JSON.stringify(mapPool.length ? mapPool : MAPS.map((m) => m.id)),
    };
    const db = getDb();
    await db.insert(rooms).values(room);
    return Response.json({ code: room.code, hostToken: room.hostToken }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể tạo phòng" }, { status: 500 });
  }
}
