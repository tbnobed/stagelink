import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const generatedLinks = pgTable("generated_links", {
  id: text("id").primaryKey(),
  streamName: text("stream_name").notNull(),
  returnFeed: text("return_feed").notNull(),
  chatEnabled: boolean("chat_enabled").notNull().default(false),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const insertGeneratedLinkSchema = createInsertSchema(generatedLinks);
export type InsertGeneratedLink = z.infer<typeof insertGeneratedLinkSchema>;
export type GeneratedLink = typeof generatedLinks.$inferSelect;
