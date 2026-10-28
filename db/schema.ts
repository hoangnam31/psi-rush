// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
export {};
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  hostToken: text("host_token").notNull(),
  title: text("title").notNull().default("Wobble Cup"),
  status: text("status").notNull().default("waiting"),
  maxPlayers: integer("max_players").notNull().default(50),
  totalRounds: integer("total_rounds").notNull().default(3),
  currentRound: integer("current_round").notNull().default(0),
  currentMap: text("current_map"),
  mapPool: text("map_pool").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8b5cf6"),
  score: integer("score").notNull().default(0),
  progress: real("progress").notNull().default(0),
  positionX: real("position_x").notNull().default(800),
  finishPosition: integer("finish_position"),
  isReady: integer("is_ready", { mode: "boolean" }).notNull().default(false),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("players_room_name_unique").on(table.roomId, table.name),
]);

export const roundResults = sqliteTable("round_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  points: integer("points").notNull(),
  timeMs: integer("time_ms").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("round_result_player_unique").on(table.roomId, table.roundNumber, table.playerId),
]);
