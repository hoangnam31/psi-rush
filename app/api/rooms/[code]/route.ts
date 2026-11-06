import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { players, rooms, roundResults } from "../../../../db/schema";
import { courseWidthForPlayers, getMapMode, pickMap, scoreForPosition } from "../../../../lib/game";
import { getCharacter, isCharacterId } from "../../../../lib/characters";

type Context = { params: Promise<{ code: string }> };

async function retryDb<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { return await operation(); }
    catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        const backoff = 70 * 2 ** attempt + Math.random() * 70;
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }
  throw lastError;
}

async function getRoom(code: string) {
  const db = getDb();
  return (await retryDb(() => db.select().from(rooms).where(eq(rooms.code, code.toUpperCase())).limit(1)))[0];
}

type RoomRow = NonNullable<Awaited<ReturnType<typeof getRoom>>>;

async function syncPlayerScore(db: ReturnType<typeof getDb>, roomId: string, playerId: string) {
  await db.update(players).set({
    score: sql<number>`coalesce((select sum("round_results"."points") from "round_results" where "round_results"."room_id" = ${roomId} and "round_results"."player_id" = ${players.id}), 0)`,
  }).where(eq(players.id, playerId));
}

async function syncRoomScores(db: ReturnType<typeof getDb>, roomId: string) {
  await db.update(players).set({
    score: sql<number>`coalesce((select sum("round_results"."points") from "round_results" where "round_results"."room_id" = ${roomId} and "round_results"."player_id" = ${players.id}), 0)`,
  }).where(eq(players.roomId, roomId));
}

async function getRoomPayload(room: RoomRow, isHost: boolean, includeResults = true) {
  const db = getDb();
  const roster = await retryDb(() => db.select({
    id: players.id, name: players.name, characterId: players.characterId, color: players.color, score: players.score,
    progress: players.progress, positionX: players.positionX, finishPosition: players.finishPosition,
    isReady: players.isReady,
  }).from(players).where(eq(players.roomId, room.id)).orderBy(asc(players.name)));
  const results = includeResults
    ? await retryDb(() => db.select().from(roundResults).where(eq(roundResults.roomId, room.id)).orderBy(desc(roundResults.roundNumber), asc(roundResults.position)))
    : [];
  return {
    room: { ...room, hostToken: undefined, mapPool: JSON.parse(room.mapPool), isHost },
    players: roster,
    results,
  };
}

