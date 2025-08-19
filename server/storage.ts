import { type User, type InsertUser, type GeneratedLink, type InsertGeneratedLink } from "@shared/schema";
import { randomUUID } from "crypto";

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
      expiresAt: insertLink.expiresAt || null,
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

export const storage = new MemStorage();
