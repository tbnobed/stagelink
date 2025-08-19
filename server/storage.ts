import { users, generatedLinks, shortLinks, viewerLinks, shortViewerLinks, sessionTokens, type User, type InsertUser, type GeneratedLink, type InsertGeneratedLink, type ShortLink, type InsertShortLink, type ViewerLink, type InsertViewerLink, type ShortViewerLink, type InsertShortViewerLink, type SessionToken, type InsertSessionToken } from "@shared/schema";
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
  
  // Viewer Links
  getAllViewerLinks(): Promise<ViewerLink[]>;
  createViewerLink(link: InsertViewerLink, userId?: number): Promise<ViewerLink>;
  deleteViewerLink(id: string): Promise<boolean>;
  deleteExpiredViewerLinks(): Promise<number>;
  
  // Short Viewer Links
  getShortViewerLink(code: string): Promise<ShortViewerLink | undefined>;
  getShortViewerLinkByParams(returnFeed: string, chatEnabled: boolean): Promise<ShortViewerLink | undefined>;
  createShortViewerLink(shortViewerLink: InsertShortViewerLink, userId?: number): Promise<ShortViewerLink>;
  deleteShortViewerLink(code: string): Promise<boolean>;
  deleteExpiredShortViewerLinks(): Promise<number>;
  
  // Session Tokens
  validateAndConsumeSessionToken(token: string): Promise<{ valid: boolean; linkId?: string; linkType?: string }>;
  createSessionToken(linkId: string, linkType: string, expiresAt: Date, userId?: number): Promise<SessionToken>;
  cleanupExpiredTokens(): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private links: Map<string, GeneratedLink>;
  private shortLinks: Map<string, ShortLink>;
  private viewerLinks: Map<string, ViewerLink>;
  private shortViewerLinks: Map<string, ShortViewerLink>;
  private sessionTokens: Map<string, SessionToken>;
  private userIdCounter: number = 1;

  constructor() {
    this.users = new Map();
    this.links = new Map();
    this.shortLinks = new Map();
    this.viewerLinks = new Map();
    this.shortViewerLinks = new Map();
    this.sessionTokens = new Map();
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
      sessionToken: null, // Always null in MemStorage
    };
    this.links.set(link.id, link);
    return link;
  }

  async deleteLink(id: string): Promise<boolean> {
    // Get the link before deleting it
    const deletedLink = this.links.get(id);
    const linkDeleted = this.links.delete(id);
    
    // SECURITY FIX: Invalidate session tokens associated with this link
    if (linkDeleted && deletedLink) {
      // Invalidate session tokens for this link
      for (const [tokenId, token] of Array.from(this.sessionTokens.entries())) {
        if (token.linkId === id && token.linkType === 'stream') {
          this.sessionTokens.delete(tokenId);
        }
      }
      
      // Also delete any short links associated with this regular link
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
      sessionToken: null, // Always null in MemStorage
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

  // Viewer Links Methods
  async getAllViewerLinks(): Promise<ViewerLink[]> {
    const now = new Date();
    const allLinks = Array.from(this.viewerLinks.values());
    
    // Filter out expired links
    return allLinks.filter(link => !link.expiresAt || link.expiresAt > now);
  }

  async createViewerLink(insertViewerLink: InsertViewerLink, userId?: number): Promise<ViewerLink> {
    const viewerLink: ViewerLink = {
      ...insertViewerLink,
      chatEnabled: insertViewerLink.chatEnabled ?? false,
      createdAt: new Date(),
      expiresAt: insertViewerLink.expiresAt ? new Date(insertViewerLink.expiresAt) : null,
      createdBy: userId || null,
      sessionToken: null, // Always null in MemStorage
    };
    this.viewerLinks.set(viewerLink.id, viewerLink);
    return viewerLink;
  }

  async deleteViewerLink(id: string): Promise<boolean> {
    const linkDeleted = this.viewerLinks.delete(id);
    
    // SECURITY FIX: Invalidate session tokens associated with this viewer link
    if (linkDeleted) {
      for (const [tokenId, token] of Array.from(this.sessionTokens.entries())) {
        if (token.linkId === id && token.linkType === 'viewer') {
          this.sessionTokens.delete(tokenId);
        }
      }
    }
    
    return linkDeleted;
  }

  async deleteExpiredViewerLinks(): Promise<number> {
    const now = new Date();
    let deletedCount = 0;
    
    for (const [id, link] of Array.from(this.viewerLinks.entries())) {
      if (link.expiresAt && link.expiresAt <= now) {
        this.viewerLinks.delete(id);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  // Short Viewer Links Methods
  async getShortViewerLink(code: string): Promise<ShortViewerLink | undefined> {
    const link = this.shortViewerLinks.get(code);
    if (!link) {
      return undefined;
    }
    
    // Check if link has expired
    if (link.expiresAt && link.expiresAt <= new Date()) {
      // Clean up expired link
      this.shortViewerLinks.delete(code);
      return undefined;
    }
    
    return link;
  }

  async getShortViewerLinkByParams(returnFeed: string, chatEnabled: boolean): Promise<ShortViewerLink | undefined> {
    const entries = Array.from(this.shortViewerLinks.entries());
    for (const [code, link] of entries) {
      if (link.returnFeed === returnFeed && link.chatEnabled === chatEnabled) {
        
        // Check if link has expired
        if (link.expiresAt && link.expiresAt <= new Date()) {
          // Clean up expired link
          this.shortViewerLinks.delete(code);
          continue;
        }
        
        return link;
      }
    }
    return undefined;
  }

  async createShortViewerLink(insertShortViewerLink: InsertShortViewerLink, userId?: number): Promise<ShortViewerLink> {
    const shortViewerLink: ShortViewerLink = {
      ...insertShortViewerLink,
      chatEnabled: insertShortViewerLink.chatEnabled ?? false,
      createdAt: new Date(),
      expiresAt: insertShortViewerLink.expiresAt ? new Date(insertShortViewerLink.expiresAt) : null,
      createdBy: userId || null,
      sessionToken: null, // Always null in MemStorage
    };
    this.shortViewerLinks.set(shortViewerLink.id, shortViewerLink);
    return shortViewerLink;
  }

  async deleteShortViewerLink(code: string): Promise<boolean> {
    return this.shortViewerLinks.delete(code);
  }

  async deleteExpiredShortViewerLinks(): Promise<number> {
    const now = new Date();
    let deletedCount = 0;
    
    for (const [code, link] of Array.from(this.shortViewerLinks.entries())) {
      if (link.expiresAt && link.expiresAt <= now) {
        this.shortViewerLinks.delete(code);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  // Session Token Methods (Not implemented for MemStorage - tokens are used for production)
  async validateAndConsumeSessionToken(token: string): Promise<{ valid: boolean; linkId?: string; linkType?: string }> {
    console.warn('Session tokens not supported in MemStorage - using in memory storage');
    return { valid: true }; // Allow all access in development mode
  }

  async createSessionToken(linkId: string, linkType: string, expiresAt: Date, userId?: number): Promise<SessionToken> {
    console.warn('Session tokens not supported in MemStorage');
    return {
      id: randomUUID(),
      linkId,
      linkType,
      used: false,
      createdAt: new Date(),
      expiresAt,
      createdBy: userId || null,
    };
  }

  async cleanupExpiredTokens(): Promise<number> {
    console.warn('Token cleanup not needed in MemStorage');
    return 0;
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

  // Viewer Links Methods
  async getAllViewerLinks(): Promise<ViewerLink[]> {
    const now = new Date();
    const allLinks = await db.select().from(viewerLinks);
    
    // Filter out expired links
    return allLinks.filter((link: ViewerLink) => !link.expiresAt || link.expiresAt > now);
  }

  async createViewerLink(insertViewerLink: InsertViewerLink, userId?: number): Promise<ViewerLink> {
    const [viewerLink] = await db
      .insert(viewerLinks)
      .values({
        ...insertViewerLink,
        chatEnabled: insertViewerLink.chatEnabled ?? false,
        createdAt: new Date(),
        expiresAt: insertViewerLink.expiresAt ? new Date(insertViewerLink.expiresAt) : null,
        createdBy: userId || null,
      })
      .returning();
    return viewerLink;
  }

  async deleteViewerLink(id: string): Promise<boolean> {
    // Get the link details before deleting it
    const [deletedLink] = await db.select().from(viewerLinks).where(eq(viewerLinks.id, id));
    
    const result = await db
      .delete(viewerLinks)
      .where(eq(viewerLinks.id, id));
    
    // If link was deleted, also clean up associated short viewer links
    if ((result.rowCount ?? 0) > 0 && deletedLink) {
      await db
        .delete(shortViewerLinks)
        .where(
          and(
            eq(shortViewerLinks.returnFeed, deletedLink.returnFeed),
            eq(shortViewerLinks.chatEnabled, deletedLink.chatEnabled)
          )
        );
    }
    
    return (result.rowCount ?? 0) > 0;
  }

  async deleteExpiredViewerLinks(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(viewerLinks)
      .where(
        and(
          isNotNull(viewerLinks.expiresAt),
          lt(viewerLinks.expiresAt, now)
        )
      );
    return result.rowCount || 0;
  }

  // Short Viewer Links Methods
  async getShortViewerLink(code: string): Promise<ShortViewerLink | undefined> {
    const [link] = await db.select().from(shortViewerLinks).where(eq(shortViewerLinks.id, code));
    
    if (!link) {
      return undefined;
    }
    
    // Check if link has expired
    if (link.expiresAt && link.expiresAt <= new Date()) {
      // Clean up expired link immediately
      await this.deleteShortViewerLink(code);
      return undefined;
    }
    
    return link;
  }

  async getShortViewerLinkByParams(returnFeed: string, chatEnabled: boolean): Promise<ShortViewerLink | undefined> {
    const [link] = await db
      .select()
      .from(shortViewerLinks)
      .where(
        and(
          eq(shortViewerLinks.returnFeed, returnFeed),
          eq(shortViewerLinks.chatEnabled, chatEnabled)
        )
      )
      .limit(1);
    
    if (!link) {
      return undefined;
    }
    
    // Check if link has expired
    if (link.expiresAt && link.expiresAt <= new Date()) {
      // Clean up expired link immediately
      await this.deleteShortViewerLink(link.id);
      return undefined;
    }
    
    return link;
  }

  async createShortViewerLink(insertShortViewerLink: InsertShortViewerLink, userId?: number): Promise<ShortViewerLink> {
    const [shortViewerLink] = await db
      .insert(shortViewerLinks)
      .values({
        ...insertShortViewerLink,
        chatEnabled: insertShortViewerLink.chatEnabled ?? false,
        createdAt: new Date(),
        expiresAt: insertShortViewerLink.expiresAt ? new Date(insertShortViewerLink.expiresAt) : null,
        createdBy: userId || null,
      })
      .returning();
    return shortViewerLink;
  }

  async deleteShortViewerLink(code: string): Promise<boolean> {
    const result = await db
      .delete(shortViewerLinks)
      .where(eq(shortViewerLinks.id, code));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteExpiredShortViewerLinks(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(shortViewerLinks)
      .where(
        and(
          isNotNull(shortViewerLinks.expiresAt),
          lt(shortViewerLinks.expiresAt, now)
        )
      );
    return result.rowCount || 0;
  }

  // Session Token Methods
  async validateAndConsumeSessionToken(token: string): Promise<{ valid: boolean; linkId?: string; linkType?: string }> {
    const [sessionToken] = await db
      .select()
      .from(sessionTokens)
      .where(eq(sessionTokens.id, token));

    if (!sessionToken) {
      return { valid: false };
    }

    // Check if token has expired
    if (sessionToken.expiresAt <= new Date()) {
      // Clean up expired token
      await db.delete(sessionTokens).where(eq(sessionTokens.id, token));
      return { valid: false };
    }

    // Check if token has already been used
    if (sessionToken.used) {
      return { valid: false };
    }

    // Mark token as used (consume it for single-use)
    await db
      .update(sessionTokens)
      .set({ used: true })
      .where(eq(sessionTokens.id, token));

    return {
      valid: true,
      linkId: sessionToken.linkId || undefined,
      linkType: sessionToken.linkType || undefined,
    };
  }

  async createSessionToken(linkId: string, linkType: string, expiresAt: Date, userId?: number): Promise<SessionToken> {
    const tokenId = randomUUID();
    const [token] = await db
      .insert(sessionTokens)
      .values({
        id: tokenId,
        linkId,
        linkType,
        used: false,
        createdAt: new Date(),
        expiresAt,
        createdBy: userId || null,
      })
      .returning();
    return token;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(sessionTokens)
      .where(lt(sessionTokens.expiresAt, now));
    return result.rowCount || 0;
  }
}

export const storage = new DatabaseStorage();
