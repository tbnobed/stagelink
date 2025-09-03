import { users, generatedLinks, shortLinks, viewerLinks, shortViewerLinks, sessionTokens, passwordResetTokens, registrationTokens, chatMessages, chatParticipants, rooms, roomParticipants, roomStreamAssignments, type User, type InsertUser, type GeneratedLink, type InsertGeneratedLink, type ShortLink, type InsertShortLink, type ViewerLink, type InsertViewerLink, type ShortViewerLink, type InsertShortViewerLink, type SessionToken, type InsertSessionToken, type PasswordResetToken, type InsertPasswordResetToken, type RegistrationToken, type InsertRegistrationToken, type ChatMessage, type InsertChatMessage, type ChatParticipant, type InsertChatParticipant, type Room, type InsertRoom, type RoomParticipant, type InsertRoomParticipant, type RoomStreamAssignment, type InsertRoomStreamAssignment } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, lt, and, isNotNull, isNull, desc } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;
  
  // Generated Links
  getAllLinks(): Promise<GeneratedLink[]>;
  getLink(id: string): Promise<GeneratedLink | undefined>;
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
  getViewerLink(id: string): Promise<ViewerLink | undefined>;
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
  
  // Password Reset Tokens
  createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  usePasswordResetToken(token: string): Promise<boolean>;
  cleanupExpiredPasswordResetTokens(): Promise<number>;
  
  // Registration Tokens
  createRegistrationToken(email: string, role: string, token: string, expiresAt: Date, inviterUserId?: number): Promise<RegistrationToken>;
  getRegistrationToken(token: string): Promise<RegistrationToken | undefined>;
  useRegistrationToken(token: string): Promise<boolean>;
  cleanupExpiredRegistrationTokens(): Promise<number>;
  
  // Chat System
  getChatMessages(sessionId: string, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatParticipants(sessionId: string): Promise<ChatParticipant[]>;
  addChatParticipant(participant: InsertChatParticipant): Promise<ChatParticipant>;
  updateParticipantStatus(sessionId: string, userId: number, isOnline: boolean): Promise<void>;
  updateParticipantStatusByUsername(sessionId: string, username: string, isOnline: boolean): Promise<void>;
  removeParticipant(sessionId: string, userId: number): Promise<void>;
  removeParticipantByUsername(sessionId: string, username: string): Promise<void>;
  
  // Room System
  getAllRooms(): Promise<Room[]>;
  getRoom(id: string): Promise<Room | undefined>;
  createRoom(room: InsertRoom, userId?: number): Promise<Room>;
  updateRoom(id: string, updates: Partial<InsertRoom>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<boolean>;
  
  // Room Participants
  getRoomParticipants(roomId: string): Promise<RoomParticipant[]>;
  addRoomParticipant(participant: InsertRoomParticipant): Promise<RoomParticipant>;
  updateRoomParticipantStreaming(roomId: string, userId: number, isStreaming: boolean): Promise<void>;
  updateRoomParticipantStreamingByName(roomId: string, guestName: string, isStreaming: boolean): Promise<void>;
  removeRoomParticipant(roomId: string, userId: number): Promise<void>;
  removeRoomParticipantByName(roomId: string, guestName: string): Promise<void>;
  
  // Room Stream Assignments
  getRoomStreamAssignments(roomId: string): Promise<RoomStreamAssignment[]>;
  createRoomStreamAssignment(assignment: InsertRoomStreamAssignment, userId?: number): Promise<RoomStreamAssignment>;
  updateRoomStreamAssignment(id: number, updates: Partial<InsertRoomStreamAssignment>): Promise<RoomStreamAssignment | undefined>;
  deleteRoomStreamAssignment(id: number): Promise<boolean>;
  getStreamAssignmentByName(roomId: string, streamName: string): Promise<RoomStreamAssignment | undefined>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
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

  async getLink(id: string): Promise<GeneratedLink | undefined> {
    const link = this.links.get(id);
    if (!link) return undefined;
    
    // Check if link has expired
    if (link.expiresAt && link.expiresAt <= new Date()) {
      this.links.delete(id);
      return undefined;
    }
    
    return link;
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
        if (token.linkId === id && token.linkType === 'guest') {
          this.sessionTokens.delete(tokenId);
          console.log('Invalidated session token for deleted link:', tokenId);
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

  async getViewerLink(id: string): Promise<ViewerLink | undefined> {
    const link = this.viewerLinks.get(id);
    if (!link) return undefined;
    
    // Check if link has expired
    if (link.expiresAt && link.expiresAt <= new Date()) {
      this.viewerLinks.delete(id);
      return undefined;
    }
    
    return link;
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
    console.log('Validating session token:', token);
    
    const sessionToken = this.sessionTokens.get(token);
    if (!sessionToken) {
      console.log('Token not found in storage');
      return { valid: false };
    }
    
    // Check if token has expired
    if (sessionToken.expiresAt && new Date() > sessionToken.expiresAt) {
      console.log('Token has expired');
      this.sessionTokens.delete(token);
      return { valid: false };
    }
    
    // Check if the associated link still exists
    if (sessionToken.linkId) {
      if (sessionToken.linkType === 'guest' && !this.links.has(sessionToken.linkId)) {
        console.log('Associated guest link no longer exists, invalidating token');
        this.sessionTokens.delete(token);
        return { valid: false };
      }
      if (sessionToken.linkType === 'viewer' && !this.viewerLinks.has(sessionToken.linkId)) {
        console.log('Associated viewer link no longer exists, invalidating token');
        this.sessionTokens.delete(token);
        return { valid: false };
      }
    }
    
    // Token is valid and can be used multiple times until expiration or deletion
    console.log('Token validated successfully');
    
    return { 
      valid: true, 
      linkId: sessionToken.linkId || undefined, 
      linkType: sessionToken.linkType || undefined 
    };
  }

  async createSessionToken(linkId: string, linkType: string, expiresAt: Date, userId?: number): Promise<SessionToken> {
    const token: SessionToken = {
      id: randomUUID(),
      linkId,
      linkType,
      createdAt: new Date(),
      expiresAt,
      createdBy: userId || null,
    };
    
    // Store the token in the Map
    this.sessionTokens.set(token.id, token);
    console.log('Session token created and stored:', token.id);
    
    return token;
  }

  async cleanupExpiredTokens(): Promise<number> {
    console.warn('Token cleanup not needed in MemStorage');
    return 0;
  }

  // Registration Token Methods - Not implemented in MemStorage
  async createRegistrationToken(email: string, role: string, token: string, expiresAt: Date, inviterUserId?: number): Promise<RegistrationToken> {
    throw new Error('Registration tokens not supported in MemStorage - use DatabaseStorage');
  }

  async getRegistrationToken(token: string): Promise<RegistrationToken | undefined> {
    throw new Error('Registration tokens not supported in MemStorage - use DatabaseStorage');
  }

  async useRegistrationToken(token: string): Promise<boolean> {
    throw new Error('Registration tokens not supported in MemStorage - use DatabaseStorage');
  }

  async cleanupExpiredRegistrationTokens(): Promise<number> {
    throw new Error('Registration tokens not supported in MemStorage - use DatabaseStorage');
  }

  // Password Reset Token Methods - Not implemented in MemStorage  
  async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    throw new Error('Password reset tokens not supported in MemStorage - use DatabaseStorage');
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    throw new Error('Password reset tokens not supported in MemStorage - use DatabaseStorage');
  }

  async usePasswordResetToken(token: string): Promise<boolean> {
    throw new Error('Password reset tokens not supported in MemStorage - use DatabaseStorage');
  }

  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    throw new Error('Password reset tokens not supported in MemStorage - use DatabaseStorage');
  }

  // Chat System Methods - Not implemented in MemStorage
  async getChatMessages(sessionId: string, limit: number = 50): Promise<ChatMessage[]> {
    console.warn('getChatMessages not implemented in MemStorage');
    return [];
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    console.warn('createChatMessage not implemented in MemStorage');
    const chatMessage: ChatMessage = {
      id: Math.floor(Math.random() * 1000000),
      ...message,
      senderId: message.senderId || null,
      recipientId: message.recipientId || null,
      messageType: message.messageType || 'individual',
      createdAt: new Date(),
    };
    return chatMessage;
  }

  async getChatParticipants(sessionId: string): Promise<ChatParticipant[]> {
    console.warn('getChatParticipants not implemented in MemStorage');
    return [];
  }

  async addChatParticipant(participant: InsertChatParticipant): Promise<ChatParticipant> {
    console.warn('addChatParticipant not implemented in MemStorage');
    const chatParticipant: ChatParticipant = {
      id: Math.floor(Math.random() * 1000000),
      ...participant,
      userId: participant.userId || null,
      isOnline: participant.isOnline || true,
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    };
    return chatParticipant;
  }

  async updateParticipantStatus(sessionId: string, userId: number, isOnline: boolean): Promise<void> {
    console.warn('updateParticipantStatus not implemented in MemStorage');
  }

  async updateParticipantStatusByUsername(sessionId: string, username: string, isOnline: boolean): Promise<void> {
    console.warn('updateParticipantStatusByUsername not implemented in MemStorage');
  }

  async removeParticipant(sessionId: string, userId: number): Promise<void> {
    console.warn('removeParticipant not implemented in MemStorage');
  }

  async removeParticipantByUsername(sessionId: string, username: string): Promise<void> {
    console.warn('removeParticipantByUsername not implemented in MemStorage');
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
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
    // Set createdBy to null for links created by this user (preserve links but remove user reference)
    await db.update(generatedLinks)
      .set({ createdBy: null })
      .where(eq(generatedLinks.createdBy, id));
    
    // Set createdBy to null for short links created by this user
    await db.update(shortLinks)
      .set({ createdBy: null })
      .where(eq(shortLinks.createdBy, id));
    
    // Set createdBy to null for viewer links created by this user
    await db.update(viewerLinks)
      .set({ createdBy: null })
      .where(eq(viewerLinks.createdBy, id));
    
    // Set createdBy to null for short viewer links created by this user
    await db.update(shortViewerLinks)
      .set({ createdBy: null })
      .where(eq(shortViewerLinks.createdBy, id));
    
    // Set createdBy to null for session tokens created by this user
    await db.update(sessionTokens)
      .set({ createdBy: null })
      .where(eq(sessionTokens.createdBy, id));
    
    // Set senderId and recipientId to null for chat messages from/to this user
    await db.update(chatMessages)
      .set({ senderId: null })
      .where(eq(chatMessages.senderId, id));
    
    await db.update(chatMessages)
      .set({ recipientId: null })
      .where(eq(chatMessages.recipientId, id));
    
    // Set inviterUserId to null for registration tokens created by this user
    await db.update(registrationTokens)
      .set({ inviterUserId: null })
      .where(eq(registrationTokens.inviterUserId, id));
    
    // Delete chat participants associated with this user
    await db.delete(chatParticipants).where(eq(chatParticipants.userId, id));
    
    // Delete password reset tokens for this user
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, id));
    
    // Finally, delete the user
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

  async getLink(id: string): Promise<GeneratedLink | undefined> {
    try {
      const [link] = await db.select()
        .from(generatedLinks)
        .where(eq(generatedLinks.id, id));
      
      if (!link) return undefined;
      
      // Check if expired
      if (link.expiresAt && link.expiresAt <= new Date()) {
        await db.delete(generatedLinks).where(eq(generatedLinks.id, id));
        return undefined;
      }
      
      return link;
    } catch (error) {
      console.error('Error fetching link:', error);
      return undefined;
    }
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
    
    // If link was deleted, also clean up associated resources
    if ((result.rowCount ?? 0) > 0 && deletedLink) {
      // Delete associated session tokens
      await db
        .delete(sessionTokens)
        .where(
          and(
            eq(sessionTokens.linkId, id),
            eq(sessionTokens.linkType, 'guest')
          )
        );
      
      // Delete associated short links
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

  async getViewerLink(id: string): Promise<ViewerLink | undefined> {
    try {
      const [link] = await db.select()
        .from(viewerLinks)
        .where(eq(viewerLinks.id, id));
      
      if (!link) return undefined;
      
      // Check if expired
      if (link.expiresAt && link.expiresAt <= new Date()) {
        await db.delete(viewerLinks).where(eq(viewerLinks.id, id));
        return undefined;
      }
      
      return link;
    } catch (error) {
      console.error('Error fetching viewer link:', error);
      return undefined;
    }
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
    // First, check the session_tokens table (new system)
    const [sessionToken] = await db
      .select()
      .from(sessionTokens)
      .where(eq(sessionTokens.id, token));

    if (sessionToken) {
      // Check if token has expired
      if (sessionToken.expiresAt <= new Date()) {
        // Clean up expired token
        await db.delete(sessionTokens).where(eq(sessionTokens.id, token));
        return { valid: false };
      }

      // Check if the associated link still exists
      if (sessionToken.linkId) {
        if (sessionToken.linkType === 'guest') {
          const [link] = await db.select().from(generatedLinks).where(eq(generatedLinks.id, sessionToken.linkId));
          if (!link) {
            // Link was deleted, invalidate token
            await db.delete(sessionTokens).where(eq(sessionTokens.id, token));
            return { valid: false };
          }
        }
        if (sessionToken.linkType === 'viewer') {
          const [viewerLink] = await db.select().from(viewerLinks).where(eq(viewerLinks.id, sessionToken.linkId));
          if (!viewerLink) {
            // Viewer link was deleted, invalidate token
            await db.delete(sessionTokens).where(eq(sessionTokens.id, token));
            return { valid: false };
          }
        }
      }

      return {
        valid: true,
        linkId: sessionToken.linkId || undefined,
        linkType: sessionToken.linkType || undefined,
      };
    }

    // If not found in session_tokens, check the legacy system (tokens stored directly in links)
    // Check generated_links table
    const [generatedLink] = await db
      .select()
      .from(generatedLinks)
      .where(eq(generatedLinks.sessionToken, token));

    if (generatedLink) {
      // Check if link has expired
      if (generatedLink.expiresAt && generatedLink.expiresAt <= new Date()) {
        return { valid: false };
      }

      return {
        valid: true,
        linkId: generatedLink.id,
        linkType: 'guest',
      };
    }

    // Check viewer_links table
    const [viewerLink] = await db
      .select()
      .from(viewerLinks)
      .where(eq(viewerLinks.sessionToken, token));

    if (viewerLink) {
      // Check if link has expired
      if (viewerLink.expiresAt && viewerLink.expiresAt <= new Date()) {
        return { valid: false };
      }

      return {
        valid: true,
        linkId: viewerLink.id,
        linkType: 'viewer',
      };
    }

    // Token not found in any table
    return { valid: false };
  }

  async createSessionToken(linkId: string, linkType: string, expiresAt: Date, userId?: number): Promise<SessionToken> {
    const tokenId = randomUUID();
    const [token] = await db
      .insert(sessionTokens)
      .values({
        id: tokenId,
        linkId,
        linkType,
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

  // Password Reset Token Methods
  async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const tokenId = randomUUID();
    const [resetToken] = await db
      .insert(passwordResetTokens)
      .values({
        id: tokenId,
        userId,
        token,
        createdAt: new Date(),
        expiresAt,
        used: false,
      })
      .returning();
    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          lt(new Date(), passwordResetTokens.expiresAt)
        )
      );
    return resetToken;
  }

  async usePasswordResetToken(token: string): Promise<boolean> {
    const result = await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          lt(new Date(), passwordResetTokens.expiresAt)
        )
      );
    return (result.rowCount ?? 0) > 0;
  }

  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(passwordResetTokens)
      .where(
        and(
          lt(passwordResetTokens.expiresAt, now)
        )
      );
    return result.rowCount || 0;
  }

  // Registration Token Methods
  async createRegistrationToken(email: string, role: string, token: string, expiresAt: Date, inviterUserId?: number): Promise<RegistrationToken> {
    const [registrationToken] = await db
      .insert(registrationTokens)
      .values({
        email,
        role: role as 'admin' | 'engineer' | 'user',
        token,
        expiresAt,
        inviterUserId,
        createdAt: new Date(),
      })
      .returning();
    return registrationToken;
  }

  async getRegistrationToken(token: string): Promise<RegistrationToken | undefined> {
    const [registrationToken] = await db
      .select()
      .from(registrationTokens)
      .where(
        and(
          eq(registrationTokens.token, token),
          eq(registrationTokens.used, false),
          lt(new Date(), registrationTokens.expiresAt)
        )
      );
    return registrationToken;
  }

  async useRegistrationToken(token: string): Promise<boolean> {
    const result = await db
      .update(registrationTokens)
      .set({ used: true })
      .where(
        and(
          eq(registrationTokens.token, token),
          eq(registrationTokens.used, false),
          lt(new Date(), registrationTokens.expiresAt)
        )
      );
    return (result.rowCount ?? 0) > 0;
  }

  async cleanupExpiredRegistrationTokens(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(registrationTokens)
      .where(
        and(
          lt(registrationTokens.expiresAt, now)
        )
      );
    return result.rowCount || 0;
  }

  // Chat System Methods
  async getChatMessages(sessionId: string, limit: number = 50): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [chatMessage] = await db
      .insert(chatMessages)
      .values({
        ...message,
        createdAt: new Date(),
      })
      .returning();
    return chatMessage;
  }

  async getChatParticipants(sessionId: string): Promise<ChatParticipant[]> {
    return await db
      .select()
      .from(chatParticipants)
      .where(
        and(
          eq(chatParticipants.sessionId, sessionId),
          eq(chatParticipants.isOnline, true)
        )
      )
      .orderBy(chatParticipants.joinedAt);
  }

  async addChatParticipant(participant: InsertChatParticipant): Promise<ChatParticipant> {
    // Simple create - duplicates are now handled in WebSocket join logic
    const [chatParticipant] = await db
      .insert(chatParticipants)
      .values({
        ...participant,
        joinedAt: new Date(),
        lastSeenAt: new Date(),
      })
      .returning();
    return chatParticipant;
  }

  async updateParticipantStatus(sessionId: string, userId: number, isOnline: boolean): Promise<void> {
    await db
      .update(chatParticipants)
      .set({
        isOnline,
        lastSeenAt: new Date(),
      })
      .where(
        and(
          eq(chatParticipants.sessionId, sessionId),
          eq(chatParticipants.userId, userId)
        )
      );
  }

  async removeParticipant(sessionId: string, userId: number): Promise<void> {
    await db
      .delete(chatParticipants)
      .where(
        and(
          eq(chatParticipants.sessionId, sessionId),
          eq(chatParticipants.userId, userId)
        )
      );
  }

  async removeParticipantByUsername(sessionId: string, username: string): Promise<void> {
    await db
      .delete(chatParticipants)
      .where(
        and(
          eq(chatParticipants.sessionId, sessionId),
          eq(chatParticipants.username, username),
          isNull(chatParticipants.userId) // Only remove guest users
        )
      );
  }

  async updateParticipantStatusByUsername(sessionId: string, username: string, isOnline: boolean): Promise<void> {
    await db.update(chatParticipants)
      .set({
        isOnline,
        lastSeenAt: new Date(),
      })
      .where(
        and(
          eq(chatParticipants.sessionId, sessionId),
          eq(chatParticipants.username, username),
          isNull(chatParticipants.userId) // Only update guest users
        )
      );
  }

  async cleanupDuplicateParticipants(sessionId: string): Promise<void> {
    // Get all participants for this session
    const participants = await db
      .select()
      .from(chatParticipants)
      .where(eq(chatParticipants.sessionId, sessionId))
      .orderBy(chatParticipants.joinedAt);

    // Group by userId
    const userGroups = new Map<number, any[]>();
    for (const participant of participants) {
      if (!userGroups.has(participant.userId)) {
        userGroups.set(participant.userId, []);
      }
      userGroups.get(participant.userId)!.push(participant);
    }

    // Keep the latest entry for each user, delete the rest
    for (const [userId, userParticipants] of userGroups) {
      if (userParticipants.length > 1) {
        // Sort by joinedAt descending to keep the latest
        userParticipants.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
        const toDelete = userParticipants.slice(1); // Keep first (latest), delete rest
        
        for (const participant of toDelete) {
          await db.delete(chatParticipants)
            .where(eq(chatParticipants.id, participant.id));
        }
      }
    }
  }

  // Room System Methods
  async getAllRooms(): Promise<Room[]> {
    return await db.select().from(rooms).orderBy(desc(rooms.createdAt));
  }

  async getRoom(id: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room || undefined;
  }

  async createRoom(insertRoom: InsertRoom, userId?: number): Promise<Room> {
    const [room] = await db
      .insert(rooms)
      .values({
        ...insertRoom,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId || null,
      })
      .returning();
    return room;
  }

  async updateRoom(id: string, updates: Partial<InsertRoom>): Promise<Room | undefined> {
    const [room] = await db
      .update(rooms)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, id))
      .returning();
    return room || undefined;
  }

  async deleteRoom(id: string): Promise<boolean> {
    // Delete room participants first (cascade delete handled by FK constraint)
    await db.delete(roomParticipants).where(eq(roomParticipants.roomId, id));
    
    // Delete room stream assignments
    await db.delete(roomStreamAssignments).where(eq(roomStreamAssignments.roomId, id));
    
    // Delete the room
    const result = await db.delete(rooms).where(eq(rooms.id, id));
    return result.rowCount > 0;
  }

  // Room Participant Methods
  async getRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
    return await db
      .select()
      .from(roomParticipants)
      .where(eq(roomParticipants.roomId, roomId))
      .orderBy(roomParticipants.joinedAt);
  }

  async addRoomParticipant(participant: InsertRoomParticipant): Promise<RoomParticipant> {
    const [newParticipant] = await db
      .insert(roomParticipants)
      .values({
        ...participant,
        joinedAt: new Date(),
        lastSeenAt: new Date(),
      })
      .returning();
    return newParticipant;
  }

  async updateRoomParticipantStreaming(roomId: string, userId: number, isStreaming: boolean): Promise<void> {
    await db
      .update(roomParticipants)
      .set({
        isStreaming,
        lastSeenAt: new Date(),
      })
      .where(
        and(
          eq(roomParticipants.roomId, roomId),
          eq(roomParticipants.userId, userId)
        )
      );
  }

  async updateRoomParticipantStreamingByName(roomId: string, guestName: string, isStreaming: boolean): Promise<void> {
    await db
      .update(roomParticipants)
      .set({
        isStreaming,
        lastSeenAt: new Date(),
      })
      .where(
        and(
          eq(roomParticipants.roomId, roomId),
          eq(roomParticipants.guestName, guestName),
          isNull(roomParticipants.userId) // Only update guest participants
        )
      );
  }

  async removeRoomParticipant(roomId: string, userId: number): Promise<void> {
    await db
      .delete(roomParticipants)
      .where(
        and(
          eq(roomParticipants.roomId, roomId),
          eq(roomParticipants.userId, userId)
        )
      );
  }

  async removeRoomParticipantByName(roomId: string, guestName: string): Promise<void> {
    await db
      .delete(roomParticipants)
      .where(
        and(
          eq(roomParticipants.roomId, roomId),
          eq(roomParticipants.guestName, guestName),
          isNull(roomParticipants.userId) // Only remove guest participants
        )
      );
  }

  // Room Stream Assignment Methods
  async getRoomStreamAssignments(roomId: string): Promise<RoomStreamAssignment[]> {
    return await db
      .select()
      .from(roomStreamAssignments)
      .where(eq(roomStreamAssignments.roomId, roomId))
      .orderBy(roomStreamAssignments.position);
  }

  async createRoomStreamAssignment(assignment: InsertRoomStreamAssignment, userId?: number): Promise<RoomStreamAssignment> {
    console.log('Storage createRoomStreamAssignment called with:', assignment, 'userId:', userId);
    try {
      const [newAssignment] = await db
        .insert(roomStreamAssignments)
        .values({
          ...assignment,
          createdAt: new Date(),
          createdBy: userId || null,
        })
        .returning();
      console.log('Successfully created assignment:', newAssignment);
      return newAssignment;
    } catch (error) {
      console.error('Database insert error:', error);
      throw error;
    }
  }

  async updateRoomStreamAssignment(id: number, updates: Partial<InsertRoomStreamAssignment>): Promise<RoomStreamAssignment | undefined> {
    const [assignment] = await db
      .update(roomStreamAssignments)
      .set(updates)
      .where(eq(roomStreamAssignments.id, id))
      .returning();
    return assignment || undefined;
  }

  async deleteRoomStreamAssignment(id: number): Promise<boolean> {
    const result = await db.delete(roomStreamAssignments).where(eq(roomStreamAssignments.id, id));
    return result.rowCount > 0;
  }

  async getStreamAssignmentByName(roomId: string, streamName: string): Promise<RoomStreamAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(roomStreamAssignments)
      .where(
        and(
          eq(roomStreamAssignments.roomId, roomId),
          eq(roomStreamAssignments.streamName, streamName)
        )
      );
    return assignment || undefined;
  }
}

export const storage = new DatabaseStorage();
