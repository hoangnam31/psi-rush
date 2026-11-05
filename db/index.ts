import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb(databaseUrl: string) {
  return drizzle(neon(databaseUrl), { schema });
}

let database: ReturnType<typeof createDb> | undefined;

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL chưa được cấu hình. Hãy kết nối Neon/Postgres trong Vercel và thêm biến môi trường DATABASE_URL."
    );
  }

  database ??= createDb(databaseUrl);
  return database;
}
