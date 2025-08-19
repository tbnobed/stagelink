import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: text("password").notNull(),
  email: varchar("email", { length: 100 }),
  role: userRoleEnum("role").notNull().default('user'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type User = typeof users.$inferSelect;

export const generatedLinks = pgTable("generated_links", {
  id: text("id").primaryKey(),
  streamName: text("stream_name").notNull(),
  returnFeed: text("return_feed").notNull(),
  chatEnabled: boolean("chat_enabled").notNull().default(false),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertGeneratedLinkSchema = createInsertSchema(generatedLinks).omit({
  createdAt: true,
  createdBy: true,
});
export type InsertGeneratedLink = z.infer<typeof insertGeneratedLinkSchema>;
export type GeneratedLink = typeof generatedLinks.$inferSelect;
