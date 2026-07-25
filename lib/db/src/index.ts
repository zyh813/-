import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use explicit SSL config to suppress pg's sslmode deprecation warning.
// Local / non-SSL connections (localhost / no sslmode in URL) skip SSL entirely.
const isLocalDb =
  process.env.DATABASE_URL?.includes("localhost") ||
  process.env.DATABASE_URL?.includes("127.0.0.1") ||
  !process.env.DATABASE_URL?.includes("sslmode");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: true },
});
export const db = drizzle(pool, { schema });

export * from "./schema";
