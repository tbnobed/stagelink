import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum('user_role', ['admin', 'engineer', 'user']);

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
  sessionToken: text("session_token").unique(), // One-time use token
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

// Short links table for URL shortening
export const shortLinks = pgTable("short_links", {
  id: text("id").primaryKey(), // Short code like "a1b2c3"
  streamName: text("stream_name").notNull(),
  returnFeed: text("return_feed").notNull(),
  chatEnabled: boolean("chat_enabled").notNull().default(false),
  sessionToken: text("session_token").unique(), // One-time use token
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertShortLinkSchema = createInsertSchema(shortLinks).omit({
  createdAt: true,
  createdBy: true,
});
export type InsertShortLink = z.infer<typeof insertShortLinkSchema>;
export type ShortLink = typeof shortLinks.$inferSelect;

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(), // UUID token
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  used: boolean("used").notNull().default(false),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Session tokens table for reusable tokens that expire or get deleted with links
export const sessionTokens = pgTable("session_tokens", {
  id: text("id").primaryKey(), // UUID token
  linkId: text("link_id"), // Can be null for direct access tokens
  linkType: text("link_type"), // 'guest', 'viewer', or 'short'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertSessionTokenSchema = createInsertSchema(sessionTokens).omit({
  createdAt: true,
  createdBy: true,
});
export type InsertSessionToken = z.infer<typeof insertSessionTokenSchema>;
export type SessionToken = typeof sessionTokens.$inferSelect;

// Viewer links table for return feed viewing
export const viewerLinks = pgTable("viewer_links", {
  id: text("id").primaryKey(),
  returnFeed: text("return_feed").notNull(),
  chatEnabled: boolean("chat_enabled").notNull().default(false),
  url: text("url").notNull(),
  sessionToken: text("session_token").unique(), // One-time use token
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertViewerLinkSchema = createInsertSchema(viewerLinks).omit({
  createdAt: true,
  createdBy: true,
});
export type InsertViewerLink = z.infer<typeof insertViewerLinkSchema>;
export type ViewerLink = typeof viewerLinks.$inferSelect;

// Short viewer links table for URL shortening
export const shortViewerLinks = pgTable("short_viewer_links", {
  id: text("id").primaryKey(), // Short code like "v1b2c3"
  returnFeed: text("return_feed").notNull(),
  chatEnabled: boolean("chat_enabled").notNull().default(false),
  sessionToken: text("session_token").unique(), // One-time use token
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertShortViewerLinkSchema = createInsertSchema(shortViewerLinks).omit({
  createdAt: true,
  createdBy: true,
});
export type InsertShortViewerLink = z.infer<typeof insertShortViewerLinkSchema>;
export type ShortViewerLink = typeof shortViewerLinks.$inferSelect;

// Chat system tables
export const messageTypeEnum = pgEnum('message_type', ['individual', 'broadcast', 'system']);

export const chatMessages = pgTable("chat_messages", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  sessionId: text("session_id").notNull(), // Links to streaming session
  senderId: integer("sender_id").references(() => users.id),
  senderName: text("sender_name").notNull(), // Cached for performance
  recipientId: integer("recipient_id").references(() => users.id), // NULL for broadcast messages
  messageType: messageTypeEnum("message_type").notNull().default('individual'),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatParticipants = pgTable("chat_participants", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  sessionId: text("session_id").notNull(),
  userId: integer("user_id").references(() => users.id),
  username: text("username").notNull(), // Cached for performance
  role: userRoleEnum("role").notNull(),
  isOnline: boolean("is_online").notNull().default(true),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertChatParticipantSchema = createInsertSchema(chatParticipants).omit({
  id: true,
  joinedAt: true,
  lastSeenAt: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatParticipant = z.infer<typeof insertChatParticipantSchema>;
export type ChatParticipant = typeof chatParticipants.$inferSelect;

// Registration tokens for user invites
export const registrationTokens = pgTable("registration_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default('user'),
  token: text("token").notNull().unique(),
  inviterUserId: integer("inviter_user_id").references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  used: boolean("used").notNull().default(false),
});

export const insertRegistrationTokenSchema = createInsertSchema(registrationTokens).omit({
  id: true,
  createdAt: true,
  used: true,
});

export type InsertRegistrationToken = z.infer<typeof insertRegistrationTokenSchema>;
export type RegistrationToken = typeof registrationTokens.$inferSelect;

// Room system tables
export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  maxParticipants: integer("max_participants").default(10),
  chatEnabled: boolean("chat_enabled").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

export const roomParticipants = pgTable("room_participants", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  roomId: varchar("room_id").notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }),
  guestName: text("guest_name"), // For non-registered participants
  streamName: text("stream_name"), // The individual stream name for this participant
  isStreaming: boolean("is_streaming").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
});

export const roomStreamAssignments = pgTable("room_stream_assignments", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  roomId: varchar("room_id").notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  streamName: text("stream_name").notNull(),
  assignedUserId: integer("assigned_user_id").references(() => users.id),
  assignedGuestName: text("assigned_guest_name"),
  position: integer("position").default(0), // For grid positioning
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});

export const insertRoomParticipantSchema = createInsertSchema(roomParticipants).omit({
  id: true,
  joinedAt: true,
  lastSeenAt: true,
});

export const insertRoomStreamAssignmentSchema = createInsertSchema(roomStreamAssignments).omit({
  id: true,
  createdAt: true,
  createdBy: true,
});

export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertRoomParticipant = z.infer<typeof insertRoomParticipantSchema>;
export type RoomParticipant = typeof roomParticipants.$inferSelect;
export type InsertRoomStreamAssignment = z.infer<typeof insertRoomStreamAssignmentSchema>;
export type RoomStreamAssignment = typeof roomStreamAssignments.$inferSelect;
