import { users, generatedLinks, type User, type InsertUser, type GeneratedLink, type InsertGeneratedLink } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, lt, and, isNotNull } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Generated Links
  getAllLinks(): Promise<GeneratedLink[]>;
  createLink(link: InsertGeneratedLink): Promise<GeneratedLink>;
  deleteLink(id: string): Promise<boolean>;
  deleteExpiredLinks(): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private links: Map<string, GeneratedLink>;

  constructor() {
    this.users = new Map();
    this.links = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllLinks(): Promise<GeneratedLink[]> {
    const now = new Date();
    const allLinks = Array.from(this.links.values());
    
    // Filter out expired links
    return allLinks.filter(link => !link.expiresAt || link.expiresAt > now);
  }

  async createLink(insertLink: InsertGeneratedLink): Promise<GeneratedLink> {
    const link: GeneratedLink = {
      ...insertLink,
      chatEnabled: insertLink.chatEnabled ?? false,
      createdAt: new Date(),
      expiresAt: insertLink.expiresAt ? new Date(insertLink.expiresAt) : null,
    };
    this.links.set(link.id, link);
    return link;
  }

  async deleteLink(id: string): Promise<boolean> {
    return this.links.delete(id);
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
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
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllLinks(): Promise<GeneratedLink[]> {
    const now = new Date();
    
    // First, clean up expired links
    await this.deleteExpiredLinks();
    
    // Return all non-expired links
    return await db.select().from(generatedLinks);
  }

  async createLink(insertLink: InsertGeneratedLink): Promise<GeneratedLink> {
    const [link] = await db
      .insert(generatedLinks)
      .values({
        ...insertLink,
        chatEnabled: insertLink.chatEnabled ?? false,
        createdAt: new Date(),
        expiresAt: insertLink.expiresAt ? new Date(insertLink.expiresAt) : null,
      })
      .returning();
    return link;
  }

  async deleteLink(id: string): Promise<boolean> {
    const result = await db
      .delete(generatedLinks)
      .where(eq(generatedLinks.id, id));
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
}

export const storage = new DatabaseStorage();
