CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"token" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#8b5cf6' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"position_x" real DEFAULT 800 NOT NULL,
	"finish_position" integer,
	"is_ready" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"host_token" text NOT NULL,
	"title" text DEFAULT 'Wobble Cup' NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"max_players" integer DEFAULT 50 NOT NULL,
	"total_rounds" integer DEFAULT 3 NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"current_map" text,
	"map_pool" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "round_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"round_number" integer NOT NULL,
	"player_id" text NOT NULL,
	"position" integer NOT NULL,
	"points" integer NOT NULL,
	"time_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_results" ADD CONSTRAINT "round_results_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_results" ADD CONSTRAINT "round_results_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "players_room_name_unique" ON "players" USING btree ("room_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "round_result_player_unique" ON "round_results" USING btree ("room_id","round_number","player_id");