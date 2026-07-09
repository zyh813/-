import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const proxiesTable = pgTable("proxies", {
  id: text("id").primaryKey(),
  url: text("url").notNull().unique(),
  protocol: text("protocol").notNull(),
  label: text("label"),
  group: text("group"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  consecutiveFails: integer("consecutive_fails").notNull().default(0),
  alive: boolean("alive").notNull().default(true),
  latencyMs: integer("latency_ms"),
});

export const insertProxySchema = createInsertSchema(proxiesTable).omit({ addedAt: true });
export type InsertProxy = z.infer<typeof insertProxySchema>;
export type Proxy = typeof proxiesTable.$inferSelect;
