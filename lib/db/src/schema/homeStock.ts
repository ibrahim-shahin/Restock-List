import { createInsertSchema } from "drizzle-zod";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const homeStockSyncTable = pgTable("home_stock_sync", {
  userId: text("user_id").primaryKey(),
  data: jsonb("data").notNull().$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertHomeStockSyncSchema = createInsertSchema(
  homeStockSyncTable,
).omit({ updatedAt: true });

export type InsertHomeStockSync = z.infer<typeof insertHomeStockSyncSchema>;
export type HomeStockSync = typeof homeStockSyncTable.$inferSelect;