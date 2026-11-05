import { boolean, integer, pgTable, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const timestampOptions = { mode: "string", withTimezone: true } as const;

export const rooms = pgTable("rooms", {
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
  createdAt: timestamp("created_at", timestampOptions).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", timestampOptions).notNull().defaultNow(),
});

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8b5cf6"),
  score: integer("score").notNull().default(0),
  progress: real("progress").notNull().default(0),
  positionX: real("position_x").notNull().default(800),
  finishPosition: integer("finish_position"),
  isReady: boolean("is_ready").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", timestampOptions).notNull().defaultNow(),
  joinedAt: timestamp("joined_at", timestampOptions).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("players_room_name_unique").on(table.roomId, table.name),
]);

export const roundResults = pgTable("round_results", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  points: integer("points").notNull(),
  timeMs: integer("time_ms").notNull(),
  createdAt: timestamp("created_at", timestampOptions).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("round_result_player_unique").on(table.roomId, table.roundNumber, table.playerId),
]);
