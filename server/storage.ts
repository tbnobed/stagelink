import { users, generatedLinks, shortLinks, type User, type InsertUser, type GeneratedLink, type InsertGeneratedLink, type ShortLink, type InsertShortLink } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, lt, and, isNotNull } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;
  
  // Generated Links
  getAllLinks(): Promise<GeneratedLink[]>;
  createLink(link: InsertGeneratedLink, userId?: number): Promise<GeneratedLink>;
  deleteLink(id: string): Promise<boolean>;
  deleteExpiredLinks(): Promise<number>;
  
  // Short Links
  getShortLink(code: string): Promise<ShortLink | undefined>;
  getShortLinkByParams(streamName: string, returnFeed: string, chatEnabled: boolean): Promise<ShortLink | undefined>;
  createShortLink(shortLink: InsertShortLink, userId?: number): Promise<ShortLink>;
  deleteShortLink(code: string): Promise<boolean>;
  deleteExpiredShortLinks(): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private links: Map<string, GeneratedLink>;
  private shortLinks: Map<string, ShortLink>;
  private userIdCounter: number = 1;

  constructor() {
    this.users = new Map();
    this.links = new Map();
    this.shortLinks = new Map();
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { 
      ...insertUser, 
      id,
      email: insertUser.email || null,
      role: insertUser.role || 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.password = hashedPassword;
      user.updatedAt = new Date();
      this.users.set(id, user);
    }
  }

  async getAllLinks(): Promise<GeneratedLink[]> {
    const now = new Date();
    const allLinks = Array.from(this.links.values());
    
    // Filter out expired links
    return allLinks.filter(link => !link.expiresAt || link.expiresAt > now);
  }

  async createLink(insertLink: InsertGeneratedLink, userId?: number): Promise<GeneratedLink> {
    const link: GeneratedLink = {
      ...insertLink,
      chatEnabled: insertLink.chatEnabled ?? false,
      createdAt: new Date(),
      expiresAt: insertLink.expiresAt ? new Date(insertLink.expiresAt) : null,
      createdBy: userId || null,
    };
    this.links.set(link.id, link);
    return link;
  }

  async deleteLink(id: string): Promise<boolean> {
    // Get the link before deleting it
    const deletedLink = this.links.get(id);
    const linkDeleted = this.links.delete(id);
    
    // Also delete any short links associated with this regular link
    if (linkDeleted && deletedLink) {
      // Remove short links that match this link's parameters
      for (const [shortId, shortLink] of Array.from(this.shortLinks.entries())) {
        if (shortLink.streamName === deletedLink.streamName && 
            shortLink.returnFeed === deletedLink.returnFeed &&
            shortLink.chatEnabled === deletedLink.chatEnabled) {
          this.shortLinks.delete(shortId);
        }
      }
    }
    
    return linkDeleted;
  }

  async deleteExpiredLinks(): Promise<number> {
    const now = new Date();
    let deletedCount = 0;
    
    for (const [id, link] of Array.from(this.links.entries())) {
      if (link.expiresAt && link.expiresAt <= now) {
        this.links.delete(id);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  async getShortLink(code: string): Promise<ShortLink | undefined> {
    const link = this.shortLinks.get(code);
    if (!link) {
      return undefined;
    }
    
    // Check if link has expired
    if (link.expiresAt && link.expiresAt <= new Date()) {
      // Clean up expired link
      this.shortLinks.delete(code);
      return undefined;
    }
    
    return link;
  }

  async getShortLinkByParams(streamName: string, returnFeed: string, chatEnabled: boolean): Promise<ShortLink | undefined> {
    const entries = Array.from(this.shortLinks.entries());
    for (const [code, link] of entries) {
      if (link.streamName === streamName && 
          link.returnFeed === returnFeed && 
          link.chatEnabled === chatEnabled) {
        
        // Check if link has expired
        if (link.expiresAt && link.expiresAt <= new Date()) {
          // Clean up expired link
          this.shortLinks.delete(code);
          continue;
        }
        
        return link;
      }
    }
    return undefined;
  }

  async createShortLink(insertShortLink: InsertShortLink, userId?: number): Promise<ShortLink> {
    const shortLink: ShortLink = {
      ...insertShortLink,
      chatEnabled: insertShortLink.chatEnabled ?? false,
      createdAt: new Date(),
      expiresAt: insertShortLink.expiresAt ? new Date(insertShortLink.expiresAt) : null,
      createdBy: userId || null,
    };
    this.shortLinks.set(shortLink.id, shortLink);
    return shortLink;
  }

  async deleteShortLink(code: string): Promise<boolean> {
    return this.shortLinks.delete(code);
  }

  async deleteExpiredShortLinks(): Promise<number> {
    const now = new Date();
    let deletedCount = 0;
    
    for (const [code, link] of Array.from(this.shortLinks.entries())) {
      if (link.expiresAt && link.expiresAt <= now) {
        this.shortLinks.delete(code);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount > 0;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async getAllLinks(): Promise<GeneratedLink[]> {
    const now = new Date();
    
    // First, clean up expired links
    await this.deleteExpiredLinks();
    
    // Return all non-expired links
    return await db.select().from(generatedLinks);
  }

  async createLink(insertLink: InsertGeneratedLink, userId?: number): Promise<GeneratedLink> {
    const [link] = await db
      .insert(generatedLinks)
      .values({
        ...insertLink,
        chatEnabled: insertLink.chatEnabled ?? false,
        createdAt: new Date(),
        expiresAt: insertLink.expiresAt ? new Date(insertLink.expiresAt) : null,
        createdBy: userId || null,
      })
      .returning();
    return link;
  }

  async deleteLink(id: string): Promise<boolean> {
    // Get the link details before deleting it
    const [deletedLink] = await db.select().from(generatedLinks).where(eq(generatedLinks.id, id));
    
    const result = await db
      .delete(generatedLinks)
      .where(eq(generatedLinks.id, id));
    
    // If link was deleted, also clean up associated short links
    if ((result.rowCount ?? 0) > 0 && deletedLink) {
      await db
        .delete(shortLinks)
        .where(
          and(
            eq(shortLinks.streamName, deletedLink.streamName),
            eq(shortLinks.returnFeed, deletedLink.returnFeed),
            eq(shortLinks.chatEnabled, deletedLink.chatEnabled)
          )
        );
    }
    
    return (result.rowCount ?? 0) > 0;
  }

  async deleteExpiredLinks(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(generatedLinks)
      .where(
        and(
          isNotNull(generatedLinks.expiresAt),
          lt(generatedLinks.expiresAt, now)
        )
      );
    return result.rowCount || 0;
  }

  async getShortLink(code: string): Promise<ShortLink | undefined> {
    const [link] = await db.select().from(shortLinks).where(eq(shortLinks.id, code));
    
    if (!link) {
      return undefined;
    }
    
    // Check if link has expired
    if (link.expiresAt && link.expiresAt <= new Date()) {
      // Clean up expired link immediately
      await this.deleteShortLink(code);
      return undefined;
    }
    
    return link;
  }

  async getShortLinkByParams(streamName: string, returnFeed: string, chatEnabled: boolean): Promise<ShortLink | undefined> {
    const [link] = await db
      .select()
      .from(shortLinks)
      .where(
        and(
          eq(shortLinks.streamName, streamName),
          eq(shortLinks.returnFeed, returnFeed),
          eq(shortLinks.chatEnabled, chatEnabled)
        )
      )
      .limit(1);
    
    if (!link) {
      return undefined;
    }
    
    // Check if link has expired
    if (link.expiresAt && link.expiresAt <= new Date()) {
      // Clean up expired link immediately
      await this.deleteShortLink(link.id);
      return undefined;
    }
    
    return link;
  }

  async createShortLink(insertShortLink: InsertShortLink, userId?: number): Promise<ShortLink> {
    const [shortLink] = await db
      .insert(shortLinks)
      .values({
        ...insertShortLink,
        chatEnabled: insertShortLink.chatEnabled ?? false,
        createdAt: new Date(),
        expiresAt: insertShortLink.expiresAt ? new Date(insertShortLink.expiresAt) : null,
        createdBy: userId || null,
      })
      .returning();
    return shortLink;
  }

  async deleteShortLink(code: string): Promise<boolean> {
    const result = await db
      .delete(shortLinks)
      .where(eq(shortLinks.id, code));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteExpiredShortLinks(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(shortLinks)
      .where(
        and(
          isNotNull(shortLinks.expiresAt),
          lt(shortLinks.expiresAt, now)
        )
      );
    return result.rowCount || 0;
  }
}

export const storage = new DatabaseStorage();
