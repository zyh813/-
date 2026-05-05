import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const schedulerConfigTable = pgTable("scheduler_config", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  intervalMs: integer("interval_ms").notNull().default(300000),
  testUrl: text("test_url").notNull().default("https://httpbin.org/ip"),
});

export const insertSchedulerConfigSchema = createInsertSchema(schedulerConfigTable);
export type InsertSchedulerConfig = z.infer<typeof insertSchedulerConfigSchema>;
export type SchedulerConfig = typeof schedulerConfigTable.$inferSelect;