export async function GET(request: Request, context: Context) {
  try {
    const { code } = await context.params; const room = await getRoom(code);
    if (!room) return Response.json({ error: "Không tìm thấy phòng" }, { status: 404 });
    const hostToken = new URL(request.url).searchParams.get("hostToken");
    const isHost = hostToken === room.hostToken;
    const includeResults = isHost || room.status === "results" || room.status === "finished";
    return Response.json(await getRoomPayload(room, isHost, includeResults), {
      headers: { "cache-control": "public, max-age=0, s-maxage=1" },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể tải phòng" }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || ""); const db = getDb();
    const playerId = String(body.playerId || ""), playerToken = String(body.playerToken || "");

    // High-frequency player updates authenticate directly with the player's
    // opaque id/token. They do not need a room lookup first, removing one D1
    // read from every position write in a 200-player match.
    if (action === "progress") {
      const progress = Math.max(0, Math.min(99.8, Number(body.progress) || 0));
      const positionX = Math.max(-120, Math.min(3120, Number(body.positionX) || 800));
      await retryDb(() => db.update(players).set({ progress, positionX, lastSeenAt: sql`CURRENT_TIMESTAMP` }).where(and(
        eq(players.id, playerId), eq(players.token, playerToken),
      )));
      return Response.json({ ok: true });
    }
    if (action === "ready") {
      await retryDb(() => db.update(players).set({ isReady: Boolean(body.ready), lastSeenAt: sql`CURRENT_TIMESTAMP` }).where(and(
        eq(players.id, playerId), eq(players.token, playerToken),
      )));
      return Response.json({ ok: true });
    }

    const { code } = await context.params; const room = await getRoom(code);
    if (!room) return Response.json({ error: "Mã phòng không tồn tại" }, { status: 404 });

    if (action === "join") {
      if (room.status !== "waiting") return Response.json({ error: "Trận đấu đã bắt đầu" }, { status: 409 });
      const count = Number((await retryDb(() => db.select({ count: sql<number>`count(*)` }).from(players).where(eq(players.roomId, room.id))))[0]?.count ?? 0);
      if (count >= room.maxPlayers) return Response.json({ error: "Phòng đã đầy" }, { status: 409 });
      const name = String(body.name || "").trim().slice(0, 16);
      if (!name) return Response.json({ error: "Hãy nhập tên người chơi" }, { status: 400 });
      const characterId = isCharacterId(body.characterId) ? body.characterId : getCharacter().id;
      const player = { id: crypto.randomUUID(), roomId: room.id, token: crypto.randomUUID(), name, characterId, color: getCharacter(characterId).accent };
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
          const playerCount = Number((await retryDb(() => db.select({ count: sql<number>`count(*)` }).from(players).where(eq(players.roomId, room.id))))[0]?.count ?? 1);
          await db.update(players).set({ progress: 0, positionX: Math.round(courseWidthForPlayers(playerCount) / 2), finishPosition: null }).where(eq(players.roomId, room.id));
          await db.update(rooms).set({ status: "racing", currentRound: nextRound, currentMap: pickMap(pool, room.currentMap, nextRound, room.id), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(rooms.id, room.id));
        }
      } else if (action === "endRound") {
        const roster = await db.select().from(players).where(eq(players.roomId, room.id));
        const completed = await db.select().from(roundResults).where(and(eq(roundResults.roomId, room.id), eq(roundResults.roundNumber, room.currentRound)));
        // A solo survival player is always the winner of the room, even when
        // they fall or touch a laser before the host closes the round. Repair
        // results created by older builds that incorrectly forced rank #2.
        if (roster.length === 1 && completed.length === 1 && (completed[0].position !== 1 || completed[0].points !== scoreForPosition(1))) {
          await db.update(roundResults).set({ position: 1, points: scoreForPosition(1) }).where(eq(roundResults.id, completed[0].id));
          completed[0].position = 1;
          completed[0].points = scoreForPosition(1);
        }
        const completedIds = new Set(completed.map((result) => result.playerId));
        const pendingResults: Array<typeof roundResults.$inferInsert> = [];
        if (getMapMode(room.currentMap) === "survival") {
          const survivors = roster.filter((item) => !completedIds.has(item.id)).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
          for (let index = 0; index < survivors.length; index++) {
            const survivor = survivors[index], position = index + 1, points = scoreForPosition(position);
            pendingResults.push({ roomId: room.id, roundNumber: room.currentRound, playerId: survivor.id, position, points, timeMs: 0 });
          }
        } else {
          // When the host closes a race before everyone reaches the finish,
          // rank every remaining racer by live progress so no round silently
          // awards zero points to unfinished players.
          const unfinished = roster
            .filter((item) => !completedIds.has(item.id))
            .sort((a, b) => b.progress - a.progress || a.joinedAt.localeCompare(b.joinedAt));
          for (let index = 0; index < unfinished.length; index++) {
            const racer = unfinished[index], position = completed.length + index + 1, points = scoreForPosition(position);
            pendingResults.push({ roomId: room.id, roundNumber: room.currentRound, playerId: racer.id, position, points, timeMs: 0 });
          }
        }
        if (pendingResults.length) await db.insert(roundResults).values(pendingResults);
        await db.update(players).set({
          finishPosition: sql<number>`(select "round_results"."position" from "round_results" where "round_results"."room_id" = ${room.id} and "round_results"."round_number" = ${room.currentRound} and "round_results"."player_id" = ${players.id} limit 1)`,
        }).where(eq(players.roomId, room.id));
        await syncRoomScores(db, room.id);
        const roundStatus = room.currentRound >= room.totalRounds ? "finished" : "results";
        await db.update(rooms).set({ status: roundStatus, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(rooms.id, room.id));
      } else if (action === "finishGame") {
        await db.update(rooms).set({ status: "finished", updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(rooms.id, room.id));
      } else {
        await db.delete(roundResults).where(eq(roundResults.roomId, room.id));
        await db.update(players).set({ score: 0, progress: 0, positionX: 800, finishPosition: null }).where(eq(players.roomId, room.id));
        await db.update(rooms).set({ status: "waiting", currentRound: 0, currentMap: null, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(rooms.id, room.id));
      }
      return Response.json({ ok: true });
    }

    const player = (await db.select().from(players).where(and(eq(players.id, playerId), eq(players.roomId, room.id), eq(players.token, playerToken))).limit(1))[0];
    if (!player) return Response.json({ error: "Phiên người chơi không hợp lệ" }, { status: 403 });
    if (action === "finish") {
      const existing = (await db.select().from(roundResults).where(and(eq(roundResults.roomId, room.id), eq(roundResults.roundNumber, room.currentRound), eq(roundResults.playerId, player.id))).limit(1))[0];
      if (!existing) {
        const count = Number((await db.select({ count: sql<number>`count(*)` }).from(roundResults).where(and(eq(roundResults.roomId, room.id), eq(roundResults.roundNumber, room.currentRound))))[0]?.count ?? 0);
        const position = count + 1, points = scoreForPosition(position);
        await db.insert(roundResults).values({ roomId: room.id, roundNumber: room.currentRound, playerId: player.id, position, points, timeMs: Math.max(0, Number(body.timeMs) || 0) });
        await db.update(players).set({ progress: 100, finishPosition: position, lastSeenAt: sql`CURRENT_TIMESTAMP` }).where(eq(players.id, player.id));
        await syncPlayerScore(db, room.id, player.id);
        return Response.json({ ok: true, position, points });
      }
    } else if (action === "eliminate") {
      if (getMapMode(room.currentMap) !== "survival") return Response.json({ error: "Map hiện tại không phải chế độ sinh tồn" }, { status: 409 });
      const existing = (await db.select().from(roundResults).where(and(eq(roundResults.roomId, room.id), eq(roundResults.roundNumber, room.currentRound), eq(roundResults.playerId, player.id))).limit(1))[0];
      if (existing) return Response.json({ ok: true, position: existing.position, points: existing.points });

      const roster = await db.select().from(players).where(eq(players.roomId, room.id));
      const completed = await db.select().from(roundResults).where(and(eq(roundResults.roomId, room.id), eq(roundResults.roundNumber, room.currentRound)));
      // Elimination order runs from the current player count down to #1.
      // Do not force a minimum of #2: in a one-player room, losing early is
      // still rank #1 because there is no opponent above that player.
      const position = Math.max(1, roster.length - completed.length);
      const points = scoreForPosition(position);
      await db.insert(roundResults).values({ roomId: room.id, roundNumber: room.currentRound, playerId: player.id, position, points, timeMs: Math.max(0, Number(body.timeMs) || 0) });
      await db.update(players).set({ finishPosition: position, lastSeenAt: sql`CURRENT_TIMESTAMP` }).where(eq(players.id, player.id));
      await syncPlayerScore(db, room.id, player.id);

      const completedIds = new Set([...completed.map((result) => result.playerId), player.id]);
      const survivors = roster.filter((item) => !completedIds.has(item.id));
      if (survivors.length === 1) {
        const winner = survivors[0];
        const winnerPoints = scoreForPosition(1);
        await db.insert(roundResults).values({ roomId: room.id, roundNumber: room.currentRound, playerId: winner.id, position: 1, points: winnerPoints, timeMs: Math.max(0, Number(body.timeMs) || 0) });
        await db.update(players).set({ finishPosition: 1, lastSeenAt: sql`CURRENT_TIMESTAMP` }).where(eq(players.id, winner.id));
        await syncPlayerScore(db, room.id, winner.id);
      }
      return Response.json({ ok: true, position, points });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Thao tác thất bại" }, { status: 500 });
  }
}
