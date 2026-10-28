import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { players, rooms, roundResults } from "../../../../db/schema";
import { getMapMode, pickMap, scoreForPosition } from "../../../../lib/game";

type Context = { params: Promise<{ code: string }> };

async function getRoom(code: string) {
  const db = getDb();
  return (await db.select().from(rooms).where(eq(rooms.code, code.toUpperCase())).limit(1))[0];
}

export async function GET(request: Request, context: Context) {
  try {
    const { code } = await context.params; const room = await getRoom(code);
    if (!room) return Response.json({ error: "Không tìm thấy phòng" }, { status: 404 });
    const db = getDb();
    const roster = await db.select({
      id: players.id, name: players.name, color: players.color, score: players.score,
      progress: players.progress, positionX: players.positionX, finishPosition: players.finishPosition,
      isReady: players.isReady, lastSeenAt: players.lastSeenAt,
    }).from(players).where(eq(players.roomId, room.id)).orderBy(desc(players.score), desc(players.progress));
    const results = await db.select().from(roundResults).where(eq(roundResults.roomId, room.id)).orderBy(desc(roundResults.roundNumber), asc(roundResults.position));
    const hostToken = new URL(request.url).searchParams.get("hostToken");
    return Response.json({
      room: { ...room, hostToken: undefined, mapPool: JSON.parse(room.mapPool), isHost: hostToken === room.hostToken },
      players: roster, results,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể tải phòng" }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { code } = await context.params; const room = await getRoom(code);
    if (!room) return Response.json({ error: "Mã phòng không tồn tại" }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || ""); const db = getDb();

    if (action === "join") {
      if (room.status !== "waiting") return Response.json({ error: "Trận đấu đã bắt đầu" }, { status: 409 });
      const count = (await db.select({ count: sql<number>`count(*)` }).from(players).where(eq(players.roomId, room.id)))[0]?.count ?? 0;
      if (count >= room.maxPlayers) return Response.json({ error: "Phòng đã đầy" }, { status: 409 });
      const name = String(body.name || "").trim().slice(0, 16);
      if (!name) return Response.json({ error: "Hãy nhập tên người chơi" }, { status: 400 });
      const player = { id: crypto.randomUUID(), roomId: room.id, token: crypto.randomUUID(), name, color: String(body.color || "#8b5cf6") };
      try { await db.insert(players).values(player); }
      catch { return Response.json({ error: "Tên này đã có trong phòng" }, { status: 409 }); }
      return Response.json({ playerId: player.id, playerToken: player.token, roomCode: room.code }, { status: 201 });
    }

    const hostToken = String(body.hostToken || "");
    if (["start", "next", "endRound", "finishGame", "reset"].includes(action)) {
      if (hostToken !== room.hostToken) return Response.json({ error: "Không có quyền host" }, { status: 403 });
      const pool = JSON.parse(room.mapPool) as string[];
      if (action === "start" || action === "next") {
        const nextRound = action === "start" ? Math.max(1, room.currentRound) : room.currentRound + 1;
        if (nextRound > room.totalRounds) {
          await db.update(rooms).set({ status: "finished", updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(rooms.id, room.id));
        } else {
          await db.update(players).set({ progress: 0, positionX: 800, finishPosition: null }).where(eq(players.roomId, room.id));
          await db.update(rooms).set({ status: "racing", currentRound: nextRound, currentMap: pickMap(pool, room.currentMap), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(rooms.id, room.id));
        }
      } else if (action === "endRound") {
        if (getMapMode(room.currentMap) === "survival") {
          const roster = await db.select().from(players).where(eq(players.roomId, room.id));
          const completed = await db.select().from(roundResults).where(and(eq(roundResults.roomId, room.id), eq(roundResults.roundNumber, room.currentRound)));
          const completedIds = new Set(completed.map((result) => result.playerId));
          const survivors = roster.filter((item) => !completedIds.has(item.id)).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
          for (let index = 0; index < survivors.length; index++) {
            const survivor = survivors[index], position = index + 1, points = scoreForPosition(position);
            await db.insert(roundResults).values({ roomId: room.id, roundNumber: room.currentRound, playerId: survivor.id, position, points, timeMs: 0 });
            await db.update(players).set({ finishPosition: position, score: sql`${players.score} + ${points}` }).where(eq(players.id, survivor.id));
          }
        }
        await db.update(rooms).set({ status: "results", updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(rooms.id, room.id));
      } else if (action === "finishGame") {
        await db.update(rooms).set({ status: "finished", updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(rooms.id, room.id));
      } else {
        await db.delete(roundResults).where(eq(roundResults.roomId, room.id));
        await db.update(players).set({ score: 0, progress: 0, positionX: 800, finishPosition: null }).where(eq(players.roomId, room.id));
        await db.update(rooms).set({ status: "waiting", currentRound: 0, currentMap: null, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(rooms.id, room.id));
      }
      return Response.json({ ok: true });
    }

    const playerId = String(body.playerId || ""), playerToken = String(body.playerToken || "");
    const player = (await db.select().from(players).where(and(eq(players.id, playerId), eq(players.roomId, room.id), eq(players.token, playerToken))).limit(1))[0];
    if (!player) return Response.json({ error: "Phiên người chơi không hợp lệ" }, { status: 403 });
    if (action === "ready") {
      await db.update(players).set({ isReady: Boolean(body.ready), lastSeenAt: sql`CURRENT_TIMESTAMP` }).where(eq(players.id, player.id));
    } else if (action === "progress") {
      const progress = Math.max(0, Math.min(99.8, Number(body.progress) || 0));
      const positionX = Math.max(-80, Math.min(1680, Number(body.positionX) || 800));
      await db.update(players).set({ progress, positionX, lastSeenAt: sql`CURRENT_TIMESTAMP` }).where(eq(players.id, player.id));
    } else if (action === "finish") {
      const existing = (await db.select().from(roundResults).where(and(eq(roundResults.roomId, room.id), eq(roundResults.roundNumber, room.currentRound), eq(roundResults.playerId, player.id))).limit(1))[0];
      if (!existing) {
        const count = (await db.select({ count: sql<number>`count(*)` }).from(roundResults).where(and(eq(roundResults.roomId, room.id), eq(roundResults.roundNumber, room.currentRound))))[0]?.count ?? 0;
        const position = count + 1, points = scoreForPosition(position);
        await db.insert(roundResults).values({ roomId: room.id, roundNumber: room.currentRound, playerId: player.id, position, points, timeMs: Math.max(0, Number(body.timeMs) || 0) });
        await db.update(players).set({ progress: 100, finishPosition: position, score: sql`${players.score} + ${points}`, lastSeenAt: sql`CURRENT_TIMESTAMP` }).where(eq(players.id, player.id));
        return Response.json({ ok: true, position, points });
      }
    } else if (action === "eliminate") {
      if (getMapMode(room.currentMap) !== "survival") return Response.json({ error: "Map hiện tại không phải chế độ sinh tồn" }, { status: 409 });
      const existing = (await db.select().from(roundResults).where(and(eq(roundResults.roomId, room.id), eq(roundResults.roundNumber, room.currentRound), eq(roundResults.playerId, player.id))).limit(1))[0];
      if (existing) return Response.json({ ok: true, position: existing.position, points: existing.points });

      const roster = await db.select().from(players).where(eq(players.roomId, room.id));
      const completed = await db.select().from(roundResults).where(and(eq(roundResults.roomId, room.id), eq(roundResults.roundNumber, room.currentRound)));
      const position = Math.max(2, roster.length - completed.length);
      const points = scoreForPosition(position);
      await db.insert(roundResults).values({ roomId: room.id, roundNumber: room.currentRound, playerId: player.id, position, points, timeMs: Math.max(0, Number(body.timeMs) || 0) });
      await db.update(players).set({ finishPosition: position, score: sql`${players.score} + ${points}`, lastSeenAt: sql`CURRENT_TIMESTAMP` }).where(eq(players.id, player.id));

      const completedIds = new Set([...completed.map((result) => result.playerId), player.id]);
      const survivors = roster.filter((item) => !completedIds.has(item.id));
      if (survivors.length === 1) {
        const winner = survivors[0];
        const winnerPoints = scoreForPosition(1);
        await db.insert(roundResults).values({ roomId: room.id, roundNumber: room.currentRound, playerId: winner.id, position: 1, points: winnerPoints, timeMs: Math.max(0, Number(body.timeMs) || 0) });
        await db.update(players).set({ finishPosition: 1, score: sql`${players.score} + ${winnerPoints}`, lastSeenAt: sql`CURRENT_TIMESTAMP` }).where(eq(players.id, winner.id));
      }
      return Response.json({ ok: true, position, points });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Thao tác thất bại" }, { status: 500 });
  }
}
