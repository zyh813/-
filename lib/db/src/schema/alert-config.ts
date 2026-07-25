import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alertConfigTable = pgTable("alert_config", {
  key: text("key").primaryKey(),
  webhookUrl: text("webhook_url"),
  onOffline: boolean("on_offline").notNull().default(true),
  onRecovery: boolean("on_recovery").notNull().default(true),
  latencyThresholdMs: integer("latency_threshold_ms"),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(30),
});

export const insertAlertConfigSchema = createInsertSchema(alertConfigTable);
export type InsertAlertConfig = z.infer<typeof insertAlertConfigSchema>;
export type AlertConfig = typeof alertConfigTable.$inferSelect;
